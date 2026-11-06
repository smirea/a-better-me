import SwiftUI
import UIKit

/// UIKit's page dots under a paging `ScrollView`, which has none of its own: the control a page-style `TabView` draws,
/// with its tap, scrub, and VoiceOver adjust.
struct PageControl: UIViewRepresentable {
    let count: Int
    @Binding var current: Int

    func makeUIView(context: Context) -> UIPageControl {
        let control = UIPageControl()
        control.addTarget(context.coordinator, action: #selector(Coordinator.changed(_:)), for: .valueChanged)
        control.setContentHuggingPriority(.required, for: .vertical)
        return control
    }

    func updateUIView(_ control: UIPageControl, context: Context) {
        context.coordinator.current = $current
        control.numberOfPages = count
        if control.currentPage != current { control.currentPage = current }
    }

    func makeCoordinator() -> Coordinator { Coordinator(current: $current) }

    final class Coordinator: NSObject {
        var current: Binding<Int>

        init(current: Binding<Int>) { self.current = current }

        @objc func changed(_ control: UIPageControl) { current.wrappedValue = control.currentPage }
    }
}
