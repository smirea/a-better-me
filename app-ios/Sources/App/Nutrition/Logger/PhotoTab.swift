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
                ProgressView("Finding foods").padding(20).glassEffect(in: .rect(cornerRadius: Theme.cornerRadius))
            }
        }
        .safeAreaInset(edge: .bottom) {
            HStack(spacing: 10) {
                Button("Find Foods", action: findFoods)
                    .primaryPill()
                    .disabled(photo == nil || session.isFindingFoods)
                LogFoodsButton(session: session)
                    .controlSize(.large)
                    .disabled(session.isFindingFoods)
            }
            .padding(.horizontal, Theme.margin)
            .padding(.bottom, 8)
        }
        .photosPicker(isPresented: $choosing, selection: $picked, matching: .images)
        .fullScreenCover(isPresented: $capturing) {
            CameraCapture { image in load { MealPhoto(image) } }.ignoresSafeArea()
        }
        .onChange(of: picked) {
            guard let picked else { return }
            Task {
                let data = try? await picked.loadTransferable(type: Data.self)
                self.picked = nil
                if let data { load { MealPhoto(data) } } else { unreadable = true }
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
    private func load(_ prepare: @escaping @Sendable () -> MealPhoto?) {
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

/// The photo as it is sent, and the same pixels to show.
private struct MealPhoto: Sendable {
    let jpeg: Data
    let preview: UIImage

    init?(_ data: Data) {
        guard let jpeg = MealPhotoImage.jpeg(from: data), let preview = UIImage(data: jpeg) else { return nil }
        self.jpeg = jpeg
        self.preview = preview
    }

    /// A camera photo, shrunk before it is encoded so the full-size frame is never compressed.
    init?(_ image: UIImage) {
        let pixels = CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
        let scale = min(1, Double(MealPhotoImage.maxPixels) / max(pixels.width, pixels.height))
        guard let small = image.preparingThumbnail(of: CGSize(width: pixels.width * scale, height: pixels.height * scale)),
              let jpeg = small.jpegData(compressionQuality: 0.7) else { return nil }
        self.jpeg = jpeg
        preview = small
    }
}

/// The system camera, handing back the photo as taken.
private struct CameraCapture: UIViewControllerRepresentable {
    let captured: (UIImage) -> Void
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
            if let image = info[.originalImage] as? UIImage { parent.captured(image) }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_: UIImagePickerController) {
            parent.dismiss()
        }
    }
}
