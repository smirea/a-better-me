// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "a-better-me",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.executable(name: "a-better-me", targets: ["App"])],
    targets: [.executableTarget(name: "App")]
)
