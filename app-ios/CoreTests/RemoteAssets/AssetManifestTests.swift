import Foundation
import Testing
@testable import Core

private let a = String(repeating: "a", count: 64)
private let b = String(repeating: "b", count: 64)
private let c = String(repeating: "c", count: 64)

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
}
