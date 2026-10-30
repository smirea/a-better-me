# MacroFactor algorithms

What MacroFactor 5.8.9 reveals about its coaching math, from the bundle and from MacroFactor's own public writing.
Every claim carries a label:

- **Found (bundle)**: a source file name, class name, or verbatim string in the Dart AOT snapshot (`Runner.app/Frameworks/App.framework/App`) or a native table. Quoted strings are verbatim; see [`app-strings.md`](app-strings.md).
- **Found (web)**: stated on a MacroFactor help or blog page; the URL follows. Pages were read through a summarizing fetch tool, so wording is near-verbatim.
- **Inferred**: our reading. Check it before building on it.

The snapshot holds names and copy, not readable function bodies, so no numeric constant below comes from the bundle. Decompiling the snapshot (blutter) would recover them; see [Open questions](#open-questions).

## Where the math lives

**Found (bundle)**: the source tree under `package:macrofactor/src/` names one file per algorithm and keeps every old version selectable:

| Concern             | Files                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trend weight        | `services/fitness_analytics/weight_trend_algorithm_v1.dart`, `weight_trend_algorithm_v2.dart`, `weight_trend_service.dart`, `enums/weight_trend_version.dart`, `enums/trend_weight_alpha.dart`, `enums/weight_trend_prediction_style.dart`                                                                                                                                                                                        |
| Expenditure         | `services/fitness_analytics/expenditure_algorithm.dart`, `expenditure_algorithm_v1.dart`, `_v2.dart`, `_v3.dart`, `expenditure_service.dart`, `enums/expenditure_version.dart`, `enums/expenditure_strategy.dart`, `enums/tdee_mode.dart`, `enums/initial_tdee_settings_mode.dart`                                                                                                                                                |
| BMR                 | `services/fitness_analytics/bmr_equation.dart`, `bmr_equation_v1.dart`, `bmr_equation_v2.dart`, `bmr_service.dart`, `body_fat_service.dart`, `enums/bmr_version.dart`                                                                                                                                                                                                                                                             |
| Macros and targets  | `services/macro_planning_service.dart`, `services/fitness_analytics/macro_nutrients_service.dart`, `services/goal_service.dart`, `models/macro_plan.dart`, `models/weekly_plan.dart`, `models/day_target.dart`, `models/calories_per_day.dart`, `enums/calorie_floor.dart`, `enums/dynamic_floor.dart`, `enums/protein_preference.dart`, `enums/program_style.dart`, `enums/program_type.dart`, `enums/maintenance_approach.dart` |
| Micronutrient goals | `services/fitness_analytics/micro_nutrients_goal_service.dart`, `constants/nutrient_ranges.dart`, `models/sex_pregnancy_lactation.dart`, `models/age_group.dart`, `models/micro_goal_definition.dart`                                                                                                                                                                                                                             |
| Check-ins           | `coaching_modules/*` (basics, goal, program, program_update, weigh_in, partial_logging, logging_break, fasting, introduction, notice), `coaching_definitions/*`, `enums/checkin_state.dart`                                                                                                                                                                                                                                       |
| Habits and history  | `models/history_doc.dart`, `models/history_aggregate_state.dart`, `enums/habit.dart`, and the freezed class `HistoryScorePiecewiseInterval(daysCutoff: …)`                                                                                                                                                                                                                                                                        |

**Inferred**: versioned algorithms are chosen per user (settings strings below let the user switch), so a clone that wants to match a user's old numbers needs the version on the user record, not a global flag.

## Trend weight

- **Found (bundle)**: two versions, `weightTrendV1` and `weightTrendV2`, shown as "Weight Trend V1" and "Weight Trend V2". V1 is "Simple and reliable smoothing that only looks at past weigh-ins". V2 is "Robust smoothing that can revise past weigh-ins based on the future and reduce lag", and is gated by a remote flag (`getFeatureWeightTrendV2Bool`) and labelled "Experimental".
- **Found (bundle)**: an enum `TrendWeightAlpha` exists, so V1 is an exponential moving average whose smoothing factor is user-selectable.
- **Found (bundle)**: V2 has `WeightTrendV2Prediction` and `WeightTrendV2PredictionBasis`, and `WeightTrendPredictionStyle` exists. The goal screens predict "Your projected weight in 30 days if your current goal rate of weight …", "… if your current rate of weight …", and "… if your recent rate of weight …".
- **Found (web)**: the trend is "a moving average of your weight data that places greater emphasis on more recent weigh-ins". Missing days are filled by linear interpolation (151 lb Monday and 150 lb Wednesday give 150.5 lb Tuesday). There is no automatic outlier rule; users delete spikes by hand. https://help.macrofactorapp.com/dashboard/weight_trend/
- **Found (web)**: V2 lets the user pick whether the trend uses only weight data, only the goal rate, or a blend. https://macrofactor.com/mm-july-2026/
- **Inferred**: V1 is `trend[d] = trend[d-1] + α · (interpolatedScale[d] − trend[d-1])`, with α from `TrendWeightAlpha`. The α values are not in the readable bundle. A common choice for daily weigh-ins is α = 0.1 (Hacker's Diet); verify against a real export before matching numbers.
- **Inferred**: `TrendWeightEntry` (`models/trend_weight_entry.dart`) is a stored series, so the trend is computed on the device and persisted per day rather than recomputed on every read. The data export includes "Trend Weight (unit)".

## Expenditure (TDEE)

- **Found (bundle)**: three versions, `expenditureV1`, `expenditureV2`, `expenditureV3`. V2 "Improves upon Expenditure V1 using groundbreaking techniques"; V3 is "A substantial improvement over V2 that uses an entirely new approach".
- **Found (bundle)**: the user can choose a dynamic or static strategy (`ExpenditureStrategy`; "Static Expenditure"; "You have set a static number for your daily energy expenditure."). In a manual program the app still computes expenditure: "We will continue to track progress towards your goal and calculate your daily energy expenditure."
- **Found (bundle)**: two modifiers, "Step-Informed Updates" and "Predictive Goal Adjustment" ("Applies a predictive adjustment to expenditure based on the likely impact of goal changes").
- **Found (bundle)**: the initial estimate: "A Basal Metabolic Rate (BMR) equation and estimated activity factor will be used to estimate your initial expenditure before the dynamic calculation begins". `InitialTdeeSettingsMode` and "Override MacroFactor’s default initial expenditure estimate with your own estimate" let the user replace it.
- **Found (bundle)**: updates stop without data: "Start logging again to re-start expenditure updates", "Log your weight for your next expenditure update.", "What is an expenditure hold?", and the logging-break module's `ExpenditurePauseStep` and `ExpenditureResumeStep`. `ExpenditureFloorProvider` and `ExpenditureMinMaxProvider` exist, so the estimate is clamped.
- **Found (bundle)**: "After 20-30 days of consistent tracking, you should have a refined, personalized Expenditure estimate." and "Smoothed TDEE".
- **Found (web)**: the core loop predicts weight change from estimated expenditure and logged intake, compares it with the trend, and corrects expenditure by the difference. https://macrofactor.com/expenditure-v3/
- **Found (web)**: V3 makes surpluses and deficits symmetric (V1 and V2 assumed gaining cost less than losing). V2 paused unless at least 6 of the last 7 days were logged; V3 pauses only with "more than three days of missing nutrition data in a seven-day period" and imputes unlogged intake "within about 15-20%". https://macrofactor.com/expenditure-v3/
- **Found (web)**: the algorithms "consider about three weeks of data". Minimum input is nutrition on at least 4 days in every 7 and weight at least once a week. One missing weight entry flips the state from "updating" to "holding". https://help.macrofactorapp.com/en/articles/109-how-frequently-do-i-need-to-log-my-weight-for-the-expenditure-algorithm-and-weekly-coaching-updates and https://help.macrofactorapp.com/en/articles/110-how-frequently-do-i-need-to-log-my-nutrition-for-the-expenditure-algorithm-and-weekly-coaching-updates
- **Found (web)**: days marked partial are ignored; fasted days count as 0 kcal; unlogged days not marked fasted are skipped. https://help.macrofactorapp.com/en/articles/29-how-do-macrofactor-s-coaching-algorithms-deal-with-partially-logged-days and https://help.macrofactorapp.com/en/articles/250-coaching-module-fasting
- **Found (web)**: switching static to dynamic resumes "as if you'd been using a dynamic expenditure estimate the whole time". https://help.macrofactorapp.com/en/articles/64-how-to-change-your-expenditure-estimate-from-dynamic-to-static
- **Found (web)**: the V3 article gives tissue energy densities of about 39.5 MJ/kg for fat and 7.6 MJ/kg for lean tissue, but not the constant the algorithm uses. https://macrofactor.com/expenditure-v3/
- **Found (web)**: accuracy is scored by prediction: over 30-day windows, (expenditure − logged intake) ÷ 3500 kcal/lb against the actual change. On 748 new users over 100 days the median error after the first 3-4 weeks is 135 kcal/day (r 0.87) against 335 for a daily-recomputed BMR formula; updates start on day 3. A day under 50% of the week's other logged days is flagged as partial logging, zero-calorie days excepted. https://macrofactor.com/algorithm-accuracy/
- **Found (web)**: the two modifiers (Nov 2025) cut the 100-day cumulative error by nearly 20%. Predictive Goal Adjustment multiplies the initial estimate by 1 + 4 × the goal rate (percent of body weight per week, negative for loss), and nudges expenditure by the same rule over "a couple of weeks" when the goal changes. Step-Informed Updates feeds step counts into the loop like weight and intake, never adding to a day's target; no formula is published. https://macrofactor.com/expenditure-modifiers/
- **Inferred**: a clone can implement V1-style expenditure as `TDEE ≈ mean(intake over window) − Δtrend · ρ / days`, with a window of about 21 days, ρ ≈ 7700 kcal/kg (3500 kcal/lb), skipping days marked partial and counting fasted days as zero, smoothed day to day and clamped by a floor. That matches the public description, not MacroFactor's exact numbers.

### BMR

- **Found (bundle)**: two equations, `BmrEquationV1` ("Cunningham Equation, developed in 1980, is a widely used equation to estimate Basal Metabolic Rate (BMR)") and `BmrEquationV2` ("MacroFactor Equation": "MacroFactor's research team developed this equation in 2024 to more accurately calculate your Basal Metabolic Rate (BMR) for the initial expenditure estimate"). Settings: "BMR Equation", "Configure how your BMR is initially calculated", "BMR Impacting Variables".
- **Found (bundle)**: activity inputs: "Basic Activity Level", "None or Relaxed Activity", "Moderately Active", "Exercise Sessions Per Week", "I exercise rigorously and consistently enough to consider myself an athlete" (`AthleteOptions`, `Activity`, `Training`, `Experience` enums).
- **Found (bundle)**: body-fat input with reference images `assets/body_fat/F-10pct.svg` … `F-50pct.svg` (step 5) and `M-3pct.svg`, `M-6pct.svg`, `M-10pct.svg` … `M-40pct.svg`.
- **Found (web)**: the MacroFactor Equation. W in kg, H in cm, Sex male = 0, female = 1. https://macrofactor.com/macrofactors-bmr/
  - Height and weight: `BMR = 129.6·W^0.55 + 0.011·H² − a·Age − 213.8·Sex`, with a = 1.96 at 60 or younger and 4.9 above 60.
  - Body composition: `BMR = 50.2·FFM^0.7 + 40.5·(FFM^0.7·FM^0.066) − b·Age`, with b = 1.1 or 2.75 by the same age split.
  - Athletes (at least 7 h/week of intense exercise): `BMR = 40.4·FFM^0.932`.
  - Adaptation multipliers: ×0.95 in a deficit; ×0.92 when more than 10% below peak weight and still losing; ×0.97 when more than 10% below peak and stable or gaining. `LifetimeWeight` and "Have you ever weighed more than …" in the bundle collect the peak.
- **Found (web)**: Cunningham 1991 is `21.6·FFM + 370`. https://macrofactor.com/best-bmr-equations/
- **Not found**: the activity multiplier values. The help center publishes them only as images. https://help.macrofactorapp.com/en/articles/126-why-is-my-expenditure-in-macrofactor-different-from-the-output-of-a-tdee-calculator

## Goal rate and calorie target

- **Found (bundle)**: the goal rate is a percentage of body weight per week ("% BW per week", "Goal Rate per Week (%)"). "The exact number of pounds you lose each week will decrease as your overall body weight decreases."
- **Found (bundle)**: goal types lose, maintain, gain (`GoalType`; StrongerModels strings "Cut", "Maintain", "Bulk"). Maintenance is dynamic: "MacroFactor’s maintenance mode is dynamic. It will monitor your weight and metabolism and make small adjustments to your weekly macro plan to move your trend weight to the chosen target." `MaintenanceApproach` holds the variant.
- **Found (bundle)**: goal progress can follow trend or scale weight ("Estimate of when you would reach your goal … based on trend weight" and "… based on scale weight"), and goals carry checkpoints ("Trend Weight Goal Checkpoint Date", "Trend Weight Goal Checkpoint Weight (").
- **Found (bundle)**: calorie floors: "Standard Floor", "Low Floor", "Ignored Floor" (`CalorieFloor`, `DynamicFloor`). When a rate needs a target below the floor: "… target would need to fall below the Standard Floor. We recommend slowing down your goal rate before continuing."
- **Found (web)**: the standard floor is 1200 kcal/day; the low floor is individualized and not published. https://help.macrofactorapp.com/en/articles/34-what-are-the-different-program-options-in-coached-mode
- **Found (web)**: maintenance holds the trend within about 0.7 kg (1.5 lb) of the target, and outside it nudges at 0.15% of body weight per week. https://help.macrofactorapp.com/en/articles/125-how-does-dynamic-maintenance-work-in-macrofactor
- **Found (web)**: each week stands alone (no catch-up), and an extra smoothing layer means a 500 kcal expenditure shift moves targets only about 200-300 kcal over 3 weeks. https://help.macrofactorapp.com/en/articles/222-how-does-macrofactor-make-adjustments-for-a-weight-gain-or-weight-loss-goal
- **Inferred**: `dailyTarget = expenditure + rate% · trendWeight · ρ / 7`, smoothed against last week's target, raised to the floor, then distributed across days. The rate presets and the "green range" bounds are not published or readable.

## Programs and check-ins

- **Found (bundle)**: three program styles: Coached, Collaborative, Manual (`ProgramStyle`). Coached setup steps, in file order: `training_type_step`, `preferred_diet_step`, `protein_preference_step`, `calorie_floor_step`, `calorie_distribution_step`, `higher_calorie_days_step`, `coached_result_step`. Manual has `editor_choice_step` (`ManualProgramEditor`), `manual_setup_step`, `manual_result_step`.
- **Found (bundle)**: manual programs opt out of updates: "Because you set your energy and macro targets manually, we have opted you out of automatic weekly plan updates."
- **Found (bundle)**: check-ins are weekly on a chosen day ("Check-In Day", "Change Check-In Day"; first check-in "Next Monday"), run as coaching modules: introduction, weigh-in, partial logging, logging break, fasting, program update, notice, goal ("The modules that appear during your check-in are based on your unique habits and progress."; "Individually configure which modules can appear during your check-in."; "Fast Check-In"). `CoachingModulePriority` orders them.
- **Found (web)**: Collaborative lets the app set the weekly calorie budget while the user sets the macro split; collaborative plans can lock days and roll unused calories across the week. https://macrofactorapp.com/?p=4998 and https://help.macrofactorapp.com/en/articles/108-how-to-adjust-calorie-targets-to-account-for-overages-or-to-roll-over-unused-calories

## Macro distribution

- **Found (bundle)**: diet styles Balanced, Low Fat, Low Carb, Keto (`preferred_diet_step`). Copy: "Fat will be reduced to prioritize carb and protein intake" (low fat), "Carbs will be reduced to prioritize fat and protein intake" (low carb). When the calorie target is too low: "… while also meeting protein and fat minimums, we had to switch you over to a ketogenic program." and "In order to meet your calorie target, we had to reduce your protein target below your requested setting."
- **Found (bundle)**: protein preference with an "Extra High" level (`ProteinPreference`); training type feeds it (`training_type_step`).
- **Found (web)**: protein presets low, moderate, high, extra high; targets scale with lean mass from current weight and a body-composition category; they are lowest for non-exercisers and highest for resistance trainers. The general range is 1.2-2.2 g/kg (0.55-1.0 g/lb). https://help.macrofactorapp.com/nutrition/protein and https://help.macrofactorapp.com/en/articles/34-what-are-the-different-program-options-in-coached-mode
- **Found (web)**: Balanced splits the calories left after protein evenly between carbs and fat; Low Carb caps carbs near 30% of calories or under 200 g; Keto treats carbs as an upper limit; when calories are very low, fat is protected first, then protein, then carbs. https://help.macrofactorapp.com/en/articles/93-balanced-macro-program and https://macrofactor.com/macrofactors-algorithms-and-core-philosophy/
- **Inferred**: order of operations: protein from lean mass × preset → fat minimum → split the rest by diet style → clamp at the floor, dropping carbs first (Keto fallback), then protein.

## Calorie distribution across days

- **Found (bundle)**: "Distribute Evenly", "How would you like to distribute …", "higher calorie days" (`higher_calorie_days_step`), `CaloriesPerDay`, `DayTarget`, `WeeklyPlan`, `CalorieDistributionExplainers`. Weekly macros are checked against the weekly budget: "Your weekly macros sum to energy content that exceeds your total weekly …".
- **Found (web)**: "Shift calories" moves budget to chosen days; on coached plans the shift is "quite modest", and its size is not published. https://help.macrofactorapp.com/en/articles/34-what-are-the-different-program-options-in-coached-mode
- **Inferred**: the plan is weekly: `weeklyBudget = 7 · dailyTarget`, then high days get `+x` and the other days share `−x·highDays/lowDays`, so the weekly sum is unchanged.

## Micronutrient goals

- **Found (bundle)**: each nutrient goal has a floor, a target, and a ceiling. "The target represents the recommended dietary allowance (RDA), which is a metric designed to meet the needs of 98% of the population." "The floor … typically represents the lower threshold intake (LTI). 97-98% of people need to exceed the LTI …". "The ceiling … represents the tolerable upper intake level (UL)".
- **Found (bundle)**: default goals are automatic: "All days prior to the first goal will default to Auto mode. That means that the floor, target and ceiling will be set for you automatically based on your age, sex, weight, and program where applicable." `SexPregnancyLactation` and `AgeGroup` models pick the DRI row. Users override with "Custom Floor", "Custom Ceiling", "Nutrient will not display a floor".
- **Found (bundle)**: the label ranges are "On the low side of the optimal range.", "In the middle of the optimal range.", "On the high end of the optimal range.", "Highest recommended intake.".
- **Found (web)**: same RDA, LTI, and UL definitions. https://help.macrofactorapp.com/en/articles/138-what-are-the-micronutrient-floor-target-and-ceiling
- **Inferred**: the default table is the Institute of Medicine DRI tables by life stage. [`nutrients.md`](nutrients.md) lists the nutrients; the bundle's `constants/nutrient_ranges.dart` values are not readable without decompiling.

## Habits

- **Found (bundle)**: `enums/habit.dart`, `models/history_doc.dart`, `HistoryAggregateState(history: …)`, `HistoryScorePiecewiseInterval(daysCutoff: …)`, and the "Habits interface" that manages manual nutrition entries ("Manual entries override food log's nutrition reporting. You can manage manual entries from the Habits interface.").
- **Found (web)**: the Habits panel shows logging consistency; no streak or score formula is documented. https://help.macrofactorapp.com/dashboard/consistency
- **Inferred**: `HistoryScorePiecewiseInterval` scores consistency with a piecewise weight by how many days ago a day was (recent days count more, older days drop off past `daysCutoff`).

## Open questions

- Every numeric constant: the `TrendWeightAlpha` values, the expenditure window and energy density, clamps, the goal-rate presets, protein grams per preset, the low floor, the calorie-shift size, and the micronutrient table. They live in the AOT code. A blutter decompile of this Dart 3.13.3 snapshot built but crashed while parsing it; a newer blutter or a real data export would answer most of these.
- Whether V3 expenditure uses the asymmetric tissue model from the article or a single energy density.
- How `HistoryScorePiecewiseInterval` turns logging history into the habit score.
