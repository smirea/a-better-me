import ObjectiveC
import SwiftUI
import UIKit

extension View {
    /// Keeps the swipe back, from the edge and from the content, on a stack whose pushed screens hide their bar or its
    /// back button, as the logger's do under its banner's Back. UIKit's own delegate for both swipes refuses every touch
    /// while the back button is hidden, so this replaces it. Apply it to the stack's root view.
    func keepsSwipeBack() -> some View {
        background(SwipeBackEnabler().frame(width: 0, height: 0))
    }
}

private struct SwipeBackEnabler: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> Controller { Controller() }
    func updateUIViewController(_ controller: Controller, context: Context) {}

    final class Controller: UIViewController {
        override func viewDidAppear(_ animated: Bool) {
            super.viewDidAppear(animated)
            guard let navigation = navigationController else { return }
            for recognizer in [navigation.interactivePopGestureRecognizer, navigation.interactiveContentPopGestureRecognizer] {
                guard let recognizer, !(recognizer.delegate is SwipeBackDelegate) else { continue }
                SwipeBackDelegate.install(on: recognizer, navigation: navigation)
            }
        }
    }
}

/// Lets a swipe begin whenever there is a screen to pop.
private final class SwipeBackDelegate: NSObject, UIGestureRecognizerDelegate {
    private static var key: UInt8 = 0
    private weak var navigation: UINavigationController?

    private init(navigation: UINavigationController) {
        self.navigation = navigation
    }

    /// The recognizer holds its delegate weakly, so it keeps this one as an associated object for as long as it lives.
    static func install(on recognizer: UIGestureRecognizer, navigation: UINavigationController) {
        let delegate = SwipeBackDelegate(navigation: navigation)
        objc_setAssociatedObject(recognizer, &key, delegate, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        recognizer.delegate = delegate
    }

    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        (navigation?.viewControllers.count ?? 0) > 1
    }
}
