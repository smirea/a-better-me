import SwiftUI

/// A setting row whose explanation stays out of the way: with `info`, the title carries a small info mark, a tap on it
/// shows the explanation under the whole row, and a second tap hides it. Whether it is open persists per title.
struct SettingRow<Control: View>: View {
    let title: String
    var systemImage: String?
    var info: String?
    @ViewBuilder let control: Control
    @AppStorage private var expanded: Bool

    init(title: String, systemImage: String? = nil, info: String? = nil, @ViewBuilder control: () -> Control) {
        self.title = title
        self.systemImage = systemImage
        self.info = info
        self.control = control()
        _expanded = AppStorage(wrappedValue: false, "settings.info.\(title)")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 12) {
                if info != nil {
                    Button { withAnimation(.snappy) { expanded.toggle() } } label: { label.contentShape(.rect) }
                        .buttonStyle(.plain)
                        .accessibilityHint(expanded ? "Hides the explanation" : "Shows the explanation")
                } else {
                    label
                }
                Spacer(minLength: 8)
                control
            }
            if let info, expanded {
                Text(info)
                    .font(AppFont.rowDetail)
                    .foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .transition(.opacity)
            }
        }
    }

    private var label: some View {
        let mark = info == nil ? Text("") : Text("  \(Image(systemName: "info.circle"))").font(.caption).foregroundStyle(Theme.textTertiary)
        return RowLabel(title: Text(title) + mark, systemImage: systemImage)
    }
}

struct SettingToggle: View {
    let title: String
    let systemImage: String
    var info: String?
    @Binding var isOn: Bool

    init(title: String, systemImage: String, info: String? = nil, isOn: Binding<Bool>) {
        self.title = title
        self.systemImage = systemImage
        self.info = info
        _isOn = isOn
    }

    var body: some View {
        SettingRow(title: title, systemImage: systemImage, info: info) {
            Toggle(title, isOn: $isOn)
                .labelsHidden()
                .tint(Theme.accent)
                .accessibilityLabel(title)
        }
    }
}

struct SettingLink<Destination: View>: View {
    let title: String
    var detail: String?
    let systemImage: String
    @ViewBuilder let destination: () -> Destination

    init(title: String, detail: String? = nil, systemImage: String, @ViewBuilder destination: @escaping () -> Destination) {
        self.title = title
        self.detail = detail
        self.systemImage = systemImage
        self.destination = destination
    }

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
    var info: String?

    var body: some View {
        SettingRow(title: title, systemImage: systemImage, info: info) {
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
