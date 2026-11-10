import SwiftUI
import UIKit

/// A photo as it is sent to the server, and the same pixels to show.
struct PhotoUpload: Identifiable, Sendable {
    let id = UUID()
    let jpeg: Data
    let preview: UIImage

    init?(_ data: Data) {
        guard let jpeg = MealPhotoImage.jpeg(from: data), let preview = UIImage(data: jpeg) else { return nil }
        self.jpeg = jpeg
        self.preview = preview
    }

    /// A camera photo, shrunk before it is encoded so the full-size frame is never compressed.
    init?(_ image: UIImage) {
        let pixels = CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
        let scale = min(1, Double(MealPhotoImage.maxPixels) / max(pixels.width, pixels.height))
        guard let small = image.preparingThumbnail(of: CGSize(width: pixels.width * scale, height: pixels.height * scale)),
              let jpeg = small.jpegData(compressionQuality: 0.7) else { return nil }
        self.jpeg = jpeg
        preview = small
    }
}

struct CameraCapture: UIViewControllerRepresentable {
    let captured: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_: UIImagePickerController, context _: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraCapture

        init(parent: CameraCapture) {
            self.parent = parent
        }

        func imagePickerController(_: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage { parent.captured(image) }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_: UIImagePickerController) {
            parent.dismiss()
        }
    }
}
