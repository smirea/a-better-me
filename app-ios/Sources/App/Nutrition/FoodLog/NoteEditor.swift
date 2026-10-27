import SwiftUI

/// A note's full-height editor: its color, title, body, and time. Saving needs a title; an existing note can be
/// deleted.
struct NoteEditor: View {
    let isNew: Bool

    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var note: FoodLogNote
    @State private var time: Date
    @State private var confirmingDelete = false
    @FocusState private var titleFocused: Bool

    init(draft: NoteDraft) {
        isNew = draft.isNew
        _note = State(initialValue: draft.note)
        _time = State(initialValue: draft.note.day.date(atMinute: draft.note.minute))
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                TextField("Note Name", text: $note.title)
                    .font(AppFont.title(24))
                    .focused($titleFocused)
                TextField("Write your note…", text: $note.body, axis: .vertical)
                    .font(AppFont.body())
                    .lineLimit(3...)
                Spacer()
                DatePicker("Time", selection: $time, displayedComponents: .hourAndMinute)
            }
            .padding(20)
            .background(Theme.background)
            .navigationTitle(isNew ? "New Note" : "Edit Note")
            .navigationSubtitle(note.day.date.formatted(date: .numeric, time: .omitted))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(role: .close) { dismiss() } }
                ToolbarItem(placement: .topBarLeading) {
                    Menu("Color", systemImage: "paintpalette") {
                        Picker("Color", selection: $note.color) {
                            ForEach(FoodLogNote.Color.allCases, id: \.self) { color in
                                Label(color.title, systemImage: "circle.fill").tint(color.tint).tag(color)
                            }
                        }
                    }
                    .tint(note.color.tint)
                }
                if !isNew {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Delete Note", systemImage: "trash", role: .destructive) { confirmingDelete = true }
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .confirm) { save() }
                        .disabled(note.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .alert("Delete Note", isPresented: $confirmingDelete) {
                Button("Delete", role: .destructive) {
                    store.deleteNote(note.id)
                    dismiss()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This note will be deleted. This action cannot be undone.")
            }
        }
        .presentationDetents([.large])
        .onAppear { if isNew { titleFocused = true } }
    }

    private func save() {
        var edited = note
        edited.title = note.title.trimmingCharacters(in: .whitespacesAndNewlines)
        edited.minute = time.minuteOfDay()
        let saved = edited
        if isNew {
            store.saveNote(saved)
        } else {
            store.editNote(saved.id) { $0 = saved }
        }
        dismiss()
    }
}
