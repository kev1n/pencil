package nu.pencil.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NUSessionPlugin.class);
        super.onCreate(savedInstanceState);
    }

    // pencilnu://plan#… links arriving while the app is open.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent.getData() == null || getBridge() == null) return;
        String link = JSONObject.quote(intent.getData().toString());
        getBridge().eval("window.dispatchEvent(new CustomEvent('pencil:link', { detail: " + link + " }))", null);
    }
}
