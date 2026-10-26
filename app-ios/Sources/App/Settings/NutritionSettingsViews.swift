import SwiftUI

/// Settings > Food Log, MacroFactor's §9.2 page. Food Tiles are left to the units that draw the tiles, since their
/// options only make sense beside a live preview.
struct FoodLogSettingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        let timeline = settings.nutrition.timeline
        Form {
            Section {
                SettingChoice(
                    title: "Nutrient Reporting", systemImage: "minus.forwardslash.plus", selection: store.binding(settings, \.nutrition.showOverages),
                    options: [
                        SettingOption(value: false, title: "No Overages", detail: "No negative numbers will be used if you exceed a nutrient target"),
                        SettingOption(value: true, title: "Show Overages", detail: "Negative numbers will be used in nutrient remaining views if you exceed your target"),
                    ]
                )
            } header: {
                SectionTitle("Nutrient Reporting").textCase(nil)
            }
            Section {
                NavigationLink { HourRangeView() } label: {
                    SettingLabel(title: "Hour Range", detail: "\(SettingsRules.hour(timeline.firstHour)) – \(SettingsRules.hour(timeline.lastHour))", systemImage: "clock")
                }
                SettingToggle(
                    title: "Hide Empty Hours", detail: "Hours without food collapse, even inside the hour range",
                    systemImage: "rectangle.compress.vertical", isOn: store.binding(settings, \.nutrition.timeline.hideEmptyHours)
                )
                SettingChoice(
                    title: "Alignment", systemImage: "text.alignleft", selection: store.binding(settings, \.nutrition.timeline.alignment),
                    options: [SettingOption(value: .left, title: "Left aligned"), SettingOption(value: .right, title: "Right aligned")]
                )
                SettingChoice(
                    title: "Add Foods to Hour", systemImage: "plus.circle", selection: store.binding(settings, \.nutrition.timeline.addFoodsToHour),
                    options: [
                        SettingOption(value: .plusIcon, title: "Plus icon next to each hour"),
                        SettingOption(value: .longPress, title: "Long-press hour shortcut"),
                    ]
                )
                SettingToggle(
                    title: "Food Timestamps", detail: "Show each food's time in the timeline",
                    systemImage: "clock.badge", isOn: store.binding(settings, \.nutrition.timeline.foodTimestamps)
                )
                SettingToggle(
                    title: "Hourly Macro Totals", detail: "Show each hour's calories and macros",
                    systemImage: "sum", isOn: store.binding(settings, \.nutrition.timeline.hourlyTotals)
                )
                SettingChoice(
                    title: "Calendar Week Banner", systemImage: "calendar", selection: store.binding(settings, \.nutrition.timeline.calendarWeekBanner),
                    options: [SettingOption(value: .show, title: "Show"), SettingOption(value: .showAndPin, title: "Show & Pin"), SettingOption(value: .hide, title: "Hide")]
                )
                SettingChoice(
                    title: "Calendar Scrolling", systemImage: "calendar.day.timeline.left", selection: store.binding(settings, \.nutrition.timeline.calendarScrolling),
                    options: [
                        SettingOption(value: .daily, title: "Daily Scroll", detail: "Scrolls freely and settles one day at a time"),
                        SettingOption(value: .weekly, title: "Weekly Swipe"),
                    ]
                )
                SettingToggle(
                    title: "Premove", detail: "After selecting a food, the Move shortcut will appear next to the hour even if the Move action has not yet been selected",
                    systemImage: "arrow.up.and.down.and.arrow.left.and.right", isOn: store.binding(settings, \.nutrition.timeline.premove)
                )
            } header: {
                SectionTitle("Timeline Options").textCase(nil)
            }
            Section {
                SettingToggle(
                    title: "Branded Results", detail: "Include branded foods in search",
                    systemImage: "tag", isOn: store.binding(settings, \.nutrition.searchBranded)
                )
                SettingToggle(
                    title: "Open Food Facts Results", detail: "Include Open Food Facts foods in search",
                    systemImage: "globe", isOn: store.binding(settings, \.nutrition.searchOpenFoodFacts)
                )
            } header: {
                SectionTitle("Food Search").textCase(nil)
            }
            Section {
                NavigationLink { LoggerBannerView() } label: {
                    SettingLabel(title: "Logger Banner", detail: "Customize the nutrients in the logger banner", systemImage: "rectangle.topthird.inset.filled")
                }
                SettingChoice(
                    title: "Time Selection", systemImage: "clock.arrow.2.circlepath", selection: store.binding(settings, \.nutrition.logger.timeSelection),
                    options: [
                        SettingOption(value: .datePicker, title: "Date Time Picker"),
                        SettingOption(value: .timePad, title: "Time Pad", detail: "Any hour of the day by tapping one of the 24 options without date selection"),
                    ]
                )
                NavigationLink { FavoriteMeasuresView() } label: {
                    SettingLabel(title: "Favorite Measurements", detail: settings.nutrition.favoriteMeasures.joined(separator: ", "), systemImage: "star")
                }
                SettingChoice(
                    title: "Optimization", systemImage: "hare", selection: store.binding(settings, \.nutrition.logger.optimization),
                    options: [
                        SettingOption(value: .speed, title: "Optimize for speed", detail: "Tapping a search result opens the food with the keypad"),
                        SettingOption(value: .context, title: "Optimize for context", detail: "Tapping a search result closes search and shows the plate"),
                    ]
                )
            } header: {
                SectionTitle("Logger Options").textCase(nil)
            }
        }
        .themedList()
        .navigationTitle("Food Log")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct HourRangeView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            Section {
                Picker("From", selection: store.binding(settings, \.nutrition.timeline.firstHour)) {
                    ForEach(0...settings.nutrition.timeline.lastHour, id: \.self) { Text(SettingsRules.hour($0)).tag($0) }
                }
                Picker("To", selection: store.binding(settings, \.nutrition.timeline.lastHour)) {
                    ForEach(settings.nutrition.timeline.firstHour...23, id: \.self) { Text(SettingsRules.hour($0)).tag($0) }
                }
            } footer: {
                Text("The timeline always shows these hours. Hours with food outside them still show.")
            }
        }
        .themedList()
        .navigationTitle("Hour Range")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct LoggerBannerView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    private static let nutrients: [NutrientID] = [.energy, .protein, .fat, .carbs]

    var body: some View {
        let shown = settings.nutrition.logger.bannerNutrients
        Form {
            Section {
                ForEach(Self.nutrients, id: \.self) { id in
                    Toggle(NutrientRegistry.nutrient(id)?.name ?? id.rawValue, isOn: Binding(
                        get: { shown.contains(id) },
                        set: { on in
                            store.updateSettings { settings in
                                settings.nutrition.logger.bannerNutrients = Self.nutrients.filter { $0 == id ? on : shown.contains($0) }
                            }
                        }
                    ))
                    .tint(Theme.accent)
                    .disabled(shown == [id])
                }
            } header: {
                SectionTitle("Nutrients").textCase(nil)
            }
            Section {
                SettingChoice(
                    title: "Nutrition Display", selection: store.binding(settings, \.nutrition.logger.nutritionDisplay),
                    options: [
                        SettingOption(value: .plateOnly, title: "Show Plate Nutrition Only"),
                        SettingOption(value: .dayAndPlate, title: "Show All Day & Plate Nutrition"),
                        SettingOption(value: .remainingAfterPlate, title: "Show Remaining After Plate"),
                    ]
                )
            }
        }
        .themedList()
        .navigationTitle("Logger Banner")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct FavoriteMeasuresView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            section("Weight", SettingsRules.weightMeasures)
            section("Volume", SettingsRules.volumeMeasures)
        }
        .themedList()
        .navigationTitle("Favorite Measurements")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func section(_ title: String, _ measures: [String]) -> some View {
        Section {
            ForEach(measures, id: \.self) { measure in
                Button {
                    store.updateSettings { $0.nutrition.favoriteMeasures = SettingsRules.toggleFavorite(measure, in: $0.nutrition.favoriteMeasures) }
                } label: {
                    LabeledContent(measure) {
                        if settings.nutrition.favoriteMeasures.contains(measure) { Image(systemName: "checkmark") }
                    }
                }
                .foregroundStyle(Theme.textPrimary)
                .accessibilityAddTraits(settings.nutrition.favoriteMeasures.contains(measure) ? .isSelected : [])
            }
        } header: {
            SectionTitle(title).textCase(nil)
        } footer: {
            Text("Up to \(SettingsRules.favoritesPerCategory). Favorites come first in the serving picker.")
        }
    }
}

/// Settings > Expenditure, §9.3. The settings are stored here; the expenditure engine reads them.
struct ExpenditureSettingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        let expenditure = settings.nutrition.expenditure
        let unit = settings.nutrition.energyUnit
        Form {
            Section {
                SettingChoice(
                    title: "Estimation Method", systemImage: "function",
                    selection: Binding(
                        get: { expenditure.initialKcal != nil },
                        set: { manual in store.updateSettings { $0.nutrition.expenditure.initialKcal = manual ? expenditure.initialKcal ?? 2000 : nil } }
                    ),
                    options: [
                        SettingOption(value: false, title: "Default", detail: "A BMR equation and estimated activity factor estimate your initial expenditure"),
                        SettingOption(value: true, title: "Manual", detail: "Enter your own initial expenditure"),
                    ]
                )
                if expenditure.initialKcal != nil {
                    EnergyField(title: "Initial Expenditure", unit: unit, kcal: store.binding(settings, \.nutrition.expenditure.initialKcal))
                }
                calculationStart(expenditure.calculationStart)
                NavigationLink { BMREquationView() } label: {
                    SettingLabel(title: "BMR Equation", detail: "Configure how your BMR is initially calculated", systemImage: "figure.arms.open")
                }
            } header: {
                SectionTitle("Initial Estimate").textCase(nil)
            }
            Section {
                SettingChoice(
                    title: "Calculation Mode", systemImage: "waveform.path.ecg",
                    selection: Binding(
                        get: { expenditure.staticKcal != nil },
                        set: { fixed in store.updateSettings { $0.nutrition.expenditure.staticKcal = fixed ? expenditure.staticKcal ?? 2000 : nil } }
                    ),
                    options: [
                        SettingOption(value: false, title: "Dynamic (Recommended)", detail: "Expenditure updates from your intake and weight trend"),
                        SettingOption(value: true, title: "Static", detail: "A fixed value that pauses expenditure updates"),
                    ]
                )
                if expenditure.staticKcal != nil {
                    EnergyField(title: "Static Expenditure", unit: unit, kcal: store.binding(settings, \.nutrition.expenditure.staticKcal))
                }
                SettingChoice(
                    title: "Algorithm", systemImage: "cpu", selection: store.binding(settings, \.nutrition.expenditure.algorithm),
                    options: [
                        SettingOption(value: .v3, title: "Expenditure V3", detail: "A substantial improvement over V2 that uses an entirely new approach"),
                        SettingOption(value: .v2, title: "Expenditure V2"),
                        SettingOption(value: .v1, title: "Expenditure V1"),
                    ]
                )
            } header: {
                SectionTitle("Expenditure Calculation").textCase(nil)
            }
            Section {
                SettingToggle(
                    title: "Step-Informed Updates",
                    detail: "Uses step trends to speed up expenditure updates during periods where the step data improves confidence",
                    systemImage: "figure.walk", isOn: store.binding(settings, \.nutrition.expenditure.stepInformedUpdates)
                )
                SettingToggle(
                    title: "Predictive Goal Adjustment",
                    detail: "Applies a predictive adjustment to expenditure based on the likely impact of goal changes",
                    systemImage: "chart.line.uptrend.xyaxis", isOn: store.binding(settings, \.nutrition.expenditure.predictiveGoalAdjustment)
                )
            } header: {
                SectionTitle("Expenditure Modifiers").textCase(nil)
            }
        }
        .themedList()
        .navigationTitle("Expenditure")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder private func calculationStart(_ start: CalendarDay?) -> some View {
        if let start {
            DatePicker(
                selection: Binding(
                    get: { Calendar.current.date(from: DateComponents(year: start.year, month: start.month, day: start.day)) ?? .now },
                    set: { date in store.updateSettings { $0.nutrition.expenditure.calculationStart = CalendarDay(date) } }
                ),
                displayedComponents: .date
            ) {
                SettingLabel(title: "Calculation Start Date", detail: nil, systemImage: "calendar")
            }
            Button("Reset to Default") { store.updateSettings { $0.nutrition.expenditure.calculationStart = nil } }
        } else {
            LabeledContent {
                Button("Edit") { store.updateSettings { $0.nutrition.expenditure.calculationStart = .today } }
                    .font(AppFont.medium(14))
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .accessibilityLabel("Edit Calculation Start Date")
            } label: {
                SettingLabel(title: "Calculation Start Date", detail: "Default: your first logged day", systemImage: "calendar")
            }
        }
    }
}

private struct BMREquationView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            Section {
                SettingChoice(
                    title: "Equation", systemImage: "function", selection: store.binding(settings, \.nutrition.expenditure.bmrEquation),
                    options: [
                        SettingOption(value: .macroFactor, title: "MacroFactor Equation", detail: "Developed in 2024 to more accurately calculate your BMR for the initial expenditure estimate"),
                        SettingOption(value: .cunningham, title: "Cunningham Equation", detail: "Published in 1980"),
                    ]
                )
            } header: {
                SectionTitle("BMR Equation").textCase(nil)
            }
            Section {
                SettingChoice(
                    title: "Activity", systemImage: "figure.walk", selection: store.binding(settings, \.nutrition.expenditure.activity),
                    options: orNotSet([
                        SettingOption(value: .mostlySedentary, title: "Mostly Sedentary", detail: "Less than 5,000 steps a day"),
                        SettingOption(value: .moderatelyActive, title: "Moderately Active", detail: "5,000 to 15,000 steps a day"),
                        SettingOption(value: .veryActive, title: "Very Active", detail: "More than 15,000 steps a day"),
                    ])
                )
                SettingChoice(
                    title: "Exercise", systemImage: "dumbbell", selection: store.binding(settings, \.nutrition.expenditure.exercise),
                    options: orNotSet([
                        SettingOption(value: .zero, title: "0 sessions / week"),
                        SettingOption(value: .oneToThree, title: "1–3 sessions / week"),
                        SettingOption(value: .fourToSix, title: "4–6 sessions / week"),
                        SettingOption(value: .sevenPlus, title: "7+ sessions / week"),
                    ])
                )
                SettingChoice(
                    title: "Athletic Pursuits", systemImage: "medal", selection: store.binding(settings, \.nutrition.expenditure.athleticPursuits),
                    options: orNotSet([
                        SettingOption(value: .exerciseRegularly, title: "I exercise regularly"),
                        SettingOption(value: .athlete, title: "I am an athlete"),
                        SettingOption(value: .professionalAthlete, title: "I am a professional athlete"),
                        SettingOption(value: .noneOfTheAbove, title: "None of the above"),
                    ])
                )
                SettingChoice(
                    title: "Prior Weight", systemImage: "scalemass", selection: store.binding(settings, \.nutrition.expenditure.priorWeight),
                    options: orNotSet([
                        SettingOption(value: .yes, title: "Have weighed more"),
                        SettingOption(value: .no, title: "Have never weighed more"),
                        SettingOption(value: .notSure, title: "Not sure"),
                    ])
                )
                SettingChoice(
                    title: "Prior Progress", systemImage: "chart.line.downtrend.xyaxis", selection: store.binding(settings, \.nutrition.expenditure.priorProgress),
                    options: orNotSet([
                        SettingOption(value: .gaining, title: "Gaining weight"),
                        SettingOption(value: .losing, title: "Losing weight"),
                        SettingOption(value: .stable, title: "Weight stable"),
                        SettingOption(value: .notSure, title: "Not sure"),
                    ])
                )
            } header: {
                SectionTitle("BMR Impacting Variables").textCase(nil)
            } footer: {
                Text("Sex, height, and date of birth are in Settings > Profile.")
            }
        }
        .themedList()
        .navigationTitle("BMR Equation")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func orNotSet<Value>(_ options: [SettingOption<Value>]) -> [SettingOption<Value?>] {
        [SettingOption(value: nil, title: "Not set")] + options.map { SettingOption(value: $0.value, title: $0.title, detail: $0.detail) }
    }
}

/// Settings > Strategy: the check-in's day and its optional modules.
struct StrategySettingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            Section {
                SettingChoice(
                    title: "Check-In Day", systemImage: "calendar.badge.checkmark", selection: store.binding(settings, \.nutrition.checkInWeekday),
                    options: (1...7).map { SettingOption(value: $0, title: Calendar.current.weekdaySymbols[$0 % 7]) }
                )
                SettingToggle(
                    title: "Fast Check-In", detail: "Skips all optional coaching modules",
                    systemImage: "forward", isOn: store.binding(settings, \.nutrition.fastCheckIn)
                )
            } header: {
                SectionTitle("General").textCase(nil)
            }
            Section {
                LabeledContent("Introduction", value: "Default")
                Toggle("Partial Logging", isOn: store.binding(settings, \.nutrition.coachingModules.partialLogging)).tint(Theme.accent)
                Toggle("Weigh-In", isOn: store.binding(settings, \.nutrition.coachingModules.weighIn)).tint(Theme.accent)
                Toggle("Fasting", isOn: store.binding(settings, \.nutrition.coachingModules.fasting)).tint(Theme.accent)
                Toggle("Logging Break", isOn: store.binding(settings, \.nutrition.coachingModules.loggingBreak)).tint(Theme.accent)
                LabeledContent("Program Update", value: "Default")
            } header: {
                SectionTitle("Coaching Modules").textCase(nil)
            } footer: {
                Text("Individually configure which modules can appear during your check-in.")
            }
        }
        .themedList()
        .navigationTitle("Strategy")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// An energy in kcal, shown and typed in the energy unit. Clearing the field keeps the last value.
private struct EnergyField: View {
    let title: String
    let unit: NutritionSettings.EnergyUnit
    @Binding var kcal: Double?

    var body: some View {
        LabeledContent(title) {
            HStack(spacing: 4) {
                TextField(title, value: Binding(
                    get: { kcal.map { SettingsRules.displayEnergy($0, in: unit).rounded() } },
                    set: { value in if let value { kcal = SettingsRules.storedEnergy(value, in: unit) } }
                ), format: .number.precision(.fractionLength(0)))
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 100)
                Text(SettingsRules.energyLabel(unit)).foregroundStyle(Theme.textSecondary)
            }
        }
    }
}
