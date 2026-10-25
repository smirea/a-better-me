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

    /// The private R2 bucket the app downloads its catalog images and Markdown from, with read-only credentials. Debug
    /// takes env-manager dev's through `LocalSecrets.xcconfig`, Release prod's through `bun run env:ios`. Empty, as in
    /// CI and fresh worktrees, turns downloads off and the catalog shows its placeholders.
    static var assets: AssetSource? {
        let version = setting("ASSETS_VERSION")
        guard version.utf8.count == 16, version.utf8.allSatisfy({ (48...57).contains($0) || (97...102).contains($0) }) else {
            fatalError("ASSETS_VERSION is not 16 hex characters. Run bun run assets version.")
        }
        let (url, accessKeyID, secretAccessKey) = (setting("ASSETS_URL"), setting("ASSETS_ACCESS_KEY_ID"), setting("ASSETS_SECRET_ACCESS_KEY"))
        if url.isEmpty || accessKeyID.isEmpty || secretAccessKey.isEmpty { return nil }
        guard let bucket = URL(string: url), bucket.scheme == "https", bucket.host != nil else {
            fatalError("ASSETS_URL is not an https URL. Run env-manager gen --local, and bun run env:ios before a Release build.")
        }
        return AssetSource(
            url: bucket,
            version: version,
            credentials: S3Credentials(accessKeyID: accessKeyID, secretAccessKey: secretAccessKey)
        )
    }

    private static func setting(_ key: String) -> String {
        (Bundle.main.object(forInfoDictionaryKey: key) as? String)?.trimmingCharacters(in: .whitespaces) ?? ""
    }
}

struct AssetSource: Sendable {
    /// The bucket's S3 URL, `https://<account>.r2.cloudflarestorage.com/a-better-me-assets`.
    let url: URL
    let version: String
    let credentials: S3Credentials
}
