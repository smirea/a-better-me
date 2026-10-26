# MacroFactor data model

What MacroFactor 5.8.9 persists, read from the bundle. Each claim carries a label:

- **Found (bundle)**: a source path, class name, `toString` fragment, or verbatim string in the Dart AOT snapshot, or a native plist or metadata file. Source paths are relative to `package:macrofactor/src/`.
- **Found (web)**: stated on a MacroFactor help or blog page; the URL follows.
- **Inferred**: our reading.

Field names come from two snapshot patterns. Freezed classes print `ClassName(firstField: …, nextField: …)`, so the pool holds `ClassName(firstField:` and `, field:` fragments; the first field is tied to its class, while later fields are pooled with every other class. Plain identifiers such as `weightTrendKg` are also in the pool, but nothing in the pool ties them to a class. Field-to-entity assignments below that are not a first field are **inferred**.

The owner's local Firestore cache could not be read; see [Local data](#local-data). No owner values appear here; example shapes use made-up values.

## Storage architecture

- **Found (bundle)**: Firebase project `sbs-diet-app` (`GoogleService-Info.plist`), with Firebase Auth, Cloud Firestore, Remote Config, Cloud Messaging, Crashlytics, App Check (`RecaptchaEnterpriseSDK`), Cloud Functions callables (`FirebaseCalomealCallables`, `CloudFunctionsHostApi`), Firebase Storage (`sbs-diet-app.appspot.com`, `services/firebase_image_service.dart`), and Firebase AI Logic (Vertex) templates.
- **Found (bundle)**: `services/firebase/firestore_database.dart`, `services_stream/firestore_stream.dart`, `services/syncing_service.dart`, `services/streaming_updates_service.dart`, `enums/sync_setting.dart`. Firestore's offline cache is the local store: the running app holds `Library/Application Support/firestore/__FIRAPP_DEFAULT/sbs-diet-app/main/*.ldb` open.
- **Found (bundle)**: deletions sync through tombstones: `models/tombstone.dart`, `TombstoneRoot`, path fragment `/tombstones/tombstone`, `tombstonesProvider`.
- **Found (bundle)**: settings that are not synced live in `shared_preferences` (`services/core/shared_preferences_service.dart`). The widget extension reads the app group `group.com.sbs.diet.widgetgroup` (`services/home_screen_widget_service.dart`).
- **Found (bundle)**: subscriptions run through RevenueCat (`RevenueCat_RevenueCat.bundle`, `services/subscription/*`). Commercial only; the clone cuts it.
- **Inferred**: every entity below is a document under a per-user root (`users/{uid}/…`); the pool has `users`, `userId`, and `uid`, but the exact collection names are not recoverable as strings.

## Entities

Source files are in `models/`; enums in `enums/`.

### User and profile

- **Found (bundle)**: `User(bodyMassKg: …)` (`models/user.dart`, json-serialized). Body and coaching inputs seen as identifiers: `sex`, `height`, `heightUnit`, `bodyFat`, `lifetimeWeight`, `heaviestWeight`, `activities`; and as types: `AgeGroup`, `SexPregnancyLactation`, `Activity`, `Training`, `Experience`, `AthleteOptions`, `LifetimeWeight`.
- **Found (bundle)**: `DietProfile(favoriteFoodIds: …)` (`models/profiles/diet_profile.dart`). Other diet preferences seen as identifiers: `checkInDay`, `coachingModules`, `pinnedNutrients`/`nutrientsPinned`, `hideAdditionalNutrients`, `servingSelectionStyle`, `foodServingUnitSystem`, `foodDbOption`, `includeBrandedSearch`, `includeOpenFoodFactsSearch`, `defaultWeightUnit`, `energyUnit`.
- **Found (bundle)**: `ShortcutConfiguration(toolbarType: …)` with `toolbarShortcutsByType`, `colorByShortcut` (`models/profiles/shortcut_configuration.dart`): the food logger's customizable shortcut bar.
- **Found (bundle)**: `RegionalDefaults(weightUnit: …)` (`localizations/regional_defaults.dart`): unit defaults by region.

Units are enums: `WeightUnit`, `HeightUnit`, `EnergyUnit` (kcal or kJ), `DistanceUnit`, `HourUnit`, `FoodServingUnitSystem`.

### Foods, servings, and recipes

- **Found (bundle)**: `models/food.dart` (with `food.g.dart` and a hand-written `food.m.dart` mapper), `models/alternative_measure.dart`, `models/label_properties.dart`, `models/barcode_source.dart`, `models/off_photo_references.dart`, `models/source_order.dart`, `models/food_bundle.dart`.
- **Found (bundle)**: serving and measure identifiers: `servingSize`, `servingName`, `servingQty`, `servingUnit`, `servingWeight`, `servingWeightGrams`, `servingSizes`, `extraServingSizes`, `altMeasures`, `minimizeAltMeasures`, `allowCustomMeasures`, `favUnits`, `equivalentServingSize`, `unitWeight`, `weightPerUnit`. `ServingDescription(unit: …)`, `ServingNutritionFactsBasis(servingSize: …)`, `UnknownNutritionFactsBasis(count: …)`, `NutritionFacts(basis: …)`.
- **Found (bundle)**: identity and source: `foodId`, `foodName`, `brand`, `brandName`, `barcode`, `barcodes`, `dbId`, `dbName`, `dbBrandName`, `localizedName`, `localizedBrandName`, `alternativeNames`, `typeOfFood`, `isRecipe`, `nutrients`, `nutritionLabel`. Barcode formats `EAN13`, `EAN8`, `UPCA`, `UPCE` (`constants/barcode_standard.dart`) and `BarcodeSourceType`.
- **Found (bundle)**: search categories `COMMON`, `BRANDED`, `RESTAURANT`, `CUSTOM` (`enums/search_category.dart`, `search_sub_category.dart`), food states `FoodState`, sources `FoodSource`, `DataSource`, `DataOrigin`, and verification markers `VERIFIED`, `VERIFIED_ON_DEVICE`.
- **Found (bundle)**: recipes: `RecipeIngredient(foodId: …)`, `ParsedRecipe(name: …)`, `ParsedRecipeIngredient(name: …)`, `RecipeExportData(name: …)`, and identifiers `ingredients`, `recipeName`, `recipeYield`, `recipeInstructions`, `prepTime`, `cookTime`, `preparation`, `ingredientsMacrosMode`. Recipe import parsers: `JsonLdRecipe`, `MicrodataRecipe`, `RdfaRecipe`, `VertexRecipe` (`ai_features/recipe_parser/*`). The "Open in MacroFactor" Safari action posts the page to `com.sbs.diet://link.macrofactor.app/recipe?link=…&title=…&file=…` (`PlugIns/Open in MacroFactor.appex/Action.js`).
- **Found (bundle)**: custom foods are shareable by link: `https://link.macrofactor.app/custom-food?userId=`.
- **Inferred**: a food stores nutrients per its base serving as a map keyed by the nutrient ids in [`nutrients.md`](nutrients.md), plus a list of alternative measures, each with a name, quantity, and gram weight. A logged entry stores the chosen measure and quantity and scales from grams.

Example shape (made-up values, inferred field set):

```json
{
	"foodId": "f_123",
	"foodName": "Greek yogurt, plain",
	"brandName": "Example Dairy",
	"barcode": "0000000000000",
	"source": "BRANDED",
	"servingName": "container",
	"servingQty": 1,
	"servingWeightGrams": 170,
	"altMeasures": [
		{ "name": "g", "qty": 100, "weightGrams": 100 },
		{ "name": "cup", "qty": 1, "weightGrams": 245 }
	],
	"nutrients": { "k": 100, "p": 17, "f": 0.7, "c": 6, "269": 6, "307": 60, "301": 190 }
}
```

### Food log

- **Found (bundle)**: `models/day_entry.dart`, `models/nutrition_entry.dart`, `models/micro_nutrition_entry.dart`, `models/macd_entry.dart`, `models/day_note.dart`, `models/history_doc.dart`, `models/food_logging_dates.dart`. Streams: `services_stream/food_log_day_stream.dart`. Services: `services/food_logging_service.dart`, `services/copy_paste_service.dart`, `services/history/*`.
- **Found (bundle)**: logged foods sit in hour buckets on a day: `foodHour`, `hourBundleString`, `incomingHourBucket`, `moveFoodToHour`, `pasteFoodToHour`, `hourlyMacroTotals`, `TimelineMode`. Bulk writes go through `FirestoreService.setEntriesInFoodsCollectionBatched`. Day micronutrients are a separate document kept in sync: `FirestoreService.syncMicroNutritionFromDayMicros`, `resyncMicroNutritionFromDayMicros`, `didDirtyFoodMicros`.
- **Found (bundle)**: `DayNoteEditingBridgeModel(dayNote: …)`, `dayNoteList`, `foodLogNotes`: one free-text note per day.
- **Found (bundle)**: manual daily overrides: "Manual entries override food log's nutrition reporting.", "Manual nutrition override for", `historyOverride`, `NutritionEntrySource`, `originalNutritionEntry`. A day can be marked incomplete or fasted ("You marked this day as incomplete during a Check-In or from the Nutrition Data Manager.", "Fasting days that have no calories logged will be counted as zero-calorie days.").
- **Found (bundle)**: history is a popularity index for search and quick logging: `HistoryAggregateState(history: …)`, `historyPopularityMultiplier`, `history_search_service.dart`, `%lld Recent Foods`.
- **Inferred**: stored per day: the list of logged foods (each a snapshot of the food's nutrients at log time, a serving, a quantity, and an hour), the day's totals (`NutritionEntry`, macros), a micros document, a note, and flags for incomplete, fasted, and manual override. Daily totals are **stored** so the expenditure algorithm and charts do not re-scan entries.

### Body metrics

- **Found (bundle)**: `models/scale_entry.dart` (weight and `scaleBodyFat`), `models/trend_weight_entry.dart`, `models/body_entry.dart`, `models/steps_entry.dart`, progress photos (`ProgressPhotosEditingArgumentsModel(date: …)`, `frontPhoto`, `sidePhoto`, `backPhoto`, `photoUrl`, `removedPhotos`), `enums/body_metric.dart`, `enums/body_metric_category.dart`, `WeightType`.
- **Found (bundle)**: body measurements are a configurable set (`BodyMetricsEditingArgumentsModel(date: …)`, `BodyMetricsValueEditingArgumentsModel(bodyMetric: …)`, "Data visibility settings control what is visible to you in the app.").
- **Found (bundle)**: trend weight is **computed** and then stored as its own series (`TrendWeightEntry`, `weightTrendKg`, `currentWeightTrend`, `trendWeightTime`). V2 trend fields: `weightScaleKg`, `weightNoiseKg`, `weightTransientKg`, `observationNoiseScale`, `trendChangeKg`, `rateKgPerDay`, `WeightTrendV2PredictionBasis`.
- **Inferred**: weights are stored in kilograms (`bodyMassKg`, `weightKg`, `trendChangeKg`) and converted for display.

### Expenditure

- **Found (bundle)**: `models/tdee_entry.dart` and identifiers `tdee`, `tdeeValue`, `tdeeStart`, `tdeeMode`, `tdeeVersion`, `expenditureVersion`, `expenditureVersionOverride`, `tdeeIncludeGoalAdjustment`, `timeOfLastTdeeUpdate`, `ignoreInitTdee`, `tdeeTooLarge`, `tdeeTooSmall`, `energySmoothed`, `energySmoothedShort`, `energySmoothedLong`, `missingWeightEntries`.
- **Inferred**: expenditure is **computed** on the device ([`algorithms.md`](algorithms.md)) and stored per day as `TdeeEntry`, with the algorithm version, so charts and check-ins read stored values. A static expenditure is a user setting that replaces the computed series.

### Goals, programs, and targets

- **Found (bundle)**: `models/goal_entry.dart` (`goalWeight`, `goalRate`, `goalRatePerWeek`, `goalStart`, `targetDate`, `GoalStatus`, `GoalType`), `models/macro_plan.dart`, `models/weekly_plan.dart`, `models/day_target.dart`, `models/calories_per_day.dart`, `models/macro_target.dart`, `models/all_macro_targets.dart`, `models/plan_macros.dart`, `models/planner_datapoint.dart`, `models/minified_program.dart`.
- **Found (bundle)**: program settings identifiers: `programStyle` (Coached, Collaborative, Manual), `programType`, `proteinPreference`, `calorieFloor`, `calorieShift`, `allDaysSamePlan`, `daysDifferentPlan`, `targetCalories`, `targetProtein`, `targetCarbs`, `targetFat`, `proteinPerKg`, `limitedByFloor`, `fatBaselineMet`, `proteinAtDesiredLevel`, `periodizedTargets`, `withInitialTargets`, `autoTargetsEvents` (`AutoTargetsEvent(time: …)`), `AutoTarget(weight: …)`.
- **Found (bundle)**: check-in state: `CheckinState`, `CoachingModule`, `CoachingModuleStatus`, `CoachingModulePriority`, `fastCheckIn`, `programUpdate`.
- **Inferred**: a goal is a dated record (start, target weight, rate, type, status); the active program holds style and preferences; each check-in writes a new `WeeklyPlan` of seven `DayTarget`s (calories plus protein, carbs, fat). Targets are **computed** at check-in and **stored**, so a past day keeps the targets it had.

### Micronutrient goals

- **Found (bundle)**: `models/micro_goal_definition.dart`, `models/micro_goal_entry.dart` (`MicroGoalEditingArgumentsModel(nutrient: …)`), `enums/micro_goal_type.dart`, `constants/nutrient_ranges.dart`. Each goal has a floor, target, and ceiling; "Auto mode" fills them from age, sex, weight, and program.
- **Inferred**: stored only when the user customizes a nutrient; dated, so a change applies from a day forward.

### Habits

- **Found (bundle)**: `enums/habit.dart`, `HistoryScorePiecewiseInterval(daysCutoff: …)`, "Habits" panel copy in [`app-strings.md`](app-strings.md).
- **Inferred**: habit scores are **computed** from the day records (logged, partial, fasted, weighed in), not stored.

### Integrations

- **Found (bundle)**: `models/integration.dart` (`Integration(type: …)`), `models/integration_map.dart`, `enums/integration_data_type.dart`, `services/integrations/apple_health_manager.dart`, `health_connect_manager.dart`, `integration_sync_service.dart`; logos for Apple Health, Health Connect, Google Fit, Fitbit. `integrationSyncInterval`, `scaleSync`, `nutritionSync`, `disableStepsApple`.
- **Found (web)**: the integrations import calories, macros, micros, and weight going back up to 30 days, with priority rules when sources conflict. https://macrofactor.com/version-2-9-3/

### Export

- **Found (bundle)**: `ui/more/data_export/services/*`: `quick_export_service.dart`, `metrics_export_service.dart`, `food_log_export_service.dart`, `library_export_service.dart`, `other_export_service.dart`, `workout_log_export_service.dart`. Models `ExportMetric`, `ExportMetricCategory`, `ExportTimeFrame`. Output is `.xlsx` (the pool has `xl/worksheets/sheet`). Copy: "Quick Export", "Granular Export", "Export Food Log", "Due to its format and size, the food log must be exported as a single file.", and "Expenditure, weight trend, scale weight, calories, macros, micros, primary nutrition targets, and food log."
- **Found (bundle)**: column header prefixes: "Trend Weight (", "Expenditure (", "Goal Rate per Week (%)", "Starting Scale Weight (", "Ending Scale Weight (", "Starting Trend Weight (", "Ending Trend Weight (", "Trend Weight Goal Checkpoint Date", "Trend Weight Goal Checkpoint Weight (". The unit is appended.
- **Inferred**: an importer for the owner's history should read a real Granular Export rather than the cache; it covers every entity above.

## Food database

- **Found (bundle)**: search runs against a Typesense cluster whose config comes from Remote Config (`TypesenseConfig`, `TypesenseNode`, `services/firebase/remote_config/typesense_config.dart`, "Failed to parse typesense config from remote config"). Collections: `common_foods`, `branded_foods`, `off_foods` (`/collections/<name>/documents/`). Settings "Show branded items in search" and "Show Open Food Facts items in search" toggle the last two.
- **Found (bundle)**: Open Food Facts is both a source and a sink: `services/open_food_facts_service.dart`, `services/openfoodfacts`, `assets/logos/off-logo-*.svg`, "Data for this food was provided by Open Food Facts contributors.", and "Every new custom food you create or edit will be contributed to Open Food Facts …". Licensed entries copied with "To Custom" are not contributed.
- **Found (bundle)**: Calomeal, a Japanese food database, behind Cloud Functions at `https://calomeal.fn.macrofactor.com` (`services/calomeal_search_service.dart`, "Calomeal barcode lookup failed").
- **Found (bundle)**: Nutritionix traces: `nfCalories`, `nfProtein`, `nfTotalFat`, `nfTotalCarbohydrate`, the paths `v2/natural/nutrients` and `v2/search/item`, and the image `https://d2eawub7utcl6.cloudfront.net/images/nix-apple-grey.png`. **Inferred**: a legacy or fallback natural-language source, since current AI logging goes through Vertex.
- **Found (bundle)**: AI logging uses Firebase AI Logic templates (`TemplateGenerativeModel`, `TemplateLLMModelParameters(templateId: …)`, `services/firebase/remote_config/prompt_operation_config.dart`) in a three-step pipeline: `VertexGenerateFoods` (turn a description or photo into food queries), Typesense lookup (`typesense_query_foods.dart`, "Failed to query Typesense for AI food search"), then `VertexSelectResults` (pick database matches), with `VertexAnalyzeFood` for label and product images (`ai_features/product_image_import/*`). Photos upload through `services/ai/ai_photo_upload_service.dart`.
- **Found (web)**: the database has "more than 1,360,000 verified items", mostly licensed from research databases, and AI logging matches real database entries instead of inventing values. https://help.macrofactorapp.com/en/articles/25-how-robust-is-the-database-coverage-in-my-region and https://help.macrofactorapp.com/en/articles/258-ai-food-logging
- **Found (bundle)**: cached locally: Firestore's offline cache (the user's own foods, recipes, favorites, and logged food snapshots), `foodThumbnailCache`, and the 406-entry food icon index `flutter_assets/assets/icon_metadata.jsonl` (icon file, name, categories, aliases, typos, keywords, weighted matchers) that picks an icon for any food name.
- **Inferred**: the server database itself is not cached; search needs the network.

What an offline-first clone needs:

1. A local food table with the same shape as the user's custom foods, holding every food the user has logged, favorited, or created. Logging copies a snapshot, so the log never depends on the remote database.
2. A bundled common-foods set for offline search. USDA FoodData Central (Foundation and SR Legacy) uses the same nutrient numbers as MacroFactor's ids, so it maps without translation.
3. Online lookups by barcode and name against Open Food Facts (free, open API), cached into the local table on first use.
4. The icon index above, reusable as is for food icons. It is a 299 KB asset of category metadata; check its license before shipping it.
5. AI describe and photo logging as an optional online step that produces queries against the same local and Open Food Facts search, matching MacroFactor's approach.

## Local data

- **Found**: the app's container is `~/Library/Containers/D19D0D96-3ED4-4DB1-ADA9-238992A624EE/` (its UUID name is per machine). `lsof` on the running app shows `Data/Library/Application Support/firestore/__FIRAPP_DEFAULT/sbs-diet-app/main/` (LevelDB), `…/Google/RemoteConfig/RemoteConfig.sqlite3`, `…/Google/FirebaseMessaging/rmq2.sqlite`, `Data/Library/Caches/com.sbs.diet/Cache.db`, and `Data/Library/HTTPStorages/com.sbs.diet/httpstorages.sqlite`. The widget group is `~/Library/Group Containers/group.com.sbs.diet.widgetgroup`.
- **Blocked**: macOS App Data protection denies reads of both from the agent's shell ("Operation not permitted"), so no collection paths, document shapes, or owner data were read. To read them, grant Full Disk Access to the terminal host, copy `firestore/__FIRAPP_DEFAULT/sbs-diet-app/main/` to `~/.claude/orchestrate/a-better-me-nutrition/private/cache/`, and decode the copy. Never open the live directory, which the app holds locked.
