# MacroFactor Workouts: research spec

Source: MacroFactor Workouts v1.4.1 ("Runner.app", a Flutter iPad build running on macOS), logged into the owner's account, studied on 2026-10-23.

**Layout caveat.** The macOS window cannot be narrower than 515 pt. At that width the app still uses its tablet layout: a left navigation rail instead of a bottom tab bar. On iPhone, assume the same five destinations sit in a bottom tab bar (Dashboard, Workout, center `+`, Levels, More). Every screen inside the rail is a single column, so the content layouts carry over to a phone directly. Full-screen flows (live workout, editors, builders) hide the rail.

Screenshots are in `screens/`. They are JPEG, about 550x1000, dark theme unless named `theme-light-*`. The equipment catalog with default weights is in [`equipment.md`](equipment.md).

Test data created during research: the workout "ZZ Research Test" (in the Workout Library), one logged session of it dated today (2026-10-23), and the custom exercise "ZZ Test Curl". A follow-up agent should delete all three (Workout detail ⋮ > Delete Workout; Workout History > the session > ⋮ > Delete Workout; More > Exercises > search "ZZ" > Delete Exercise). All settings were restored. No program was created.

---

## 1. Visual design language

- **Theme.** There are three options: System, Light, and Dark (More > Theme). The owner uses System, which renders dark on this Mac.
  - Dark: the app background is near-black (~#141414). The rail and header areas are ~#1C1C1C. Cards are ~#252525 to #2A2A2A. Input cells are ~#333. Primary text is white, secondary text is ~#9A9A9A.
  - Light: white and ~#F2F2F2 surfaces. See `theme-light-*.jpg`.
- **Primary buttons** are full-width white pills with black text in dark mode (Next, Done, Save, Start Workout). Secondary buttons are dark-gray pills. Destructive text is red (~#E06666), for example "Reset to App Defaults".
- **Accent colors** are semantic, not a single brand color:
  - Muscle highlight on body maps: blue ~#3366FF. Heat intensity scales with volume.
  - RIR badges: 0 and 1 red ~#D63A3A, 2 and 3 amber ~#F0A830, 4 and 5 green ~#4E9A5E, 6+ blue ~#3A6FE0, "?" gray.
  - Plate colors in the plate calculator: 45 lb blue, 25 lb green (IPF-style coding).
  - Dashboard charts: workouts and steps bars salmon ~#F08C6C, weight trend lilac ~#A99BF0, scale weight green ~#7CC48A, exercise 1-RM line light blue ~#8EC9E8, records bars yellow ~#F5C842, muscle-group bars blue.
  - Program colors (7 swatches): red, orange, yellow, green, blue, purple, teal. Program icon tile: a 40 pt rounded square in the program color with a white glyph (Material Symbols).
- **Typography** (bundled fonts in `flutter_assets/packages/macrofactor/fonts`):
  - **MacroSans** (variable): the screen titles, which are all-caps, wide, and heavy ("DASHBOARD", "WORKOUT", "LEVELS", "MORE", "CREATE WORKOUT").
  - **DM Sans** (variable): all body text, section headers (bold ~20 pt), and list titles (semibold ~15 pt).
  - **Inter** and **NotoSansJP**: fallbacks.
  - **CustomIcon.ttf**, Material Symbols (Outlined, Rounded, Sharp), and CupertinoIcons: icons.
  - Numbers in charts and summaries use DM Sans.
- **Shape:**
  - Cards and grouped lists use a ~12–14 pt corner radius with 1 pt hairline dividers inset from the leading icon.
  - Chips and filter pills are fully rounded (~16 pt radius, 28–32 pt tall) on a dark-gray fill. Muscle tags are small 4 pt-radius tags: a filled gray tag for a primary muscle, an outlined tag for a secondary muscle. The muscle being viewed is drawn white-filled or white-outlined.
  - Set-number buttons are 36 pt circles. Toggles are pill switches (white track with a black knob when on).
  - Bottom sheets have a grab handle, an X at the left, a centered bold title, an optional right action icon (sliders), and a hairline under the header. Option lists inside sheets are 49–57 pt rows with radio circles or a title and subtitle.
  - Dialogs are centered cards with a title, body text, and two stacked full-width buttons.
- **Spacing:** 18–20 pt side margins, a 49 pt standard list row, and section headers ~30 pt above groups.
- **Imagery:**
  - Exercise thumbnails: a photo of a model on a light-gray studio background in a 2:3 rounded tile. Custom exercises without media show their initials stacked vertically ("Z / T").
  - Muscle illustrations: gray anatomical figures with blue highlighted regions, in three forms: whole-body front and back, per-muscle mini torso tiles, and SVGs in `assets/muscle_groups/{male,female}/*.svg`.
  - Space-themed Rive illustrations (rocket, planets) appear on onboarding and create screens.
- **Animations:**
  - A confetti burst on the Workout Complete screen when records are set.
  - Exercise videos loop inline.
  - Sheets slide up over a dimmed scrim.
  - The live workout auto-scrolls between superset exercises.
  - The rest timer bar drains.

## 2. Navigation shell

The rail (bottom tab bar on iPhone) has five destinations:

- **Dashboard**
- **Workout**
- **center `+`** (white filled circle): opens the Shortcuts sheet
- **Levels**
- **More**

The Shortcuts sheet (`nav-plus-01.jpg`) has a sliders icon in its header to customize it. It contains:

- A row of 4 round shortcut buttons: Weight, Photos, Metrics, History.
- An "Up Next • Mon — Upper A (push)" card showing the next program workout with its exercise list and muscle tags. Tap it to open that workout.
- Rows: Empty Workout, New Program, New Workout.

---

## 3. Workout tab

`workout-tab-01.jpg`, `workout-tab-02-library.jpg`, `workout-tab-11-library-with-test.jpg`

**Header:** the title "WORKOUT" plus three round icon buttons:

- **Calendar** expands the week strip into a scrolling month grid (`workout-tab-06-calendar.jpg`, `workout-tab-07-calendar-past.jpg`). Day pills show the day number and weekday initials. Days with a logged workout get an amber outline, today gets a dot, and months alternate background shades with a "Nov" or "Dec" label. Tapping a past day opens that day's workout summary.
- **+** opens the "Create" sheet with three choices: New Section, New Program, New Workout (`workout-tab-04-plus-menu.jpg`).
- **⋮** opens the "More" sheet (`workout-tab-05-more-menu.jpg`):
  - Start Empty Workout
  - Workout History
  - Customize Sections
  - Archive, with the subtitle "1 program, 0 workouts"

**Week strip:** 7 day pills, Monday to Sunday. Scroll behavior is configurable as Daily Scroll or Weekly Swipe. When the strip shows a non-current week, a dark round "›" button appears to jump back.

**Sections** are user-orderable (`workout-tab-09-customize-sections.jpg`):

- **Active Program** (can be toggled on or off): a header with "Cycle 1" on the right, then the program card. The card has an icon tile, the name, "6 workouts", and a collapse chevron. Under it is one row per program day: the day name (for example "Mon — Upper A (push)"), a gray comma-separated exercise list (2 lines), a horizontal row of muscle tags, and a completion checkbox on the right.
- **Workout Library**: standalone workouts (title, exercise list, tags, chevron) and programs, with a "Collapse" link.
- **Your Sections**: custom sections added with +. Empty state: "You haven’t added new sections yet. You can add one by tapping + on this page".

**Workout History** (`history-01.jpg`) is grouped by date header ("Sep 27, 2026"). Each row has the program icon tile, the workout name, the program name, the exercise list, and muscle tags. Tap a row to open the workout summary.

**Archive** (`workout-tab-10-archive.jpg`): archived programs and workouts, in the same row style.

### 3.1 Workout detail (template)

`workout-detail-01.jpg`, `program-workout-detail.jpg`

**Header:** back, the title, a **house icon** (gym for this workout), and **⋮**. The ⋮ menu has these options (`workout-detail-02-menu.jpg`):

- Name (Edit)
- Swap Gym for Workout ("Currently working out at Aquasol 6770")
- Reset Workout ("Reset workout time, sets, weights, and any other modifications you made")
- Duplicate Workout
- Export Workout (.xlsx)
- Archive Workout
- Delete Workout

**Body:**

- **Target Muscles**: horizontally scrolling cards. Each card has a muscle mini figure, the muscle name, "N exercises", and "N sets". A secondary muscle counts 0.5 set per set, for example "Forearms · 1 exercise · 0.5 sets".
- **"N Exercises"** with "Estimated workout time is 14 min", and a round + button that opens the exercise picker.
- **Exercise rows**: a thumbnail, the name, the per-set target lines ("D 8 reps", "2 8-12 reps") with RIR badges on the right, muscle tags, and ⋮.
- **Superset groups** get a header row ("Superset · 3 rounds" with ⋮). Member thumbnails carry a small ⇄ badge.

The **Start Workout** button is pinned at the bottom.

**Exercise ⋮ menu ("Exercise Options")** (`create-workout-07-exercise-menu.jpg`):

- Info ("Learn about the exercise")
- Targets ("No target set", Edit)
- Superset ("Manage superset settings"). This opens "Superset with previous" or "Superset with next".
- Swap ("Replace with an alternate")
- Duplicate Exercise
- Remove from workout

**Superset ⋮ ("Superset Options")** (`superset-03-menu.jpg`):

- Add Exercises ("Adds exercises to the superset")
- Remove Superset ("Also removes all exercises from workout")
- Ungroup Exercises

**Targets sheet** (`targets-01.jpg` to `targets-07-rest-picker.jpg`):

- Columns: Set, Reps Min, Reps Max, (Rest), RIR. The fields show "Optional" placeholders.
- `+` adds a set that copies the previous set.
- Tapping RIR opens "RIR Targets" with circles 0, 1, 2, 3, 4, 5, 6+.
- Tapping the set number opens "Set Type" with these options and descriptions:
  - **Standard Set**: "A normal set of a fixed weight and target repetitions"
  - **Warm-Up Set**: "A set with a lighter weight to prepare your muscles for heavier working sets". This option is offered only in the live workout, not in the template targets.
  - **Drop Set**: "A set where you continue repping to push muscle fatigue with progressively lower weights after reaching failure at a heavier load". The badge is "D". It gets indented "+" sub-rows (the drops). Reps Max is disabled and RIR is forced to 0.
  - **Myo Set**: "A set where you continue repping to push muscle fatigue with progressively lower reps while keeping the weight constant". The badge is "M". Its sub-rows keep the same weight.
  - **Failure Set**: "A set where you perform reps until you can no longer maintain proper form (for compound exercises) or complete another rep (for isolation exercises)"
- **Set Rest Timers** toggle: "This will override default exercise settings". It adds a Rest column. Each cell opens a min:sec wheel picker ("Rest Timer"). Defaults come from the exercise type (1:30 for isolation). Drop sub-rows default to 0:00.

**Reordering:** not verified. There is no visible drag handle on template rows. Program days have a "Re-order" action.

### 3.2 Create Workout flow

`create-workout-01` to `09`. A full-screen wizard with a progress bar under the header:

1. A splash screen with a rocket illustration: "CREATE WORKOUT · You will create or import a new workout for your library." Then Next.
2. "How would you like to create your workout?" Options: Build From Scratch ("Start with a fully blank slate and no guidance") or Import Workout From File ("You can upload .xlsx files from previously exported workouts").
3. "What would you like to name this workout?" The name defaults to today's date.
4. "Where will you work out?" A list of gym profiles with "192 pieces of equipment".
5. An editor that matches the workout detail, with **Save to Library** at the bottom.

### 3.3 Programs

**Program editor** (`program-01.jpg`):

- Title bar: back, the program name, and a sliders icon for Program Settings.
- Scrollable day tabs ("Mon — Upper A (push)" and so on). Generated programs also have "Rest" days and an "Add Day +" tab.
- Action chips: Gym ▾, Rename, Re-order, Duplicate, Change to Rest, Remove.
- Target Muscles with a **Day / Cycle** toggle ("Day / Week" for weekly programs).
- "6 Exercises" with an "Add Exercises" link.
- Each exercise has:
  - a targets card, "10 Cycles", listing its sets ("1 5-8 reps", RIR badge). Generated programs instead show horizontally scrolling **Week 1, Week 2…** cards with changing rep ranges. Example: 11-13, 11-13, 9-11, 8-10.
  - a pinned **Program Note** card with a pin icon.

**Cycle targets sheet** (`program-06-cycle-targets.jpg`):

- Columns: Set, Reps Min, Reps Max, Rest, RIR.
- Toggles: "Skip Exercise" ("Exercise will be skipped on Mon — Upper A (push), 10 Cycles") and "Set Rest Timers".
- "More Options" opens "Saving Options", with Exercise Settings scope choices: "<exercise> only", "All exercises for the day", or "All exercises in the program".

**Program Settings** (`program-02-settings.jpg`):

- Number of Cycles (10)
- Name
- Color & Icon (`program-03-color-icon.jpg`: 7 colors and a grid of about 50 glyphs)
- Day Order (`program-04-day-order.jpg`: "6-Day Cycle", Day 1..6)
- Deload (`program-05-deload.jpg`):
  - None: "Train continuously without scheduled reductions in intensity or volume."
  - First Cycle: "Start each training block with a lower-intensity cycle to ease into new workloads and reduce soreness."
  - Last Cycle: "Finish each training block with a lighter cycle to promote recovery and readiness for the next phase."
- Periodization toggle: "Organize your training into phases that vary intensity and volume to support continuous progress and effective recovery". Its sub-options were not opened.
- Duplicate, Export, Deactivate, Archive, and Delete Program.

**New Program wizard** (`new-program-01` to `04`). Intro: "We will create a personalized training program tailored to your goals. Or, you can import or build your own." Method choices: **Use Smart Generation** (Recommended), Build From Scratch, or Import From File. The Smart Generation questions are:

1. Primary goal: Muscle Hypertrophy, Muscle Strength, or Both Strength & Hypertrophy. Each option has a one-line description.
2. Times per week: a big number stepper, default 3.
3. Split: No preference, Full Body, Upper/Lower/Full Body Split, or Push/Pull/Legs Split.
4. Session time: Up to 20, 20–40, 40–60, 60–90, 90–120, or Over 120 minutes.
5. Rep-range progression:
   - No preference
   - Static: "Keep the same rep targets each week."
   - Linear: "Gradually decrease rep targets and increase weights over the program."
   - Reverse Linear: the opposite of Linear
   - Undulating: "Alternate between lower rep targets with heavier weights and higher rep targets with lighter weights each week."
6. Muscle focus: a list of muscles, each set to more or less emphasis.
7. Gym.
8. "Keep these selections from last time?" Shows Deload (toggle, Recommended) and Lifting Experience (Intermediate).
9. Name, defaulting to the split name.
10. Color.
11. A "Generating your program based on the latest science" checklist: Experience, Muscle prioritization, Equipment availability, Exercise selection, Muscle strength focus, Optimizing for workout duration, Periodization, Smart progression.
12. The editor, with **Save to Library** or **Activate Program**.

---

## 4. Exercise picker (add exercise)

`picker-01.jpg` to `picker-07-after-custom.jpg`, `picker-filter-*.jpg`, `swap-01.jpg`

A full-height sheet.

**Top bar:** X, + (Create Custom Exercise), a tray showing thumbnails of the selected exercises, and ↓/↑ to expand the tray. Swap mode shows "Swapping with "ZZ Test Curl"" instead of the tray.

**Filter chips, scrolling horizontally:**

- **Reset icon**
- **Gym** ("Gym Options · Impacts exercise selection", a list of gyms plus "Manage Gym Profiles")
- **Type**: Any, Compound Upper, Compound Lower, Upper Isolation, Lower Isolation, Core
- **Laterality**: Any, Bilateral, Unilateral, Asymmetrical
- **Resistance**: the equipment list, grouped, with a "Filter equipment by name" field. Items missing from the gym say "Not available in this gym".
- **Support**: Benches & Racks and similar
- **Range of Motion**: a 0–5 range slider with Save

**Muscle tiles row:** scrolls horizontally. Tap a tile to filter. Tiles: Chest, Quads, Upper Back, Glutes, Lats, Hamstrings, Biceps, Triceps, Front Delts, and so on.

**List:** grouped by category, each group showing 5 items and a "See N More" / "See Less" link. Groups and counts: **Free Weights** (~523), **Machines** (~492), **Bodyweight & Personal** (~289), **Cardio** (Running, Cycling, Elliptical Training, Walking, and others, "See 7 More"), **Other**.

- A row has a thumbnail, the name, and a muscle line "Primary, Primary • Secondary, Secondary". The bullet separates primary from secondary muscles.
- The round **+** on a row adds the exercise. In swap mode it becomes ⇄. Tapping the row opens the exercise detail sheet with an "Add Exercise" button.

**Search:** a field pinned at the bottom ("Search for an exercise") next to a white **Done** pill. Matched substrings are bolded. Active filters still apply, so a search can show "No Results".

**Expanded tray, "Your Exercises":** the selected exercises with trash buttons, and a toggle **"Add as a superset?"**. With 3 or more selected it reads **"Add as a circuit?"**.

**Swap sheet** (from a live workout, `live-20-swap.jpg`): the current exercise, a **"Smart Substitutions"** list of similar exercises (same muscles), and a "Find Other Replacements" button that opens the full picker.

### 4.1 Create Custom Exercise

`custom-exercise-01` to `09`. A 5-step wizard:

1. **"Build your exercise"**:
   - Exercise Name (required).
   - Trackable Metric (required). Two slots, each from: Reps, Reps per side, Weight, Weight per side, Weight per side (Persistent), Weight (Assistance), Duration, Duration per side, Distance short, Distance short per side, Distance long. Each option has a description, for example "Track short distances, like sprints or carries".
   - Type.
   - Laterality: Bilateral ("Both sides of the body work together at the same time"), Unilateral, Asymmetrical, or "Unilateral & Bilateral" ("…each limb works independently on its own resistance path").
2. **"Select muscles"**: a 3-column grid of mini-figure tiles in Upper and Lower groups. A tap cycles none → **P** (primary) → **S** (secondary). A footer shows "1 primary, 1 secondary" with Reset.
3. **"Select equipment"**:
   - Resistance (required): "Equipment that adds load to the exercise", choose one.
   - Support (optional): "Equipment that assists, stabilizes, or makes the movement possible, without adding resistance".
4. **"Final details"**:
   - Range of Motion (0–5 stepper with a 5-segment bar)
   - Stability (0–5)
   - Body Weight Contribution % (required; shows "0 lb at your current weight")
   - Primary and Secondary Joint Action (a huge anatomical multiselect, "Choose all that apply")
   - Alternate Names (300 characters, comma-separated)
   - Description (Edit)
5. **"Does everything look correct?"** Warning: "Most fields are final · You won’t be able to edit them after the exercise is created." Trackable Metric and Laterality are tagged "Final". Buttons: **Create & Add** and **Create**.

## 5. Exercise detail sheet

`exercise-detail-01` to `05`, `library-03`, `library-04`, `live-24-info.jpg`, `live-25-fullscreen-video.jpg`

**Header:** X and the exercise name. Tabs: **Instructions · Details · History**.

- **Instructions:**
  - The **video plays in-app**, looping inline, with a progress bar.
  - Speed buttons: **.2X, .5X, 1X**.
  - 3 camera-angle thumbnails on the right switch the angle.
  - Tapping the exercise thumbnail in the live workout opens a full-screen player with the same controls.
  - Below the video are collapsible markdown sections: **Setting up**, **Exercise technique**, **Description**. These are numbered lists with nested sub-points. The text is bundled locally as about 1,500 markdown files in `flutter_assets/assets/markdown/<id>.md`. Stills are in `assets/exercises/<id>_{a,b,c}.webp`.
- **Details:**
  - **Target Muscles**: cards with a mini figure, the name, and "Primary" or "Secondary".
  - **Properties**: Range of Motion 4/5 and Stability 4/5, each as a 5-segment bar.
  - **Resistance Equipment** and **Support Equipment**: cards. Support can list alternative sets, for example "Flat Bench Press Station | Flat Bench, Power Rack | …".
  - **Details**: Alternative Names, Type, Body Weight Contribution (8%), Metrics ("Weight x Reps", "Reps per side x Weight per side"), Laterality, Primary Joint Action, Secondary Joint Action.
- **History:**
  - Dropdown chips: a metric ("Exercise Display": 1-RM, 3-RM, 10-RM, Heaviest Weight, Total Volume, Best Set Volume, Total Reps, Best Set Reps, Total Sets), a sort ("Most Recent"), and "Records On / Records Only / Records Off".
  - Rows show the program icon, the date, the program name, the metric value, and record badges (🏆 volume, ✱ reps, medal 1-RM).
  - A row expands to show its sets, for example "1 | 50 lb (per side) x 9 (per side) | RIR 4".
- In the picker, a bottom "Add Exercise" button.

**Exercise Settings page** (`library-02-exercise-page.jpg`, `live-28-exercise-settings.jpg`):

- **General:**
  - Info
  - Exercise Note: "Note will display on this exercise every time you work out"
  - **Do Not Recommend**: "This exercise will not be recommended when creating programs"
  - Edit Duplicate: "To edit all available exercise properties, create a duplicate"
  - Custom exercises add Edit (limited), Archive Exercise ("…hide…but will not impact your history"), and Delete Exercise ("…remove the exercise from your custom library, history, programs and workouts").
- **Exercise Overrides**, each "Default · Edit": Equipment Weights, Rest Timer, Rest Between Left/Right Sets, Expand Rep Range, Weight Match, Warm-Up Automation, Warm-Up Scheme, Reset Defaults.
- **Equipment Weights** (`live-29` to `31`) explains: "Settings below will override your gym profile weights for this exercise. Equipment availability is still determined by the profile."
  - Pin-stack machines: weight ranges ("Range 1 · 0 - 500 lb, 10 lb increments", Edit Range, +), a kg/lb toggle, and **"Scan with AI"**.
  - Plates: a checklist of 0.5, 1.25, 2.5, 5, 10, 25, 35, 45, 55 lb, each with "Set Qty".

## 6. More > Exercises (library)

`settings-exercises.jpg`, `library-*.jpg`

The same list and filters as the picker, with:

- **tabs**: All, Performed, Deprioritized, Modified, Archived
- a subtitle per row: "Performed 11 times"
- a chevron that opens the Exercise Settings page
- **+** in the header to create a custom exercise
- search pinned at the bottom

---

## 7. Live workout (tracking)

`live-00` to `live-36`

A full-screen screen. From top to bottom:

1. **Header row:**
   - Hamburger (Workout Options).
   - Elapsed timer "0:04:49". It can be hidden in settings.
   - On the right, the **rest timer**: a stopwatch icon, "1:06", and a white progress bar that drains. Tap it to open the Rest Timer sheet.
2. **Exercise strip:** thumbnails of every exercise plus a "+" tile to add exercises. A white underline marks the current exercise and gray bars mark progress. Completed exercises get a ✓ overlay. Tapping the current thumbnail opens the full-screen video.
3. **Title:** the exercise name and a subtitle: "Set 3 of 3", or "Superset 1 of 2 • Round 1 of 3".
4. **Chip row:**
   - **Wand (Smart Progression)**: a blue dot marks an active adjustment.
   - **Info**: the detail sheet.
   - **Warm Up**: shows a count badge when warm-up sets are hidden.
   - **Targets**: the same sheet as in the template.
   - **Swap**.
   - **Note**: tabs Session ("Note will be saved to your workout history", 300 characters) and Exercise ("Pinned note about this exercise · Pinned to exercise, not saved to your workout history").
   - **Superset**: "Detach from superset" when the exercise is in a superset.
   - **Equipment**: pick which equipment variant you are using, for example "Pin-Loaded Single Cable Machine", "Plate-Loaded Cable Crossover, Weight Plates". Options not in the gym are labelled "Option 5 not available in your gym".
   - **More**: Exercise Settings, Reset to default, Remove from workout.
5. **Set table:**
   - Columns: **Set** (a circle with the number or a type letter: W, D, M, F), a reference column whose header toggles between **"Auto ⇄"** (Smart Progression suggestion, for example "40 lb x 8 / 0 RIR" or "30 lb x 8-12 / 2 RIR") and **"Previous"** (last performance, "30 lb x 12 / 2 RIR", or "No Previous"), **Lb** (or **Lb/Side**) input, **Reps** (or **Reps/Side**) input, and a checkbox. A header checkbox completes all sets.
   - The RIR is a small colored badge on the corner of the reps cell.
   - Drop and myo sets show indented "+" sub-rows with their own inputs and checkbox.
   - Completed rows dim.
   - "No Target" shows when the exercise has no targets. The inputs then stay empty.
   - A round "+" under the table adds a set.
6. **Pinned Program Note** card, when one exists (`workout-edit-past-01.jpg`).

**Custom keypad** (`live-15-keyboard.jpg`, `live-16-weight-keypad.jpg`, `live-33-barbell-keypad.jpg`). Not the system keyboard. A 3x4 digit grid on the left (with "." for weight and ⌫); on the right, keyboard-dismiss, then a context key, then a confirm key.

- **Reps field:** a top row of RIR chips (0 to 6+ and "?") with the colors listed in section 1. The context key is "RIR". Below it is an **F | P** segmented toggle (full vs partial reps; not verified). The confirm key is ✓.
- **Weight field:** the context key is a plate-calculator toggle (disabled for non-plate equipment), then **− / +** stepper buttons, then **→** (next field).
- **Plate calculator** panel above the keypad: a barbell drawing with colored plates, a legend ("1 x 45", "1 x 25"), and the sentence "70 lb on both sides + 45 lb bar weight = 185 lb". If the weight is not loadable: "0 lb on both sides + 45 lb bar weight = 0 lb + extra 45 lb".

**Behaviors observed:**

- Checking a set starts the rest timer. The default duration is per exercise type (see §9). After the last warm-up set, rest is scaled to 75% (1:30 → 1:07).
- Checking the main row of a drop set does not start rest. The drops follow.
- Completing a superset exercise auto-scrolls to the next superset member without rest. After the round, it returns to the first member with "Round 2 of 3" and starts the rest timer.
- **Exercise Auto-Next**: finishing an exercise jumps to the next incomplete one.
- **Warm Up chip** (`live-09-warmup.jpg`): a "Set Calculator" with a **Smart | Scheme** toggle. Smart example: "W 40% of 1-RM 20 lb ×8", "W 63% of 1-RM 30 lb ×5". Each line has a + to add it. "More Options · Add empty warm-up set". With "Hide Completed Sets" on, completed warm-ups collapse into the chip badge.
- **Smart Progression sheet** (`live-03-wand.jpg`):
  - Banner: "Target rep ranges were adjusted · Smart Progression has widened the target rep range of 1 set without making permanent changes to this workout". The Info button shows Current Targets vs Adjusted Targets ("D 8 reps" → "D 8-9 reps").
  - An **Event Log** with timestamped prefilled values.
  - A sliders icon opening the settings (§9).
- **Rest Timer sheet** (`live-14-rest-timer-sheet.jpg`): a progress line, the countdown with −15 s and +15 s round buttons, and "Restart With New Timer" pills: ■ (0:00) to stop, ↺ (1:07) to restart the default, then 0:15, 0:30, 0:45, 1:00, 1:15, and so on.
- **Workout Options (hamburger)** (`live-07-hamburger.jpg`): Pause workout, Minimize workout, Finish workout, Workout settings, Gym settings, Discard workout.
- **Finish** dialog: "Finish this workout? You've logged 2 of 4 exercises. You can log both completed and unlogged sets using the current values, or log only completed sets." Buttons: **Log All Sets** and **Log Only Completed Sets**.
- **Empty Workout** (`live-00-empty-workout.jpg`): a workout named "Empty" with no exercises and Start Workout.

### 7.1 Workout Complete / summary

`finish-02` to `04`, `workout-summary-01` to `04`

The title is "Workout Complete" (or the date for a past workout). X and ⋮ ("Workout Options" with the workout name and Delete Workout). The body, top to bottom:

- **Front and back body figures** with the trained muscles in blue.
- **Record cards** in a horizontal row. Each card has an icon (trophy = Volume Record, star badge = Reps Record, medal = 1-RM Record), the value, "+6%" or "New!", the exercise name, and the record type.
- **Workout Details**: Volume (1905 lb), Start Time (Edit), Duration (Edit), Edit Workout ("Go to the workout editor"), which opens the same live editor titled "Edit Workout" with all sets checked.
- **Details**: per exercise, the thumbnail, the name, "480 lb volume", "1 set", and record icons with values. The row expands to the sets list ("1 | 135 lb x 10 | RIR 2"). Superset members show a "Superset" label.
- A bottom bar (finish only):
  - an **"Update Workout Plan"** toggle: "Save these changes as the new default for this workout"
  - **View Changes**: a "Workout Changes" sheet with Added Exercises and Modified Exercises in Before/After format, each with Undo
  - **Done**

Leaving an editor shows "Exit the editor? Changes you made to your workout will be discarded." with Exit and Stay.

---

## 8. Levels tab

`levels-01` to `07`

Despite the name, Levels shows **weekly training volume per muscle**, not strength scores. No strength-standard or level explanation appears anywhere in the UI. The screen, top to bottom:

- The title "LEVELS".
- A large body figure, a heat map in blue where intensity is proportional to sets. A rotate button flips front and back.
- The caption "● Average weekly sets over **1-week ▾**". The period options are 1-week, 1-month, 3-months.
- Segmented sections **Upper Body Levels** and **Lower Body Levels**. Rows are sorted by sets descending. Each row has a mini torso figure, the muscle name, "6.1 sets", a blue progress bar scaled relative to the top muscle, and a chevron.
- Muscle detail (`levels-04-muscle-detail.jpg`): the same caption and dropdown, a header row, then **Contributing Lifts**. Each lift row has the thumbnail, "1.2 sets", and muscle tags with the current muscle highlighted (white fill = primary, white outline = secondary). Tap a lift to open the exercise detail sheet.
- Set counting: a primary muscle gets 1 set per working set and a secondary muscle gets 0.5. Example: 1-week biceps = 2 sets from 1 drop set + 1 dumbbell set; triceps = 0.5 from one bench set. Warm-up sets are excluded.

The upper and lower muscle groups use the same taxonomy as everywhere else (§11).

## 9. More > Feature Settings

`more-01.jpg`, `more-02-bottom.jpg`, `settings-*.jpg`

The More page shows the profile (initials avatar, name, "Member Since August 13, 2023"), then these groups:

- **General:**
  - Account, Subscription, Integrations, and Language were skipped as instructed.
  - **Units** (`settings-units.jpg`): Weight Pounds/Kilograms; Energy Calories/Kilojoules; Height Feet and Inches/Centimeters; Clock 12/24 Hour; Distance Miles and Yards/Kilometers and Meters.
- **Feature Settings:**
  - **Dashboard**: see §10.
  - **Workout** (`live-08-workout-settings.jpg`, `settings-workout-02.jpg`):
    - General:
      - **Rest Timer** (`settings-rest-timer*.jpg`):
        - Use Rest Timers (on).
        - Notifications: Play Sound, Vibrate.
        - **Timer Duration** defaults: Compound Upper 2:00, Compound Lower 3:00, Upper Isolation 1:30, Lower Isolation 1:30, Core 1:00. Add Exercise Timer and Reset Defaults are available.
        - Rest After Last Warm-up Set (on), Rest Between Exercises (off), Rest Between Left/Right Sets (off).
        - **Rest Scaling**: After Last Warm-up Set 75%, Between Exercises 100%, Between Left/Right Sets 50%.
      - **Smart Progression** (`live-05`, `live-06`):
        - Initial log fill: "Smart Progression values" ("pre-fill your weight and rep logs based on your workout history and goals") or "Previous values".
        - Apply in session (on): "Allow Smart Progression to fill in new values for exercise data entry fields mid-workout."
        - Expand Rep Range (on): "Allow Smart Progression to widen your target rep range when adding or lowering weight alone can't achieve an optimal result."
        - Weight Match (off): "Prefer matching the previous set's weight when possible."
      - **Warm-Up** (`settings-warmup*.jpg`):
        - Warm-Up Automation, one of:
          - None
          - Smart Warm-Up: "Warm-ups will be automatically added to exercises in your workout depending on how fresh your muscles are and how heavy the weight is"
          - Scheme Warm-Up, with Edit Scheme
          - Add Exercise Override
        - **Warm-Up Scheme** per exercise type, default "40% target weight x 5 reps / 60% x 5 / 80% x 3". The editor has W rows with % and reps, "Save To All Categories", and Exercise Schemes.
        - Hide Completed Sets (on).
        - Simplify Warm-Up Plates (on): "Adjust warm-up weights to the nearest load that doesn’t require trivially small plates".
      - Previous Reference: "Any workout" or "Workouts within program only".
      - Propagate Changes (on): "Weight and rep edits will propagate to all sets with same weight and reps".
      - RIR Tracking (on): "Automatically populate RIR selection in the session log based on program".
      - Superset Auto-Scroll (on).
      - Exercise Auto-Next (on).
    - Display:
      - Keep Alive (off).
      - Workout Timer (on).
      - Bodyweight Contribution (on): "Display scale weight and body weight contribution during workout sessions".
      - Calendar Scrolling: Daily Scroll ("scrolls freely and settles one day at a time") or Weekly Swipe.
    - Other: Exercise Assessment, "A questionnaire about your experience with foundational movements that determines access to advanced exercises". Not opened.
  - **Shortcuts** (`settings-shortcuts.jpg`): an Up Next Banner toggle, and shortcuts (Weight, Photos, Metrics, History as "Top Shortcut", plus Empty Workout, New Program, New Workout) with Order and Color modes and Add or Remove.
  - **Weight Trend**: V2 (Experimental, "Robust smoothing that can revise past weigh-ins based on the future and reduce lag") or V1 ("Simple and reliable smoothing that only looks at past weigh-ins").
  - **Exercises**: the library, §6.
  - **Gym Profiles** (`settings-gym-profiles.jpg`, `gym-profile-*.jpg`):
    - The list of gyms, each with an icon, name, "N pieces of equipment", and Default. "Add New Gym Profile" is at the bottom.
    - The editor has chips (Edit Icon, Rename Gym, Duplicate, Remove), an Equipment list with Selected/All toggle grouped by category with Deselect/Select All, and a checkbox per item with its weight list and an "Edit Weights", "Edit Inventory" (bands), "Edit Base Weight", or "Edit Machine" link. See `equipment.md`.
- **Theme**: System, Light, Dark.
- **Data Management**: Data Export, Data Visibility, Account & Data Deletion. Not explored.
- **Community & Support**: Reddit, Facebook, and Instagram links; Knowledge Base; Roadmap; Support.
- **Other**: Legal; Tutorials ("Reset Tutorials"); About; "Version 1.4.1".

## 10. Dashboard

`dashboard-01` to `15`

The title is "DASHBOARD" with a sliders button (Customize). From top to bottom:

1. **Primary Focus carousel** (2 pages, dots):
   - **Cycle Workouts**: three rings, Muscles "0 / 18 left · 18 target", Sets "0 / 88 left", Exercises "0 / 27 left", with an **Active Program | All Workouts** segmented control.
   - **Recent Records**: horizontal yellow bars per exercise with values and a **Volume | Reps | 1-RM** toggle.
2. **Insights & Analytics** (2-column cards):
   - Workouts: "Last 7 Workouts", a salmon bar chart, "12 sets".
   - Weight Trend: "Last 7 Days", a lilac line, "196.8 lb".
3. **Habits**: Weigh-In and Workouts "Last 30 Days" dot grids, "0/7 this week".
4. **Body Metrics** (See All): Scale Weight and Visual Body Fat (32.0 %).
5. **Muscle Groups** (See All shows a grid of every muscle): per-muscle cards, "Last 7 Days", "-- sets".
6. **Exercises** (See All): per-exercise 1-RM line, "Last 7 Workouts", "230.9 lb".
7. **General**: Steps bar chart, "1112 steps". Period is also available here, off by default.

Card anatomy: the title, a gray subtitle (the period), a chart, a hairline, then the big value with a unit and a chevron.

**Detail screens** (`dashboard-03`, `04`, `13`, `14`):

- Metric tabs. Exercise: 1-RM, 3-RM, 10-RM, Heaviest Weight, Total Volume, Best Set Volume, Total Reps, Best Set Reps, Total Sets. Workouts and muscles: Sets, Volume.
- A summary row ("Avg 1-RM 219.4 lb · Best 1-RM 230.9 lb · Jul 19 - Oct 23, 2026") and a fit-to-data icon button.
- A line or bar chart with a right-side axis.
- Range pills: 1W, 1M, 3M, 6M, 1Y, All, plus an averaging dropdown: D - Daily, W - Weekly, M - Monthly.
- A legend chip.
- A month-grouped list of the data points ("230.9 lb · Wed, Aug 12"). The Workouts detail instead shows "Top 5 Exercises by Sets · Last 30 Days".

**Customize Dashboard** (`dashboard-06` to `11`, `settings-dashboard.jpg`): Save in the header, and:

- Primary Focus toggles: Weekly Workouts and Recent Records. Arrows reorder them.
- Each section has ↑ ↓ arrows to reorder it, rows with ≡ drag handles, and an "Add or Remove …" sheet of checkboxes.
- Muscle tiles have a metric dropdown (Sets or Volume). Exercise tiles have a metric (1-RM and so on). The exercise tile picker reuses the exercise picker.
- "Reset to App Defaults" in red.

---

## 11. Data model implied

```
MuscleGroup (enum, 22): Upper = chest, upperBack, lats, biceps, triceps, frontDelts, sideDelts,
  lowerBack, abs, upperTraps, rearDelts, forearms, obliques, neck, serratus;
  Lower = quads, glutes, hamstrings, calves, abductors, adductors, tibialis
  (asset ids: abductors, abs, adductors, biceps, calves, chest, forearms, front_delts, glutes,
   hamstrings, lats, lower_back, neck, obliques, quads, rear_delts, serratus, side_delts, tibs,
   triceps, upper_back, upper_traps)

ExerciseType: compoundUpper | compoundLower | upperIsolation | lowerIsolation | core
Laterality: bilateral | unilateral | asymmetrical | unilateralAndBilateral
TrackableMetric: reps | repsPerSide | weight | weightPerSide | weightPerSidePersistent |
  weightAssistance | duration | durationPerSide | distanceShort | distanceShortPerSide | distanceLong
  (an exercise has 1-2 metrics, e.g. Weight x Reps)
ExerciseCategory (list grouping): freeWeights | machines | bodyweightAndPersonal | cardio | other

Exercise { id, name, alternativeNames[], type, laterality, metrics[1..2],
  primaryMuscles[], secondaryMuscles[], resistanceEquipment[] (alternatives),
  supportEquipment[][] (alternative sets), rangeOfMotion 0-5, stability 0-5,
  bodyWeightContribution %, primaryJointActions[], secondaryJointActions[],
  instructions {settingUp, technique, description} (markdown), media {videos x3 angles, stills a/b/c},
  isCustom, archived, doNotRecommend, note (pinned), overrides {equipmentWeights, restTimer,
  restBetweenSides, expandRepRange, weightMatch, warmUpAutomation, warmUpScheme} }

Equipment { id, name, category (Bodyweight, Free Weights, Loadable Bars, Fixed Weight Bars,
  Bands & Ropes, Body Weights, Benches & Racks, Accessories & Functional, Loadable Accessories,
  Cable Machines, Plate Loaded Machines, Pin Loaded Machines, Cardio, Other), weights[] | ranges[] | baseWeight }
GymProfile { id, name, icon, isDefault, equipment: {equipmentId -> selected, weights override} }

SetType: standard | warmUp | drop | myo | failure   (badges: number, W, D, M, F)
SetTarget { type, repsMin?, repsMax?, rir? (0..6+), restSeconds?, subSets[] (drop/myo) }
WorkoutExerciseTemplate { exerciseId, sets: SetTarget[], restOverride?, skip?, note? , supersetGroupId? }
SupersetGroup { id, exerciseIds (2 = superset, 3+ = circuit), rounds = max set count }
WorkoutTemplate { id, name, gymId, exercises[], archived, programId?, dayIndex? }
Program { id, name, color (7), icon, cycles (count), days[] (workout or rest), dayOrder,
  deload: none|firstCycle|lastCycle, periodization bool, perCycle/perWeek targets,
  active, currentCycle, archived }
  generator inputs: goal, daysPerWeek, split, sessionMinutes, repProgression(static|linear|reverseLinear|undulating), muscleFocus, gym, deload, experience

WorkoutSession { id, templateId?, programId?, name, gymId, startTime, duration, paused, sessionNote,
  exercises: [{ exerciseId, equipmentVariant, sets: [{ type, weight, reps, rir?, partial(F/P)?,
  completed, subSets[] }] }] }
Records per exercise: volume, reps, 1-RM (estimated), shown as "New!" or "+x%"
Derived: volume = sum(weight x reps) (per-side metrics count both sides: 25 lb/side x 10/side = 500 lb),
  muscle sets = primary 1 / secondary 0.5 per working set, estimated workout time,
  est. 1-RM / 3-RM / 10-RM
Settings: see §9 (all toggles and enums listed there)
```

## 12. Open questions and things not determined

- **1-RM formula.** The app shows estimates but never explains them. Data points:
  - 185×5 (no RIR) → 224.9
  - 135×10 @2 RIR → 202.4
  - 40×9 @0 (a drop set followed by 20×6) → 66.1
  - 50/side ×9 @4 → 75.9
  - These match no standard formula exactly. It seems to factor in RIR (reps-to-failure) and possibly the drop continuation.
- **Smart Progression algorithm.** Only its effects were observed: it prefilled 40×9 against a target of 8 and widened the range to 8-9 reps. The rule is not stated beyond the setting descriptions.
- **Smart warm-up percentages.** "40% of 1-RM ×8" and "63% of 1-RM ×5" were seen. The logic is unknown.
- **Levels:** no strength levels appear in this version. Whether the bar has target zones (minimum or optimal volume) is unknown. The bar looked purely relative.
- **F | P toggle** on the reps keypad: probably full vs partial reps. Not verified.
- **Plate calculator details:** bar selection and the expanded view could not be opened, because clicks on the custom keypad dismissed it under automation.
- **Reordering** exercises inside a workout: there is no visible handle. Long-press drag was not tested.
- **The phone layout** could not be seen, because the window minimum width is 515 pt.
- Periodization sub-settings, Exercise Assessment questionnaire, Pause/Minimize workout behavior, New Section, Data Export format, and the sort options in exercise History.

## 13. Not yet explored (for a follow-up agent)

- Periodization toggle and its options in Program Settings. Program "Re-order" and "Change to Rest" flows.
- Exercise Assessment questionnaire (More > Workout > Other).
- Pause and Minimize workout (what the minimized state looks like on other tabs).
- Edit Start Time and Duration pickers on the summary.
- Gym profile sub-editors: Edit Weights for bars, Edit Inventory for bands, Edit Machine, Add New Gym Profile flow, and the gym icon set.
- Shortcuts customization (Order and Color modes).
- Weight, Photos, and Metrics shortcuts (body tracking; outside workout scope).
- Exercise history sort dropdown options; Exercises library tabs Performed, Deprioritized, and Archived contents.
- The full exercise name list (about 1,300 exercises; only counts per category were captured).
- Cleanup of the test data listed at the top of this file.
