import Foundation
import Testing
@testable import App

private let a = String(repeating: "a", count: 64)
private let b = String(repeating: "b", count: 64)
private let c = String(repeating: "c", count: 64)
private let enUS = Locale(identifier: "en_US")

private let manifest = AssetManifest(version: "0123456789abcdef", packs: [
    .init(sha256: a, size: 1_000_000, files: [.init(path: "EquipmentImages/x.webp", offset: 0, size: 1_000_000)]),
    .init(sha256: b, size: 2_500_000, files: [.init(path: "ExerciseImages/x_a.webp", offset: 0, size: 2_500_000)]),
    .init(sha256: b, size: 2_500_000, files: [.init(path: "ExerciseImages/x_a.webp", offset: 0, size: 2_500_000)]),
    .init(sha256: c, size: 10_000_000, files: [.init(path: "ExerciseImages/z_a.webp", offset: 0, size: 10_000_000)]),
])

private func parse(_ packs: String) throws(AssetError) -> AssetManifest {
    try AssetManifest.parse(Data(#"{"version":"0123456789abcdef","packs":\#(packs)}"#.utf8), version: "0123456789abcdef")
}

struct AssetManifestTests {
    @Test func missingListsEachAbsentPackOnce() {
        let all = Set(manifest.packs.map(\.directory))
        #expect(manifest.missing(present: [manifest.packs[0].directory]).map(\.sha256) == [b, c])
        #expect(manifest.missing(present: all) == [])
    }

    @Test func progressCountsBytesOfEachPackOnce() {
        #expect(manifest.progress(present: [manifest.packs[0].directory]) == AssetProgress(bytesDone: 1_000_000, bytesTotal: 13_500_000))
        #expect(manifest.progress(present: Set(manifest.packs.map(\.directory))).fraction == 1)
    }

    @Test func aRenamedFileGetsANewDirectoryEvenWhenThePackBytesMatch() {
        let before = AssetManifest.Pack(sha256: a, size: 3, files: [.init(path: "ExerciseImages/x.webp", offset: 0, size: 3)])
        let renamed = AssetManifest.Pack(sha256: a, size: 3, files: [.init(path: "ExerciseImages/y.webp", offset: 0, size: 3)])
        #expect(before.directory != renamed.directory)
        #expect(AssetManifest.isBlobName(before.directory))
    }

    @Test func parseRejectsAnotherVersionAPathLikeHashOrAnEscapingPath() throws {
        let valid = Data(#"{"version":"0123456789abcdef","packs":[{"sha256":"\#(a)","size":3,"files":[{"path":"ExerciseImages/x.webp","offset":0,"size":3}]}]}"#.utf8)
        #expect(try AssetManifest.parse(valid, version: "0123456789abcdef").packs.map(\.files.count) == [1])
        #expect(throws: AssetError.badManifest) { try AssetManifest.parse(valid, version: "fedcba9876543210") }
        #expect(throws: AssetError.badManifest) {
            try parse(#"[{"sha256":"../../a-better-me.sqlite","size":3,"files":[]}]"#)
        }
        #expect(throws: AssetError.badManifest) {
            try parse(#"[{"sha256":"\#(a)","size":3,"files":[{"path":"../a-better-me.sqlite","offset":0,"size":3}]}]"#)
        }
        #expect(throws: AssetError.badManifest) {
            try parse(#"[{"sha256":"\#(a)","size":3,"files":[{"path":"/x.webp","offset":0,"size":3}]}]"#)
        }
        #expect(throws: AssetError.badManifest) {
            try parse(#"[{"sha256":"\#(a)","size":3,"files":[{"path":"x.webp","offset":2,"size":3}]}]"#)
        }
    }

    @Test func statusLines() {
        let partway = AssetProgress(bytesDone: 4_200_000, bytesTotal: 16_400_000)
        let done = AssetProgress(bytesDone: 16_400_000, bytesTotal: 16_400_000)
        #expect(AssetPhase.downloading.statusLine(partway, locale: enUS) == "Assets: downloading · 4.2 of 16.4 MB")
        #expect(AssetPhase.complete.statusLine(done, locale: enUS) == "Assets: downloaded · 16.4 MB")
        #expect(AssetPhase.waitingForWiFi.statusLine(partway, locale: enUS) == "Assets: 12.2 MB waiting for Wi-Fi")
        #expect(AssetPhase.waitingForTap.statusLine(partway, locale: enUS) == "Assets: 12.2 MB, tap to download")
        #expect(AssetPhase.failed("HTTP 403").statusLine(partway, locale: enUS) == "Assets: HTTP 403 · 12.2 MB left")
        #expect(AssetPhase.checking.statusLine(partway, locale: enUS) == "Assets: checking…")
        #expect(AssetPhase.checking.statusLine(nil, locale: enUS) == "Assets: checking…")
        #expect(AssetPhase.failed("Offline").statusLine(nil, locale: enUS) == "Assets: Offline")
        #expect(AssetPhase.off.statusLine(nil, locale: enUS) == "Assets: off")
        #expect(AssetPhase.waitingForTap.statusLine(nil, locale: enUS) == "Assets: tap to download")
    }
}
