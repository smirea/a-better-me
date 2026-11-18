import SwiftUI

extension ExerciseSearch {
    func highlighted(_ name: String) -> AttributedString {
        var text = AttributedString(name)
        for word in words {
            var searchStart = text.startIndex
            while let range = text[searchStart...].range(of: word, options: [.caseInsensitive, .diacriticInsensitive]) {
                text[range].font = AppFont.title(15)
                searchStart = range.upperBound
            }
        }
        return text
    }
}
