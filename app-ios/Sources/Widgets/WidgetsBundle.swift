import SwiftUI
import WidgetKit

@main
struct BetterMeWidgets: WidgetBundle {
    init() {
        AppFont.register()
    }

    var body: some Widget {
        WorkoutLiveActivity()
    }
}
