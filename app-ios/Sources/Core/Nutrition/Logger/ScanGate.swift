import Foundation

/// Which scanned barcodes the logger acts on. VisionKit's scanner reports a code each time it starts recognizing it, so
/// one package held in frame can arrive again: tracking lost and found, the scanner resuming, or a new scanner after
/// Create Food closes. One barcode is handled at a time, and the code just handled is ignored for `cooldown` after the
/// screen it opened closes, so a package still in frame doesn't open its screen again (docs/decisions/nutrition.md).
struct ScanGate: Hashable, Sendable {
    static let cooldown: TimeInterval = 3

    /// The barcode whose lookup or screen is open.
    private(set) var held: String?
    private var last: String?
    private var closedAt: Date?

    /// Whether to act on `code` now. Admitting it holds the gate until `release`.
    mutating func admit(_ code: String, at now: Date) -> Bool {
        guard held == nil else { return false }
        if code == last, let closedAt, now < closedAt.addingTimeInterval(Self.cooldown) { return false }
        held = code
        return true
    }

    /// The screen the held barcode opened is closed, and the scanner is back.
    mutating func release(at now: Date) {
        guard let held else { return }
        last = held
        closedAt = now
        self.held = nil
    }
}
