import AVFoundation
import Feedback
import SwiftUI
import VisionKit

/// Scan (`log-12-scan-barcode.jpg`): the camera reads a barcode with VisionKit's data scanner, and the keyboard button
/// takes a typed one (Manual Barcode). A known barcode opens the food detail. An unknown one opens Create Food with the
/// barcode filled in and the photo the scanner took as it read the barcode already being read, so a store's deli label
/// fills its own nutrition (docs/decisions/nutrition.md).
struct ScanTab: View {
    let session: LoggerSession
    let open: (LoggerPick) -> Void
    @State private var typing = false
    @State private var typed = ""
    @State private var looking = false
    @State private var problem: String?
    @State private var choosing: StoreChoice?
    @State private var creating: NewFood?
    /// The scanner only reads while this tab is on screen, so a scan never pushes a second detail over the first.
    @State private var visible = false
    /// `DataScannerViewController.isAvailable` stays false until camera access is granted, and nothing else asks.
    @State private var cameraWorks = false

    var body: some View {
        ZStack {
            if cameraWorks {
                BarcodeScanner(paused: !visible || looking || typing || problem != nil || choosing != nil || creating != nil) { barcode, photo in
                    lookup(barcode, photo: photo)
                }
                .ignoresSafeArea(edges: .bottom)
            } else {
                ContentUnavailableView {
                    Label("Camera unavailable", systemImage: "camera")
                } description: {
                    Text("Type the barcode number instead.")
                } actions: {
                    Button("Enter Barcode") { typing = true }.primaryPill().fixedSize()
                }
            }
            if looking {
                ProgressView("Looking up barcode").padding(Theme.margin).glassEffect(in: .rect(cornerRadius: Theme.cornerRadius))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay(alignment: .topTrailing) {
            RoundIconButton("Manual Barcode", systemImage: "keyboard") { typing = true }
                .padding(16)
        }
        .overlay(alignment: .bottomTrailing) {
            LogFoodsButton(session: session).controlSize(.large).padding(16)
        }
        .onAppear { visible = true }
        .onDisappear { visible = false }
        .task {
            guard DataScannerViewController.isSupported else { return }
            if AVCaptureDevice.authorizationStatus(for: .video) == .notDetermined {
                _ = await AVCaptureDevice.requestAccess(for: .video)
            }
            cameraWorks = DataScannerViewController.isAvailable
        }
        .alert("Manual Barcode", isPresented: $typing) {
            TextField("Enter the barcode number", text: $typed).keyboardType(.numberPad)
            Button("Lookup Barcode") { lookup(typed, photo: nil) }
            Button("Cancel", role: .cancel) {}
        }
        .alert("Barcode", isPresented: .isPresent($problem)) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(problem ?? "")
        }
        .alert("Which store is it from?", isPresented: .isPresent($choosing), presenting: choosing) { choice in
            ForEach(choice.foods, id: \.id) { food in
                Button("\(food.store ?? "No store") · \(food.name)") { open(LoggerPick(choice.barcode.portion(of: food))) }
            }
            Button("New Food") { Task { await create(choice.barcode, photo: choice.photo) } }
            Button("Cancel", role: .cancel) {}
        } message: { _ in
            Text("Stores number their own items, so this code names a food at each of these stores.")
        }
        .sheet(item: $creating) { new in
            FoodEditor(draft: new.draft, photos: new.photos, onCreate: { food in open(LoggerPick(new.barcode.portion(of: food))) })
        }
        .feedback(self)
    }

    private func lookup(_ text: String, photo: Task<UIImage?, Never>?) {
        guard !looking else { return }
        looking = true
        Task {
            let outcome = await session.lookup(barcode: text)
            switch outcome {
            case let .found(portion):
                looking = false
                typed = ""
                open(LoggerPick(portion))
            case let .stores(foods, barcode):
                looking = false
                choosing = StoreChoice(foods: foods, barcode: barcode, photo: photo)
            case let .notFound(barcode):
                typed = ""
                await create(barcode, photo: photo)
                looking = false
            case .invalid:
                looking = false
                problem = "A barcode has 8 to 14 digits."
            case .unreachable:
                looking = false
                problem = "The food database can't be reached. Check the connection and try again."
            }
        }
    }

    /// Create Food for an unknown barcode, reading the scanner's photo of the package straight away.
    private func create(_ barcode: ScannedBarcode, photo: Task<UIImage?, Never>?) async {
        let image = await photo?.value
        let upload = await Task.detached { image.flatMap(PhotoUpload.init) }.value
        var draft = FoodDraft()
        draft.barcode = barcode.code
        creating = NewFood(barcode: barcode, draft: draft, photos: FoodPhotoReader(photos: upload.map { [$0] } ?? []))
    }
}

/// A store item code several stores' foods share, waiting for the owner to pick the store.
private struct StoreChoice {
    let foods: [Food]
    let barcode: ScannedBarcode
    let photo: Task<UIImage?, Never>?
}

private struct NewFood: Identifiable {
    let id = UUID()
    let barcode: ScannedBarcode
    let draft: FoodDraft
    let photos: FoodPhotoReader
}

/// VisionKit's `DataScannerViewController` reading retail barcodes, reporting the first one it recognizes while not
/// paused, with a photo it starts taking at that moment: the package is still in front of the camera, and a store's
/// label shows its nutrition facts beside the barcode.
private struct BarcodeScanner: UIViewControllerRepresentable {
    let paused: Bool
    let found: (String, Task<UIImage?, Never>) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.ean8, .ean13, .upce, .itf14, .code128, .gs1DataBar, .gs1DataBarExpanded, .gs1DataBarLimited])],
            qualityLevel: .balanced, isHighlightingEnabled: true
        )
        scanner.delegate = context.coordinator
        return scanner
    }

    func updateUIViewController(_ scanner: DataScannerViewController, context: Context) {
        context.coordinator.parent = self
        guard !scanner.isScanning else { return }
        do {
            try scanner.startScanning()
        } catch {
            FoodSearch.log.error("The barcode scanner did not start: \(String(describing: error))")
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        var parent: BarcodeScanner

        init(parent: BarcodeScanner) {
            self.parent = parent
        }

        func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
            guard !parent.paused else { return }
            for case let .barcode(barcode) in addedItems {
                if let payload = barcode.payloadStringValue {
                    parent.found(payload, Task { try? await dataScanner.capturePhoto() })
                    return
                }
            }
        }
    }
}
