import Foundation

/// The Color & Icon picker's glyphs. MF offers about fifty; these are SF Symbols close to its set.
enum ProgramIcon {
    static let all: [(symbol: String, title: String)] = [
        ("dumbbell.fill", "Dumbbell"), ("figure.strengthtraining.traditional", "Lifter"), ("figure.strengthtraining.functional", "Functional"),
        ("figure.run", "Runner"), ("figure.walk", "Walker"), ("figure.hiking", "Hiker"), ("figure.outdoor.cycle", "Cyclist"),
        ("figure.pool.swim", "Swimmer"), ("figure.rower", "Rower"), ("figure.yoga", "Yoga"), ("figure.pilates", "Pilates"),
        ("figure.boxing", "Boxing"), ("figure.martial.arts", "Martial Arts"), ("figure.climbing", "Climbing"), ("figure.core.training", "Core"),
        ("figure.cross.training", "Cross Training"), ("figure.flexibility", "Flexibility"), ("figure.jumprope", "Jump Rope"),
        ("figure.step.training", "Step"), ("figure.highintensity.intervaltraining", "Intervals"), ("figure.cooldown", "Cooldown"),
        ("figure.mixed.cardio", "Cardio"), ("figure.stairs", "Stairs"), ("figure.skiing.downhill", "Skiing"), ("figure.surfing", "Surfing"),
        ("figure.basketball", "Basketball"), ("figure.soccer", "Soccer"), ("figure.tennis", "Tennis"), ("figure.golf", "Golf"),
        ("paperplane.fill", "Paper Plane"), ("flame.fill", "Flame"), ("bolt.fill", "Bolt"), ("star.fill", "Star"), ("heart.fill", "Heart"),
        ("trophy.fill", "Trophy"), ("medal.fill", "Medal"), ("crown.fill", "Crown"), ("target", "Target"), ("mountain.2.fill", "Mountain"),
        ("sun.max.fill", "Sun"), ("moon.fill", "Moon"), ("leaf.fill", "Leaf"), ("drop.fill", "Drop"), ("snowflake", "Snowflake"),
        ("timer", "Timer"), ("stopwatch.fill", "Stopwatch"), ("calendar", "Calendar"), ("chart.line.uptrend.xyaxis", "Progress"),
        ("scalemass.fill", "Scale"), ("shield.fill", "Shield"), ("hare.fill", "Hare"), ("tortoise.fill", "Tortoise"), ("pawprint.fill", "Paw"),
    ]

    static func title(of symbol: String) -> String {
        all.first { $0.symbol == symbol }?.title ?? symbol
    }
}

extension ProgramColor {
    var title: String { rawValue.capitalized }
}
