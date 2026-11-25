import Feedback
import SwiftUI

/// A note field at the bottom of the Pings tab, over the tab bar: one line that grows a line at a time as it is typed,
/// up to five, then scrolls. Send puts the note on the day shown, at the time a ping logged now would get
/// (`PingLog.instant`), and empties the field. The draft survives the app closing.
struct PingNoteComposer: View {
    let day: CalendarDay
    /// Whether the field has the keyboard.
    @Binding var composing: Bool
    let sent: (TimelineNote) -> Void

    @Environment(LocalStore.self) private var store
    @State private var text = ""
    @FocusState private var focused: Bool

    var body: some View {
        let note = text.trimmingCharacters(in: .whitespacesAndNewlines)
        HStack(alignment: .bottom, spacing: 4) {
            TextField("Note", text: $text, axis: .vertical)
                .font(AppFont.rowTitle)
                .lineLimit(1...5)
                .focused($focused)
                .padding(.vertical, 13)
                .accessibilityLabel("Timeline note")
            if !note.isEmpty {
                Button("Add Note", systemImage: "arrow.up.circle.fill") { send(note) }
                    .labelStyle(.iconOnly)
                    .font(.system(size: 30))
                    .foregroundStyle(Theme.textPrimary)
                    .buttonStyle(.plain)
                    .frame(width: 44, height: 48)
                    .contentShape(.rect)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(.leading, 18)
        .padding(.trailing, note.isEmpty ? 18 : 2)
        .frame(minHeight: 48)
        .glassEffect(.regular.interactive(), in: .rect(cornerRadius: 24))
        .padding(.horizontal, Theme.margin)
        .padding(.bottom, 8)
        .animation(.snappy(duration: 0.2), value: note.isEmpty)
        .onChange(of: focused) { _, focused in composing = focused }
        .persistDraft($text, key: "pings.note")
        .feedback(self)
    }

    private func send(_ note: String) {
        let row = TimelineNote(text: note, at: PingLog.instant(on: day))
        store.insert(row)
        text = ""
        sent(row)
    }
}
