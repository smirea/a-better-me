import Testing
@testable import Core

struct CustomExerciseDraftTests {
    let pullUp = Exercise(
        id: "pull-up",
        name: "Pull-Up",
        alternativeNames: ["Chin-Up Wide"],
        type: .compound,
        primaryMuscles: [.lats],
        secondaryMuscles: [.biceps],
        primaryMuscleDetails: ["Latissimus Dorsi"],
        movementPatterns: ["Vertical Pull"],
        region: .upper,
        metrics: [.weight, .reps],
        resistanceEquipment: ["Body weight", "Dip belt and plates"],
        supportEquipment: ["Pull-up bar"],
        resistanceEquipmentIDs: [["bodyweight"], ["dip-belt", "plates"]],
        supportEquipmentIDs: [["pull-up-bar"]],
        category: .bodyweight,
        rangeOfMotion: 4,
        stability: 3,
        primaryJointActions: ["Shoulder Adduction"],
        secondaryJointActions: ["Elbow Flexion"],
        bodyweightFraction: 0.95
    )

    @Test func aDuplicateKeepsEveryPropertyOfItsSource() {
        let copy = CustomExerciseDraft(duplicating: pullUp, instructions: "## Description\nHang, then pull.").exercise()
        #expect(copy.id.hasPrefix("custom-"))
        #expect(copy.name == "Pull-Up (Copy)")
        #expect(copy.resistanceEquipment == ["Body weight", "Dip belt and plates"])
        #expect(copy.resistanceEquipmentIDs == [["bodyweight"], ["dip-belt", "plates"]])
        #expect(copy.supportEquipmentIDs == [["pull-up-bar"]])
        #expect(copy.equipmentIDs == ["bodyweight", "dip-belt", "plates", "pull-up-bar"])
        #expect(copy.rangeOfMotion == 4)
        #expect(copy.stability == 3)
        #expect(copy.bodyweightFraction == 0.95)
        #expect(copy.primaryJointActions == ["Shoulder Adduction"])
        #expect(copy.secondaryJointActions == ["Elbow Flexion"])
        #expect(copy.alternativeNames == ["Chin-Up Wide"])
        #expect(copy.primaryMuscleDetails == ["Latissimus Dorsi"])
        #expect(copy.movementPatterns == ["Vertical Pull"])
        #expect(copy.category == .bodyweight)
        #expect(copy.about == "## Description\nHang, then pull.")
    }

    @Test func changedMusclesDropTheSourcesAnatomicalNames() {
        var draft = CustomExerciseDraft(duplicating: pullUp, instructions: nil)
        draft.cycle(.biceps)
        let copy = draft.exercise()
        #expect(copy.secondaryMuscles == [])
        #expect(copy.primaryMuscleDetails == [])
    }
}
