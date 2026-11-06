import SwiftUI

/// A number over its caption, with an optional unit. Regular stats lead a detail screen's chart and fill Strategy's
/// cards; compact ones flank a focus card's ring or sum.
struct StatView: View {
    enum Size { case regular, compact }

    init(title: String, value: String, unit: String? = nil, size: Size = .regular, symbol: (name: String, color: Color)? = nil) {
        self.title = title
        self.value = value
        self.unit = unit
        self.size = size
        self.symbol = symbol
    }

    /// A regular stat whose value already carries its unit, as Strategy writes "2,259 kcal".
    init(value: String, caption: String) {
        self.init(title: caption, value: value)
    }

    let title: String
    let value: String
    var unit: String?
    var size = Size.regular
    /// A compact stat's series symbol, tying it to its chart.
    var symbol: (name: String, color: Color)?

    var body: some View {
        Group {
            switch size {
            case .regular:
                VStack(alignment: .leading, spacing: 2) {
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(value).font(AppFont.number(20)).lineLimit(1).minimumScaleFactor(0.7)
                        if let unit { Text(unit).font(AppFont.caption()).foregroundStyle(Theme.textSecondary) }
                    }
                    Text(title).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            case .compact:
                VStack(spacing: 2) {
                    Text(value).font(AppFont.number(19))
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
        .accessibilityElement(children: .combine)
    }
}
