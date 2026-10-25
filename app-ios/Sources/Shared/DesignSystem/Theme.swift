import CoreText
import SwiftUI

enum Theme {
    static let background = Color(hex: 0x151414)
    static let surface = Color(hex: 0x201E1E)
    static let surfaceRaised = Color(hex: 0x2B2929)
    static let header = Color(hex: 0x222222)
    static let separator = Color.white.opacity(0.08)

    static let textPrimary = Color.white
    static let textSecondary = Color(hex: 0xABABAB)
    static let textTertiary = Color(hex: 0x6E6E6E)

    static let accent = Color(hex: 0xF28969)
    static let lavender = Color(hex: 0xACA0D2)
    static let green = Color(hex: 0x7FC48B)
    /// Logged days in the workout calendar, and the 2-3 RIR badge.
    static let amber = Color(hex: 0xF0A830)
    static let destructive = Color(hex: 0xE5534B)
    /// Trained muscles on body maps and progress bars.
    static let muscle = Color(hex: 0x276EF1)

    /// MF's RIR badge colors: 0-1 red, 2-3 amber, 4-5 green, 6+ blue, unknown gray.
    static func rir(_ rir: Int?) -> Color {
        guard let rir else { return Color(hex: 0x6E6E6E) }
        return switch rir {
        case ...1: Color(hex: 0xD63A3A)
        case 2...3: amber
        case 4...5: Color(hex: 0x4E9A5E)
        default: Color(hex: 0x3A6FE0)
        }
    }

    static let cornerRadius: CGFloat = 16
    static let smallCornerRadius: CGFloat = 10
}

/// Static instances cut from the reference app's variable fonts by `scripts/make-fonts.py`. iOS ignores variation
/// axes on these fonts, so each weight is its own file.
enum AppFont {
    /// Wide all-caps screen titles such as "DASHBOARD" and "MORE".
    static func display(_ size: CGFloat = 26) -> Font { .custom(displayName, fixedSize: size) }

    static func title(_ size: CGFloat = 20) -> Font { .custom("DMSans-Bold", size: size) }
    static func headline(_ size: CGFloat = 17) -> Font { .custom("DMSans-SemiBold", size: size) }
    static func body(_ size: CGFloat = 16) -> Font { .custom("DMSans-Regular", size: size) }
    static func medium(_ size: CGFloat = 16) -> Font { .custom("DMSans-Medium", size: size) }
    static func caption(_ size: CGFloat = 13) -> Font { .custom("DMSans-Regular", size: size) }
    /// Big numbers in set rows, timers, and stat rings.
    static func number(_ size: CGFloat = 22) -> Font { .custom("DMSans-Bold", size: size).monospacedDigit() }

    static let displayName = "MacroSansDisplay-Black"

    static func register() {
        let names = ["DMSans-Regular", "DMSans-Medium", "DMSans-SemiBold", "DMSans-Bold", displayName]
        for name in names {
            guard let url = Bundle.main.url(forResource: name, withExtension: "ttf") else {
                fatalError("Missing bundled font \(name).ttf")
            }
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}
