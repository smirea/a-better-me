import Feedback
import SwiftUI

/// One step of a wizard (Create Workout, Create Program, Create Custom Exercise, Check-In): a progress bar under the
/// title, the step's question, its content, and the step's actions pinned to the bottom.
struct WizardPage<Content: View, Actions: View>: View {
    let progress: Double
    var question: String?
    @ViewBuilder let content: Content
    @ViewBuilder let actions: Actions

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let question {
                    Text(question).font(AppFont.title(22))
                }
                content
            }
            .padding(.horizontal, Theme.margin)
            .padding(.vertical, 16)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.background)
        .safeAreaInset(edge: .top, spacing: 0) { WizardProgress(value: progress) }
        .pinnedActions { actions }
        .feedback(self)
    }
}

struct WizardProgress: View {
    let value: Double

    var body: some View {
        ProgressView(value: value)
            .progressViewStyle(.bar(Theme.textPrimary))
            .padding(.horizontal, Theme.margin)
            .padding(.bottom, 8)
    }
}
