import SwiftUI

@main
struct BetterMeWatchApp: App {
    init() {
        AppFont.register()
    }

    var body: some Scene {
        WindowGroup {
            Text("Better Me").font(AppFont.headline())
        }
    }
}
