import AVFoundation
import SwiftUI
import VisionKit

/// Scan (`log-12-scan-barcode.jpg`): the camera reads a barcode with VisionKit's data scanner, and the keyboard button
/// takes a typed one (Manual Barcode). Either opens the food detail. Label scanning is not built
/// (docs/decisions/nutrition.md).
struct ScanTab: View {
    let session: LoggerSession
    let open: (LoggerPick) -> Void
    @State private var typing = false
    @State private var typed = ""
    @State private var looking = false
    @State private var problem: String?
    /// The scanner only reads while this tab is on screen, so a scan never pushes a second detail over the first.
    @State private var visible = false
    /// `DataScannerViewController.isAvailable` stays false until camera access is granted, and nothing else asks.
    @State private var cameraWorks = false

    var body: some View {
        ZStack {
            if cameraWorks {
                BarcodeScanner(paused: !visible || looking || typing || problem != nil) { barcode in lookup(barcode) }
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
                ProgressView("Looking up barcode").padding(20).glassEffect(in: .rect(cornerRadius: Theme.cornerRadius))
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
            Button("Lookup Barcode") { lookup(typed) }
            Button("Cancel", role: .cancel) {}
        }
        .alert("Barcode", isPresented: .isPresent($problem)) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(problem ?? "")
        }
    }

    private func lookup(_ text: String) {
        guard !looking else { return }
        looking = true
        Task {
            let outcome = await session.lookup(barcode: text)
            looking = false
            switch outcome {
            case let .found(food):
                typed = ""
                open(LoggerPick(FoodPortion(food.snapshot)))
            case let .notFound(barcode): problem = "No food has the barcode \(barcode)."
            case .invalid: problem = "A barcode has 8 to 14 digits."
            case .unreachable: problem = "The food database can't be reached. Check the connection and try again."
            }
        }
    }
}

/// VisionKit's `DataScannerViewController` reading retail barcodes, reporting the first one it recognizes while not
/// paused.
private struct BarcodeScanner: UIViewControllerRepresentable {
    let paused: Bool
    let found: (String) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.ean8, .ean13, .upce, .itf14, .code128])],
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
                    parent.found(payload)
                    return
                }
            }
        }
    }
}
