#if DEBUG
import Foundation
import GRDB

/// Seven pings and 45 days of their logs: booleans logged from never to eight times a day, a labelled and an unlabelled
/// range, one with ten steps, one whose labels are too long to sit side by side, and one made before pings had colors.
enum PingSeed {
    static func insert(in db: Database, now: Date = .now, calendar: Calendar = .current) throws {
        let pings: [(name: String, icon: String, color: PingColor?, kind: PingKind, perDay: ClosedRange<Int>)] = [
            ("Mood", "face.smiling", .yellow, .range(["Terrible", "Bad", "Okay", "Good", "Great"]), 0...2),
            ("Energy", "bolt", .orange, .range(Array(repeating: "", count: 5)), 0...2),
            ("Water", "drop", .sky, .boolean, 2...8),
            ("Bathroom", "toilet", .tan, .boolean, 0...3),
            ("Coffee", "cup.and.saucer", nil, .boolean, 0...2),
            ("Pain", "bandage", .red, .range(Array(repeating: "", count: 10)), 0...1),
            ("Sleep Quality", "moon.zzz", .violet, .range(["Barely slept at all", "Restless, woke up often", "Fine", "Slept well", "Fully rested"]), 0...1),
        ]
        let today = calendar.startOfDay(for: now)
        var random = SeededGenerator(seed: 41)
        for (position, seed) in pings.enumerated() {
            let ping = Ping(id: DevSeed.id("ping/\(seed.name)"), name: seed.name, icon: seed.icon, color: seed.color, kind: seed.kind, position: position, at: today)
            try ping.insert(db)
            for ago in 0..<45 {
                let day = calendar.date(byAdding: .day, value: -ago, to: today)!
                for index in 0..<Int.random(in: seed.perDay, using: &random) {
                    let time = day.addingTimeInterval(TimeInterval(Int.random(in: 7 * 3600..<22 * 3600, using: &random)))
                    guard time <= now else { continue }
                    let value = seed.kind.steps.isEmpty ? 1 : Int.random(in: 1...seed.kind.steps.count, using: &random)
                    let note = seed.name == "Mood" && index == 0 && ago % 6 == 0 ? "Long day at work, skipped lunch" : ""
                    try PingLog(id: DevSeed.id("ping/\(seed.name)/\(ago)/\(index)"), pingID: ping.id, value: value, note: note, at: time).insert(db)
                }
            }
        }
    }
}

/// SplitMix64, so every launch seeds the same logs.
private struct SeededGenerator: RandomNumberGenerator {
    var state: UInt64

    init(seed: UInt64) { state = seed }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}
#endif
