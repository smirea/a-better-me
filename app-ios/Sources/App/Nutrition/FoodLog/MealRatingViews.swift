import Feedback
import SwiftUI

extension MealRating.Tier {
    var color: Color {
        switch self {
        case .excellent: Theme.ratingBlue
        case .great, .good: Theme.ratingGreen
        case .fair: Theme.ratingYellow
        case .poor: Theme.ratingRed
        }
    }
}

/// "13:1" in its tier's color, with a skull past the formula's dire line. Without text it is a dot in the same colors,
/// for a row with no width to spare.
struct MealRatingTag: View {
    let text: String?
    let tier: MealRating.Tier
    var isDire = false

    init(text: String?, tier: MealRating.Tier, isDire: Bool = false) {
        self.text = text
        self.tier = tier
        self.isDire = isDire
    }

    init(_ score: MealRating.Score, showsText: Bool = true) {
        self.init(text: showsText ? score.ratioText : nil, tier: score.tier, isDire: score.isDire)
    }

    private var isAnimated: Bool { tier.isAnimated(dire: isDire) }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let color = tier.color
        HStack(spacing: 2) {
            Group {
                if let text {
                    Text(text)
                        .font(AppFont.headline(11))
                        .monospacedDigit()
                        .lineLimit(1)
                        .fixedSize()
                        .foregroundStyle(color)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                } else {
                    Color.clear.frame(width: 14, height: 14)
                }
            }
            .background(color.opacity(text == nil ? 0.5 : 0.16), in: .capsule)
                .overlay {
                    if isAnimated, !reduceMotion {
                        RunningBorder(color: color)
                    } else {
                        Capsule().strokeBorder(color.opacity(isAnimated ? 1 : 0.5), lineWidth: isAnimated ? 1.5 : 1)
                    }
                }
            if isDire {
                // No SF Symbol draws a skull; multiplying the emoji's white by red keeps its dark eyes.
                Text(verbatim: "💀").font(.system(size: 13)).colorMultiply(Theme.ratingRed)
            }
        }
    }
}

/// A tag that opens the rating's drawer, read as "<title> Calories per Protein, 13 to 1, Fair".
struct MealRatingButton: View {
    let title: String
    let score: MealRating.Score
    let formula: MealRating.Formula
    var showsText = true
    let action: () -> Void

    var body: some View {
        Button(action: action) { MealRatingTag(score, showsText: showsText).frame(minHeight: 40).contentShape(.rect) }
            .buttonStyle(.plain)
            .accessibilityLabel("\(title) \(formula.title)")
            .accessibilityValue("\(score.ratio.map { "\($0) to 1" } ?? "No protein"), \(score.tier.title)")
            .accessibilityHint("Explains the meal rating")
    }
}

/// The rating of a group of foods outside the Food Log's rows (a recipe, the plate), with its drawer. It draws
/// nothing while Meal Rating is off or the foods have no calories. The drawer hangs on a stack that stays when the tag
/// goes, so turning the rating off inside the drawer keeps it open, as the rows' does.
struct MealRatingBadge: View {
    let title: String
    let amounts: NutrientAmounts

    @Observe(AppSettings.current) private var settings
    @State private var explains = false

    var body: some View {
        let rating = settings.nutrition.mealRating
        HStack(spacing: 0) {
            if rating.enabled, let score = rating.formula.score(amounts) {
                MealRatingButton(title: title, score: score, formula: rating.formula) { explains = true }
            }
        }
        .sheet(isPresented: $explains) {
            MealRatingSheet(meal: title, amounts: amounts)
        }
    }
}

/// A bright arc running around the capsule's edge: a conic gradient turning under a capsule-shaped ring mask. It is a
/// Core Animation rotation, so the render server runs it and the app does no work per frame. A SwiftUI repeating
/// rotation started in `onAppear` never moved inside the Food Log's pages, since the change landed in the first update.
private struct RunningBorder: UIViewRepresentable {
    let color: Color

    func makeUIView(context: Context) -> RunningBorderView { RunningBorderView() }

    func updateUIView(_ view: RunningBorderView, context: Context) {
        view.color = UIColor(color)
    }
}

final class RunningBorderView: UIView {
    private static let period: CFTimeInterval = 2.4
    private static let lineWidth: CGFloat = 1.5

    private let gradient = CAGradientLayer()
    private let ring = CAShapeLayer()

    var color = UIColor.white {
        didSet {
            guard color != oldValue else { return }
            let dim = color.withAlphaComponent(0.35).cgColor
            gradient.colors = [dim, dim, color.cgColor, UIColor.white.cgColor, color.cgColor, dim]
        }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        gradient.type = .conic
        gradient.startPoint = CGPoint(x: 0.5, y: 0.5)
        gradient.endPoint = CGPoint(x: 1, y: 0.5)
        layer.addSublayer(gradient)
        ring.fillColor = nil
        ring.strokeColor = UIColor.black.cgColor
        ring.lineWidth = Self.lineWidth
        layer.mask = ring
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func layoutSubviews() {
        super.layoutSubviews()
        // A square as wide as the capsule covers it at every angle.
        let side = max(bounds.width, bounds.height)
        gradient.bounds = CGRect(x: 0, y: 0, width: side, height: side)
        gradient.position = CGPoint(x: bounds.midX, y: bounds.midY)
        let inset = bounds.insetBy(dx: Self.lineWidth / 2, dy: Self.lineWidth / 2)
        ring.frame = bounds
        ring.path = UIBezierPath(roundedRect: inset, cornerRadius: inset.height / 2).cgPath
    }

    /// Core Animation drops a layer's animations when it leaves the window, so each return starts it again. Every
    /// border's turn starts on a multiple of the period in host time, so all of them on screen turn together. The spin
    /// is never removed on completion: suspending the app ends such animations, and a border still in its window
    /// came back from the background standing still.
    override func didMoveToWindow() {
        super.didMoveToWindow()
        gradient.removeAllAnimations()
        guard window != nil else { return }
        let now = CACurrentMediaTime()
        let spin = CABasicAnimation(keyPath: "transform.rotation.z")
        spin.fromValue = 0
        spin.toValue = 2 * Double.pi
        spin.duration = Self.period
        spin.repeatCount = .infinity
        spin.isRemovedOnCompletion = false
        spin.beginTime = gradient.convertTime(now - now.truncatingRemainder(dividingBy: Self.period), from: nil)
        gradient.add(spin, forKey: "spin")
    }
}

/// The drawer a meal's tag opens: what the rating means, where this meal lands, and the same settings as Food Log's.
struct MealRatingSheet: View {
    let meal: String
    let amounts: NutrientAmounts

    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings

    var body: some View {
        let formula = settings.nutrition.mealRating.formula
        let score = formula.score(amounts)
        NavigationStack {
            Form {
                ThemedSection {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(meal).font(AppFont.rowTitle)
                            Spacer()
                            if let score {
                                MealRatingTag(score)
                            }
                        }
                        Text("\((amounts[.energy] ?? 0).wholeText) kcal ÷ \((amounts[.protein] ?? 0).wholeText) g protein")
                            .font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                        Text(formula.explanation).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                    }
                    .padding(.vertical, 4)
                }
                ThemedSection(formula.title, footer: "Over \(formula.direAbove):1 the tag also gets a skull and a running border.") {
                    ForEach(MealRating.Tier.allCases, id: \.self) { tier in
                        HStack(spacing: 12) {
                            MealRatingTag(text: formula.range(of: tier), tier: tier)
                                .frame(width: 72, alignment: .leading)
                            Text(tier.title).font(AppFont.rowTitle)
                            Spacer()
                            if tier == score?.tier {
                                Text(meal).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                            }
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
                MealRatingSettings(footer: nil)
            }
            .themedList()
            .detailTitle("Meal Rating")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .feedback(self)
    }
}

/// Meal Rating's rows, in Settings > Food Log and under a tag's explanation.
struct MealRatingSettings: View {
    var footer: String? = "Grades each meal, recipes, and your plate with a tag. Tap a tag to see what it means."

    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        ThemedSection("Meal Rating", footer: footer) {
            SettingToggle(
                title: "Meal Rating", detail: "Show a rating beside meals and recipes",
                systemImage: "gauge.with.needle", isOn: store.binding(settings, \.nutrition.mealRating.enabled)
            )
            if settings.nutrition.mealRating.enabled {
                SettingChoice(
                    title: "Formula", systemImage: "function", selection: store.binding(settings, \.nutrition.mealRating.formula),
                    options: MealRating.Formula.allCases.map { SettingOption(value: $0, title: $0.title, detail: $0.abbreviation) }
                )
            }
        }
        .feedback(self)
    }
}
