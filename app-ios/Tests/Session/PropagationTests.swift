import Testing
@testable import App

/// Propagate Changes over one exercise's rows, with the weights each row showed before the edit.
struct PropagationTests {
    private func propagate(_ weights: [Double], editing index: Int, to newValue: Double, logged: Set<Int> = []) -> [Double] {
        let rows = weights.indices.map { RowPath(block: 0, exercise: 0, set: $0) }
        var result = weights
        result[index] = newValue
        let targets = SessionFlow.propagationTargets(from: rows[index], rows: rows, isOpen: { !logged.contains($0.set) }) { weights[$0.set] }
        for target in targets { result[target.set] = newValue }
        return result
    }

    @Test func laterRowsWithTheSameWeightFollowTheEdit() {
        #expect(propagate([50, 50, 50, 45], editing: 1, to: 55) == [50, 55, 55, 45])
    }

    @Test func onlyEqualRowsAfterTheEditedOneChange() {
        #expect(propagate([50, 55, 50], editing: 0, to: 60) == [60, 55, 60])
    }

    @Test func loggedRowsKeepTheirValue() {
        #expect(propagate([50, 50, 50], editing: 0, to: 60, logged: [1]) == [60, 50, 60])
    }

    @Test func subRowsPropagateOnlyToSubRows() {
        let main = RowPath(block: 0, exercise: 0, set: 0)
        let sub0 = RowPath(block: 0, exercise: 0, set: 0, sub: 0)
        let main1 = RowPath(block: 0, exercise: 0, set: 1)
        let sub1 = RowPath(block: 0, exercise: 0, set: 1, sub: 0)
        let targets = SessionFlow.propagationTargets(from: sub0, rows: [main, sub0, main1, sub1], isOpen: { _ in true }) { _ in 20.0 }
        #expect(targets == [sub1])
    }
}
