import Feedback
import PhotosUI
import SwiftUI

/// An editor's package photos and their read into a `Label`: a food's or a supplement's. Every change to the photos
/// reads all of them again in one call, replacing a read still running, so the answer always covers every photo shown.
@MainActor @Observable
final class PhotoReader<Label: Equatable & Sendable> {
    enum State: Equatable {
        case idle, reading
        case read(Label)
        case failed(String)
    }

    /// The server takes eight.
    static var limit: Int { 8 }

    private(set) var photos: [PhotoUpload]
    private(set) var state = State.idle
    @ObservationIgnored private let reading: @Sendable ([Data]) async throws -> Label
    @ObservationIgnored private var task: Task<Void, Never>?
    @ObservationIgnored private var restored: Set<PhotoUpload.ID> = []

    init(photos: [PhotoUpload] = [], reading: @escaping @Sendable ([Data]) async throws -> Label) {
        self.photos = photos
        self.reading = reading
        read()
    }

    func add(_ added: [PhotoUpload]) {
        let room = Self.limit - photos.count
        guard room > 0, !added.isEmpty else { return }
        photos += added.prefix(room)
        read()
    }

    /// Photos the editor opens with, which its fields already reflect. They go first and start no read, and neither
    /// does removing one: only a photo added here is news, and then all of them are read together.
    func restore(_ stored: [PhotoUpload]) {
        restored.formUnion(stored.map(\.id))
        photos = stored + photos
    }

    func remove(_ id: PhotoUpload.ID) {
        photos.removeAll { $0.id == id }
        read()
    }

    func read() {
        task?.cancel()
        guard photos.contains(where: { !restored.contains($0.id) }) else {
            state = .idle
            return
        }
        state = .reading
        let jpegs = photos.map(\.jpeg)
        task = Task { [reading] in
            do {
                let label = try await reading(jpegs)
                if !Task.isCancelled { state = .read(label) }
            } catch {
                guard !Task.isCancelled else { return }
                FoodSearch.log.info("Reading photos failed: \(String(describing: error))")
                state = .failed((error as? MealPhotoError)?.message ?? "The server can't be reached. Check the connection and try again.")
            }
        }
    }

    func cancel() {
        task?.cancel()
    }
}

typealias FoodPhotoReader = PhotoReader<FoodLabel>

extension PhotoReader where Label == FoodLabel {
    convenience init(photos: [PhotoUpload] = [], reader: any FoodLabelReader = FoodLabelClient.live) {
        self.init(photos: photos) { try await reader.read(jpegs: $0) }
    }
}

/// Photos of the package at the top of an editor: thumbnails, the camera, and the library (several at once).
/// `nothingRead` is the label of photos that show nothing to fill in.
struct PhotosSection<Label: Equatable & Sendable>: View {
    let reader: PhotoReader<Label>
    let nothingRead: Label
    @State private var choosing = false
    @State private var picked: [PhotosPickerItem] = []
    @State private var loading = false

    var body: some View {
        ThemedSection("Photos") {
            if !reader.photos.isEmpty {
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(reader.photos) { photo in
                            Image(uiImage: photo.preview)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 72, height: 72)
                                .clipShape(.rect(cornerRadius: 10))
                                .accessibilityLabel("Photo")
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
                if Camera.isAvailable {
                    Button("Camera", systemImage: "camera") { Camera.capture { image in load { [PhotoUpload(image)].compactMap(\.self) } } }.secondaryPill()
                }
                Button("Photos", systemImage: "photo.on.rectangle") { choosing = true }.secondaryPill().accessibilityLabel("Choose Photos")
            }
            .disabled(reader.photos.count >= PhotoReader<Label>.limit || loading)
            // On the row, not the section: a section hands its modifiers to every row, which presented a picker per row.
            .photosPicker(isPresented: $choosing, selection: $picked, maxSelectionCount: PhotoReader<Label>.limit - reader.photos.count, matching: .images)
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
            SwiftUI.Label(label == nothingRead ? "Nothing to read in the photos" : "Filled in from the photos", systemImage: label == nothingRead ? "questionmark.circle" : "checkmark.circle")
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
