import SwiftUI

/// A list section on the card surface with the app's section title. Lists use it instead of `Section` so every row
/// draws on `Theme.surface`.
struct ThemedSection<Content: View>: View {
    var title: String?
    var subtitle: String?
    var footer: String?
    @ViewBuilder let content: Content

    init(_ title: String? = nil, subtitle: String? = nil, footer: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.subtitle = subtitle
        self.footer = footer
        self.content = content()
    }

    var body: some View {
        Section {
            content
        } header: {
            VStack(alignment: .leading, spacing: 4) {
                if let title { SectionTitle(title) }
                if let subtitle { Text(subtitle).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary) }
            }
            .textCase(nil)
        } footer: {
            if let footer { Text(footer) }
        }
        .listRowBackground(Theme.surface)
    }
}

/// A capsule chip for filters, choices, and quick values. Active chips fill white. Small chips are the Food Log's hour
/// pills.
struct Chip: View {
    enum Size { case small, regular }

    let title: String
    var systemImage: String?
    var trailingImage: String?
    var isActive = false
    var size = Size.regular

    var body: some View {
        HStack(spacing: size == .small ? 3 : 6) {
            if let systemImage { Image(systemName: systemImage).imageScale(.small) }
            Text(title).lineLimit(1)
            if let trailingImage { Image(systemName: trailingImage).imageScale(.small) }
        }
        .font(size == .small ? AppFont.badge : AppFont.chip)
        .foregroundStyle(isActive ? Theme.onPrimary : Theme.textPrimary)
        .padding(.horizontal, size == .small ? 8 : 12)
        .frame(height: size == .small ? 22 : 32)
        .background(isActive ? Theme.textPrimary : Theme.surfaceRaised, in: .capsule)
    }
}

/// Rows of its children that wrap when the next one would not fit, each centered on its row, so a bar of actions
/// never hides one off-screen.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let items = frames(subviews, width: proposal.width ?? .infinity)
        return CGSize(width: items.map(\.maxX).max() ?? 0, height: items.map(\.maxY).max() ?? 0)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for (subview, frame) in zip(subviews, frames(subviews, width: bounds.width)) {
            subview.place(at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY), proposal: ProposedViewSize(frame.size))
        }
    }

    private func frames(_ subviews: Subviews, width: CGFloat) -> [CGRect] {
        var rows: [[CGSize]] = [[]]
        var x: CGFloat = 0
        for size in subviews.map({ $0.sizeThatFits(.unspecified) }) {
            if !rows[rows.count - 1].isEmpty, x + size.width > width {
                rows.append([])
                x = 0
            }
            rows[rows.count - 1].append(size)
            x += size.width + spacing
        }
        var frames: [CGRect] = []
        var y: CGFloat = 0
        for row in rows where !row.isEmpty {
            let height = row.map(\.height).max() ?? 0
            var x: CGFloat = 0
            for size in row {
                frames.append(CGRect(x: x, y: y + (height - size.height) / 2, width: size.width, height: size.height))
                x += size.width + spacing
            }
            y += height + spacing
        }
        return frames
    }
}

struct RoundIconButton: View {
    enum Size { case small, regular }

    let title: String
    let systemImage: String
    var size = Size.regular
    var role: ButtonRole?
    let action: () -> Void

    init(_ title: String, systemImage: String, size: Size = .regular, role: ButtonRole? = nil, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.size = size
        self.role = role
        self.action = action
    }

    var body: some View {
        // A fixed glyph frame keeps every circle the same size, whatever the symbol's own width.
        Button(role: role, action: action) {
            Image(systemName: systemImage).frame(width: glyph, height: glyph)
        }
        .accessibilityLabel(title)
        .buttonStyle(.glass)
        .buttonBorderShape(.circle)
        .controlSize(size == .small ? .small : .regular)
    }

    private var glyph: CGFloat { size == .small ? 16 : 22 }
}

/// A thin capsule bar for a nutrient or goal's progress: `ProgressView(value:).progressViewStyle(.bar(color))`.
struct BarProgressStyle: ProgressViewStyle {
    var color: Color
    var height: CGFloat = 4

    func makeBody(configuration: Configuration) -> some View {
        Capsule()
            .fill(Theme.surfaceRaised)
            .overlay(alignment: .leading) {
                GeometryReader { proxy in
                    Capsule().fill(color).frame(width: proxy.size.width * min(1, max(0, configuration.fractionCompleted ?? 0)))
                }
            }
            .frame(height: height)
    }
}

extension ProgressViewStyle where Self == BarProgressStyle {
    static func bar(_ color: Color, height: CGFloat = 4) -> BarProgressStyle { BarProgressStyle(color: color, height: height) }
}

extension Binding {
    /// True while an optional is set; setting false clears it. For `isPresented:` APIs driven by an optional.
    static func isPresent<Wrapped>(_ value: Binding<Wrapped?>) -> Binding<Bool> where Value == Bool {
        Binding(get: { value.wrappedValue != nil }, set: { if !$0 { value.wrappedValue = nil } })
    }
}

struct NameAlert: ViewModifier {
    let title: String
    @Binding var isPresented: Bool
    let initial: String
    let placeholder: String
    let confirm: String
    let onSave: (String) -> Void

    @State private var name = ""

    func body(content: Content) -> some View {
        content
            .alert(title, isPresented: $isPresented) {
                TextField(placeholder, text: $name)
                Button(confirm) {
                    let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !name.isEmpty { onSave(name) }
                }
                Button("Cancel", role: .cancel) {}
            }
            .onChange(of: isPresented) { _, shown in
                if shown { name = initial }
            }
    }
}
