# Nutrition

The Nutrition half re-creates MacroFactor (food logging, the expenditure coach, and its strategy). What the reference app stores and computes is captured in [`docs/research/macrofactor/`](../research/macrofactor/): `data-model.md`, `nutrients.md`, `algorithms.md`, and `app-strings.md`. Feature workers read those and never drive the app.

## Food data

- **USDA plus Open Food Facts.** The owner's ruling: USDA FoodData Central generic foods (Foundation and SR Legacy) ship in the app bundle for offline search, and barcode and branded lookups go to Open Food Facts through our server. MacroFactor's own database (Typesense collections, Calomeal, the Nutritionix traces) is licensed and server-side, so it is cut.
- **The USDA catalog is a bundled resource, not rows.** A later unit builds it. Only a food the owner logs is copied into `foods`, under the id `usda-<fdcId>`. An Open Food Facts food is cached the same way under `off-<barcode>`. Two devices caching one food converge on one row, and caching again refreshes it in place.
- **The owner's MacroFactor export seeds history.** The export's food log, weights, and targets map onto the tables below. The export file is owner data, so it stays out of git (`~/.claude/orchestrate/a-better-me-nutrition/private/`).
- **AI logging is deferred.** Describe and photo logging, and AI recipe import, are not built (owner ruling). When they come, they produce queries against the same local and Open Food Facts search, as MacroFactor's do, and need no new tables.

## Domain model

Records live in `app-ios/Sources/App/Nutrition/Model/`, one file per entity. Writes go through the `LocalStore` extension in `NutritionStore.swift`, and screens observe the queries in `NutritionQueries.swift`. The tables are in `shared/db/schema.ts`.

- **`foods`**: a food the owner made (id: a lowercase UUID) or a cached USDA or Open Food Facts food. `source` is `custom`, `usda`, or `open_food_facts`. `nutrition` is a `FoodNutrition`: sparse nutrients per base serving, the grams or milliliters in a base serving when known, and the measures it can be logged in.
- **`recipes`**: name, ingredients, the number of servings it makes, the cooked weight, steps, prep and cook minutes, and notes. A recipe's nutrition is derived from its ingredients on read, so it has no second copy to drift.
- **`food_entries`**: one logged food: the calendar `day`, the `hour` (0 to 23), the `food` snapshot, and the `serving`. MacroFactor has no named meals. Its timeline groups foods by hour, so the hour is the grouping. A quick add is an entry whose snapshot has the source `quick_add` and one "serving" measure. The plate (several foods picked before logging) is screen state, not data: `LocalStore.log` writes the whole plate in one transaction.
- **`food_favorites`**: a food snapshot at a chosen serving, as MacroFactor defines a favorite. Several may come from one food. At 50, saving another replaces the oldest. MacroFactor replaces the least used one, but tracking use is not worth a column yet.
- **`nutrition_days`**: what the owner said about a day, keyed by the day: `status` (`none`, `partial`, or `fasted`), a free-text `note`, and an `override`, the sparse nutrients that replace the log's totals. A day without a row is a plain day.
- **`body_metrics`**: a manual value per day and kind, keyed `<day>/<kind>`: `body_fat` (percent), `steps` (a count), and tape measurements in centimeters (neck, shoulders, chest, waist, hips, and left and right bicep, forearm, thigh, and calf). MacroFactor tracks scale body fat, a configurable tape set, and steps. Body fat is a kind here rather than a `body_weights` column, because a body fat reading needs no weigh-in and HealthKit stores it as its own sample type. HealthKit values stay read live, as weigh-ins are ([Workouts](workouts.md)).
- **`body_weights`** stays the one weigh-in table for both halves.
- **`nutrition_plans`**: the strategy from a day on, keyed by that day: `kind` (`setup`, `check_in`, or `edit`), the `goal` (lose, maintain, or gain, the target weight, the rate in percent of body weight per week, and its start), the `coaching` program (coached, collaborative, or manual; balanced, low fat, low carb, or keto; the protein level; the calorie floor; the higher-calorie weekdays), the seven day `targets` (kcal, protein, fat, and carbs, Monday first), and the `expenditure_kcal` and `trend_weight_kg` a check-in used. The plan for a day is the latest that starts on or before it, so a past day keeps its targets, and a second plan on one day replaces the first. Goal history and check-in history are these rows. A manual program writes the owner's own targets here.
- **`nutrient_goals`**: a nutrient's floor, target, and ceiling from a day on, keyed `<day>/<nutrient>`. In `auto` mode, and on days before a nutrient's first goal, the registry's defaults apply (`NutrientGoal.range`). Under `custom`, a null bound is hidden, as MacroFactor's "will not display a ceiling" is.
- **`settings.nutrition`**: `NutritionSettings`, one JSON column on the shared settings row, read over its defaults: energy unit (kcal or kJ, display only), check-in weekday, pinned nutrients, hiding additional nutrients, the branded and Open Food Facts search toggles, favorite measures, timeline options, and a static or initial expenditure. `ProfileSettings` gains `heightCm` and `birthDate`, which the BMR and the nutrient defaults read, beside the existing `sex`. Both halves share one Settings screen.

## Rules

- **A log never changes when its food does.** An entry, a favorite, and a recipe ingredient each hold a `FoodSnapshot` (the food's id, source, name, brand, and nutrition) and a `Serving` (a measure and its quantity). Editing or deleting a food or recipe, or refreshing a cached food, leaves them as they are, so deletes never cascade. A food's id inside a snapshot is provenance only.
- **One scaling rule.** A measure says how many base servings a quantity of it is (`{ cup, 1, 2.4 }`). An entry's amounts are the snapshot's nutrients times `serving.servings`. The weight and volume measures (g, oz, lb, mL, fl oz, cup) are derived from the base serving's grams or milliliters, so a food only lists its own named measures. The agent API, when it exposes the log, applies the same rule.
- **Calendar days, not instants.** A log entry, a day row, a metric, a plan, and a nutrient goal key on `YYYY-MM-DD` text (`CalendarDay`), which sorts as text and never moves through a time zone. Instants (`created_at`, `updated_at`) stay ISO 8601 UTC.
- **Rows where two writers meet, fixed ids where one value per key is the rule.** Each logged food is its own row, so two devices logging one day offline both keep their foods. Day state, metrics, plans, nutrient goals, and cached foods have ids built from their key, so writing one again replaces it (`LocalStore.put`) instead of duplicating it. An entry keeps the measure and quantity in one `serving` column, so a merge never pairs one device's unit with another's amount.
- **The server checks what the app decodes strictly.** The validators in `schema.ts` describe the inner shape of every nutrition data column (`foodSnapshot`, `serving`, `foodNutrition`, the plan's goal, program, and seven targets), so a tree the Swift decoder would refuse is rejected at the write instead of hiding the row. The data columns default to `{}` only to stay additive; the validators refuse it. `shared/db/schema.test.ts` and `NutritionModelTests` assert the same encoded text from both sides.

## Nutrient ids and the registry

- **MacroFactor's ids.** Nutrients are keyed `k` (kcal), `p`, `f`, `c`, `nc` (net carbs), and USDA nutrient numbers such as `291` (fiber), plus MacroFactor's `901` and `902` (omega-3 and omega-6 totals). Amounts are sparse maps from id to amount in the registry's unit, so USDA data imports without a mapping. The validators check the id's shape, not membership, so a nutrient the app adds needs no server deploy. Net carbs is derived from carbs and fiber when a food does not report it.
- **`Resources/Nutrition/nutrients.json`** lists the 56 nutrients in display order (MacroFactor's order within General, Protein, Carbohydrates, Fats, Vitamins, and Minerals) with name, short label, unit, group, SF Symbol, the adult (31-50) DRI target and ceiling by sex where the National Academies publish one, and the per-kilogram target of the seven single amino acids. No floors: MacroFactor's lower threshold intakes are compiled into its app and were not recovered.
- **Hand-written once, an exception to generated bundled data ([iOS](ios.md)).** The research table supplies the ids, names, units, and symbols, but the groups and the DRI values have no machine-readable source, so a generator would only re-type them. A one-off script seeded the file, and the JSON is the source from then on. `shared/db/schema.test.ts` fails when its ids or units drift from the generated table in `nutrients.md`.

## Computed, not stored

- **Totals.** Entry amounts, hour and day totals, and net carbs are computed from snapshots and servings. A day's override replaces its totals.
- **Day intake.** `DayIntake` is what the expenditure algorithm reads: an override counts, a partial day is skipped, an empty day counts as zero only when marked fasted, and any other empty day is skipped.
- **Trend weight and expenditure** are recomputed from `body_weights` and the log ([`algorithms.md`](../research/macrofactor/algorithms.md)). MacroFactor stores them as series; we don't, because a stored series goes stale on any edit to a past weigh-in or entry. Only a check-in freezes the expenditure and trend weight it used, in its plan row.
- **Micronutrient ranges** resolve from `nutrient_goals` and the registry. Recents, habits, and logging consistency derive from the entries and the day rows.

## Cut or deferred

- **Progress photos** wait until the sync engine can carry files. A row that names a photo held on one phone would orphan on every other device.
- **AI logging and recipe import** (owner ruling, above).
- **Sharing custom foods or recipes by link, contributing to Open Food Facts, and Calomeal**: commercial or social features.
