# MacroFactor Workouts: milestone 2 research

Source: MF Workouts v1.4.1 (`Runner.app`) on macOS, logged into the owner's account, studied on 2026-10-23. This file extends the milestone 1 spec in [`README.md`](README.md) and covers what milestone 2 builds ([Workouts decisions](../../decisions/workouts.md#milestone-2-feature-parity)). It does not repeat what the milestone 1 spec already says.

Screenshots are `screens/m2-*.jpg`. The data files next to this one are:

- [`generated-programs.json`](generated-programs.json): every program Smart Generation produced during this research, with the wizard inputs and the full output, resolved to MF exercise ids. `tools/programs-json.py` rebuilds it from the `.xlsx` exports in [`exports/`](exports/).
- [`smart-generation-fields.md`](smart-generation-fields.md) and [`generation-candidates.json`](generation-candidates.json): the per-exercise selection fields in `app_file.json`, with ranked candidates per muscle and slot. `tools/generation-fields.py` rebuilds both.
- [`app-strings.md`](app-strings.md): literal UI strings from the compiled app, grouped by topic.
- [`exports/`](exports/): real `.xlsx` files from MF's Export Program and Export Workout, for building import.

Claims are marked **observed** (seen in the app or its exports), **measured** (computed from bundle data), or **inferred**.

## Contents

1. [Smart Generation](#1-smart-generation)
2. [Programs](#2-programs)
3. [Smart Progression and warm-ups](#3-smart-progression-and-warm-ups)
4. [Gym profiles and the plate calculator](#4-gym-profiles-and-the-plate-calculator)
5. [Everything else](#5-everything-else)
6. [Research data created and deleted](#6-research-data-created-and-deleted)

---

## 1. Smart Generation

### 1.1 The wizard

The "+" sheet's New Program, or the Workout tab's "+" > New Program, opens "Create Program". A progress bar sits under the header. Each step has one question and a full-width Next button. The options are radio rows with a title and a one-line description. **Observed.**

1. Splash: "We will create a personalized training program tailored to your goals. Or, you can import or build your own."
2. "How would you like to create your program?"
   - Use Smart Generation ("We will create a custom plan tailored to your goals, fitness level, and gym equipment", tagged Recommended)
   - Build From Scratch ("Start with a fully blank slate and no guidance")
   - Import From File ("You can upload .xlsx files from previously exported programs")
3. "What is your primary goal?"
   - Muscle Hypertrophy ("Workouts will focus on increasing muscle size using moderate weights and reps.")
   - Muscle Strength ("Workouts will focus on increasing maximal strength using heavier weights for fewer reps.")
   - Both Strength & Hypertrophy ("Workouts will balance strength and size with a variety of weight and rep schemes.")
4. "How many times per week would you like to train?" A − / + stepper around a large number, "times per week". The range is 2 to 6, and the default is 3 (`m2-gen-03-days.jpg`).
5. "How do you prefer to structure your training?" The split options depend on the day count. "No preference" ("We'll choose a recommended split for you") and "Full Body" ("Train your whole body each workout") are always first:

   | Days | Other split options (title, description)                                                                                                                                                                                                                                    |
   | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | 2    | Upper/Lower Split ("Keep upper and lower body training separate"); Push/Pull Split ("Train pushing and pulling movements separately")                                                                                                                                       |
   | 3    | Upper/Lower/Full Body Split ("Alternate upper, lower, and full-body workouts"); Push/Pull/Legs Split ("Train push, pull, and legs on separate days")                                                                                                                        |
   | 4    | Upper/Lower/Upper/Lower Split ("Alternate upper and lower body workouts"); Push/Pull/Hinge/Squat Split ("Separate push, pull, hinge, and squat training"); Push/Pull/Legs + Accessories ("Add accessory work to your push, pull, and leg days")                             |
   | 5    | Upper/Lower/Upper/Lower/Upper Split ("Alternate upper and lower body workouts"); Push/Pull/Hinge/Squat + Accessories ("Add accessory work to push, pull, hinge, and squat days"); Push/Pull/Legs/Upper/Lower Split ("Combine push, pull, legs, upper, and lower body days") |
   | 6    | Push/Pull/Hinge/Squat/Upper/Lower Split ("Combine push, pull, hinge, squat, upper, and lower body days"); Push/Pull/Legs/Push/Pull/Legs Split ("Repeat push, pull, and legs twice each week")                                                                               |

6. "How much time would you like to budget per session?" Up to 20 minutes, 20 to 40, 40 to 60, 60 to 90, 90 to 120, or Over 120 minutes.
7. "How do you prefer your rep ranges to update each week?"
   - No preference ("We'll choose a recommended option for you.")
   - Static ("Keep the same rep targets each week.")
   - Linear ("Gradually decrease rep targets and increase weights over the program.")
   - Reverse Linear ("Gradually increase rep targets and decrease weights over the program.")
   - Undulating ("Alternate between lower rep targets with heavier weights and higher rep targets with lighter weights each week.")
8. "Which muscles should get more or less focus?" (`m2-gen-06-focus.jpg`) An Upper list (Biceps, Triceps, Side Delts, Chest, Lats, Rear Delts, Abs, Front Delts, Upper Back, Obliques, Upper Traps, Lower Back, Forearms) and a Lower list. Each row has a mini figure, the name, and two round buttons, thumbs-down and thumbs-up. Choosing one dims the other. A footer counts "2 prioritized · 1 deprioritized" with Reset (`m2-gen-07-focus-selected.jpg`).
9. "Which of your gyms will you be using during this program?" The gym profiles, each with "N pieces of equipment", the default tagged Default.
10. "Would you like to keep these selections from last time?" (`m2-gen-08-keep.jpg`) Two cards:
    - Deload, a toggle: "This program's training block will end with a lighter week to promote recovery and readiness for the next phase", tagged Recommended. It starts in the state the previous generation used. The owner's was off.
    - Lifting Experience, with a pencil that opens a sheet (`m2-gen-08b-experience.jpg`): None ("Currently not lifting"), Beginner ("Lifting for the past year or less"), Intermediate ("Lifting for more than the past year, but less than 4 years"), Advanced ("Lifting for the past 4 years or more"). The owner's was Intermediate.
11. "What would you like to name this program?" The default name is the split name ("Full Body").
12. "What color should we use to display this program?"
13. "Generating your program based on the latest science", a checklist that ticks off: Experience, Muscle prioritization, Equipment availability, Exercise selection, Muscle strength focus, Time efficiency, Periodization, Smart progression.
14. The generated program in the program editor, with **Save to Library** and **Activate Program** at the bottom (`m2-gen-12-editor-save.jpg`). Activate Program sits exactly where Next was. Activating replaces the active program, which moves to the Workout Library.

**Observed gotcha.** The first research generation pressed Next once too often and activated the test program, which moved the owner's "Recomp v3 (6-day)" into the library. It was reactivated during cleanup (§6).

<!-- 1.2+ calibration observations land here -->
