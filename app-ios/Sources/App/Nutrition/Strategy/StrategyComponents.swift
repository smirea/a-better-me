import SwiftUI

/// MacroFactor's nutrient colors, sampled from its dark theme (docs/research/macrofactor/README.md §1).
enum StrategyPalette {
    static let energy = Color(hex: 0x68A0FA)
    static let protein = Color(hex: 0xFF8660)
    static let fat = Color(hex: 0xFFD05E)
    static let carbs = Color(hex: 0x5EB987)
    static let goal = Color(hex: 0x5EBB89)
}

enum StrategyFormat {
    static let weekdayLetters = ["M", "T", "W", "T", "F", "S", "S"]
    static let weekdayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    static func day(_ day: CalendarDay, year: Bool = false) -> String {
        let date = StrategyInputs.date(day, .current)
        return year ? date.formatted(.dateTime.month(.abbreviated).day().year()) : date.formatted(.dateTime.month(.abbreviated).day())
    }

    static func range(_ start: CalendarDay, _ end: CalendarDay?) -> String {
        "\(day(start, year: true)) – \(end.map { day($0, year: true) } ?? "Now")"
    }

    static func kcal(_ value: Double) -> String { "\(Int(value.rounded()).formatted()) kcal" }

    static func weight(_ kg: Double?, _ unit: WeightUnit) -> String {
        kg.map { "\(unit.fromKg($0).formatted(.number.precision(.fractionLength(1)))) \(unit.rawValue)" } ?? "—"
    }

    static func signed(_ value: Double, digits: ClosedRange<Int>) -> String {
        value.formatted(.number.precision(.fractionLength(digits)).sign(strategy: .always()))
    }

    static func macros(_ target: DayTarget) -> String {
        "\(Int(target.protein))P \(Int(target.fat))F \(Int(target.carbs))C"
    }
}

/// The program chart: seven columns, Monday first, each a calorie pill over protein, fat, and carb blocks sized by
/// their calories. With `selection`, the weekday letters become the Collaborative editor's day buttons.
struct WeekTargetsChart: View {
    let targets: WeekTargets
    var today: Int?
    var selection: Binding<Int>?
    var locked: Set<Int> = []
    var height: CGFloat = 150

    var body: some View {
        let largest = max(1, targets.days.map(\.energy).max() ?? 1)
        HStack(alignment: .bottom, spacing: 6) {
            ForEach(1...7, id: \.self) { weekday in
                column(weekday, scale: height / largest)
            }
        }
    }

    private func column(_ weekday: Int, scale: CGFloat) -> some View {
        let target = targets[weekday]
        return VStack(spacing: 3) {
            Text(Int(target.energy).formatted())
                .font(AppFont.medium(10))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .foregroundStyle(Theme.background)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 3)
                .background(StrategyPalette.energy, in: Capsule())
            block("\(Int(target.protein)) P", target.protein * NutritionEngine.Targets.kcalPerGProtein * scale, StrategyPalette.protein)
            block("\(Int(target.fat)) F", target.fat * NutritionEngine.Targets.kcalPerGFat * scale, StrategyPalette.fat)
            block("\(Int(target.carbs)) C", target.carbs * NutritionEngine.Targets.kcalPerGCarb * scale, StrategyPalette.carbs)
            dayLabel(weekday)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(StrategyFormat.weekdayNames[weekday - 1]): \(Int(target.energy)) kcal, \(StrategyFormat.macros(target))")
    }

    private func block(_ label: String, _ height: Double, _ color: Color) -> some View {
        Text(label)
            .font(AppFont.medium(9))
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .foregroundStyle(Theme.background)
            .frame(maxWidth: .infinity)
            .frame(height: max(14, height))
            .background(color, in: RoundedRectangle(cornerRadius: 4))
    }

    @ViewBuilder
    private func dayLabel(_ weekday: Int) -> some View {
        let letter = StrategyFormat.weekdayLetters[weekday - 1]
        if let selection {
            let selected = selection.wrappedValue == weekday
            Button { selection.wrappedValue = weekday } label: {
                VStack(spacing: 2) {
                    Text(letter).font(AppFont.headline(14))
                    Image(systemName: "lock.fill").font(.system(size: 8)).opacity(locked.contains(weekday) ? 1 : 0)
                }
                .foregroundStyle(selected ? Theme.background : Theme.textPrimary)
                .frame(width: 34, height: 40)
                .background(selected ? Theme.textPrimary : Theme.surfaceRaised, in: Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(StrategyFormat.weekdayNames[weekday - 1])
            .accessibilityAddTraits(selected ? .isSelected : [])
            .padding(.top, 4)
        } else {
            Text(letter)
                .font(AppFont.medium(12))
                .foregroundStyle(weekday == today ? Theme.textPrimary : Theme.textSecondary)
                .frame(width: 22, height: 22)
                .background(weekday == today ? Theme.surfaceRaised : .clear, in: Circle())
                .padding(.top, 4)
        }
    }
}

/// The overview's card: a title, an optional subtitle, the content, and a row of glass actions under a hairline.
struct StrategyCard<Content: View, Actions: View>: View {
    let title: String
    var subtitle: String?
    @ViewBuilder let content: Content
    @ViewBuilder let actions: Actions

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(AppFont.headline())
                if let subtitle {
                    Text(subtitle).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                }
            }
            content
            if Actions.self != EmptyView.self {
                Divider().overlay(Theme.separator)
                ScrollView(.horizontal) {
                    HStack(spacing: 8) { actions }
                }
                .scrollIndicators(.hidden)
                .buttonStyle(.glass)
                .controlSize(.small)
                .font(AppFont.medium(14))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.cornerRadius))
    }
}

extension StrategyCard where Actions == EmptyView {
    init(title: String, subtitle: String? = nil, @ViewBuilder content: () -> Content) {
        self.init(title: title, subtitle: subtitle, content: content, actions: { EmptyView() })
    }
}

/// A big number over a caption, MacroFactor's stat style.
struct StrategyStat: View {
    let value: String
    let caption: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(AppFont.number(20)).lineLimit(1).minimumScaleFactor(0.7)
            Text(caption).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}
