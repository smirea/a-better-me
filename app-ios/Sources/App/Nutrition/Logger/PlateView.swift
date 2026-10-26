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
        let day = dayRow.intake(entries)
        List {
            Section("Your Plate") {
                ForEach(session.plate.items) { item in
                    Button { open(item.id) } label: {
                        HStack(spacing: 12) {
                            LoggerFoodIcon(food: item.pick.portion.food)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.pick.portion.food.name).font(AppFont.medium(15)).lineLimit(2)
                                Text(item.pick.portion.amounts.macroLine).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                            }
                            Spacer()
                            Text(item.pick.portion.serving.label)
                                .font(AppFont.medium(13))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 8))
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .onDelete { offsets in
                    for id in offsets.map({ session.plate.items[$0].id }) {
                        session.plate.remove(id)
                    }
                }
            }
            Section {
                Picker("Nutrition", selection: $withDay) {
                    Text("Plate").tag(false)
                    Text("Day").tag(true)
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
                ForEach([NutrientID.energy, .protein, .fat, .carbs], id: \.self) { id in
                    macroRow(id, plate: plate[id] ?? 0, day: day[id] ?? 0)
                }
                Toggle("Show all nutrients", isOn: $allNutrients).tint(Theme.accent)
                if allNutrients {
                    let total = withDay ? day + plate : plate
                    ForEach(NutrientRegistry.all.filter { ![.energy, .protein, .fat, .carbs].contains($0.id) && total.amount(of: $0.id) != nil }) { nutrient in
                        LabeledContent(nutrient.name, value: FoodDetailView.amount(total.amount(of: nutrient.id) ?? 0, nutrient.unit))
                    }
                }
            } header: {
                Text("Nutrition")
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
            .padding(.horizontal, 16)
            .padding(.bottom, 8)
        }
        .navigationTitle("Your Plate")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func macroRow(_ id: NutrientID, plate: Double, day: Double) -> some View {
        let target = NutritionPlan.effective(on: session.time.day, in: plans)?.target(on: session.time.day).amount(id)
        let unit = id == .energy ? "kcal" : "g"
        let amount = Int((withDay ? day + plate : plate).rounded())
        let caption = withDay ? "\(amount)\(target.map { " / \(Int($0.rounded()))" } ?? "") \(unit) with plate" : "\(amount) \(unit) in plate"
        return VStack(alignment: .leading, spacing: 6) {
            Text(id == .energy ? "Calories" : NutrientRegistry.nutrient(id)?.name ?? id.rawValue).font(AppFont.medium(15))
            Text(caption).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
            ProgressView(value: target.map { min(1, (withDay ? day + plate : plate) / max($0, 1)) } ?? 0)
                .tint(MacroColor.of(id))
        }
        .padding(.vertical, 2)
    }
}
