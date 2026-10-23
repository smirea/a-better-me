import Foundation

enum AppEnvironment {
    static var apiURL: URL {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "API_URL") as? String,
              let url = URL(string: value),
              let scheme = url.scheme, ["http", "https"].contains(scheme),
              url.host != nil else {
            fatalError("Missing API_URL. Run env-manager gen --local and build with Xcode or the run launcher.")
        }
        return url
    }
}
