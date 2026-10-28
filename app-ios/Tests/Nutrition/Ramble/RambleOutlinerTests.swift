import Foundation
import Testing
@testable import App

/// Answers each transcript with one item named after it, after `delay`, or fails.
@MainActor
final class FakeRambleModel {
    var calls: [String] = []
    var answered: [String] = []
    var delay = Duration.milliseconds(10)
    var failing = false

    func outliner(settle: Duration = .milliseconds(60), maxWait: Duration = .milliseconds(300)) -> RambleOutliner {
        RambleOutliner(settle: settle, maxWait: maxWait, request: { [self] text in
            calls.append(text)
            try await Task.sleep(for: delay)
            if failing { throw URLError(.timedOut) }
            return RambleOutline(items: [RambleItem(name: text)])
        }, onOutline: { [self] text, _ in answered.append(text) })
    }
}

/// Waits until `condition` holds, so a busy simulator delaying a debounce timer fails nothing; the expectations that
/// follow still check the result. It counts polls, not wall time: CI once held the main actor for 90 s, and a clock
/// deadline ran out before the timer it waited on could fire.
@MainActor
func eventually(_ condition: () -> Bool) async throws {
    var polls = 0
    while !condition(), polls < 500 {
        polls += 1
        try await Task.sleep(for: .milliseconds(10))
    }
}

@MainActor
struct RambleOutlinerTests {
    let model = FakeRambleModel()

    @Test func wordsInQuickSuccessionSendOneRequestWithTheLatest() async throws {
        let outliner = model.outliner()
        outliner.update("one")
        outliner.update("one cup")
        outliner.update("one cup of oats")
        try await eventually { !model.answered.isEmpty }
        #expect(model.calls == ["one cup of oats"])
        #expect(model.answered == ["one cup of oats"])
        #expect(outliner.latest?.transcript == "one cup of oats")
    }

    @Test func nonstopSpeechIsStillReadEveryMaxWait() async throws {
        let outliner = model.outliner(settle: .milliseconds(150), maxWait: .milliseconds(300))
        var words: [String] = []
        for index in 0..<16 {
            words.append("w\(index)")
            outliner.update(words.joined(separator: " "))
            try await Task.sleep(for: .milliseconds(50))
        }
        // 800 ms of speech that never paused 150 ms: without the cap nothing would have been sent yet.
        #expect(model.calls.count >= 2)
        #expect(model.calls.first.map { $0.split(separator: " ").count < 16 } == true)
    }

    @Test func oneRequestIsInFlightAndTheNewestTranscriptGoesNext() async throws {
        model.delay = .milliseconds(300)
        let outliner = model.outliner()
        outliner.update("a")
        try await eventually { model.calls == ["a"] }
        outliner.update("a b")
        outliner.update("a b c")
        try await eventually { model.answered.count == 2 }
        #expect(model.calls == ["a", "a b c"])
        #expect(model.answered == ["a", "a b c"])
    }

    @Test func settlingOnTheTranscriptLastReadReusesItsAnswer() async throws {
        let outliner = model.outliner()
        outliner.update("two eggs")
        try await eventually { outliner.latest != nil }
        let outline = await outliner.settle("two eggs", timeout: .seconds(1))
        #expect(outline?.items.map(\.name) == ["two eggs"])
        #expect(model.calls == ["two eggs"])
    }

    @Test func settlingOnNewerWordsAbortsTheStaleRequestAndSendsTheFinal() async throws {
        model.delay = .milliseconds(300)
        let outliner = model.outliner()
        outliner.update("two eggs")
        try await eventually { model.calls == ["two eggs"] }
        let outline = await outliner.settle("two eggs and toast", timeout: .seconds(2))
        #expect(outline?.items.map(\.name) == ["two eggs and toast"])
        #expect(model.calls == ["two eggs", "two eggs and toast"])
        #expect(model.answered == ["two eggs and toast"])
    }

    @Test func settlingGivesUpAtTheTimeout() async throws {
        model.delay = .seconds(2)
        let outliner = model.outliner()
        let started = ContinuousClock.now
        let outline = await outliner.settle("toast", timeout: .milliseconds(150))
        #expect(outline == nil)
        #expect(ContinuousClock.now - started < .seconds(1))
    }

    @Test func twoFailuresInARowTurnItOffForTheCapture() async throws {
        model.failing = true
        let outliner = model.outliner()
        outliner.update("a")
        try await eventually { model.calls == ["a"] }
        try await Task.sleep(for: .milliseconds(50))
        #expect(!outliner.off)
        outliner.update("a b")
        try await eventually { outliner.off }
        #expect(outliner.off)
        outliner.update("a b c")
        try await Task.sleep(for: .milliseconds(200))
        #expect(model.calls == ["a", "a b"])
        #expect(await outliner.settle("a b c", timeout: .seconds(1)) == nil)
    }
}

struct RambleItemDecodingTests {
    @Test func theServersEmptyStringsAndUnsaidDayBecomeNilAndItsClockAMinute() throws {
        let json = #"""
        {"items":[
          {"kind":"food","name":"oats","amount":0.5,"unit":"cup","ref":null,"copy":null,"except":[],"day":null,"meal":"breakfast","time":"","options":false},
          {"kind":"copy","name":"","amount":0,"unit":"","ref":null,"copy":"2026-10-27-breakfast","except":["e1"],"day":-1,"meal":"","time":"15:30","options":false}
        ]}
        """#
        let items = try JSONDecoder().decode(RambleOutline.self, from: Data(json.utf8)).items
        #expect(items == [
            RambleItem(name: "oats", amount: 0.5, unit: "cup", meal: .breakfast),
            RambleItem(kind: .copy, copy: "2026-10-27-breakfast", except: ["e1"], day: -1, minute: 15 * 60 + 30),
        ])
    }
}
