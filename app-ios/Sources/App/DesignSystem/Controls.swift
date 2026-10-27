import SwiftUI

/// A list section on the card surface with the app's section title. Lists use it instead of `Section` so every row
/// draws on `Theme.surface`.
struct ThemedSection<Content: View>: View {
    var title: String?
    var footer: String?
    @ViewBuilder let content: Content

    init(_ title: String? = nil, footer: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.footer = footer
        self.content = content()
    }

    var body: some View {
        Section {
            content
        } header: {
            if let title { SectionTitle(title).textCase(nil) }
        } footer: {
            if let footer { Text(footer) }
        }
        .listRowBackground(Theme.surface)
    }
}

/// A capsule chip for filters, choices, and quick values. Active chips fill white.
struct Chip: View {
    let title: String
    var systemImage: String?
    var trailingImage: String?
    var isActive = false

    var body: some View {
        HStack(spacing: 6) {
            if let systemImage { Image(systemName: systemImage).imageScale(.small) }
            Text(title).lineLimit(1)
            if let trailingImage { Image(systemName: trailingImage).imageScale(.small) }
        }
        .font(AppFont.chip)
        .foregroundStyle(isActive ? Theme.onPrimary : Theme.textPrimary)
        .padding(.horizontal, 12)
        .frame(height: 32)
        .background(isActive ? Theme.textPrimary : Theme.surfaceRaised, in: .capsule)
    }
}

/// A round glass icon button.
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
        Button(title, systemImage: systemImage, role: role, action: action)
            .labelStyle(.iconOnly)
            .buttonStyle(.glass)
            .buttonBorderShape(.circle)
            .controlSize(size == .small ? .small : .regular)
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
