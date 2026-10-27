import PhotosUI
import SwiftUI
import UIKit

/// Photo: a meal photo, taken or picked, and an optional note go to the server's Gemini model, which names each food
/// and weighs it. The foods land on the plate, matched against the logger's own search, so every one can be checked or
/// changed before Log Foods (docs/decisions/nutrition.md).
struct PhotoTab: View {
    let session: LoggerSession
    let showPlate: () -> Void
    @State private var photo: MealPhoto?
    @State private var note = ""
    @State private var choosing = false
    @State private var picked: PhotosPickerItem?
    @State private var capturing = false
    @State private var analyzing = false
    @State private var problem: String?
    /// Foods went on the plate, but the alert naming the unmatched ones shows first, on this tab.
    @State private var plateAfterAlert = false
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
            if analyzing {
                ProgressView("Finding foods").padding(20).glassEffect(in: .rect(cornerRadius: Theme.cornerRadius))
            }
        }
        .safeAreaInset(edge: .bottom) {
            HStack(spacing: 10) {
                Button("Find Foods", action: analyze)
                    .primaryPill()
                    .disabled(photo == nil || analyzing)
                LogFoodsButton(session: session).controlSize(.large)
            }
            .padding(.horizontal, Theme.margin)
            .padding(.bottom, 8)
        }
        .photosPicker(isPresented: $choosing, selection: $picked, matching: .images)
        .fullScreenCover(isPresented: $capturing) {
            CameraCapture { data in load(data) }.ignoresSafeArea()
        }
        .onChange(of: picked) {
            guard let picked else { return }
            Task {
                let data = try? await picked.loadTransferable(type: Data.self)
                self.picked = nil
                if let data { load(data) } else { problem = "That photo could not be read." }
            }
        }
        .alert("Photo", isPresented: .isPresent($problem)) {
            Button("OK", role: .cancel) {
                if plateAfterAlert {
                    plateAfterAlert = false
                    showPlate()
                }
            }
        } message: {
            Text(problem ?? "")
        }
    }

    /// Shrinks the photo off the main actor; the full-size original never stays in memory.
    private func load(_ data: Data) {
        Task {
            let prepared = await Task.detached { MealPhoto(data) }.value
            if let prepared { photo = prepared } else { problem = "That file is not a photo." }
        }
    }

    private func analyze() {
        guard let photo, !analyzing else { return }
        analyzing = true
        noteFocused = false
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            defer { analyzing = false }
            do {
                let outcome = try await session.addPhoto(jpeg: photo.jpeg, note: trimmed.isEmpty ? nil : trimmed)
                if outcome.added > 0 {
                    self.photo = nil
                    note = ""
                    if outcome.unmatched.isEmpty { showPlate() } else { plateAfterAlert = true }
                }
                if !outcome.unmatched.isEmpty {
                    problem = "No food in the database matched \(outcome.unmatched.formatted(.list(type: .and))). Add \(outcome.unmatched.count == 1 ? "it" : "them") from Search."
                } else if outcome.added == 0 {
                    problem = "No food was found in the photo."
                }
            } catch let error as MealPhotoError {
                problem = error.message
            } catch {
                problem = "The server can't be reached. Check the connection and try again."
            }
        }
    }
}

/// The photo as it is sent, and the same pixels to show.
private struct MealPhoto: Sendable {
    let jpeg: Data
    let preview: UIImage

    init?(_ data: Data) {
        guard let jpeg = MealPhotoImage.jpeg(from: data), let preview = UIImage(data: jpeg) else { return nil }
        self.jpeg = jpeg
        self.preview = preview
    }
}

/// The system camera, handing back the photo as JPEG data.
private struct CameraCapture: UIViewControllerRepresentable {
    let captured: (Data) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_: UIImagePickerController, context _: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraCapture

        init(parent: CameraCapture) {
            self.parent = parent
        }

        func imagePickerController(_: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let data = (info[.originalImage] as? UIImage)?.jpegData(compressionQuality: 0.9) { parent.captured(data) }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_: UIImagePickerController) {
            parent.dismiss()
        }
    }
}
