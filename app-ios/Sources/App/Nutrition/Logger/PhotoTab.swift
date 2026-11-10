import PhotosUI
import Feedback
import SwiftUI
import UIKit

/// Photo: a meal photo, taken or picked, and an optional note go to the server's Gemini model, which names each food
/// and weighs it. The foods land on the plate, matched against the logger's own search, so every one can be checked or
/// changed before Log Foods (docs/decisions/nutrition.md).
struct PhotoTab: View {
    let session: LoggerSession
    let showPlate: () -> Void
    @State private var photo: PhotoUpload?
    @State private var note = ""
    @State private var choosing = false
    @State private var picked: PhotosPickerItem?
    @State private var capturing = false
    @State private var unreadable = false
    @FocusState private var noteFocused: Bool

    private let cameraWorks = UIImagePickerController.isSourceTypeAvailable(.camera)

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
                        Text("Gemini names each food and estimates its weight. You check them on your plate before logging.")
                    }
                }
                HStack(spacing: 10) {
                    if cameraWorks {
                        Button("Camera", systemImage: "camera") { capturing = true }.secondaryPill()
                    }
                    Button("Photos", systemImage: "photo.on.rectangle") { choosing = true }.secondaryPill()
                }
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
            ThemedSection("Note", footer: "What the photo can't show, like \"skin removed\", \"cooked in a tablespoon of butter\", or \"ate half\".") {
                TextField("Optional", text: $note, axis: .vertical)
                    .focused($noteFocused)
                    .lineLimit(1...4)
            }
        }
        .themedList()
        .scrollDismissesKeyboard(.interactively)
        .overlay {
            if session.isFindingFoods {
                ProgressView("Finding foods").padding(Theme.margin).glassEffect(in: .rect(cornerRadius: Theme.cornerRadius))
            }
        }
        .pinnedActions {
            HStack(spacing: 10) {
                Button("Find Foods", action: findFoods)
                    .primaryPill()
                    .disabled(photo == nil || session.isFindingFoods)
                LogFoodsButton(session: session)
                    .controlSize(.large)
                    .disabled(session.isFindingFoods)
            }
        }
        .photosPicker(isPresented: $choosing, selection: $picked, matching: .images)
        .fullScreenCover(isPresented: $capturing) {
            CameraCapture { image in load { PhotoUpload(image) } }.ignoresSafeArea()
        }
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
                if foodsAdded { clearAndShowPlate() }
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

    /// Foods that all matched go straight to the plate; unmatched ones wait for the alert's OK.
    private func showAddedFoods() {
        guard session.photoNotice == .added(unmatched: []) else { return }
        session.photoNotice = nil
        clearAndShowPlate()
    }

    private func clearAndShowPlate() {
        photo = nil
        note = ""
        showPlate()
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
