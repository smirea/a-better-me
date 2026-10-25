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

    /// Where the app downloads its catalog images and Markdown. Debug reads the worktree's dev server at
    /// `$(API_URL)/assets` without credentials; Release reads the private R2 bucket with env-manager prod's read-only
    /// credentials through `bun run env:ios`. An empty URL turns downloads off and the catalog shows its placeholders.
    static var assets: AssetSource? {
        let version = setting("ASSETS_VERSION")
        guard version.utf8.count == 16, version.utf8.allSatisfy({ (48...57).contains($0) || (97...102).contains($0) }) else {
            fatalError("ASSETS_VERSION is not 16 hex characters. Run bun run assets version.")
        }
        let (url, accessKeyID, secretAccessKey) = (setting("ASSETS_URL"), setting("ASSETS_ACCESS_KEY_ID"), setting("ASSETS_SECRET_ACCESS_KEY"))
        if url.isEmpty { return nil }
        guard let base = URL(string: url), let scheme = base.scheme, ["http", "https"].contains(scheme), base.host != nil else {
            fatalError("ASSETS_URL is not an http(s) URL. Run env-manager gen --local, and bun run env:ios before a Release build.")
        }
        if accessKeyID.isEmpty != secretAccessKey.isEmpty {
            fatalError("Set both ASSETS_ACCESS_KEY_ID and ASSETS_SECRET_ACCESS_KEY or neither. Run bun run env:ios before a Release build.")
        }
        return AssetSource(
            url: base,
            version: version,
            credentials: accessKeyID.isEmpty ? nil : S3Credentials(accessKeyID: accessKeyID, secretAccessKey: secretAccessKey),
            downloadsAutomatically: !isDebug
        )
    }

    private static var isDebug: Bool {
        #if DEBUG
        true
        #else
        false
        #endif
    }

    private static func setting(_ key: String) -> String {
        (Bundle.main.object(forInfoDictionaryKey: key) as? String)?.trimmingCharacters(in: .whitespaces) ?? ""
    }
}

struct AssetSource: Sendable {
    /// The bucket's S3 URL, `https://<account>.r2.cloudflarestorage.com/a-better-me-assets`, or the dev server's
    /// `/assets`, which serves the same layout.
    let url: URL
    let version: String
    /// Nil for the dev server, which takes unsigned requests.
    let credentials: S3Credentials?
    /// False in Debug, so development builds download only when the More row is tapped.
    let downloadsAutomatically: Bool
}
