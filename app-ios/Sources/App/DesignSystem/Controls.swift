import Feedback
import SwiftUI

/// A list section with the app's section title. Lists use it instead of `Section`. In a grouped Settings list its rows
/// draw on the `Theme.surface` card; under `flatList()` (content and editors) they draw flat on `Theme.background`
/// with a `FlatSection`-style header. A titled section with `info` explains itself the way `SettingRow` does: an info
/// mark on the title, whose tap shows the explanation under it.
struct ThemedSection<Content: View, Actions: View>: View {
    @Environment(\.flatSections) private var flat
    var title: String?
    var subtitle: String?
    var info: String?
    @ViewBuilder let content: Content
    /// `SectionHeader`'s underlined text actions, trailing the title.
    @ViewBuilder let actions: Actions
    @AppStorage private var expanded: Bool

    init(
        _ title: String? = nil, subtitle: String? = nil, info: String? = nil,
        @ViewBuilder content: () -> Content, @ViewBuilder actions: () -> Actions
    ) {
        self.title = title
        self.subtitle = subtitle
        self.info = info
        self.content = content()
        self.actions = actions()
        _expanded = AppStorage(wrappedValue: false, "section.info.\(title ?? "")")
    }

    var body: some View {
        Section {
            content
        } header: {
            if title != nil || subtitle != nil {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        if let title {
                            if let info {
                                Button { withAnimation(.snappy) { expanded.toggle() } } label: {
                                    Text("\(title)  \(Text(Image(systemName: "info.circle")).font(.caption).foregroundStyle(Theme.textTertiary))")
                                        .font(AppFont.listTitle)
                                        .foregroundStyle(Theme.textPrimary)
                                }
                                .buttonStyle(.plain)
                                // Its own name, so it never collides with a row that shares the section's title.
                                .accessibilityLabel("\(title) Info")
                                .accessibilityHint(expanded ? "Hides the explanation" : "Shows the explanation")
                                if expanded {
                                    Text(info).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary).fixedSize(horizontal: false, vertical: true)
                                }
                            } else {
                                SectionTitle(title)
                            }
                        }
                        if let subtitle { Text(subtitle).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary) }
                    }
                    Spacer(minLength: 0)
                    actions
                        .font(AppFont.rowTitle)
                        .underline()
                        .foregroundStyle(Theme.textPrimary)
                }
                .textCase(nil)
                .listRowInsets(flat ? EdgeInsets(top: 16, leading: Theme.margin, bottom: 8, trailing: Theme.margin) : nil)
            }
        }
        // The background fills the whole cell, unlike the row's content, so a tap on a row's padding selects the row.
        .listRowBackground((flat ? Theme.background : Theme.surface).feedback(title.map { "\($0) Row" } ?? "Row"))
        // `flatList()` zeroes the list's own margins, so flat rows and headers keep the app's margin.
        .listRowInsets(flat ? EdgeInsets(top: 11, leading: Theme.margin, bottom: 11, trailing: Theme.margin) : nil)
        .listSectionSeparator(flat ? .hidden : .automatic)
    }
}

extension EnvironmentValues {
    @Entry var flatSections = false
}

extension View {
    /// A content list or editor (a `Form` or `List`) drawn flat: full-width rows on `Theme.background` with hairline
    /// separators, every `ThemedSection` without its card. Grouped Settings keep `themedList()`'s cards.
    func flatList() -> some View {
        listStyle(.grouped)
            .themedList()
            .contentMargins(.horizontal, 0, for: .scrollContent)
            .environment(\.flatSections, true)
    }

    /// A raw `Section` inside `flatList()`, one that needs its own header, drawn as a flat `ThemedSection` draws its rows.
    func flatSectionRows() -> some View {
        listRowBackground(Theme.background)
            .listRowInsets(EdgeInsets(top: 11, leading: Theme.margin, bottom: 11, trailing: Theme.margin))
            .listSectionSeparator(.hidden)
    }

    /// `flatList()` for a plain list, which already runs rows edge to edge on the app's margin.
    func flatPlainList() -> some View {
        listStyle(.plain)
            .themedList()
            .environment(\.flatSections, true)
    }
}

extension ThemedSection where Actions == EmptyView {
    init(_ title: String? = nil, subtitle: String? = nil, info: String? = nil, @ViewBuilder content: () -> Content) {
        self.init(title, subtitle: subtitle, info: info, content: content) { EmptyView() }
    }
}

/// A flat content section for `ScrollView` / `LazyVStack` screens: an optional
/// `SectionHeader` (with optional muted subtitle), and content directly on `Theme.background` without a `Theme.surface`
/// card wrapper.
struct FlatSection<HeaderAction: View, Content: View>: View {
    var title: String?
    var subtitle: String?
    var spacing: CGFloat = 10
    @ViewBuilder let headerAction: HeaderAction
    @ViewBuilder let content: Content

    init(
        _ title: String? = nil,
        subtitle: String? = nil,
        spacing: CGFloat = 10,
        @ViewBuilder headerAction: () -> HeaderAction,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.spacing = spacing
        self.headerAction = headerAction()
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: spacing) {
            if title != nil || subtitle != nil {
                VStack(alignment: .leading, spacing: 4) {
                    if let title {
                        SectionHeader(title) { headerAction }
                    }
                    if let subtitle {
                        Text(subtitle).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                    }
                }
            }
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

extension FlatSection where HeaderAction == EmptyView {
    init(
        _ title: String? = nil,
        subtitle: String? = nil,
        spacing: CGFloat = 10,
        @ViewBuilder content: () -> Content
    ) {
        self.init(title, subtitle: subtitle, spacing: spacing, headerAction: { EmptyView() }, content: content)
    }
}

/// A capsule chip for filters, choices, and quick values. Active chips fill white. Small chips are the Food Log's hour
/// pills, which share one `width` so their column lines up.
struct Chip: View {
    enum Size { case small, regular }

    let title: String
    var systemImage: String?
    var trailingImage: String?
    var isActive = false
    var size = Size.regular
    var width: CGFloat?

    var body: some View {
        HStack(spacing: size == .small ? 3 : 6) {
            if let systemImage { Image(systemName: systemImage).imageScale(.small) }
            Text(title).lineLimit(1)
            if let trailingImage { Image(systemName: trailingImage).imageScale(.small) }
        }
        .font(size == .small ? AppFont.badge : AppFont.chip)
        .foregroundStyle(isActive ? Theme.onPrimary : Theme.textPrimary)
        .padding(.horizontal, width != nil ? 4 : size == .small ? 8 : 12)
        .frame(width: width, height: size == .small ? 22 : 32)
        .background(isActive ? Theme.textPrimary : Theme.surfaceRaised, in: .capsule)
    }
}

/// Rows of its children, leading-aligned, that wrap when the next one would not fit, so a bar of actions never hides
/// one off-screen. A child wider than the row is offered the row's width.
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
        let sizes = subviews.map { subview in
            let ideal = subview.sizeThatFits(.unspecified)
            return ideal.width > width ? subview.sizeThatFits(ProposedViewSize(width: width, height: nil)) : ideal
        }
        for size in sizes {
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
    var tint: Color?
    let action: () -> Void

    init(_ title: String, systemImage: String, size: Size = .regular, tint: Color? = nil, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.size = size
        self.tint = tint
        self.action = action
    }

    var body: some View {
        // A fixed glyph frame keeps every circle the same size, whatever the symbol's own width.
        Button(action: action) {
            Image(systemName: systemImage).frame(width: glyph, height: glyph).foregroundStyle(tint ?? .primary)
        }
        .accessibilityLabel(title)
        .buttonStyle(.glass)
        .buttonBorderShape(.circle)
        .controlSize(size == .small ? .small : .regular)
    }

    private var glyph: CGFloat { size == .small ? 16 : 22 }
}

/// A filter field in a glass capsule for a screen's bottom edge, placed with `safeAreaInset(edge: .bottom)`. A
/// `.bottomBar` search toolbar item sits where the in-progress workout bar floats once the tab bar is hidden, while a
/// safe area inset stays above it.
struct GlassSearchField: View {
    @Binding var text: String
    let prompt: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundStyle(Theme.textSecondary)
            TextField(prompt, text: $text)
                .submitLabel(.search)
                .autocorrectionDisabled()
                .accessibilityLabel(prompt)
            if !text.isEmpty {
                Button("Clear search", systemImage: "xmark.circle.fill") { text = "" }
                    .labelStyle(.iconOnly)
                    .buttonStyle(.plain)
                    .foregroundStyle(Theme.textSecondary)
                    .frame(width: 44, height: 44)
                    .contentShape(.rect)
            }
        }
        .padding(.leading, 16)
        .padding(.trailing, text.isEmpty ? 16 : 2)
        .frame(height: 48)
        .glassEffect(.regular.interactive(), in: .capsule)
        .padding(.horizontal, Theme.margin)
        .padding(.bottom, 8)
        .feedback(self)
    }
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
