import SwiftUI

/// The Exercise Assessment questionnaire: seven yes-or-no questions saved into `ProfileSettings.assessment` as they are
/// answered. `assessmentCompletedAt` is stamped once every question has an answer. The caller supplies the navigation
/// stack.
struct ExerciseAssessmentView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        List {
            Section {
                ForEach(AssessmentQuestion.all) { question in
                    VStack(alignment: .leading, spacing: 10) {
                        Text(question.text).font(AppFont.medium(15))
                        Picker(question.text, selection: answer(question)) {
                            Text("No").tag(String?.some(AssessmentQuestion.no))
                            Text("Yes").tag(String?.some(AssessmentQuestion.yes))
                        }
                        .pickerStyle(.segmented)
                        .labelsHidden()
                    }
                    .padding(.vertical, 6)
                    .listRowBackground(Theme.surface)
                }
            } header: {
                Text("A few questions about your experience with the following exercises")
                    .font(AppFont.medium(15))
                    .foregroundStyle(Theme.textSecondary)
                    .textCase(nil)
                    .padding(.bottom, 4)
            }
        }
        .themedList()
        .navigationTitle("Exercise Assessment")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func answer(_ question: AssessmentQuestion) -> Binding<String?> {
        Binding(
            get: { settings.profile.assessment[question.id] },
            set: { value in
                store.updateSettings { settings in
                    settings.profile.assessment[question.id] = value
                    if AssessmentQuestion.all.allSatisfy({ settings.profile.assessment[$0.id] != nil }) {
                        settings.profile.assessmentCompletedAt = .now
                    }
                }
            }
        )
    }
}
