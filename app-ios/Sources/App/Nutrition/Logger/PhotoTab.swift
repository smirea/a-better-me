import PhotosUI
import Feedback
import SwiftUI
import UIKit

/// Photo: a meal photo, taken or picked, and an optional note go to the server's Gemini model, which names each food
/// and weighs it. The foods are matched against the logger's own search and added at once, and the meal opens so every
/// one can be checked, changed, or removed (docs/decisions/nutrition.md).
struct PhotoTab: View {
    let session: LoggerSession
    let showMeal: () -> Void
    @State private var photo: PhotoUpload?
    @State private var note = ""
    @State private var choosing = false
    @State private var picked: PhotosPickerItem?
    @State private var unreadable = false
    @FocusState private var noteFocused: Bool

    var body: some View {
        List {
            Section {
                if let photo {
                    Image(uiImage: photo.preview)
                        .resizable()
                        .scaledToFit()
                        .clipShape(.rect(cornerRadius: Theme.cornerRadius))
                        .frame(maxWidth: .infinity, maxHeight: 360)
                        .accessibilityLabel("Meal photo")
                } else {
                    ContentUnavailableView {
                        Label("Photograph your meal", systemImage: "camera")
                    } description: {
                        Text("Gemini names each food and estimates its weight. They're added at once, and the meal opens to check them.")
                    }
                }
                HStack(spacing: 10) {
                    if Camera.isAvailable {
                        Button("Camera", systemImage: "camera") { Camera.capture { image in load { PhotoUpload(image) } } }.secondaryPill()
                    }
                    Button("Photos", systemImage: "photo.on.rectangle") { choosing = true }.secondaryPill()
                }
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 8, leading: Theme.margin, bottom: 8, trailing: Theme.margin))
            ThemedSection("Note") {
                TextField("Optional", text: $note, axis: .vertical)
                    .focused($noteFocused)
                    .lineLimit(1...4)
            }
        }
        .flatList()
        .scrollDismissesKeyboard(.interactively)
        .overlay {
            if session.isFindingFoods {
                ProgressView("Finding foods").padding(Theme.margin).glassEffect(in: .rect(cornerRadius: Theme.cornerRadius))
            }
        }
        .pinnedActions {
            Button("Find Foods", action: findFoods)
                .primaryPill()
                .disabled(photo == nil || session.isFindingFoods)
        }
        .photosPicker(isPresented: $choosing, selection: $picked, matching: .images)
        .onChange(of: picked) {
            guard let picked else { return }
            Task {
                let data = try? await picked.loadTransferable(type: Data.self)
                self.picked = nil
                if let data { load { PhotoUpload(data) } } else { unreadable = true }
            }
        }
        .onAppear(perform: showAddedFoods)
        .onChange(of: session.photoNotice, showAddedFoods)
        .alert("Photo", isPresented: .constant(alert != nil)) {
            Button("OK", role: .cancel) {
                let foodsAdded = if case .added = session.photoNotice { true } else { false }
                session.photoNotice = nil
                unreadable = false
                if foodsAdded { clearAndShowMeal() }
            }
        } message: {
            Text(alert ?? "")
        }
        .feedback(self)
    }

    private var alert: String? {
        if unreadable { return "That photo could not be read." }
        switch session.photoNotice {
        case let .added(unmatched) where !unmatched.isEmpty:
            return "No food in the database matched \(unmatched.formatted(.list(type: .and))). Add \(unmatched.count == 1 ? "it" : "them") from Search."
        case let .failed(message): return message
        case .added, nil: return nil
        }
    }

    /// Foods that all matched show in the meal at once; unmatched ones wait for the alert's OK.
    private func showAddedFoods() {
        guard session.photoNotice == .added(unmatched: []) else { return }
        session.photoNotice = nil
        clearAndShowMeal()
    }

    private func clearAndShowMeal() {
        photo = nil
        note = ""
        showMeal()
    }

    /// Shrinks the photo off the main actor; the full-size original never stays in memory.
    private func load(_ prepare: @escaping @Sendable () -> PhotoUpload?) {
        Task {
            let prepared = await Task.detached(operation: prepare).value
            if let prepared { photo = prepared } else { unreadable = true }
        }
    }

    private func findFoods() {
        guard let photo else { return }
        noteFocused = false
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        Task { await session.findFoods(jpeg: photo.jpeg, note: trimmed.isEmpty ? nil : trimmed) }
    }
}
