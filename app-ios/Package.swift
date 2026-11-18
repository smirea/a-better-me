// swift-tools-version: 6.4
import Foundation
import PackageDescription

// The app builds from App.xcodeproj, which compiles these folders into the App module (Sources/Shared/Core into the
// watch app and widgets too). This package compiles the same files as `Core`, so `swift test` runs their tests on
// the Mac with no simulator and no app build.
// Everything in Sources/Shared but its Core folder is app code: SwiftPM would warn about each file it neither builds nor
// bundles.
let sharedAppCode = ((try? FileManager.default.contentsOfDirectory(atPath: Context.packageDirectory + "/Sources/Shared")) ?? [])
    .filter { $0 != "Core" && !$0.hasPrefix(".") }
    .map { "Shared/\($0)" }

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
            exclude: ["App", "Watch", "Widgets"] + sharedAppCode,
            sources: ["Core", "Shared/Core"],
            resources: [.process("CoreResources")],
            // Optimized in debug too: unoptimized, the transfer round trips and the program generator's calibration took
            // the suite to 15 s, over the commit hook's budget; optimized it runs in about 5. `assert` is off as a result;
            // `precondition` still traps.
            swiftSettings: [.unsafeFlags(["-O"])]
        ),
        .testTarget(name: "CoreTests", dependencies: ["Core"], path: "CoreTests"),
    ]
)
