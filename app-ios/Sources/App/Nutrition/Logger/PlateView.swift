import SwiftUI

/// Your Plate (`log-04-your-plate.jpg`): each food with its quantity, which opens it for editing, the plate's nutrition
/// alone or with the day's, every nutrient on request, and Log Foods.
struct PlateView: View {
    let session: LoggerSession
    let open: (UUID) -> Void
    @Observe(NutritionPlan.all) private var plans
    @Observe<[FoodEntry]> private var entries: [FoodEntry]
    @Observe<NutritionDay> private var dayRow: NutritionDay
    @State private var withDay = false
    @State private var allNutrients = false

    init(session: LoggerSession, open: @escaping (UUID) -> Void) {
        self.session = session
        self.open = open
        _entries = Observe(FoodEntry.on(session.time.day))
        _dayRow = Observe(NutritionDay.one(session.time.day))
    }

    var body: some View {
        let plate = session.plate.totals
        let day = dayRow.totals(entries)
        List {
            ThemedSection("Your Plate") {
                ForEach(session.plate.items) { item in
                    Button { open(item.id) } label: {
                        FoodRow(food: item.pick.portion.food, serving: item.pick.portion.serving)
                    }
                    .buttonStyle(.plain)
                }
                .onDelete { offsets in
                    for id in offsets.map({ session.plate.items[$0].id }) {
                        session.plate.remove(id)
                    }
                }
            }
            ThemedSection("Nutrition") {
                Picker("Nutrition", selection: $withDay) {
                    Text("Plate").tag(false)
                    Text("Day").tag(true)
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
                ForEach(NutrientID.macros, id: \.self) { id in
                    macroRow(id, plate: plate[id] ?? 0, day: day[id] ?? 0)
                }
                Toggle("Show all nutrients", isOn: $allNutrients).tint(Theme.accent)
                if allNutrients {
                    let total = withDay ? day + plate : plate
                    ForEach(NutrientSection.allCases.dropFirst().flatMap(\.nutrients).filter { total.amount(of: $0.id) != nil }) { nutrient in
                        LabeledContent(nutrient.name, value: NutritionFormat.amount(total.amount(of: nutrient.id) ?? 0, nutrient.unit))
                    }
                }
            }
        }
        .themedList()
        .overlay {
            if session.plate.isEmpty {
                ContentUnavailableView("Your plate is empty", systemImage: "fork.knife", description: Text("Add foods from Search, Scan, Quick Add, or Library."))
            }
        }
        .safeAreaInset(edge: .bottom) {
            HStack {
                Spacer()
                LogFoodsButton(session: session).controlSize(.large)
            }
            .padding(.horizontal, Theme.margin)
            .padding(.bottom, 8)
        }
        .detailTitle("Your Plate")
    }

    private func macroRow(_ id: NutrientID, plate: Double, day: Double) -> some View {
        let target = NutritionPlan.effective(on: session.time.day, in: plans)?.target(on: session.time.day).amount(id)
        let unit = id == .energy ? "kcal" : "g"
        let amount = Int((withDay ? day + plate : plate).rounded())
        let caption = withDay ? "\(amount)\(target.map { " / \(Int($0.rounded()))" } ?? "") \(unit) with plate" : "\(amount) \(unit) in plate"
        return VStack(alignment: .leading, spacing: 6) {
            Text(id == .energy ? "Calories" : NutrientRegistry.nutrient(id)?.name ?? id.rawValue).font(AppFont.rowTitle)
            Text(caption).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
            ProgressView(value: target.map { min(1, (withDay ? day + plate : plate) / max($0, 1)) } ?? 0)
                .progressViewStyle(.bar(Theme.macro(id)))
        }
        .padding(.vertical, 2)
    }
}
