import UIKit
import WebKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = PencilViewController()
        window?.makeKeyAndVisible()

        NUSessionPlugin.launchLink = connectionOptions.urlContexts.first?.url.absoluteString ?? ""
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    // pencilnu://plan#… links (the website's "Open in Pencil" button).
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let link = URLContexts.first?.url.absoluteString,
           let quoted = String(data: (try? JSONEncoder().encode(link)) ?? Data(), encoding: .utf8) {
            (window?.rootViewController as? CAPBridgeViewController)?.bridge?.webView?
                .evaluateJavaScript("window.dispatchEvent(new CustomEvent('pencil:link', { detail: \(quoted) }))")
        }
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

class PencilViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NUSessionPlugin())
    }
}

// The Capacitor face of the shared session (NUSessionCore.swift).
@objc(NUSessionPlugin)
public class NUSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NUSessionPlugin"
    public let jsName = "NUSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "forgetSite", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "debugRoute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "launchLink", returnType: CAPPluginReturnPromise)
    ]

    private let core = NUSessionCore()
    // A plan link the app was opened with, until the page asks for it.
    static var launchLink = ""

    public override func load() {
        #if DEBUG
        core.load(dropFolder: FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0])
        #else
        core.load()
        #endif
    }

    private func options(_ call: CAPPluginCall) -> NUSessionCore.Options {
        call.options as? NUSessionCore.Options ?? [:]
    }

    @objc func signIn(_ call: CAPPluginCall) {
        core.signIn(options(call), present: { url, title, donePattern, done in
            let controller = SignInViewController(url: url, title: title, donePattern: donePattern, onDone: done)
            let nav = UINavigationController(rootViewController: controller)
            nav.modalPresentationStyle = .pageSheet
            nav.isModalInPresentation = true
            self.bridge?.viewController?.present(nav, animated: true)
        }, reply: { call.resolve($0) }, fail: { call.reject($0) })
    }

    @objc func request(_ call: CAPPluginCall) {
        core.request(options(call), reply: { call.resolve($0) }, fail: { call.reject($0) })
    }

    @objc func status(_ call: CAPPluginCall) {
        core.status { call.resolve($0) }
    }

    @objc func signOut(_ call: CAPPluginCall) {
        core.signOut { _ in call.resolve() }
    }

    @objc func forgetSite(_ call: CAPPluginCall) {
        core.forgetSite(options(call)) { _ in call.resolve() }
    }

    @objc func launchLink(_ call: CAPPluginCall) {
        var url = NUSessionPlugin.launchLink
        #if DEBUG
        // Development aid: `-link <url>` on the launch command stands in for opening a link.
        if url.isEmpty { url = UserDefaults.standard.string(forKey: "link") ?? "" }
        #endif
        call.resolve(["url": url])
        NUSessionPlugin.launchLink = ""
    }

    // Development aid: `-route /you` on the launch command opens that screen.
    @objc func debugRoute(_ call: CAPPluginCall) {
        #if DEBUG
        call.resolve(["route": UserDefaults.standard.string(forKey: "route") ?? ""])
        #else
        call.resolve(["route": ""])
        #endif
    }
}

class SignInViewController: UIViewController, WKNavigationDelegate {
    private let url: URL
    private let donePattern: NSRegularExpression?
    private let onDone: (String, Bool) -> Void
    private var webView: WKWebView!
    private var finished = false

    init(url: URL, title: String, donePattern: String?, onDone: @escaping (String, Bool) -> Void) {
        self.url = url
        self.donePattern = donePattern.flatMap { try? NSRegularExpression(pattern: $0) }
        self.onDone = onDone
        super.init(nibName: nil, bundle: nil)
        self.title = title
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .cancel, target: self, action: #selector(cancelTapped))
        webView = WKWebView(frame: view.bounds, configuration: WKWebViewConfiguration())
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        view.addSubview(webView)
        webView.load(URLRequest(url: url))
    }

    @objc private func cancelTapped() { finish(completed: false) }

    private func finish(completed: Bool) {
        guard !finished else { return }
        finished = true
        let finalUrl = webView.url?.absoluteString ?? ""
        dismiss(animated: true) { self.onDone(finalUrl, completed) }
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
