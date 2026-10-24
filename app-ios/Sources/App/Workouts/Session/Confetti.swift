import SwiftUI

/// Falling colored rectangles over Workout Complete when the session set a record. Removes itself after `duration`.
struct ConfettiOverlay: View {
    static let duration: TimeInterval = 3

    private struct Piece {
        var x: Double
        var delay: Double
        var speed: Double
        var drift: Double
        var spin: Double
        var size: CGSize
        var color: Color
    }

    private static let colors = [Theme.accent, Theme.lavender, Theme.green, Theme.amber, Theme.muscle, Theme.textPrimary]

    private let pieces: [Piece] = {
        var generator = SystemRandomNumberGenerator()
        return (0..<80).map { _ in
            Piece(
                x: .random(in: 0...1, using: &generator),
                delay: .random(in: 0...0.8, using: &generator),
                speed: .random(in: 0.9...1.4, using: &generator),
                drift: .random(in: -60...60, using: &generator),
                spin: .random(in: 2...6, using: &generator),
                size: CGSize(width: .random(in: 6...10, using: &generator), height: .random(in: 10...16, using: &generator)),
                color: colors.randomElement(using: &generator)!
            )
        }
    }()

    private let startedAt = Date.now
    @State private var isDone = false

    var body: some View {
        if !isDone {
            TimelineView(.animation) { context in
                let elapsed = context.date.timeIntervalSince(startedAt)
                Canvas { canvas, size in
                    for piece in pieces {
                        let t = max(0, elapsed - piece.delay) * piece.speed
                        let progress = t / Self.duration
                        guard progress < 1.1 else { continue }
                        let y = -20 + progress * (size.height + 40)
                        let x = piece.x * size.width + sin(t * 2) * piece.drift
                        var context = canvas
                        context.translateBy(x: x, y: y)
                        context.rotate(by: .radians(t * piece.spin))
                        context.opacity = progress > 0.8 ? max(0, 1 - (progress - 0.8) / 0.3) : 1
                        let rect = CGRect(x: -piece.size.width / 2, y: -piece.size.height / 2, width: piece.size.width, height: piece.size.height)
                        context.fill(Path(roundedRect: rect, cornerRadius: 1.5), with: .color(piece.color))
                    }
                }
            }
            .allowsHitTesting(false)
            .ignoresSafeArea()
            .accessibilityHidden(true)
            .task {
                try? await Task.sleep(for: .seconds(Self.duration + 1.5))
                isDone = true
            }
        }
    }
}
