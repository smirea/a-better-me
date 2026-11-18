// swift-tools-version: 6.4
import PackageDescription

// The app builds from App.xcodeproj, which compiles these folders into the App module (Sources/Shared/Core into the
// watch app and widgets too). This package compiles the same files as `Core`, so `swift test` runs their tests on
// the Mac with no simulator and no app build.
let package = Package(
    name: "a-better-me",
    platforms: [.iOS(.v27), .macOS(.v27)],
    dependencies: [
        .package(url: "https://github.com/smirea/sync-engine", branch: "master"),
        .package(url: "https://github.com/groue/GRDB.swift.git", from: "7.11.1"),
    ],
    targets: [
        .target(
            name: "Core",
            dependencies: [
                .product(name: "SyncEngine", package: "sync-engine"),
                .product(name: "GRDB", package: "GRDB.swift"),
            ],
            path: "Sources",
            exclude: ["App", "Watch", "Widgets", "Shared/Resources"],
            sources: ["Core", "Shared/Core"]
        ),
        .testTarget(name: "CoreTests", dependencies: ["Core"], path: "CoreTests"),
    ]
)
