import SwiftUI

struct RowLabel: View {
    let title: Text
    var detail: Text?
    /// Sits at the detail line's trailing edge and gives way first, so `detail` stays whole.
    var trailingDetail: Text?
    var systemImage: String?
    var iconTint = Theme.textPrimary
    @ScaledMetric private var trailingMinWidth: CGFloat = 28

    init(title: Text, detail: Text? = nil, trailingDetail: Text? = nil, systemImage: String? = nil, iconTint: Color = Theme.textPrimary) {
        self.title = title
        self.detail = detail
        self.trailingDetail = trailingDetail
        self.systemImage = systemImage
        self.iconTint = iconTint
    }

    init(title: String, detail: String? = nil, systemImage: String? = nil, iconTint: Color = Theme.textPrimary) {
        self.init(title: Text(title), detail: detail.map { Text($0) }, systemImage: systemImage, iconTint: iconTint)
    }

    init(title: String, detail: Text, trailingDetail: Text? = nil, systemImage: String? = nil, iconTint: Color = Theme.textPrimary) {
        self.init(title: Text(title), detail: detail, trailingDetail: trailingDetail, systemImage: systemImage, iconTint: iconTint)
    }

    var body: some View {
        if let systemImage {
            Label { text } icon: { Image(systemName: systemImage).foregroundStyle(iconTint) }
        } else {
            text
        }
    }

    private var text: some View {
        VStack(alignment: .leading, spacing: 2) {
            title.font(AppFont.rowTitle).foregroundStyle(Theme.textPrimary)
            Group {
                if let detail, let trailingDetail {
                    // The trailing text's ideal width is pinned to its minimum so the HStack is chosen whenever `detail`
                    // fits whole beside a few truncated characters; otherwise the trailing text drops instead of
                    // leaving a clipped sliver.
                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 8) {
                            detail.layoutPriority(1)
                            trailingDetail.frame(
                                minWidth: trailingMinWidth, idealWidth: trailingMinWidth, maxWidth: .infinity, alignment: .trailing
                            )
                        }
                        detail
                    }
                } else if let detail {
                    detail
                }
            }
            .font(AppFont.rowDetail)
            .foregroundStyle(Theme.textSecondary)
        }
    }
}
