# Widgets

Home Screen and Lock Screen widgets, and the Control Center control. The reference apps' sets come from their bundles: MacroFactor's `mfwidgetsExtension.appex` ([research §11](../research/macrofactor/README.md)) and MacroFactor Workouts' `RunnerWidgets.appex` ([watch research §3, §5](../research/mf-workouts/watch.md)).

## What ships

- **MacroFactor's four widgets and its control, under their names.** Current & Remaining (calories left and the macros under them), Nutrient Focus (one nutrient picked in the widget's settings), Nutrient Collection (four nutrient slots), Quick Actions (four configurable buttons), and the Quick Action control for Control Center, the Lock Screen, and the Action button. Each widget also takes the Lock Screen families that fit it.
- **MacroFactor Workouts ships only its Live Activity on the phone,** which this app already has ([Live workout surfaces](live-workout.md)). Its Live Activity also opts into the `.small` family, so it shows in a paired watch's Smart Stack; ours does the same with the heading, thumbnail, and clock.
- **Cut:** MacroFactor's widget theme (System, Light, Dark), since the app is dark only; the "plan last updated … check in" reminder, since no check-in due date exists to compare against; and the watch app's own complications (`com.sbs.train.watch.currentWorkout*`), whose extension is absent from the reference bundle, so only their kind names are known.

## One snapshot in the app group

- **The app writes, the widgets read.** The database lives in the app's private container, so `WidgetPublisher` (`Sources/App/Widgets/`) observes the log, the day rows, the plans, the nutrient goals, the latest weight, and the settings, and builds a `NutritionSnapshot` (`Sources/Shared/Widgets/`) inside the database read, off the main thread. A changed snapshot is written to `Widgets/nutrition.json` in `group.com.stefan.a-better-me` and reloads only the nutrition widget kinds.
- **Seven days, so midnight needs no app.** The snapshot holds today and the six days after it, each with its consumed amounts (planned entries count) and its ranges: calories and macros from the plan's weekday target, every other nutrient from its goal. The timeline has one entry per day from its midnight, then an entry asking to open the app. The day key is the device's calendar day, as `CalendarDay` writes it.
- **A new day changes no table,** so the publisher reads again each time the app becomes active.
- **The snapshot carries what the widget can't look up:** the visible nutrients (hidden ones are left out, the macros always stay) with names, short names (the Lock Screen rectangle labels its four slots "cal", "prot", and so on, since first letters made Calories and Carbs both "C"), units, and tints, the pinned nutrients, and `showOverages`. The nutrient picker in a widget's settings lists the snapshot's nutrients.
- **Remaining follows MacroFactor's wording.** `NutrientProgress` measures against the target, else the floor, else the ceiling. Passing a floor reads "Minimum met"; only a target or a ceiling can be overshot, and remaining goes negative ("120 kcal over") only when overages show.
- **Empty slots take the pinned nutrients.** The nutrient query has no `defaultResult`, because App Intents filled every empty slot with it and a new Nutrient Collection showed Calories four times.

## Quick actions

- **`QuickAction` is MacroFactor's target list adapted to both halves:** Search, Barcode, Quick Add, Ramble (in place of MacroFactor's AI, opening the logger's Ramble tab), Your Foods, Recipes, Favorites, Weight, Food Log, Dashboard, plus New Workout (the Workouts "+") and Empty Workout.
- **One inbox routes every entry point.** Widget buttons and the control run `OpenQuickActionIntent`, a foreground intent that runs in the app's process and drops the action into `QuickActionInbox`; `abetterme://action/<case>` links land there too: the Quick Actions Lock Screen circle uses one, and a tap on a nutrition widget opens the Food Log through one. `RootView` opens it: it dismisses everything presented above the root (the live workout and any sheet a tab owns), selects the Nutrition, Workout, or Dashboard tab, and presents the logger, the weight sheet, or "+" through one `RootSheet` item that also carries the tab bar's own "+". The inbox outlives the view, so an intent that runs before the first frame of a cold launch still opens its screen.
