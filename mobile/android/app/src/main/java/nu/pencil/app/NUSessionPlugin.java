package nu.pencil.app;

import android.app.Dialog;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

// The student's Northwestern session on Android. Sign-in happens on
// Northwestern's own pages in a web view; requests then go out natively
// carrying the cookies that sign-in left in the system cookie store.
// Nothing is sent anywhere but Northwestern.
@CapacitorPlugin(name = "NUSession")
public class NUSessionPlugin extends Plugin {
    private static final String CAESAR = "https://caesar.ent.northwestern.edu/";
    // CAESAR chooses a phone or desktop page layout when its page session
    // starts. The parsers shared with the browser extension know the desktop
    // layout, so native requests present themselves as a desktop browser.
    private static final String DESKTOP_UA =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
    private static final String DESKTOP_SCREEN =
        "width:1440 height:900 pixelratio:2 touch:0 geolocation:1 websockets:1 webworkers:1 datepicker:1 dtpicker:1 timepicker:1 dnd:1 sessionstorage:1 localstorage:1 history:1 canvas:1 svg:1 postmessage:1 hc:0 maf:0";

    private final ExecutorService network = Executors.newFixedThreadPool(4);
    private final Handler main = new Handler(Looper.getMainLooper());
    private final CookieManager cookies = CookieManager.getInstance();

    private void claimDesktopScreen() {
        String all = cookies.getCookie(CAESAR);
        if (all == null || !all.contains("PS_DEVICEFEATURES=")) return;
        cookies.setCookie(CAESAR, "PS_DEVICEFEATURES=" + DESKTOP_SCREEN + "; Domain=.northwestern.edu; Path=/");
    }

    // Drops CAESAR's page-session cookies but keeps the sign-in, so the next
    // native request starts a new page session as a desktop browser. Expiring
    // by domain leaves CAESAR's own host cookies (the sign-in) alone.
    private void resetPeopleSoftSession() {
        String all = cookies.getCookie(CAESAR);
        if (all == null) return;
        for (String pair : all.split(";")) {
            String name = pair.trim().split("=", 2)[0];
            if (name.isEmpty() || name.equals("PS_DEVICEFEATURES")) continue;
            cookies.setCookie(CAESAR, name + "=; Domain=.northwestern.edu; Path=/; Max-Age=0");
        }
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        String url = call.getString("url");
        if (url == null) { call.reject("url required"); return; }
        String title = call.getString("title", "Northwestern sign-in");
        String donePattern = call.getString("doneUrlPattern");
        boolean reset = Boolean.TRUE.equals(call.getBoolean("resetPeopleSoft", false));
        Pattern pattern = donePattern == null ? null : Pattern.compile(donePattern);

        main.post(() -> {
            Dialog dialog = new Dialog(getActivity(), android.R.style.Theme_DeviceDefault_Light_NoActionBar);
            dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

            LinearLayout root = new LinearLayout(getContext());
            root.setOrientation(LinearLayout.VERTICAL);
            root.setBackgroundColor(Color.WHITE);
            root.setFitsSystemWindows(true);

            LinearLayout bar = new LinearLayout(getContext());
            bar.setOrientation(LinearLayout.HORIZONTAL);
            Button cancel = new Button(getContext(), null, android.R.attr.borderlessButtonStyle);
            cancel.setText("Cancel");
            TextView heading = new TextView(getContext());
            heading.setText(title);
            heading.setTextSize(18);
            heading.setTextColor(Color.BLACK);
            heading.setPadding(16, 0, 0, 0);
            heading.setGravity(android.view.Gravity.CENTER_VERTICAL);
            bar.addView(cancel, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            bar.addView(heading, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.MATCH_PARENT));
            root.addView(bar);

            WebView web = new WebView(getContext());
            web.getSettings().setJavaScriptEnabled(true);
            web.getSettings().setDomStorageEnabled(true);
            cookies.setAcceptThirdPartyCookies(web, true);
            root.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

            final boolean[] finished = { false };
            class Closer {
                void close(boolean completed) {
                    if (finished[0]) return;
                    finished[0] = true;
                    String finalUrl = web.getUrl() == null ? "" : web.getUrl();
                    dialog.dismiss();
                    web.destroy();
                    cookies.flush();
                    if (completed && reset) resetPeopleSoftSession();
                    claimDesktopScreen();
                    cookies.flush();
                    JSObject out = new JSObject();
                    out.put("completed", completed);
                    out.put("finalUrl", finalUrl);
                    call.resolve(out);
                }
            }
            Closer closer = new Closer();

            web.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String loaded) {
                    if (pattern != null && loaded != null && pattern.matcher(loaded).find()) {
                        // Let the page set its own script cookies before closing.
                        main.postDelayed(() -> closer.close(true), 1200);
                    }
                }
            });
            cancel.setOnClickListener(v -> closer.close(false));
            dialog.setOnCancelListener(d -> closer.close(false));
            dialog.setContentView(root);
            dialog.show();
            web.loadUrl(url);
        });
    }

    @PluginMethod
    public void request(PluginCall call) {
        String url = call.getString("url");
        if (url == null) { call.reject("url required"); return; }
        String method = call.getString("method", "GET");
        JSObject headers = call.getObject("headers", new JSObject());
        String body = call.getString("body");
        int timeout = call.getInt("timeoutMs", 30000);
        boolean binary = Boolean.TRUE.equals(call.getBoolean("binary", false));

        network.execute(() -> {
            JSObject out = new JSObject();
            try {
                claimDesktopScreen();
                String current = url;
                String verb = method;
                String payload = body;
                HttpURLConnection conn = null;
                // Redirects are followed by hand so each hop gets, and sets,
                // the right cookies.
                for (int hop = 0; hop < 25; hop++) {
                    conn = (HttpURLConnection) new URL(current).openConnection();
                    conn.setInstanceFollowRedirects(false);
                    conn.setConnectTimeout(timeout);
                    conn.setReadTimeout(timeout);
                    conn.setRequestMethod(verb);
                    conn.setRequestProperty("User-Agent", DESKTOP_UA);
                    if (hop == 0) {
                        Iterator<String> keys = headers.keys();
                        while (keys.hasNext()) {
                            String key = keys.next();
                            conn.setRequestProperty(key, headers.getString(key));
                        }
                    }
                    String jar = cookies.getCookie(current);
                    if (jar != null) conn.setRequestProperty("Cookie", jar);
                    if (payload != null && !verb.equals("GET")) {
                        conn.setDoOutput(true);
                        try (OutputStream os = conn.getOutputStream()) {
                            os.write(payload.getBytes(StandardCharsets.UTF_8));
                        }
                    }
                    int status = conn.getResponseCode();
                    for (Map.Entry<String, List<String>> header : conn.getHeaderFields().entrySet()) {
                        if (header.getKey() != null && header.getKey().equalsIgnoreCase("Set-Cookie")) {
                            for (String value : header.getValue()) cookies.setCookie(current, value);
                        }
                    }
                    String location = conn.getHeaderField("Location");
                    if (status >= 300 && status < 400 && location != null) {
                        current = new URL(new URL(current), location).toString();
                        if (status != 307 && status != 308) { verb = "GET"; payload = null; }
                        conn.disconnect();
                        continue;
                    }
                    break;
                }
                cookies.flush();
                int status = conn.getResponseCode();
                InputStream in = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                if (in != null) {
                    byte[] buffer = new byte[16384];
                    int read;
                    while ((read = in.read(buffer)) != -1) bytes.write(buffer, 0, read);
                    in.close();
                }
                String type = conn.getContentType();
                out.put("ok", true);
                out.put("status", status);
                out.put("finalUrl", current);
                out.put("contentType", type == null ? "" : type);
                if (binary) out.put("base64", Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP));
                else out.put("text", new String(bytes.toByteArray(), StandardCharsets.UTF_8));
            } catch (Exception error) {
                out.put("ok", false);
                out.put("error", String.valueOf(error.getMessage()));
                out.put("connectionFailed", true);
            }
            call.resolve(out);
        });
    }

    @PluginMethod
    public void status(PluginCall call) {
        String all = cookies.getCookie(CAESAR);
        JSObject out = new JSObject();
        out.put("hasCaesarSession", all != null && all.contains("mod_auth_openidc_session="));
        call.resolve(out);
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        cookies.removeAllCookies(done -> {
            cookies.flush();
            call.resolve();
        });
    }

    // The plan link the app was opened with, once.
    @PluginMethod
    public void launchLink(PluginCall call) {
        android.content.Intent intent = getActivity().getIntent();
        android.net.Uri link = intent == null ? null : intent.getData();
        JSObject out = new JSObject();
        out.put("url", link == null ? "" : link.toString());
        if (intent != null) intent.setData(null);
        call.resolve(out);
    }

    // Development aid: `adb shell am start -n nu.pencil.app/.MainActivity -e route /you`.
    @PluginMethod
    public void debugRoute(PluginCall call) {
        JSObject out = new JSObject();
        boolean debuggable = (getContext().getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        String route = debuggable ? getActivity().getIntent().getStringExtra("route") : null;
        out.put("route", route == null ? "" : route);
        call.resolve(out);
    }
}
