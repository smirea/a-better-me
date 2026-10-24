import Foundation
import Testing
@testable import App

/// The calculator's options are optional keys inside JSON columns that already exist, so text written before them
/// must still decode.
struct PlateCalculatorShapesTests {
    private func decode<T: Decodable>(_ json: String, as type: T.Type = T.self) throws -> T {
        try JSONDecoder().decode(T.self, from: Data(json.utf8))
    }

    @Test func aMachineWrittenWithoutMicroAdjustmentsDecodes() throws {
        let load: EquipmentLoad = try decode(#"{"ranges":{"options":[{"minKg":0,"maxKg":100,"incrementKg":5}]}}"#)
        #expect(load == .ranges(options: [WeightRange(minKg: 0, maxKg: 100, incrementKg: 5)]))
        let micro: EquipmentLoad = try decode(#"{"ranges":{"options":[],"micro":{"kind":"pin","weightsKg":[1.25]}}}"#)
        #expect(micro == .ranges(options: [], micro: MicroAdjustment(kind: .pin, weightsKg: [1.25])))
    }

    @Test func aPlateWrittenWithoutAUnitReadsTheUnitItIsTidyIn() throws {
        let plates: EquipmentLoad = try decode(#"{"weights":{"options":[{"kg":20.41165665},{"kg":1.25,"count":2},{"kg":10,"unit":"lb"}]}}"#)
        guard case let .weights(options) = plates else {
            Issue.record("not weights")
            return
        }
        #expect(options.map(\.nativeUnit) == [.lb, .kg, .lb])
        #expect(options.map(\.count) == [nil, 2, nil])
    }

    @Test func entriesInsideTheSettingsTreeDefaultTheirMissingKeys() throws {
        let options: [String: PlateCalculatorOptions] = try decode(#"{"gym":{"includeBumperPlates":true}}"#)
        #expect(options["gym"] == { var expected = PlateCalculatorOptions(); expected.includeBumperPlates = true; return expected }())
        let section: CustomWorkoutSection = try decode(#"{"id":"3B3E8D9A-5E7B-4F4E-9E8C-2B0B7E2F9D11","name":"Travel"}"#)
        #expect(section == CustomWorkoutSection(id: UUID(uuidString: "3B3E8D9A-5E7B-4F4E-9E8C-2B0B7E2F9D11")!, name: "Travel"))
    }

    @Test func aKgOwnerSelectingOrResettingAnItemStoresTheKgList() {
        guard case let .weights(plates)? = GymDefaults.storedLoad(for: Loading.weightPlatesID, unit: .kg) else {
            Issue.record("no kg plates")
            return
        }
        #expect(plates.map(\.kg) == [1.25, 2.5, 5, 10, 15, 20, 25])
        #expect(GymDefaults.storedLoad(for: Loading.weightPlatesID, unit: .lb) == nil)
    }

    @Test func overridesAndBlocksWithoutTheNewKeysDecode() throws {
        let overrides: ExerciseOverrides = try decode(#"{"weightMatch":true}"#)
        #expect(overrides == { var expected = ExerciseOverrides(); expected.weightMatch = true; return expected }())
        let exercise: BlockExercise = try decode(#"{"id":"3B3E8D9A-5E7B-4F4E-9E8C-2B0B7E2F9D11","exerciseID":"bench","sets":[],"equipment":["bar"]}"#)
        #expect(exercise.support == nil)
        #expect(exercise.equipment == ["bar"])
    }

    @Test func overridesRoundTripTheBarChoiceAndOffset() throws {
        var overrides = ExerciseOverrides()
        overrides.barWeightKg = ["bar": 15]
        overrides.plateOffset = .percent(-10)
        let text = String(decoding: try JSONEncoder().encode(overrides), as: UTF8.self)
        #expect(text.contains(#""barWeightKg":{"bar":15}"#))
        #expect(try decode(text, as: ExerciseOverrides.self) == overrides)
    }

    @Test func gymOptionsDefaultOffAndReadByGymID() {
        var settings = WorkoutSettings()
        let gym = UUID()
        #expect(settings.plateCalculator(for: gym) == PlateCalculatorOptions())
        settings.plateCalculator[gym.uuidString] = PlateCalculatorOptions(includeBumperPlates: true, allowMixedUnits: false, offsetWeight: true)
        #expect(settings.plateCalculator(for: gym).includeBumperPlates == true)
        #expect(settings.plateCalculator(for: UUID()).includeBumperPlates == false)
    }

    @Test func microAdjustmentsAddOneWeightOrAnyCombination() {
        #expect(MicroAdjustment(kind: .pin, weightsKg: [2.5, 5]).extrasKg == [0, 2.5, 5])
        #expect(MicroAdjustment(kind: .dial, weightsKg: [0, 1.25]).extrasKg == [0, 1.25])
        #expect(MicroAdjustment(kind: .plates, weightsKg: [2.5, 5]).extrasKg.sorted() == [0, 2.5, 5, 7.5])
    }

    @Test func nativeUnitIsTheOneAWeightIsAWholeQuarterIn() {
        #expect(WeightUnit.native(toKg: WeightUnit.lb.toKg(45)) == .lb)
        #expect(WeightUnit.native(toKg: WeightUnit.lb.toKg(2.5)) == .lb)
        #expect(WeightUnit.native(toKg: 1.25) == .kg)
        #expect(WeightUnit.native(toKg: 20) == .kg)
        #expect(WeightUnit.native(toKg: 3.3) == nil)
    }

    @Test func offsetMovesTheTargetAndNamesItself() {
        #expect(PlateOffset.percent(10).applied(to: 200, unit: .lb) == 220)
        #expect(PlateOffset.percent(-10).label(unit: .lb) == "-10% offset")
        #expect(PlateOffset.kilograms(-2.5).applied(to: 100, unit: .kg) == 97.5)
        #expect(PlateOffset.kilograms(WeightUnit.lb.toKg(5)).label(unit: .lb) == "+5 lb offset")
    }
}
