import Foundation

/// MF's seven yes-or-no questions about foundational movements. Answers live in `ProfileSettings.assessment`, keyed by
/// `id`, with "yes" or "no". An exercise with a precondition is a generator candidate only when the question that
/// gates it is answered yes.
struct AssessmentQuestion: Identifiable, Hashable {
    let id: String
    let text: String

    static let all: [AssessmentQuestion] = [
        AssessmentQuestion(id: "benchPress10", text: "Can you bench press a barbell for at least 10 reps?"),
        AssessmentQuestion(id: "inclinePress10", text: "Can you incline press a barbell for at least 10 reps?"),
        AssessmentQuestion(id: "overheadPress10", text: "Can you overhead press (shoulder press) a barbell for at least 10 reps?"),
        AssessmentQuestion(id: "pullUps5", text: "Can you do at least 5 strict, unassisted pull-ups or chin-ups?"),
        AssessmentQuestion(id: "pullUps10", text: "Can you do at least 10 strict, unassisted pull-ups or chin-ups?"),
        AssessmentQuestion(id: "pushUps15", text: "Can you do at least 15 strict, bodyweight push-ups?"),
        AssessmentQuestion(id: "dips10", text: "Can you perform at least 10 body weight dips?"),
    ]

    static let yes = "yes"
    static let no = "no"
}

enum ExerciseAssessment {
    /// The question that gates a bundle precondition, matched on the precondition's name. The bundle does not say
    /// which answer unlocks which of its 43 preconditions, so this table is ours: a precondition no question covers
    /// (barbell lunges, Nordic curls, Jefferson curls) is never gated.
    static func question(gating precondition: String) -> String? {
        let name = precondition.lowercased()
        if name.contains("weighted vertical pull") || name.contains("muscle-up") || name.contains("weighted pull-up") { return "pullUps10" }
        if name.contains("vertical pull") || name.contains("pull-up") || name.contains("chin-up") || name.contains("dead hang") { return "pullUps5" }
        if name.contains("dip") { return "dips10" }
        if name.contains("push-up") { return "pushUps15" }
        if name.contains("incline barbell press") { return "inclinePress10" }
        if name.contains("bench press") || name.contains("barbell jm") { return "benchPress10" }
        if name.contains("overhead press") || name.contains("z press") { return "overheadPress10" }
        return nil
    }

    /// Whether `profile` unlocks `exercise`. Exercises without preconditions always pass.
    static func allows(_ exercise: Exercise, profile: ProfileSettings) -> Bool {
        guard let preconditions = exercise.selection?.preconditions else { return true }
        return preconditions.allSatisfy { precondition in
            guard let question = question(gating: precondition) else { return true }
            return profile.assessment[question] == AssessmentQuestion.yes
        }
    }
}
