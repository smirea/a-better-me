import Feedback
import PhotosUI
import SwiftUI

/// The food editor's package photos and their read. Every change to the photos reads all of them again in one call,
/// replacing a read still running, so the answer always covers every photo shown.
@MainActor @Observable
final class FoodPhotoReader {
    enum State: Equatable {
        case idle, reading
        case read(FoodLabel)
        case failed(String)
    }

    /// The server takes eight.
    static let limit = 8

    private(set) var photos: [PhotoUpload]
    private(set) var state = State.idle
    @ObservationIgnored private let reader: any FoodLabelReader
    @ObservationIgnored private var task: Task<Void, Never>?

    init(photos: [PhotoUpload] = [], reader: any FoodLabelReader = FoodLabelClient.live) {
        self.photos = photos
        self.reader = reader
        read()
    }

    func add(_ added: [PhotoUpload]) {
        let room = Self.limit - photos.count
        guard room > 0, !added.isEmpty else { return }
        photos += added.prefix(room)
        read()
    }

    func remove(_ id: PhotoUpload.ID) {
        photos.removeAll { $0.id == id }
        read()
    }

    func read() {
        task?.cancel()
        guard !photos.isEmpty else {
            state = .idle
            return
        }
        state = .reading
        let jpegs = photos.map(\.jpeg)
        task = Task { [reader] in
            do {
                let label = try await reader.read(jpegs: jpegs)
                if !Task.isCancelled { state = .read(label) }
            } catch {
                guard !Task.isCancelled else { return }
                FoodSearch.log.info("Reading food photos failed: \(String(describing: error))")
                state = .failed((error as? MealPhotoError)?.message ?? "The server can't be reached. Check the connection and try again.")
            }
        }
    }

    func cancel() {
        task?.cancel()
    }
}

/// Photos of the package at the top of the food editor: thumbnails, the camera, and the library (several at once).
struct FoodPhotosSection: View {
    let reader: FoodPhotoReader
    @State private var capturing = false
    @State private var choosing = false
    @State private var picked: [PhotosPickerItem] = []
    @State private var loading = false

    private let cameraWorks = UIImagePickerController.isSourceTypeAvailable(.camera)

    var body: some View {
        ThemedSection("Photos", footer: "Photograph the front, the nutrition facts, and any store label. Gemini reads them together and fills in what they show; a field you change stays yours.") {
            if !reader.photos.isEmpty {
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(reader.photos) { photo in
                            Image(uiImage: photo.preview)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 72, height: 72)
                                .clipShape(.rect(cornerRadius: 10))
                                .accessibilityLabel("Food photo")
                                .overlay(alignment: .topTrailing) {
                                    Button("Remove Photo", systemImage: "xmark.circle.fill") { reader.remove(photo.id) }
                                        .labelStyle(.iconOnly)
                                        .symbolRenderingMode(.palette)
                                        .foregroundStyle(.white, .black.opacity(0.6))
                                        .padding(4)
                                }
                        }
                    }
                }
                .scrollIndicators(.hidden)
            }
            status
            HStack(spacing: 10) {
                if cameraWorks {
                    Button("Camera", systemImage: "camera") { capturing = true }.secondaryPill()
                }
                Button("Photos", systemImage: "photo.on.rectangle") { choosing = true }.secondaryPill().accessibilityLabel("Choose Photos")
            }
            .disabled(reader.photos.count >= FoodPhotoReader.limit || loading)
            // On the row, not the section: a section hands its modifiers to every row, which presented a picker per row.
            .photosPicker(isPresented: $choosing, selection: $picked, maxSelectionCount: FoodPhotoReader.limit - reader.photos.count, matching: .images)
            .fullScreenCover(isPresented: $capturing) {
                CameraCapture { image in load { [PhotoUpload(image)].compactMap(\.self) } }.ignoresSafeArea()
            }
            .onChange(of: picked) {
                guard !picked.isEmpty else { return }
                let items = picked
                picked = []
                Task {
                    var data: [Data] = []
                    for item in items {
                        if let loaded = try? await item.loadTransferable(type: Data.self) { data.append(loaded) }
                    }
                    load { data.compactMap(PhotoUpload.init) }
                }
            }
            .feedback(self)
        }
    }

    @ViewBuilder private var status: some View {
        switch reader.state {
        case .idle: EmptyView()
        case .reading:
            HStack(spacing: 8) {
                ProgressView()
                Text(reader.photos.count == 1 ? "Reading the photo" : "Reading \(reader.photos.count) photos")
                    .foregroundStyle(Theme.textSecondary)
            }
        case let .read(label):
            Label(label == FoodLabel() ? "Nothing to read in the photos" : "Filled in from the photos", systemImage: label == FoodLabel() ? "questionmark.circle" : "checkmark.circle")
                .foregroundStyle(Theme.textSecondary)
        case let .failed(message):
            HStack {
                Text(message).foregroundStyle(Theme.destructive)
                Spacer()
                Button("Retry") { reader.read() }.buttonStyle(.borderless)
            }
        }
    }

    /// Shrinks the photos off the main actor; the full-size originals never stay in memory.
    private func load(_ prepare: @escaping @Sendable () -> [PhotoUpload]) {
        loading = true
        Task {
            let prepared = await Task.detached(operation: prepare).value
            loading = false
            reader.add(prepared)
        }
    }
}
