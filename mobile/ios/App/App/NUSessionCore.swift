import Foundation
import WebKit
import Security

// CAESAR chooses a phone or desktop page layout when its page session
// starts. The parsers shared with the browser extension know the desktop
// layout, so native requests present themselves as a desktop browser.
private let desktopUserAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15"
private let desktopScreen =
    "width:1440 height:900 pixelratio:2 touch:0 geolocation:1 websockets:1 webworkers:1 datepicker:1 dtpicker:1 timepicker:1 dnd:1 sessionstorage:1 localstorage:1 history:1 canvas:1 svg:1 postmessage:1 hc:0 maf:0"

// The student's Northwestern session. Sign-in happens on Northwestern's own
// pages in a web view; the cookies it leaves are copied into a native HTTP
// session that the app's requests go through, and kept on the device (the
// Keychain on iPhone, a private file on Mac) so the session outlives the app. Nothing is sent anywhere but Northwestern.
//
// Shared by the iPhone app (through its Capacitor plugin) and the Mac app
// (mobile/mac), which each show the sign-in page their own way.
final class NUSessionCore {
    typealias Options = [String: Any]
    typealias Reply = (Options) -> Void
    // Shows a sign-in page and reports the last address and whether the
    // sign-in finished.
    typealias Presenter = (_ url: URL, _ title: String, _ donePattern: String?, _ done: @escaping (String, Bool) -> Void) -> Void

    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        return URLSession(configuration: config)
    }()
    private var jar: HTTPCookieStorage { session.configuration.httpCookieStorage! }
    private var webStore: WKHTTPCookieStore { WKWebsiteDataStore.default().httpCookieStore }
    private var needsImport = true

    // MARK: cookies

    // `dropFolder` is a development aid: a session file left there is moved
    // into the Keychain once, so a test device can reuse a sign-in.
    func load(dropFolder: URL? = nil) {
        if let dropped = dropFolder?.appendingPathComponent("session-cookies.plist"),
           Keychain.read() == nil, let list = NSArray(contentsOf: dropped),
           let data = try? PropertyListSerialization.data(fromPropertyList: list, format: .binary, options: 0) {
            Keychain.write(data)
            try? FileManager.default.removeItem(at: dropped)
        }
        guard let data = Keychain.read(), let list = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [[String: Any]] else { return }
        for item in list {
            var props: [HTTPCookiePropertyKey: Any] = [:]
            for (key, value) in item { props[HTTPCookiePropertyKey(key)] = value }
            if let cookie = HTTPCookie(properties: props) { jar.setCookie(cookie) }
        }
        needsImport = false
    }

    private func saveCookies() {
        let list = (jar.cookies ?? []).compactMap { cookie -> [String: Any]? in
            guard let props = cookie.properties else { return nil }
            var out: [String: Any] = [:]
            for (key, value) in props { out[key.rawValue] = value }
            return out
        }
        if let data = try? PropertyListSerialization.data(fromPropertyList: list, format: .binary, options: 0) {
            Keychain.write(data)
        }
    }

    // Web view -> native session. Runs at first use and after each sign-in.
    private func importCookiesIfNeeded(_ done: @escaping () -> Void) {
        DispatchQueue.main.async {
            guard self.needsImport else { done(); return }
            self.webStore.getAllCookies { cookies in
                for cookie in cookies { self.jar.setCookie(cookie) }
                self.needsImport = false
                self.saveCookies()
                done()
            }
        }
    }

    // Native session -> web view, so a sign-in page sees the same session.
    private func exportCookies(_ done: @escaping () -> Void) {
        let cookies = jar.cookies ?? []
        DispatchQueue.main.async {
            let group = DispatchGroup()
            for cookie in cookies {
                group.enter()
                self.webStore.setCookie(cookie) { group.leave() }
            }
            group.notify(queue: .main, execute: done)
        }
    }

    private func claimDesktopScreen() {
        for cookie in jar.cookies ?? [] where cookie.name == "PS_DEVICEFEATURES" {
            guard var props = cookie.properties else { continue }
            props[.value] = desktopScreen
            if let desktop = HTTPCookie(properties: props) { jar.setCookie(desktop) }
        }
    }

    // Drops CAESAR's page-session cookies but keeps the sign-in, so the next
    // native request starts a new page session as a desktop browser.
    private func resetPeopleSoftSession() {
        for cookie in jar.cookies ?? []
        where cookie.domain == ".northwestern.edu" && cookie.name != "PS_DEVICEFEATURES" {
            jar.deleteCookie(cookie)
        }
    }

    // MARK: methods

    func signIn(_ options: Options, present: @escaping Presenter, reply: @escaping Reply, fail: @escaping (String) -> Void) {
        guard let urlString = options["url"] as? String, let url = URL(string: urlString) else {
            fail("url required"); return
        }
        let title = options["title"] as? String ?? "Northwestern sign-in"
        let reset = options["resetPeopleSoft"] as? Bool ?? false
        exportCookies {
            present(url, title, options["doneUrlPattern"] as? String) { finalUrl, completed in
                self.needsImport = true
                self.importCookiesIfNeeded {
                    if completed && reset { self.resetPeopleSoftSession() }
                    self.claimDesktopScreen()
                    self.saveCookies()
                    reply(["completed": completed, "finalUrl": finalUrl])
                }
            }
        }
    }

    func request(_ options: Options, reply: @escaping Reply, fail: @escaping (String) -> Void) {
        guard let urlString = options["url"] as? String, let url = URL(string: urlString) else {
            fail("url required"); return
        }
        var req = URLRequest(url: url)
        req.httpMethod = options["method"] as? String ?? "GET"
        req.timeoutInterval = (options["timeoutMs"] as? Double ?? 30000) / 1000
        req.setValue(desktopUserAgent, forHTTPHeaderField: "User-Agent")
        for (key, value) in options["headers"] as? [String: Any] ?? [:] {
            if let value = value as? String { req.setValue(value, forHTTPHeaderField: key) }
        }
        if let body = options["body"] as? String { req.httpBody = body.data(using: .utf8) }
        let binary = options["binary"] as? Bool ?? false

        importCookiesIfNeeded {
            self.claimDesktopScreen()
            self.session.dataTask(with: req) { data, response, error in
                if let error = error {
                    reply(["ok": false, "error": error.localizedDescription, "connectionFailed": true])
                    return
                }
                self.saveCookies()
                let http = response as? HTTPURLResponse
                // Development aid: `PENCIL_TRACE=1` prints each request's outcome.
                if ProcessInfo.processInfo.environment["PENCIL_TRACE"] != nil {
                    let body = String(decoding: (data ?? Data()).prefix(900), as: UTF8.self).replacingOccurrences(of: "\n", with: " ")
                    FileHandle.standardError.write("TRACE \(req.httpMethod ?? "") \(urlString) -> \(http?.statusCode ?? 0) \(http?.url?.absoluteString ?? "") :: \(body)\n".data(using: .utf8)!)
                }
                var result: Options = [
                    "ok": true,
                    "status": http?.statusCode ?? 0,
                    "finalUrl": http?.url?.absoluteString ?? urlString,
                    "contentType": http?.value(forHTTPHeaderField: "Content-Type") ?? ""
                ]
                let data = data ?? Data()
                if binary {
                    result["base64"] = data.base64EncodedString()
                } else {
                    result["text"] = String(data: data, encoding: .utf8) ?? String(decoding: data, as: UTF8.self)
                }
                reply(result)
            }.resume()
        }
    }

    func status(reply: @escaping Reply) {
        importCookiesIfNeeded {
            let has = (self.jar.cookies ?? []).contains {
                $0.domain.hasSuffix("caesar.ent.northwestern.edu") && $0.name == "mod_auth_openidc_session"
            }
            reply(["hasCaesarSession": has])
        }
    }

    func signOut(reply: @escaping Reply) {
        for cookie in jar.cookies ?? [] { jar.deleteCookie(cookie) }
        Keychain.clear()
        DispatchQueue.main.async {
            // Only the cookies: the app's own saved data lives in the same store.
            self.webStore.getAllCookies { cookies in
                let group = DispatchGroup()
                for cookie in cookies {
                    group.enter()
                    self.webStore.delete(cookie) { group.leave() }
                }
                group.notify(queue: .main) {
                    self.needsImport = false
                    reply([:])
                }
            }
        }
    }

    // Drops one site's cookies and keeps the rest of the sign-in, so that
    // site starts a new session on the next request.
    func forgetSite(_ options: Options, reply: @escaping Reply) {
        let host = options["host"] as? String ?? ""
        guard !host.isEmpty else { reply([:]); return }
        for cookie in jar.cookies ?? [] where cookie.domain.hasSuffix(host) { jar.deleteCookie(cookie) }
        saveCookies()
        DispatchQueue.main.async {
            self.webStore.getAllCookies { cookies in
                let group = DispatchGroup()
                for cookie in cookies where cookie.domain.hasSuffix(host) {
                    group.enter()
                    self.webStore.delete(cookie) { group.leave() }
                }
                group.notify(queue: .main) { reply([:]) }
            }
        }
    }
}

#if os(macOS)
// On the Mac the session is a file only this user can read, the way browsers
// keep theirs. The Mac Keychain asks for the login password each time an
// app without a developer signature touches it.
private enum Keychain {
    private static let file: URL = {
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Pencil")
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("session")
    }()

    static func read() -> Data? { try? Data(contentsOf: file) }

    static func write(_ data: Data) {
        try? data.write(to: file, options: .atomic)
        try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
    }

    static func clear() { try? FileManager.default.removeItem(at: file) }
}
#else
private enum Keychain {
    private static let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "nu.pencil.app.session",
        kSecAttrAccount as String: "cookies"
    ]

    static func read() -> Data? {
        var q = query
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        return SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess ? out as? Data : nil
    }

    static func write(_ data: Data) {
        let attrs: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        if SecItemUpdate(query as CFDictionary, attrs as CFDictionary) == errSecItemNotFound {
            SecItemAdd(query.merging(attrs) { $1 } as CFDictionary, nil)
        }
    }

    static func clear() {
        SecItemDelete(query as CFDictionary)
    }
}
#endif
