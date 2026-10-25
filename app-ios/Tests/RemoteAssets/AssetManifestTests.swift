import Foundation
import Testing
@testable import App

private let a = String(repeating: "a", count: 64)
private let b = String(repeating: "b", count: 64)
private let c = String(repeating: "c", count: 64)
private let enUS = Locale(identifier: "en_US")

private let manifest = AssetManifest(version: "0123456789abcdef", files: [
    .init(path: "Articles/x.md", sha256: a, size: 1_000),
    .init(path: "ExerciseImages/x_0.webp", sha256: b, size: 2_500_000),
    .init(path: "ExerciseImages/y_0.webp", sha256: b, size: 2_500_000),
    .init(path: "Instructions/x.md", sha256: c, size: 10_000_000),
])

struct AssetManifestTests {
    @Test func missingListsEachAbsentBlobOnce() {
        #expect(manifest.missing(present: [a]).map(\.path) == ["ExerciseImages/x_0.webp", "Instructions/x.md"])
        #expect(manifest.missing(present: [a, b, c]) == [])
    }

    @Test func progressCountsFilesAndBytesOfMissingBlobs() {
        #expect(manifest.progress(present: [a]) == AssetProgress(done: 1, total: 4, bytesLeft: 12_500_000))
        #expect(manifest.progress(present: [b, c]) == AssetProgress(done: 3, total: 4, bytesLeft: 1_000))
    }

    @Test func parseRejectsAnotherVersionOrAPathLikeHash() throws {
        let valid = Data(#"{"version":"0123456789abcdef","files":[{"path":"Articles/x.md","sha256":"\#(a)","size":3}]}"#.utf8)
        #expect(try AssetManifest.parse(valid, version: "0123456789abcdef").files.map(\.path) == ["Articles/x.md"])
        #expect(throws: AssetError.badManifest) { try AssetManifest.parse(valid, version: "fedcba9876543210") }
        let escaping = Data(#"{"version":"0123456789abcdef","files":[{"path":"x","sha256":"../../a-better-me.sqlite","size":3}]}"#.utf8)
        #expect(throws: AssetError.badManifest) { try AssetManifest.parse(escaping, version: "0123456789abcdef") }
    }

    @Test func statusLines() {
        let partway = AssetProgress(done: 1_200, total: 3_002, bytesLeft: 12_400_000)
        let done = AssetProgress(done: 3_002, total: 3_002, bytesLeft: 0)
        #expect(AssetPhase.downloading.statusLine(partway, locale: enUS) == "Assets 1,200/3,002 · 12.4 MB left")
        #expect(AssetPhase.waitingForWiFi.statusLine(partway, locale: enUS) == "Assets 1,200/3,002 · 12.4 MB waiting for Wi-Fi")
        #expect(AssetPhase.failed("HTTP 403").statusLine(partway, locale: enUS) == "Assets 1,200/3,002 · HTTP 403")
        #expect(AssetPhase.checking.statusLine(partway, locale: enUS) == "Assets 1,200/3,002 · Checking…")
        #expect(AssetPhase.complete.statusLine(done, locale: enUS) == "Assets 3,002/3,002")
        #expect(AssetPhase.checking.statusLine(nil, locale: enUS) == "Assets · Checking…")
        #expect(AssetPhase.failed("Offline").statusLine(nil, locale: enUS) == "Assets · Offline")
        #expect(AssetPhase.off.statusLine(nil, locale: enUS) == "Assets · Off")
        #expect(AssetPhase.waitingForTap.statusLine(nil, locale: enUS) == "Assets · Tap to download")
        #expect(AssetPhase.waitingForTap.statusLine(partway, locale: enUS) == "Assets 1,200/3,002 · 12.4 MB, tap to download")
    }
}
