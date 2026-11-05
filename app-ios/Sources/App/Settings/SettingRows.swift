import SwiftUI

struct SettingToggle: View {
    let title: String
    let detail: String
    let systemImage: String
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) { RowLabel(title: title, detail: detail, systemImage: systemImage) }
            .tint(Theme.accent)
            .accessibilityLabel(title)
    }
}

struct SettingLink<Destination: View>: View {
    let title: String
    let detail: String
    let systemImage: String
    @ViewBuilder let destination: () -> Destination

    var body: some View {
        NavigationLink(destination: destination) { RowLabel(title: title, detail: detail, systemImage: systemImage) }
            .accessibilityLabel(title)
    }
}

struct SettingOption<Value: Hashable>: Identifiable {
    let value: Value
    let title: String
    var detail: String?

    var id: Value { value }
}

/// A setting with its current value trailing as a menu, the way a native menu picker reads: the title on the left, the
/// value and an up-down chevron on the right, and a tap lists every option with its detail.
struct SettingChoice<Value: Hashable>: View {
    let title: String
    var systemImage: String?
    @Binding var selection: Value
    let options: [SettingOption<Value>]

    var body: some View {
        LabeledContent {
            Menu {
                // Menu toggles render as checkmark items and, unlike Picker rows, show a second Text as a subtitle.
                ForEach(options) { option in
                    Toggle(isOn: Binding(get: { selection == option.value }, set: { if $0 { selection = option.value } })) {
                        Text(option.title)
                        if let detail = option.detail { Text(detail) }
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    Text(current)
                    Image(systemName: "chevron.up.chevron.down").imageScale(.small)
                }
                .font(AppFont.rowTitle)
                .foregroundStyle(Theme.textSecondary)
            }
            .accessibilityLabel(title)
            .accessibilityValue(current)
        } label: {
            RowLabel(title: title, systemImage: systemImage)
        }
    }

    private var current: String {
        options.first { $0.value == selection }?.title ?? ""
    }
}

/// A full-width row that restores a screen's defaults.
struct ResetRowButton: View {
    let title: String
    let action: () -> Void

    init(_ title: String, action: @escaping () -> Void) {
        self.title = title
        self.action = action
    }

    var body: some View {
        Button(title, role: .destructive, action: action).frame(maxWidth: .infinity)
    }
}

extension [SettingOption<Int>] {
    static func percents() -> Self {
        stride(from: 0, through: 100, by: 5).map { SettingOption(value: $0, title: "\($0)%") }
    }

    static func restDurations() -> Self {
        stride(from: 0, through: 600, by: 15).map { SettingOption(value: $0, title: $0.minuteSecond) }
    }
}
