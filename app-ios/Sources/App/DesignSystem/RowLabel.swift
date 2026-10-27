import SwiftUI

/// The app's list row label: an icon, a title, and an optional detail line.
struct RowLabel: View {
    let title: String
    var detail: String?
    var systemImage: String?

    var body: some View {
        if let systemImage {
            Label { text } icon: { Image(systemName: systemImage).foregroundStyle(Theme.textPrimary) }
        } else {
            text
        }
    }

    private var text: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(AppFont.rowTitle).foregroundStyle(Theme.textPrimary)
            if let detail {
                Text(detail).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
            }
        }
    }
}
