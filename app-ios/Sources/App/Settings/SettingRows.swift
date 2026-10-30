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

/// A value shown under its title with an Edit menu beside it, like the reference app's Edit buttons.
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
                Text("Edit")
            }
            .chipButton()
            .accessibilityLabel("Edit \(title)")
        } label: {
            RowLabel(title: title, detail: options.first { $0.value == selection }?.title ?? "", systemImage: systemImage)
        }
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
