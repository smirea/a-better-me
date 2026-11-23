import SwiftUI
import UIKit

/// A photo as it is sent to the server, and the same pixels to show.
struct PhotoUpload: Identifiable, Sendable {
    let id: UUID
    let jpeg: Data
    let preview: UIImage

    init?(_ data: Data) {
        guard let jpeg = MealPhotoImage.jpeg(from: data) else { return nil }
        self.init(id: UUID(), jpeg: jpeg)
    }

    /// A JPEG kept as it is, such as a stored picture an editor opens with, under the id it is stored by.
    init?(id: UUID, jpeg: Data) {
        guard let preview = UIImage(data: jpeg) else { return nil }
        self.id = id
        self.jpeg = jpeg
        self.preview = preview
    }

    /// A camera photo, shrunk before it is encoded so the full-size frame is never compressed.
    init?(_ image: UIImage) {
        let pixels = CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
        let scale = min(1, Double(MealPhotoImage.maxPixels) / max(pixels.width, pixels.height))
        guard let small = image.preparingThumbnail(of: CGSize(width: pixels.width * scale, height: pixels.height * scale)),
              let jpeg = small.jpegData(compressionQuality: 0.7) else { return nil }
        id = UUID()
        self.jpeg = jpeg
        preview = small
    }
}

/// The system camera, presented by UIKit from whatever is on top rather than by a SwiftUI cover on the button's view:
/// SwiftUI closes a cover by itself when its presenter's identity changes (FB25287840), which closed Create Food's
/// camera as it opened (docs/decisions/nutrition.md). Over full screen keeps the screens underneath in the window, so
/// their `onDisappear` (Create Food's cancels its photo read) doesn't run while the camera is up.
@MainActor
enum Camera {
    static let isAvailable = UIImagePickerController.isSourceTypeAvailable(.camera)

    static func capture(_ captured: @escaping (UIImage) -> Void) {
        guard var top = UIApplication.shared.connectedScenes.lazy.compactMap({ ($0 as? UIWindowScene)?.keyWindow?.rootViewController }).first
        else { return }
        while let presented = top.presentedViewController, !presented.isBeingDismissed { top = presented }
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.modalPresentationStyle = .overFullScreen
        picker.modalPresentationCapturesStatusBarAppearance = true
        let delegate = Delegate(captured: captured)
        picker.delegate = delegate
        Delegate.open = delegate
        top.present(picker, animated: true)
    }

    private final class Delegate: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        /// The picker holds its delegate weakly.
        static var open: Delegate?
        let captured: (UIImage) -> Void

        init(captured: @escaping (UIImage) -> Void) {
            self.captured = captured
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage { captured(image) }
            close(picker)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            close(picker)
        }

        private func close(_ picker: UIImagePickerController) {
            picker.dismiss(animated: true)
            Self.open = nil
        }
    }
}
