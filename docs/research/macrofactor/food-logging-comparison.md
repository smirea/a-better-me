# Food logging: MacroFactor compared with A Better Me

Both apps were driven on 2026-10-27 as one persona: someone who logs food every day, repeats whole days, repeats meals at other hours, and logs recipes at full and partial servings. MacroFactor 5.8.9 ran on the Mac against the owner's account, writing only to future days that were cleared afterwards. A Better Me ran as a Debug build on a simulator with the dev seed. Screenshots stay out of git (`.cache/food-logging-compare/`), because MacroFactor's show the owner's data.

## What MacroFactor does that a daily logger relies on

Ranked by how often the persona needed it.

1. **Tapping an hour pill selects every entry in that hour.** Copy, Move, Modify Timestamp, and Remove then act on the whole meal: copy breakfast to tomorrow in 3 to 6 taps, whatever its size. Long press adds food at that hour only when Add Foods to Hour is set to the long-press shortcut.
2. **Copy Day goes to several dates in one submission**, and appends to what those days hold; it never replaces.
3. **Copy to Date & Time** moves a meal to another day and hour together. Copying to a date keeps each entry's minute, and copying to an hour sets minute zero.
4. **Paste Inline** turns every hour's + into a paste target, on any day the owner swipes to.
5. **Latest remembers the last amount and unit** a food was logged at (180 g, 3 oz, 0.5 serving), ordered by when it was logged.
6. **Hour Picks**: the logger opened for an hour shows "8 AM Picks", the foods usually logged at that hour, above Latest.
7. **The row's + builds a plate without leaving search**, and the banner shows what the plate leaves of the day.
8. **Search rows are about 47 pt**: a one-line name with the matched text bold, then one line of "105ઠ 1P 0F 27C • 1 medium". About 18 foods fit on a screen.
9. **Recipes scale by typed fractions** (0.5, 1/2) and log without duplicate records.
10. **Create Recipe from a selection** of two or more entries prefills the ingredients with their logged amounts and keeps the entries.
11. **Explode** replaces a logged recipe with its ingredients scaled to the logged amount, without confirmation.
12. **Hide Empty Hours and Hide Food Details apply at once** from the ⋮ menu. Hide Food Details shows a row of icons per hour, not names.

MacroFactor's search field has **no clear button**. Its nutrient colors fill only bars, rings, and chip backgrounds: every number, macro letter, and row's macro text is white, the hourly totals' letter badges are gray `#333333`, and the food detail's share chips are the macro hue darkened (protein `#7E2C10`, fat `#826100`, carbs `#005231`) under white text. Sampled fills: calories `#679FFA`, protein `#FF8B66`, fat `#FFD15E`, carbs `#5DBA87`. Changing a logged entry's unit keeps the typed number (90 g becomes 90 oz); ours converts the amount instead, which is kept.

## Where A Better Me falls short

- **The hour pill does nothing.** It is a label without a gesture, so acting on a meal means tapping each entry. The Add Foods to Hour, Premove, Alignment, Calendar Week Banner, and Calendar Scrolling settings are shown in Settings and read by nothing.
- **Search rows are 67 pt, 103 pt for long names**, because the shared food row wraps both lines and the list keeps inset-grouped spacing. About 8 rows fit without the keyboard and 4 with it. Matched text is not bold, the keyboard does not dismiss on scroll, and every food shows the default icon.
- **The search field has no clear button.** Clearing "banana" takes six backspaces. This is a step past MacroFactor rather than parity.
- **Nutrient colors.** Dashboard nutrient tiles for anything but the macros (Fiber, Sugars Added) drew in the calorie blue, because the macro color lookup fell back to calories for every other nutrient. The food detail chips were bright macro fills with dark text, and the plate button used the app accent, which is nearly protein's salmon. Fixed with this document: one lookup by the registry's group (`NutrientID.color`), share chips darkened like MacroFactor's, and a neutral plate button.
- **Latest orders by when food was eaten**, so foods copied to future days outrank today's and carry stale servings. There are no hour Picks.
- **The copy and move target bar** hides To Dates, To Date & Time, and Paste Inline off-screen, the Paste Inline hint has no background, and nothing confirms a copy or offers undo.
- **The logger's library** never offers Create & Add, recipes in the logger lack Prepare, Edit, and Duplicate, the ingredient picker adds one food per trip, and decimal fields have no Next or Done key. The dev seed has no recipes, custom foods, or favorites, so none of this shows without setup.
- **No Create Recipe from a selection and no Explode**, both cut earlier and both on the persona's daily path.
- **Smaller:** the plate's Log Foods button covers its last row, the banner ignores a Quick Add being typed, the timeline does not scroll to what was just logged, and the entry editor cannot change the day.

The reported freeze when toggling nutrition settings did not reproduce in the walkthrough; it is investigated on its own.
