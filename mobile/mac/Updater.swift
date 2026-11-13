// Keeps the Mac app current. At launch it asks pencil.nu which version the
// download button gives out (the address `/download/mac` forwards to names
// it), and when that is newer it fetches the disk image, checks the app
// inside carries this developer's signature, and offers to restart into it.
// Pointing that address at a new release is what rolls an update out.
import AppKit
import Security

private let downloadPage = URL(string: "https://www.pencil.nu/download/mac")!
// Only an app signed by this team, under this name, may replace this one.
private let signedByUs =
    "identifier \"nu.pencil.app.mac\" and anchor apple generic and certificate leaf[subject.OU] = \"XGF7764L2K\""

final class Updater: NSObject, URLSessionTaskDelegate {
    private let app = Bundle.main.bundleURL
    private var current: String { Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0" }
    private var forwardedTo: URL?

    func check(over window: NSWindow) {
        // A copy run from the disk image or from a folder this user cannot
        // change has nowhere to put an update.
        guard !app.path.contains("/AppTranslocation/"), !app.path.hasPrefix("/Volumes/"),
              FileManager.default.isWritableFile(atPath: app.deletingLastPathComponent().path) else { return }
        let session = URLSession(configuration: .ephemeral, delegate: self, delegateQueue: nil)
        session.dataTask(with: downloadPage) { _, _, _ in
            session.finishTasksAndInvalidate()
            guard let image = self.forwardedTo, let version = self.version(in: image.absoluteString),
                  self.isNewer(version) else { return }
            URLSession.shared.downloadTask(with: image) { file, _, _ in
                guard let file = file, let ready = self.unpack(file) else { return }
                DispatchQueue.main.async { self.offer(ready, version: version, over: window) }
            }.resume()
        }.resume()
    }

    // The forwarding address is the answer; the file itself is fetched later.
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        forwardedTo = request.url
        completionHandler(nil)
    }

    private func version(in address: String) -> String? {
        guard let match = address.range(of: #"mac-v[0-9.]+"#, options: .regularExpression) else { return nil }
        return String(address[match].dropFirst(5))
    }

    private func isNewer(_ version: String) -> Bool {
        version.compare(current, options: .numeric) == .orderedDescending
    }

    // Opens the disk image, checks the app inside, and copies it next to the
    // installed one so swapping them is a single step.
    private func unpack(_ image: URL) -> URL? {
        let files = FileManager.default
        let mount = files.temporaryDirectory.appendingPathComponent("pencil-update-\(UUID().uuidString)")
        guard run("/usr/bin/hdiutil", ["attach", "-nobrowse", "-readonly", "-noautoopen", "-mountpoint", mount.path, image.path]) else { return nil }
        defer { _ = run("/usr/bin/hdiutil", ["detach", "-force", mount.path]) }
        let found = mount.appendingPathComponent("Pencil.app")
        guard isOurs(found), let version = Bundle(url: found)?.infoDictionary?["CFBundleShortVersionString"] as? String,
              isNewer(version),
              let holding = try? files.url(for: .itemReplacementDirectory, in: .userDomainMask, appropriateFor: app, create: true)
        else { return nil }
        let ready = holding.appendingPathComponent("Pencil.app")
        guard (try? files.copyItem(at: found, to: ready)) != nil, isOurs(ready) else { return nil }
        return ready
    }

    private func isOurs(_ bundle: URL) -> Bool {
        var code: SecStaticCode?
        var rule: SecRequirement?
        guard SecStaticCodeCreateWithPath(bundle as CFURL, [], &code) == errSecSuccess, let code = code,
              SecRequirementCreateWithString(signedByUs as CFString, [], &rule) == errSecSuccess, let rule = rule
        else { return false }
        let strict = SecCSFlags(rawValue: kSecCSCheckAllArchitectures | kSecCSCheckNestedCode | kSecCSStrictValidate)
        return SecStaticCodeCheckValidity(code, strict, rule) == errSecSuccess
    }

    private func offer(_ ready: URL, version: String, over window: NSWindow) {
        // Development aid: `PENCIL_UPDATE=now` installs without asking.
        if ProcessInfo.processInfo.environment["PENCIL_UPDATE"] == "now" { install(ready); return }
        let alert = NSAlert()
        alert.messageText = "A new version of Pencil is ready"
        alert.informativeText = "Pencil \(version) has been downloaded. Restart to start using it."
        alert.addButton(withTitle: "Restart now")
        alert.addButton(withTitle: "Later")
        alert.beginSheetModal(for: window) { answer in
            if answer == .alertFirstButtonReturn { self.install(ready) }
        }
    }

    private func install(_ ready: URL) {
        guard (try? FileManager.default.replaceItemAt(app, withItemAt: ready)) != nil else { return }
        // Opens the new copy once this one has quit.
        let reopen = Process()
        reopen.executableURL = URL(fileURLWithPath: "/bin/sh")
        reopen.arguments = ["-c", "while kill -0 \"$0\" 2>/dev/null; do sleep 0.2; done; open \"$1\"",
                            String(ProcessInfo.processInfo.processIdentifier), app.path]
        try? reopen.run()
        NSApp.terminate(nil)
    }

    private func run(_ tool: String, _ arguments: [String]) -> Bool {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: tool)
        process.arguments = arguments
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        guard (try? process.run()) != nil else { return false }
        process.waitUntilExit()
        return process.terminationStatus == 0
    }
}
