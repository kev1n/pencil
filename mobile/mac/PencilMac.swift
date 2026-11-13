// Pencil for Mac: one window showing the app's own screens (the same web
// bundle the phone apps run), with the Northwestern session held natively by
// NUSessionCore. No Capacitor here: a page address scheme serves the bundle
// from inside the app, and one message handler stands in for the plugin.
import AppKit
import WebKit

private let appScheme = "pencil"
private let paper = NSColor(name: nil) { appearance in
    appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        ? NSColor(srgbRed: 0.09, green: 0.09, blue: 0.08, alpha: 1)
        : NSColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)
}

@main
final class PencilApp: NSObject, NSApplicationDelegate, WKScriptMessageHandlerWithReply, WKUIDelegate, WKNavigationDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private let core = NUSessionCore()
    private var signInSheet: SignInSheet?
    // A plan link the app was opened with, until the page asks for it.
    private var launchLink = ""
    private var pageReady = false

    static func main() {
        let app = NSApplication.shared
        let delegate = PencilApp()
        app.delegate = delegate
        // A screenshot run (`-shot`, development aid) stays out of the Dock
        // and never comes to the front.
        app.setActivationPolicy(UserDefaults.standard.string(forKey: "shot") == nil ? .regular : .accessory)
        app.run()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        #if DEBUG
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Pencil")
        core.load(dropFolder: support)
        #else
        core.load()
        #endif

        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleFiles(), forURLScheme: appScheme)
        config.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "pencil")
        #if DEBUG
        // Page errors are kept so the `-shot` aid can print them.
        config.userContentController.addUserScript(WKUserScript(
            source: "window.__errors=[];addEventListener('error',e=>__errors.push(String(e.message)+' '+(e.filename||'')+':'+e.lineno));addEventListener('unhandledrejection',e=>__errors.push('rejected: '+String(e.reason&&e.reason.stack||e.reason)));",
            injectionTime: .atDocumentStart, forMainFrameOnly: true))
        #endif
        webView = WKWebView(frame: .zero, configuration: config)
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")
        #if DEBUG
        if #available(macOS 13.3, *) { webView.isInspectable = true }
        #endif

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1480, height: 860),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false)
        window.title = "Pencil"
        window.titlebarAppearsTransparent = true
        window.backgroundColor = paper
        window.minSize = NSSize(width: 420, height: 520)
        window.contentView = webView
        NSApp.mainMenu = makeMenu()
        if UserDefaults.standard.string(forKey: "shot") == nil {
            window.center()
            window.setFrameAutosaveName("Pencil")
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        } else {
            // Off the screen and behind everything, so it takes no focus.
            // `-width 402 -height 874` gives the shot a phone's shape.
            let wide = UserDefaults.standard.double(forKey: "width"), tall = UserDefaults.standard.double(forKey: "height")
            if wide > 0 && tall > 0 {
                window.minSize = NSSize(width: 320, height: 480)
                window.setContentSize(NSSize(width: wide, height: tall))
            }
            window.setFrameOrigin(NSPoint(x: -30000, y: -30000))
            window.orderBack(nil)
        }
        webView.load(URLRequest(url: URL(string: "\(appScheme)://app/index.html")!))

        #if DEBUG
        // Development aid: `-link <plan link>` acts as if the app was opened with it.
        if launchLink.isEmpty { launchLink = UserDefaults.standard.string(forKey: "link") ?? "" }
        // Development aid: `-shot /tmp/x.png -after 6` saves a picture of the
        // window's page after that many seconds and quits.
        if let path = UserDefaults.standard.string(forKey: "shot") {
            let wait = max(1, UserDefaults.standard.double(forKey: "after"))
            DispatchQueue.main.asyncAfter(deadline: .now() + wait) {
                self.webView.evaluateJavaScript("JSON.stringify(window.__errors||[])") { errors, _ in
                    if let errors = errors as? String, errors != "[]" { print("page errors: \(errors)") }
                }
                self.webView.takeSnapshot(with: nil) { image, _ in
                    if let tiff = image?.tiffRepresentation, let png = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:]) {
                        try? png.write(to: URL(fileURLWithPath: path))
                    }
                    NSApp.terminate(nil)
                }
            }
        }
        #endif
    }

    // pencilnu://plan#… links (the website's "Open in Pencil" button).
    func application(_ application: NSApplication, open urls: [URL]) {
        guard let link = urls.first?.absoluteString else { return }
        if pageReady { send("link", link) } else { launchLink = link }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    // MARK: the page's calls

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        let body = message.body as? [String: Any] ?? [:]
        let options = body["options"] as? NUSessionCore.Options ?? [:]
        let reply: NUSessionCore.Reply = { result in DispatchQueue.main.async { replyHandler(result, nil) } }
        let fail: (String) -> Void = { text in DispatchQueue.main.async { replyHandler(nil, text) } }
        switch body["method"] as? String {
        case "signIn":
            core.signIn(options, present: { url, title, donePattern, done in
                let sheet = SignInSheet(url: url, title: title, donePattern: donePattern) { finalUrl, completed in
                    self.signInSheet = nil
                    done(finalUrl, completed)
                }
                self.signInSheet = sheet
                sheet.show(over: self.window)
            }, reply: reply, fail: fail)
        case "request": core.request(options, reply: reply, fail: fail)
        case "status": core.status(reply: reply)
        case "signOut": core.signOut(reply: reply)
        case "forgetSite": core.forgetSite(options, reply: reply)
        case "appearance":
            let mode = options["mode"] as? String
            window.appearance = mode == "dark" ? NSAppearance(named: .darkAqua) : mode == "light" ? NSAppearance(named: .aqua) : nil
            reply([:])
        case "launchLink":
            pageReady = true
            reply(["url": launchLink])
            launchLink = ""
        case "debugRoute":
            #if DEBUG
            reply(["route": UserDefaults.standard.string(forKey: "route") ?? ""])
            #else
            reply(["route": ""])
            #endif
        default: fail("unknown method")
        }
    }

    // Links that leave the app open in the browser.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = action.request.url, url.scheme != appScheme, action.targetFrame?.isMainFrame == true {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow)
        }
    }

    // MARK: menus

    private func makeMenu() -> NSMenu {
        let main = NSMenu()
        func add(_ title: String, _ items: [NSMenuItem]) {
            let item = NSMenuItem()
            let menu = NSMenu(title: title)
            items.forEach(menu.addItem)
            item.submenu = menu
            main.addItem(item)
        }
        func item(_ title: String, _ action: Selector?, _ key: String = "", shift: Bool = false) -> NSMenuItem {
            let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
            if shift { item.keyEquivalentModifierMask = [.command, .shift] }
            return item
        }
        add("Pencil", [
            item("About Pencil", #selector(NSApplication.orderFrontStandardAboutPanel(_:))),
            .separator(),
            item("Hide Pencil", #selector(NSApplication.hide(_:)), "h"),
            item("Quit Pencil", #selector(NSApplication.terminate(_:)), "q")
        ])
        add("Edit", [
            item("Undo", Selector(("undo:")), "z"),
            item("Redo", Selector(("redo:")), "z", shift: true),
            .separator(),
            item("Cut", #selector(NSText.cut(_:)), "x"),
            item("Copy", #selector(NSText.copy(_:)), "c"),
            item("Paste", #selector(NSText.paste(_:)), "v"),
            item("Select All", #selector(NSText.selectAll(_:)), "a"),
            .separator(),
            item("Find Classes", #selector(findClasses), "f")
        ])
        add("View", [
            item("Schedule", #selector(showSchedule), "1"),
            item("Search", #selector(showSearch), "2"),
            item("You", #selector(showYou), "3"),
            .separator(),
            item("Reload", #selector(reload), "r")
        ])
        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(item("Minimize", #selector(NSWindow.performMiniaturize(_:)), "m"))
        windowMenu.addItem(item("Zoom", #selector(NSWindow.performZoom(_:))))
        windowMenu.addItem(item("Close", #selector(NSWindow.performClose(_:)), "w"))
        let windowItem = NSMenuItem()
        windowItem.submenu = windowMenu
        main.addItem(windowItem)
        NSApp.windowsMenu = windowMenu
        return main
    }

    // The page listens for these (src/App.tsx).
    private func send(_ name: String, _ detail: String = "") {
        let quoted = String(data: (try? JSONEncoder().encode(detail)) ?? Data("\"\"".utf8), encoding: .utf8)!
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('pencil:\(name)', { detail: \(quoted) }))")
    }

    @objc private func showSchedule() { send("go", "schedule") }
    @objc private func showSearch() { send("go", "search") }
    @objc private func showYou() { send("go", "you") }
    @objc private func findClasses() { send("find") }
    @objc private func reload() { webView.reload() }
}

// Serves the web bundle (Contents/Resources/dist) to the page.
private final class BundleFiles: NSObject, WKURLSchemeHandler {
    private let root = Bundle.main.resourceURL!.appendingPathComponent("dist")
    private let types = [
        "html": "text/html", "js": "text/javascript", "css": "text/css", "json": "application/json",
        "svg": "image/svg+xml", "png": "image/png", "woff2": "font/woff2", "ico": "image/x-icon"
    ]

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        let url = task.request.url!
        let path = url.path.isEmpty || url.path == "/" ? "/index.html" : url.path
        let file = root.appendingPathComponent(path).standardizedFileURL
        guard file.path.hasPrefix(root.path), let data = try? Data(contentsOf: file) else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        let type = types[file.pathExtension] ?? "application/octet-stream"
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: [
            "Content-Type": type, "Content-Length": "\(data.count)", "Cache-Control": "no-cache"
        ])!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

// Northwestern's own sign-in page, as a sheet on the window.
private final class SignInSheet: NSObject, WKNavigationDelegate {
    private let url: URL
    private let donePattern: NSRegularExpression?
    private let onDone: (String, Bool) -> Void
    private let panel: NSWindow
    private let webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
    private weak var parent: NSWindow?
    private var finished = false

    init(url: URL, title: String, donePattern: String?, onDone: @escaping (String, Bool) -> Void) {
        self.url = url
        self.donePattern = donePattern.flatMap { try? NSRegularExpression(pattern: $0) }
        self.onDone = onDone
        panel = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 560, height: 700), styleMask: [.titled], backing: .buffered, defer: false)
        super.init()

        let label = NSTextField(labelWithString: title)
        label.font = .systemFont(ofSize: 13, weight: .semibold)
        let cancel = NSButton(title: "Cancel", target: self, action: #selector(cancelTapped))
        cancel.keyEquivalent = "\u{1b}"
        let bar = NSStackView(views: [label, NSView(), cancel])
        bar.edgeInsets = NSEdgeInsets(top: 10, left: 16, bottom: 10, right: 12)
        let stack = NSStackView(views: [bar, webView])
        stack.orientation = .vertical
        stack.spacing = 0
        panel.contentView = stack
        webView.navigationDelegate = self
    }

    func show(over window: NSWindow) {
        parent = window
        window.beginSheet(panel)
        webView.load(URLRequest(url: url))
    }

    @objc private func cancelTapped() { finish(completed: false) }

    private func finish(completed: Bool) {
        guard !finished else { return }
        finished = true
        let finalUrl = webView.url?.absoluteString ?? ""
        parent?.endSheet(panel)
        onDone(finalUrl, completed)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard let pattern = donePattern, let current = webView.url?.absoluteString else { return }
        let range = NSRange(current.startIndex..., in: current)
        if pattern.firstMatch(in: current, range: range) != nil {
            // Let the page set its own script cookies before closing.
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { self.finish(completed: true) }
        }
    }
}
