import SwiftUI

/// A number over its caption, with an optional unit and an optional tap action for directly editable stats. Regular
/// stats lead a detail screen's chart and fill Strategy's cards; compact ones flank a focus card's ring or sum.
struct StatView: View {
    enum Size { case regular, compact }

    init(
        title: String,
        value: String,
        unit: String? = nil,
        size: Size = .regular,
        symbol: (name: String, color: Color)? = nil,
        action: (() -> Void)? = nil
    ) {
        self.title = title
        self.value = value
        self.unit = unit
        self.size = size
        self.symbol = symbol
        self.action = action
    }

    /// A regular stat whose value already carries its unit, as Strategy writes "2,259 cal".
    init(value: String, caption: String, action: (() -> Void)? = nil) {
        self.init(title: caption, value: value, action: action)
    }

    let title: String
    let value: String
    var unit: String?
    var size = Size.regular
    /// A compact stat's series symbol, tying it to its chart.
    var symbol: (name: String, color: Color)?
    /// When set, tapping the stat invokes `action` and a subtle chevron beside its caption signals direct editing.
    var action: (() -> Void)?

    var body: some View {
        if let action {
            Button(action: action) {
                statContent(editable: true)
                    .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isButton)
        } else {
            statContent(editable: false)
                .accessibilityElement(children: .combine)
        }
    }

    @ViewBuilder
    private func statContent(editable: Bool) -> some View {
        switch size {
        case .regular:
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: unit == "%" ? 1 : 4) {
                    Text(value)
                        .font(AppFont.number(20))
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    if let unit { Text(unit).font(AppFont.caption()).foregroundStyle(Theme.textSecondary) }
                }
                HStack(spacing: 4) {
                    Text(title).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                    if editable {
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(Theme.textTertiary)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case .compact:
            VStack(spacing: 2) {
                Text(value)
                    .font(AppFont.number(19))
                    .foregroundStyle(Theme.textPrimary)
                Group {
                    if let symbol {
                        Label { Text(title) } icon: { Image(systemName: symbol.name).foregroundStyle(symbol.color) }
                    } else {
                        Text(title)
                    }
                }
                .font(AppFont.rowDetail)
                .foregroundStyle(Theme.textSecondary)
            }
            .frame(maxWidth: .infinity)
        }
    }
}
