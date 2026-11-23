import SwiftUI

/// A wizard's choice row, flat on the page: icon, title, optional detail, and its `SelectionMark` over a hairline.
struct WizardOption: View {
    var icon: String?
    let title: String
    let subtitle: String?
    var tag: String?
    let selected: Bool
    let action: () -> Void
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                if let icon {
                    Image(systemName: icon).font(.system(size: 20, weight: .semibold)).frame(width: 28)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(AppFont.rowTitle)
                    if let subtitle {
                        Text(subtitle).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                    }
                    if let tag {
                        Text(tag).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                SelectionMark(isOn: selected)
            }
            .multilineTextAlignment(.leading)
            .padding(.vertical, 12)
            .overlay(alignment: .bottom) { Divider().overlay(Theme.separator) }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .opacity(isEnabled ? 1 : 0.5)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// The radio or checkbox at a choice row's trailing edge: white when on, tertiary when off, one size everywhere.
struct SelectionMark: View {
    enum Style { case radio, check }

    let isOn: Bool
    var style = Style.radio

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: 22))
            .foregroundStyle(isOn ? Theme.textPrimary : Theme.textTertiary)
            .accessibilityHidden(true)
    }

    private var symbol: String {
        switch style {
        case .radio: isOn ? "record.circle.fill" : "circle"
        case .check: isOn ? "checkmark.square.fill" : "square"
        }
    }
}
