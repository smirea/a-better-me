import SwiftUI

/// The app's list row label: an icon, a title, and an optional detail line.
struct RowLabel: View {
    let title: Text
    var detail: Text?
    var systemImage: String?
    var iconTint = Theme.textPrimary

    init(title: Text, detail: Text? = nil, systemImage: String? = nil, iconTint: Color = Theme.textPrimary) {
        self.title = title
        self.detail = detail
        self.systemImage = systemImage
        self.iconTint = iconTint
    }

    init(title: String, detail: String? = nil, systemImage: String? = nil, iconTint: Color = Theme.textPrimary) {
        self.init(title: Text(title), detail: detail.map { Text($0) }, systemImage: systemImage, iconTint: iconTint)
    }

    init(title: String, detail: Text, systemImage: String? = nil, iconTint: Color = Theme.textPrimary) {
        self.init(title: Text(title), detail: detail, systemImage: systemImage, iconTint: iconTint)
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
            if let detail {
                detail.font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
            }
        }
    }
}
