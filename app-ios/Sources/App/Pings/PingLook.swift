import Foundation
import FoundationModels
import os
import SwiftUI

extension Theme {
    static let ping = PingColor.fallback.swatch
}

extension PingColor {
    /// Twelve hues around the wheel at one weight, so each reads apart from its neighbors on the dark background.
    var swatch: Color {
        switch self {
        case .red: Color(hex: 0xF2555A)
        case .orange: Color(hex: 0xFF8A3D)
        case .yellow: Color(hex: 0xF5C542)
        case .lime: Color(hex: 0xA6D44E)
        case .green: Color(hex: 0x3FC27A)
        case .teal: Color(hex: 0x5AC8C8)
        case .sky: Color(hex: 0x46AEF0)
        case .blue: Color(hex: 0x4D78F0)
        case .violet: Color(hex: 0x8E6CF0)
        case .purple: Color(hex: 0xC066E8)
        case .pink: Color(hex: 0xF06AAE)
        case .tan: Color(hex: 0xC9A27E)
        }
    }

    var title: String { rawValue.capitalized }
}

extension Ping {
    /// The ping's color on its icon, dot, chart, and ring.
    var tint: Color { (color ?? .fallback).swatch }
}

/// An icon and a color the on-device model picked for a ping's name.
struct PingLook: Equatable, Sendable {
    var icon: String
    var color: PingColor
}

/// Apple's on-device model, its output constrained to the icons and swatches the editor offers. The general model with
/// greedy sampling, as `OnDeviceFoodIconModel`, so a name gets the same pick every time.
struct PingLookModel: Sendable {
    nonisolated static let log = Logger(subsystem: "com.stefan.a-better-me", category: "ping-look")

    private let model = SystemLanguageModel.default

    /// False while the device can't run it: not eligible, Apple Intelligence off, or the model still downloading.
    var isAvailable: Bool { model.isAvailable }

    /// Nil when the model fails or answers outside the choices; the editor then keeps its defaults.
    func look(for name: String, colors: [PingColor]) async -> PingLook? {
        do {
            let schema = try GenerationSchema(
                root: DynamicGenerationSchema(name: "PingLook", properties: [
                    .init(name: "icon", description: "The icon that best pictures it", schema: DynamicGenerationSchema(name: "Icon", anyOf: PingIcons.all)),
                    .init(name: "color", description: "The color that suits it", schema: DynamicGenerationSchema(name: "Color", anyOf: colors.map(\.rawValue))),
                ]),
                dependencies: []
            )
            let session = LanguageModelSession(model: model, instructions: Self.instructions)
            let content = try await session.respond(to: "Ping: \(name)", schema: schema, options: GenerationOptions(samplingMode: .greedy)).content
            let icon = try content.value(String.self, forProperty: "icon")
            guard PingIcons.all.contains(icon), let color = PingColor(rawValue: try content.value(String.self, forProperty: "color")) else {
                Self.log.error("The model answered outside the choices for \(name, privacy: .public)")
                return nil
            }
            return PingLook(icon: icon, color: color)
        } catch {
            Self.log.error("Picking a ping's look failed: \(String(describing: error))")
            return nil
        }
    }

    private static let instructions = """
        You choose the icon and color of a ping: something a person logs in a tap, such as a mood, a symptom, a \
        drink, a habit, or an activity. Pick the icon that best pictures the ping's name and a color that suits it.
        """
}
