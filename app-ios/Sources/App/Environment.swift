import Foundation

enum AppEnvironment {
    static var apiURL: URL {
        guard let url = URL(string: setting("API_URL")),
              let scheme = url.scheme, ["http", "https"].contains(scheme),
              url.host != nil else {
            fatalError("API_URL is not an http(s) URL. Run env-manager gen --local, and bun run env:ios before a Release build.")
        }
        return url
    }

    /// Bundled at build time: Debug uses the local servers' development token, Release env-manager prod's.
    static var ownerToken: String {
        let token = setting("OWNER_TOKEN")
        if token.isEmpty { fatalError("Missing OWNER_TOKEN. Run bun run env:ios before a Release build.") }
        return token
    }

    /// Sentry project `a-better-me-ios`: Debug takes env-manager dev's through `LocalSecrets.xcconfig`, Release prod's
    /// through `bun run env:ios`. Empty, as in CI and fresh worktrees, reports nothing.
    static var sentryDSN: String? {
        let dsn = setting("SENTRY_DSN_IOS")
        return dsn.isEmpty ? nil : dsn
    }

    private static func setting(_ key: String) -> String {
        (Bundle.main.object(forInfoDictionaryKey: key) as? String)?.trimmingCharacters(in: .whitespaces) ?? ""
    }
}
