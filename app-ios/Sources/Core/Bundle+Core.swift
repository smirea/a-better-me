import Foundation

extension Bundle {
    /// Where `Sources/CoreResources` lands: the app's bundle, which Xcode copies them into, or the package's under `swift test`.
    static var core: Bundle {
        #if SWIFT_PACKAGE
        .module
        #else
        .main
        #endif
    }
}
