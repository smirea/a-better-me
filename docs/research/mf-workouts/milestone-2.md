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

### 1.2 Calibration data

MF generated 20 programs on 2026-10-23 against the owner's default gym "Aquasol 6770" (192 pieces of equipment). [`generated-programs.json`](generated-programs.json) holds them. [`tools/programs-analysis.py`](tools/programs-analysis.py) computes every number below (`python3 -I docs/research/mf-workouts/tools/programs-analysis.py`).

The inputs isolate one variable at a time against P1 (hypertrophy, 3x Full Body, 40 to 60 minutes, no rep preference, intermediate, deload on).

| Variable        | Programs                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Repeat run      | P1, P8                                                                                                               |
| Rep progression | P1 noPreference, P7 static, P9 undulating, P10 reverseLinear                                                         |
| Experience      | P1 intermediate, P16 beginner, P17 advanced                                                                          |
| Deload          | P1 on, P18 off                                                                                                       |
| Session length  | P11 0-20, P1 40-60, P12 120+                                                                                         |
| Goal            | P2 strength (3x FB), P13 strength (5x PPLUL), P6 both (5x noPreference, linear)                                      |
| Split and days  | P3 5x PPHS+Acc, P4 4x UL (with focus), P5 4x UL, P14 6x noPreference, P15 2x noPreference, P19 6x PPLPPL, P20 3x PPL |
| Muscle focus    | P4 (biceps and side delts more, chest less)                                                                          |

Labels follow this file. **Measured** means computed from the 20 exports. **Inferred** means a rule that fits every observation but was not seen directly.

The analysis classifies every exercise into a role from two signals in its cycle 1 sets. The RIR track separates push and leg compounds (last set at 1 RIR), pull compounds (last set at 0 RIR, descending), and accessories (two trailing zeros). The rep tier then separates primary from secondary within a track. The rule holds for all 653 picks. **Measured.**

### 1.3 Program shape

- Every program has `cycles = 7`, whatever the inputs. **Measured** (20 of 20).
- `cycleBlocks` is seven 1s, except static progression, which has a single block and one `setsPerCycle` entry. **Measured.**
- Deload on exports `deload = "Last Cycle"`. Deload off exports `deload = None`. Nothing else in the export differs, and the deload week itself shows only in the editor (§1.9). **Measured.**
- The day list always has 7 entries. Rest days are fixed by day count and do not depend on split. **Measured.**

| Days | Pattern (W = workout, R = rest) |
| ---- | ------------------------------- |
| 2    | W R R W R R R                   |
| 3    | W R W R W R R                   |
| 4    | W R W R W W R                   |
| 5    | W W W W W R R                   |
| 6    | W W W W W W R                   |

Day names per split. **Measured.**

| Split                         | Day names in order                             |
| ----------------------------- | ---------------------------------------------- |
| fullBody (2x, 3x)             | Workout A, Workout B, Workout C                |
| pushPullLegs (3x)             | Push, Pull, Legs                               |
| upperLowerUpperLower (4x)     | Upper A, Lower A, Upper B, Lower B             |
| pushPullHingeSquatAccessories | Push, Hinge, Pull, Squat, Accessories          |
| pushPullLegsUpperLower        | Push, Pull, Legs, Upper, Lower                 |
| pushPullLegsPushPullLegs      | Push A, Pull A, Legs A, Push B, Pull B, Legs B |

"No preference" picks these splits. **Measured.**

| Days | No-preference result                                                      | Evidence                                                                                                               |
| ---- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 2    | Full Body (Workout A, B; each day has a push, a pull, and a leg compound) | P15                                                                                                                    |
| 5    | Push/Pull/Legs/Upper/Lower                                                | P6, same names and skeleton as P13                                                                                     |
| 6    | Push/Pull/Legs/Push/Pull/Legs                                             | P14 has the same skeleton, sets, and RIR as P19. They share 25 of 93 exercise ids, the same overlap as two random runs |
| 3    | Upper/Lower/Full Body (days Upper, Lower, Full)                           | P21                                                                                                                    |
| 4    | Upper/Lower/Upper/Lower                                                   | P22, same names as P5                                                                                                  |

### 1.4 Slots, day skeletons, and volume

Four slots exist. A primary compound is the heaviest lift of a pattern. A secondary compound is a lighter lift of a pattern. An accessory is a single-muscle exercise. Core exercises (classification Core) fill accessory slots with accessory reps and RIR. Lunges and split squats appear only as accessories. **Measured.**

Six compound patterns exist. They are Horizontal Push, Vertical Push, Horizontal Pull, Vertical Pull, Squat, Hip Hinge. **Every program gives each of the six patterns exactly one primary slot per week.** **Measured** for push and leg patterns in all 20 programs and for pulls in the 4 programs where pull tiers differ (P2, P6, P7, P13). **Inferred** for hypertrophy pulls under linear progression, where primary and secondary pulls share one rep tier.

Day order is fixed. All compounds come first, then all accessories (73 of 73 days). Within the compounds, every determinable primary precedes every secondary (73 of 73). **Measured.**

Compound skeletons. P is primary, S secondary, ? a hypertrophy pull with a tied tier. P7 (static) has the same skeleton as P1 and resolves the ? marks as shown in brackets. **Measured.**

| Program            | Day skeletons (compounds only)                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3x FB 40-60 (P1)   | A: HPush P, VPull ?[P], VPush S, Squat S. B: VPush P, Squat P, HPull ?[S], Hinge S. C: HPull ?[P], Hinge P, HPush S, VPull ?[S]                                     |
| 3x FB 0-20 (P11)   | A: HPush P. B: VPush P, Squat P. C: HPull ?, VPull ?, Hinge P                                                                                                       |
| 3x FB 120+ (P12)   | P1's four per day, then the day's two S patterns repeated (A: VPush S, Squat S)                                                                                     |
| 2x NP 40-60 (P15)  | A: HPush P, HPull ?, Squat P. B: VPush P, VPull ?, Hinge P                                                                                                          |
| 3x PPL 60-90 (P20) | Push: HPush P, VPush P, HPush S, VPush S. Pull: four pulls. Legs: Squat P, Hinge P, Squat S, Hinge S                                                                |
| 4x UL 20-40 (P4)   | Upper A: HPush P, HPull ?. Lower A: Squat P, Hinge S. Upper B: VPush P, VPull ?. Lower B: Hinge P, Squat S                                                          |
| 4x UL 90-120 (P5)  | Upper A: HPush P, HPull ?, then (VPush S, VPull ?) x2. Lower A: Squat P, Squat S, Hinge S, Hinge S                                                                  |
| 5x PPLUL (P6, P13) | Push: HPush P, VPush P, HPush S (+1 S at 60-90). Pull: HPull P, VPull P, VPull S (+1). Legs: Squat P, Hinge S (+1). Upper: S only. Lower: Hinge P, Squat S (+1)     |
| 5x PPHS+Acc (P3)   | Push: HPush P, VPush P, then 4 S alternating H, V. Hinge: Hinge P, 2 Hinge S. Pull: six pulls. Squat: Squat P, 2 Squat S. Accessories: 13 accessories, no compounds |
| 6x PPL (P14, P19)  | Push A: HPush P + 3 S. Push B: VPush P + 3 S. Pull A starts HPull, Pull B starts VPull. Legs A: Squat P, 2 Hinge S. Legs B: Hinge P, 2 Squat S                      |

The 3x Full Body skeleton is a sliding window. The pattern cycle HPush, VPull, VPush, Squat, HPull, Hinge advances by two each day and each day takes four. The first two are primaries and the last two secondaries, so every pattern gets one P and one S per week. **Measured** on P1 and P7 (pull tiers from P7).

Secondary slots per pattern per week. **Measured.**

| Program             | Days, band          | S per push pattern | S per pull pattern | S per leg pattern |
| ------------------- | ------------------- | ------------------ | ------------------ | ----------------- |
| P11                 | 3x 0-20             | 0                  | 0                  | 0                 |
| P15                 | 2x 40-60            | 0                  | 0                  | 0                 |
| P4                  | 4x 20-40            | 0                  | 0                  | 1                 |
| P1, P2, P6, P7, P20 | 3x or 5x 40-90      | 1                  | 1                  | 1                 |
| P3, P12, P13        | 3x 120+ or 5x 60-90 | 2                  | 2                  | 2                 |
| P5                  | 4x 90-120           | 2                  | 2                  | 3                 |
| P14, P19            | 6x 60-90            | 3                  | 3                  | 2                 |

Exercises and sets per training day (cycle 1). **Measured.**

| Band   | Programs          | Exercises per day | Sets per day | Compound sets | Accessory sets |
| ------ | ----------------- | ----------------- | ------------ | ------------- | -------------- |
| 0-20   | P11               | 3 to 4            | 7 to 8       | 2 to 4        | 3 to 6         |
| 20-40  | P4                | 4 to 6            | 11 to 12     | 4 to 6        | 6 to 8         |
| 40-60  | P1, P2, P6, P15   | 6 to 9            | 18 to 24     | 6 to 10       | 9 to 18        |
| 60-90  | P3, P13, P14, P20 | 7 to 13           | 24 to 39     | 0 to 18       | 12 to 39       |
| 90-120 | P5                | 12 to 15          | 39 to 47     | 15 to 20      | 24 to 27       |
| 120+   | P12               | 18 to 19          | 51 to 53     | 20 to 22      | 30 to 33       |

Sets per day track session length, not day count. A time model fits every day. Minutes = 3 x compound sets + 2 x accessory sets puts all 73 days inside their band. **Measured** fit. Pairs (2.75, 2.25), (3.25, 2), and (3.5, 1.75) also fit. That MF uses such a budget is **inferred**. Under (3, 2), days land at 18 (0-20), 27 to 30 (20-40), 45 to 54 (40-60), 60 to 84 (60-90), 93 to 114 (90-120), and 122 to 126 (120+) minutes.

Sets per exercise by slot and band (count of exercises at each set count). **Measured.**

| Band   | Primary               | Secondary             | Hyp pull (P or S)    | Accessory and core |
| ------ | --------------------- | --------------------- | -------------------- | ------------------ |
| 0-20   | 1 or 2                | none                  | 1 or 2               | 3                  |
| 20-40  | 2 or 3                | 2                     | 3                    | 2 or 3             |
| 40-60  | 2 (26), 3 (22), 4 (2) | 2 (40), 3 (6)         | 2 (21), 3 (9)        | 2 (28), 3 (117)    |
| 60-90  | 3 (4), 4 (18)         | 2 (2), 3 (18), 4 (24) | 2 (2), 3 (18), 4 (6) | 3 (151)            |
| 90-120 | 4 or 5                | 3 or 4                | 3 or 4               | 3                  |
| 120+   | 4                     | 2 to 4                | 3 or 4               | 2 (17), 3 (20)     |

The first compound of a day always holds the day's highest compound set count (73 of 73 days). Accessories can exceed it. P1 Workout B has 2-set compounds and 3-set accessories. Accessories are 3 sets for hypertrophy and 2 for strength at 40 to 60 minutes (P2). Leg-day accessories drop to 2 sets in P4 and P6. **Measured.** The exact per-exercise allocation rule is not determinable (§1.10).

### 1.5 Rep ranges

Every range is 3 reps wide (max = min + 2). Every exercise in one (goal, progression, role) group has the same sequence. **Measured** (27 groups, 1 distinct sequence each).

Cycle 1 tier per goal and role, linear or no-preference progression. **Measured.**

| Goal        | Primary (push, legs) | Secondary (push, legs) | Pull primary | Pull secondary | Accessory |
| ----------- | -------------------- | ---------------------- | ------------ | -------------- | --------- |
| hypertrophy | 11-13                | 14-16                  | 14-16        | 14-16          | 19-21     |
| strength    | 7-9                  | 9-11                   | 11-13        | 14-16          | 14-16     |
| both        | 7-9                  | 14-16                  | 11-13        | 14-16          | 19-21     |

"Both" takes strength tiers for primaries and hypertrophy tiers for everything else. **Measured** (P6). A pull tier is never below the matching push tier. **Measured.**

Each starting tier owns a five-value ladder v0 to v4. **Measured.**

| Start | v0    | v1    | v2    | v3    | v4   |
| ----- | ----- | ----- | ----- | ----- | ---- |
| 7-9   | 7-9   | 5-7   | 4-6   | 4-6   | 2-4  |
| 9-11  | 9-11  | 7-9   | 6-8   | 6-8   | 4-6  |
| 11-13 | 11-13 | 9-11  | 8-10  | 7-9   | 5-7  |
| 14-16 | 14-16 | 12-14 | 10-12 | 9-11  | 7-9  |
| 19-21 | 19-21 | 16-18 | 14-16 | 12-14 | 9-11 |

Progressions are fixed index sequences over the ladder for cycles 1 to 7. **Measured** on every exercise of P1 to P20 (undulating and reverse on all 24 exercises of P9 and P10).

| Progression   | Cycle indexes (c1..c7) | Example for an 11-13 start                                                        |
| ------------- | ---------------------- | --------------------------------------------------------------------------------- |
| linear        | 0 0 1 2 3 4 4          | 11-13, 11-13, 9-11, 8-10, 7-9, 5-7, 5-7                                           |
| noPreference  | same as linear         | identical to P6 linear, for hypertrophy and strength, all three experience levels |
| reverseLinear | 4 4 3 2 1 0 0          | 5-7, 5-7, 7-9, 8-10, 9-11, 11-13, 11-13                                           |
| undulating    | 0 2 4 0 3 1 4          | 11-13, 8-10, 5-7, 11-13, 7-9, 9-11, 5-7                                           |
| static        | one cycle, own tiers   | see below                                                                         |

Static (P7, hypertrophy) does not reuse a ladder value consistently. It has its own tiers, and it separates pull primary from pull secondary. **Measured.**

| Goal        | Primary | Secondary | Pull primary | Pull secondary | Accessory |
| ----------- | ------- | --------- | ------------ | -------------- | --------- |
| hypertrophy | 7-9     | 9-11      | 9-11         | 11-13          | 14-16     |

Cycle 7 always equals cycle 6, and cycle 1 always equals cycle 2 under linear. That holds with deload on and off. **Measured.** The deload week is not in the export (§1.9).

### 1.6 RIR and rest

RIR depends only on the track and the set count. It never changes across cycles, goal, experience, or deload. **Measured** (all 653 picks, all cycles).

| Track | Who                                         | 1 set    | 2 sets | 3 sets  | 4 sets     | 5 sets        |
| ----- | ------------------------------------------- | -------- | ------ | ------- | ---------- | ------------- |
| A     | push and leg compounds, P or S (180 of 180) | 2        | 2, 1   | 3, 2, 1 | 3, 2, 2, 1 | 3, 2, 2, 1, 1 |
| B     | pull compounds, P or S (90 of 90)           | 1        | 1, 0   | 2, 1, 0 | 2, 1, 1, 0 | not seen      |
| C     | accessories and core (383)                  | not seen | 0, 0   | 1, 0, 0 | not seen   | not seen      |

Track B is track A minus one at every set. **Measured.** Within a track, primary and secondary use the same RIR. **Measured.**

Rest is never set. `restSeconds` is null on all 12,732 exported set rows. Every set type is `standard`. **Measured.** MF's rest timer behavior therefore lives outside the program (milestone 1 spec).

### 1.7 Exercise selection

Level of each pick in its goal's level field for its slot. "Both" reads the strength field for primaries and the hypertrophy field otherwise. **Measured.**

| Slot                               | Level 1 | Level 2 | Share at level 1 |
| ---------------------------------- | ------- | ------- | ---------------- |
| Primary                            | 85      | 3       | 97%              |
| Secondary                          | 107     | 3       | 97%              |
| Hyp pull (better of P and S field) | 72      | 0       | 100%             |
| Accessory                          | 342     | 5       | 99%              |
| Core                               | 36      | 0       | 100%             |

- No pick is above level 2. **Measured.**
- Only 11 of 581 slot-determinable picks had a strictly better-level candidate for the same primary muscle. **Measured.** The 99 skipped better candidates break down by likely cause as follows. Exclusion grouping already used in the program 38, equipment not in the gym 19, exercise already in the program 18, has a precondition 18, unexplained 4, equipment not on the gym list 2. **Measured** counts. Causes are **inferred**.
- The gym model is consistent with the picks. No pick needs equipment the gym list marks absent (624 available, 29 need an item missing from the list). **Measured.** An exercise counts as available when some resistance group and some support group have all their equipment in the gym. **Inferred.**
- The level-2 picks are P2's machine-assisted pull-up (over L1 and L1.5 pull-ups and chin-ups, all with preconditions), P5's dumbbell rear delt fly and GHD hip hinge, P12's half-kneeling single-arm pulldown, P13's pin-loaded leg press, and P14's seated dumbbell press. **Measured.**
- Ties inside a level are broken at random. 25% of picks have the top `searchBoostValue` among equal-level, available, precondition-free candidates, against 22% expected from a uniform draw. **Measured.** No boost weighting is **inferred**.
- Repeat runs barely overlap. P1 and P8 share 2 of 46 exercise ids and 2 of 24 day positions. Pairwise Jaccard across the eight same-skeleton programs (P1, P7 to P10, P16 to P18) is 0.02 to 0.23. **Measured.** Everything except exercise identity is deterministic. P1, P8, P16, P17, and P18 have identical skeletons, set counts, rep sequences, and RIR. **Measured.**
- No exercise repeats on two days of one program. **Measured** (0 cases).
- Exclusion groupings hold with one exception family. Five pairs share a grouping, all lat pulldowns ("Overhand pulldowns", "Neutral pulldowns") in P5, P14, and P19. One pair is on the same day (P14 Pull B, plate-loaded and pin-loaded overhand machine pulldowns). Three involve a pulldown in an accessory slot. **Measured.** The rule is "no two exercises in a program share a grouping," and pulldowns leak because they fill both compound and Lat Accessory slots. **Inferred.**
- Preconditions are rare and limited. 32 of 653 picks carry one. The barbell bench family (bench, pause, close grip) accounts for 20, the barbell overhead press family for 11, and the 45° incline barbell press for 1. **Measured.** No bodyweight or weighted pull-up or dip variant is ever picked, and P2 skipped all of them for an assisted machine. The owner's assessment likely answers yes for bench and overhead press and no for pull-ups and dips. **Inferred.** Beginner (P16) still gets the close-grip bench, so experience does not gate preconditions. **Measured.**
- Accessories target muscles, one per exercise. The first accessory of each full-body day rotates Side Delts, Biceps, Triceps. Then come chest or back isolation, then calves, hamstrings, quads, then traps, upper back, abs. Neck, forearms, glutes, obliques, abductors, adductors, front delts, and lower back appear only at larger budgets. **Measured** on P1, P2, P11, P12, P15. The priority is a fixed muscle list filtered by the day's region. **Inferred.**

| Program      | Accessory primary muscles per day, in day order                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P11 0-20     | A: Side Delts, Calves. B: Biceps, Hamstrings. C: Triceps                                                                                                                                          |
| P1 40-60     | A: Side Delts, Chest, Calves, Upper Traps. B: Biceps, Rear Delts, Hamstrings, Upper Traps+Upper Back. C: Triceps, Lats, Quads, Abs                                                                |
| P2 40-60 str | The same order as P1, plus a fifth per day: Neck (A), Glutes (B), Forearms (C)                                                                                                                    |
| P20 PPL      | Push: Side Delts, Triceps, Chest, Side Delts, Triceps, Neck. Pull: Biceps, Rear Delts, Lats, Biceps, Upper Traps, Upper Back, Forearms. Legs: Calves, Hamstrings, Quads, Abs, Abductors, Obliques |

### 1.8 Weekly sets per muscle

Weighted weekly sets in cycle 1, with a primary feature muscle counting 1 and a secondary 0.5. **Measured.**

| Muscle      | P1 int | P16 beg | P17 adv | P11 0-20 | P12 120+ | P2 str | P4 focus | P5 UL | P20 PPL | P14 6x |
| ----------- | ------ | ------- | ------- | -------- | -------- | ------ | -------- | ----- | ------- | ------ |
| Upper Back  | 15     | 14      | 16      | 3.5      | 34.5     | 16.5   | 6.5      | 26.5  | 16.5    | 38.5   |
| Lats        | 12     | 12      | 12      | 3        | 28       | 13     | 6        | 26    | 15      | 32     |
| Chest       | 10.5   | 9.5     | 9.5     | 2        | 20.5     | 8      | 3        | 19    | 10.5    | 23.5   |
| Front Delts | 9.5    | 9.5     | 9.5     | 3.5      | 27.5     | 10.5   | 7.5      | 24    | 15      | 36     |
| Side Delts  | 5.5    | 6.5     | 6.5     | 3.5      | 14       | 5.5    | 7.5      | 14    | 10.5    | 21.5   |
| Biceps      | 9.5    | 9.5     | 9.5     | 5        | 25.5     | 10.5   | 10.5     | 24    | 15      | 31.5   |
| Triceps     | 7.5    | 9       | 9       | 4.5      | 19       | 7      | 4.5      | 18    | 13.5    | 22     |
| Quads       | 7      | 8       | 7       | 1        | 14.5     | 8      | 7        | 25    | 10.5    | 21.5   |
| Glutes      | 8      | 8       | 7       | 2        | 24.5     | 11     | 9        | 39.5  | 13.5    | 29.5   |
| Hamstrings  | 7      | 5       | 7       | 4        | 13       | 6      | 6        | 21    | 6       | 14     |
| Calves      | 4.5    | 4.5     | 4.5     | 4.5      | 8        | 3      | 5        | 12    | 4.5     | 9      |
| Abs         | 3      | 3       | 3       | 0        | 4        | 2      | 2        | 6     | 3       | 6      |
| Total       | 146.5  | 144.5   | 148     | 47       | 356.5    | 157    | 111      | 392   | 199.5   | 433.5  |

- **Experience (P1, P16, P17).** No structural effect. Skeleton, set counts, reps, and RIR are identical. Muscle totals move by at most 2.5 sets (Lower Back 4.5, 3, 2), and only through which random exercise filled a slot (for example, whether the squat pick lists Adductors). **Measured.** Experience may act through rules these inputs never trigger, such as "None" or other gyms. **Inferred.**
- **Session length (P11, P1, P12).** Volume scales with time, not by a constant factor per muscle. Total weighted sets are 47, 146.5, and 356.5. Small muscles keep a floor. Calves hold 4.5 at both 0-20 and 40-60, and Biceps keep 5 against 9.5. Chest drops from 10.5 to 2 and Quads from 7 to 1. At 0 to 20 minutes the program keeps the six primaries and five accessories in total (side delts, calves, biceps, hamstrings, triceps). **Measured.**
- **Goal (P1, P2).** Strength has slightly more compound sets (3 sets on more primaries) and 2-set accessories, five per day instead of four. Total 157 against 146.5. **Measured.**
- **Muscle focus (P4).** No same-input control exists. Against P5 (same split, no focus) and P1, focus shows in three places. **Measured.** The two accessory slots on each upper day both go to biceps and side delts (P5 spreads them over side delts, triceps, biceps, chest). Biceps is 9.5% of weighted sets in P4 against 6.1% (P5) and 6.5% (P1). Side delts is 6.8% against 3.6% and 3.8%. The upper compounds lean to biceps and away from chest. They are a close-grip bench (triceps and chest), an underhand cable row, and an underhand pulldown (biceps primary). Chest is 2.7% against 4.8% and 7.2%, with no chest accessory. **Measured.** Focus reorders accessory priority and biases compound choice through primary and emphasized muscles. **Inferred.**

### 1.8.1 "Less" focus alone

P23 repeats P1's inputs with Triceps and Lats set to less. **Measured.**

- The skeleton, set counts, reps, and RIR equal P1's.
- The triceps accessory (skull crusher in P1 Workout C) and the lats accessory (machine pullover) are gone. Their slots went to a rear delt fly, a wrist curl, and a neck extension. Workout C now opens its accessories with a pec deck.
- The lat pulldown compound slots stay, so Lats still get 9 weighted sets against 12 in P1. Triceps drop from 7.5 to 4.5.

### 1.9 Deload

The `.xlsx` export carries no deload targets. P18 (deload off) and P1 (deload on) differ only in the header field `Deload: Last Cycle`, and in both, cycle 7 is the ladder's last value repeated. **Measured.**

The program editor shows the deload. Each exercise's horizontal card row ends with a **Deload** card after Week 7 (`m2-program-week-cards-deload.jpg`). Program Settings still says "Number of Weeks: 7 Weeks", so the deload week comes in addition to the 7 cycles. **Observed.** [`exports/editor-week-cards-p1-p2.json`](exports/editor-week-cards-p1-p2.json) holds every card of P1 and P2, harvested from the editor's accessibility tree.

The deload card derives from the last week's sets by one rule, with no exceptions in 51 exercises across P1 (hypertrophy) and P2 (strength). **Observed.**

- Drop the last set. 3 sets become 2, and 2 become 1. One-set exercises were not seen.
- Add 3 to each remaining set's RIR, capped at 6+.
- Scale both ends of the rep range by 0.8 and round half up.

| Week 7 sets (reps, RIR) | Deload sets        | Seen on                                   |
| ----------------------- | ------------------ | ----------------------------------------- |
| 3 x 5-7, RIR 3, 2, 1    | 2 x 4-6, RIR 6+, 5 | P1 barbell bench press                    |
| 2 x 5-7, RIR 2, 1       | 1 x 4-6, RIR 5     | P1 overhead press, squat, RDL             |
| 2 x 7-9, RIR 2, 1       | 1 x 6-7, RIR 5     | P1 incline press, leg press, good morning |
| 2 x 7-9, RIR 1, 0       | 1 x 6-7, RIR 4     | P1 pulldowns and rows                     |
| 3 x 7-9, RIR 2, 1, 0    | 2 x 6-7, RIR 5, 4  | P1 T-bar row                              |
| 3 x 9-11, RIR 1, 0, 0   | 2 x 7-9, RIR 4, 3  | P1 accessories                            |
| 3 x 2-4, RIR 3, 2, 1    | 2 x 2-3, RIR 6+, 5 | P2 pause bench, front squat               |
| 2 x 2-4, RIR 2, 1       | 1 x 2-3, RIR 5     | P2 trap bar deadlift                      |
| 3 x 5-7, RIR 2, 1, 0    | 2 x 4-6, RIR 5, 4  | P2 assisted pull-up, barbell row          |
| 2 x 4-6, RIR 2, 1       | 1 x 3-5, RIR 5     | P2 dumbbell press, pause squat            |
| 2 x 7-9, RIR 0, 0       | 1 x 6-7, RIR 3     | P2 accessories                            |

Deload "First Cycle" (Program Settings, §2) presumably puts the card before Week 1. That placement was not generated. **Inferred.**

### 1.10 Generator recipe

Each rule reproduces the 20 programs. "Obs" marks observed rules and "inf" marks inferred ones.

1. Program length is 7 cycles. With deload on, add a deload week after cycle 7, derived from cycle 7 by the §1.9 rule. Obs.
2. Lay out the week by day count with the rest pattern table in §1.3. Obs.
3. The no-preference split is 2 days Full Body, 3 days Upper/Lower/Full, 4 days Upper/Lower/Upper/Lower, 5 days PPLUL, 6 days PPLPPL. Obs.
4. Give each of the six compound patterns (HPush, VPush, HPull, VPull, Squat, Hinge) exactly one primary per week, on a day whose split admits it. Obs. On full-body days use the sliding window in §1.4. Obs.
5. Add secondaries per pattern from the session budget (§1.4 table). Obs. Fill one per pattern before adding a second. Inf.
6. Order each day as primaries, then secondaries, then accessories. Obs.
7. Fill the remaining minutes with accessories, one muscle each, from a priority list that starts Side Delts, Biceps, Triceps, then chest and back isolation, then calves, hamstrings, quads, then traps, upper back, abs, then the rest. Rotate the list across days and filter by the day's region. Inf. Never repeat an exercise in a program. Obs.
8. Budget time as 3 minutes per compound set and 2 per accessory set, and land inside the band. Inf (fits all 73 days).
9. The first compound gets the day's highest compound set count. Primaries get 2 or 3 at 40 to 60 minutes and mostly 4 at 60 minutes or more. Secondaries get 2 to 4. Accessories get 3 for hypertrophy and 2 for strength at 40 to 60 minutes. Obs ranges. The exact allocator is unknown.
10. Rep tier from the goal and role table in §1.5, with "both" taking strength primaries and hypertrophy for the rest. Obs.
11. Rep sequence from the ladder and the progression's index list in §1.5. noPreference means linear. Static uses its own tier table and one cycle. Obs for hypertrophy, and for strength under linear. Inf for strength or both under the other progressions.
12. RIR from the track and set count table in §1.6, constant across cycles. Obs.
13. Leave rest unset and use standard set type. Obs.
14. For each slot, take candidates whose primary feature muscle matches and whose goal level for the slot is non-null. Drop exercises the gym cannot equip and those whose precondition the assessment fails. Drop any that share an exclusion grouping with an exercise already in the program. Take the lowest level and break ties uniformly at random. Obs for level 1 (97% to 100%) and random ties. Exclusion is Inf (5 leaks, all pulldowns).
15. Muscle focus "more" moves the muscle to the front of the accessory list, can double its accessories, and prefers compounds where it is a primary. Inf from one program. "Less" removes the muscle's accessories and gives their slots to the next muscles in the priority list, while the compound slots stay. Obs (P23).
16. Experience changes nothing visible. Obs for beginner, intermediate, and advanced at 3x Full Body.

These 20 programs cannot determine the following.

- The splits never generated (2x Upper/Lower and Push/Pull, 3x Upper/Lower/Full, 4x PPHS and PPL+Accessories, 5x ULULU, 6x PPHSUL).
- Strength and "both" tiers under static, undulating, and reverse progressions.
- Hypertrophy pull tiers under linear, where primary and secondary are both 14-16. Static shows they are different slots.
- The deload of a one-set exercise, and of a "First Cycle" deload.
- The exact per-exercise set allocator and the exact accessory priority list. Both are fitted, not observed.
- How focus on lower-body muscles works, and how strong the effect is.
- Whether experience "None" or beginner changes anything at other splits or session lengths.
- Exclusion scope (program or day), since all leaks are pulldowns.
- The owner's Exercise Assessment answers, and how 7 answers map to 43 preconditions.
- Equipment effects beyond this gym. 23 catalog equipment names are missing from the gym list.
- Rest times, which the export never sets.

---

## 2. Programs

Everything here was observed on the test programs from §1, mainly P1 (3x Full Body, a 7-day weekly program). The owner's own program, "Recomp v3 (6-day)", was only read: 10 cycles, 6 workout days, deload None, periodization off.

### 2.1 Weeks and cycles

A program is a list of days, workout or rest, that repeats. **Observed.**

- A program with exactly 7 days is **weekly**. The UI says "Week": "Number of Weeks", "Week 1" cards, the Day / Week toggle, and "Week 1" on the Workout tab.
- Any other length is a **cycle**. Duplicating a day in P1 made it 8 days, and every label switched to "Cycle": "Cycle 1" cards, Day / Cycle, "Number of Cycles" (`m2-program-cycle-terms.jpg`). The owner's 6-day program says "Cycle 1".
- Day Order shows the length as "7-Day Cycle" either way.

### 2.2 Active Program on the Workout tab

`m2-workout-tab-active-weekly.jpg`, `m2-workout-tab-day-done.jpg`, `m2-workout-tab-no-active.jpg`

- The section header has "Active Program" on the left and the current position on the right, as an underlined link: "Week 1" or "Cycle 1". Tapping it opens a "Go to..." sheet listing Week 1 to Week 7 and then Deload (`m2-active-goto-week.jpg`). Picking one changes the label, and the day rows then open with that week's targets. For example, P1 Workout A under Deload showed 2 x 4-6 reps on the bench and an estimate of 28 minutes.
- The program card has the icon tile, the name, "3 workouts", and a collapse chevron. One row per day follows, in order, rest days included. A workout row has the day name, the exercise list (2 lines), muscle tags, and a checkbox. A rest row is "Rest Day" and a checkbox.
- **Completion.** Logging a session of a program day ticks its checkbox and dims the row. Rest days are ticked by tapping their checkbox. Tapping a workout day's checkbox did nothing, so a workout day completes only through a logged session.
- After the first program session, today's pill in the week strip gained an arc in the program color (red for P1). It looks like a progress ring. **Inferred.**
- Tapping a day row opens the workout detail for that day and the selected week. Its Target Muscles show that week's numbers (Chest "7 sets").
- With no active program, the section reads "Drag a program block here". Activating a program from the library replaces it. Deactivating moves it back to the Workout Library and resets its progress.
- What happens after the last day of a week was not observed. Strings in the binary describe the end of the block: "Program Block Complete", "Repeat Program Block", and "You could repeat this program block once or continue running this block until you activate a different program." ([`app-strings.md`](app-strings.md)).

### 2.3 Up Next

`m2-plus-up-next-weekly.jpg`, `m2-plus-up-next-rest-day.jpg`

The "+" Shortcuts sheet shows "Up Next • <day name>" for the active program's first unticked day, in day order. **Observed.**

- A workout day shows as a card with the exercise list and muscle tags. Tapping it opens that day's workout detail, with Start Workout.
- After P1's Workout A was logged, Up Next became "Up Next • Rest Day", a plain row with a checkbox. Once that rest day was ticked on the Workout tab, Up Next became Workout B.
- The day is chosen by order, not by weekday. P1 was activated on a Friday, and Up Next was still Workout A.

### 2.4 Program editor

`m2-program-editor-generated.jpg`, `m2-program-week-cards-deload.jpg`

- **Header.** Back, the program name, and a sliders button for Program Settings.
- **Day tabs.** A scrolling tab bar with one tab per day ("Workout A", "Rest", ...) and a final **Add Day** tab. Add Day appends a rest day and selects it.
- **Chips for a workout day.** Gym ▾, Rename, Re-order, Duplicate, Change to Rest, Remove. A rest day puts Remove first.
  - **Gym ▾** opens "Gym Options · Impacts exercise selection": the gym profiles with their equipment counts, "Manage Gym Profiles · Add, edit, and remove gyms", and an **Apply to All Days** toggle (`m2-program-gym-options.jpg`). The gym is per day.
  - **Rename** opens "Rename Day" with a Name field and Save (`m2-program-rename-day.jpg`).
  - **Re-order** opens a "Re-Order" sheet listing the day's exercises with ≡ handles and Done (`m2-program-reorder.jpg`). It reorders exercises inside the day. Days are reordered in Program Settings > Day Order.
  - **Duplicate** appends a copy of the day at the end, named with the next letter ("Workout D"), and selects it (`m2-program-duplicated-day.jpg`).
  - **Change to Rest** asks "All exercises will be cleared for this day" / "Exercises will be cleared and the day will be turned into a Rest day." with Change to Rest and Go Back (`m2-program-change-to-rest-dialog.jpg`).
  - **Remove** asks "Remove Day?" / "This will remove the entire day from your program." with OK and Go Back.
- **A rest day's body** reads "Rest Day · You can convert the rest day into a workout day by adding exercises below", then "0 Exercises" with Add Exercises (`m2-program-rest-day.jpg`).
- **Target Muscles** with a Day / Week toggle (Day / Cycle for cycles). Each card is a muscle with "N exercises" and "N sets". In the editor the sets are averaged over every week including the deload. P1 Workout A's chest shows 6.7 sets, which is (7 x 7 weeks + 4.5 in the deload) / 8. Week mode sums the program's days the same way (Upper Back 14.3). **Observed** values, averaging **inferred** from them.
- **"N Exercises" | Add Exercises.** Each exercise has its thumbnail, name, muscle tags, and ⋮, then a horizontal row of cards: Week 1 to Week N, then **Deload** when deload is on (First Week puts it first). A card lists its sets as a number, "11-13 reps", and a colored RIR badge. With periodization off there is a single "7 Weeks" card instead (`m2-program-periodization-off.jpg`).

**Week targets sheet.** Tapping a card opens the targets sheet titled with the exercise, subtitled "Week 1" (`m2-program-week-targets.jpg`). Its columns are Set, Reps Min, Reps Max, RIR, with Skip Exercise ("Exercise will be skipped on Workout A, Week 1") and Set Rest Timers ("This will override default exercise settings") toggles. The buttons are:

- **Save To All Weeks**
- **Save** (this week only)
- **More Options**, which opens "Saving Options · 3 sets" (`m2-program-saving-options.jpg`). It holds two radio groups and Save:
  - Cycle Settings: "Week 1 only", "Week 1 and beyond", "All weeks"
  - Exercise Settings: "Barbell Bench Press only", "All exercises for the day", "All exercises in the program"

**Exercise Options (⋮)** (`m2-program-exercise-options.jpg`):

- Info ("Learn about the exercise")
- Swap ("Replace with an alternate")
- Superset ("Manage superset settings")
- Move to a different day ("Relocate the exercise in your program"). This opens "Move", listing every other day as "Day 2 | Rest", "Day 3 | Workout B", and so on. Rest days are valid targets.
- Program Note ("Note will display on this exercise every time you work out", Add). The note pins to the exercise within this program.
- Duplicate Exercise
- Remove from workout

### 2.5 Program Settings

`m2-program-settings-weekly.jpg`. The sheet is titled "Program Settings" with the program name under it.

- **Number of Weeks** (or Cycles), a − / + stepper with "7 Weeks" under the title. Adding a week copies the last week's targets into it, and the deload stays last: P1's Week 8 repeated Week 7's 5-7 reps. Removing a week drops the last one. **Observed.**
- **Name**, Edit.
- **Color & Icon**, Edit, shown as "Red, Rocket". The milestone 1 spec has the picker (7 colors, about 50 glyphs).
- **Day Order**, Edit, shown as "W, R, W, R, W, R, R". The sheet is titled "Day Order" with "7-Day Cycle" under it. It lists "Day 1 | Workout A" through "Day 7 | Rest Day" as a reorderable list, with Save and Cancel (`m2-program-day-order.jpg`).
- **Deload**, Edit, shown as "Last Week". The sheet has three choices:
  - None ("Train continuously without scheduled reductions in intensity or volume.")
  - First Week ("Start each training block with a lower-intensity week to ease into new workloads and reduce soreness.")
  - Last Week ("Finish each training block with a lighter week to promote recovery and readiness for the next phase.")

  The choice moves the Deload card. First Week derives the deload from Week 1 by the §1.9 rule: 3 x 11-13 at RIR 3, 2, 1 became 2 x 9-10 at RIR 6+, 5, and 2 x 14-16 at RIR 1, 0 became 1 x 11-13 at RIR 4. **Observed.**

- **Periodization**, a toggle with "Organize your training into phases that vary intensity and volume to support continuous progress and effective recovery". There are no sub-options in Program Settings. The style (linear, reverse linear, undulating, static) is chosen only in the generation wizard. Turning it off asks "Turn off periodization?" / "Periodization is what allows cycle-to-cycle variation. When disabled, all weeks for an exercise will use identical sets and targets. The impact of turning this off is not reversible." with Turn Off and Go Back (`m2-program-periodization-off-dialog.jpg`). After Turn Off, every week took Week 1's targets, and the cards collapsed to one "7 Weeks" card plus the Deload card. **Observed.**
- **Duplicate Program**, which opens "Program Name". The name defaults to today's date ("October 23, 2026"), with "Save & Go to Duplicate" (`m2-program-duplicate-name.jpg`).
- **Export Program** opens the system share sheet with an `.xlsx` named `MacroFactor-<yyyyMMddHHmmss>`. See §5 for the format.
- **Activate Program** on an inactive program, or **Deactivate Program** on the active one. Deactivate asks "Are you sure you want to deactivate this program?" / "Your active program will be moved to your Workout Library and its progress will be reset." with OK and Go Back (`m2-program-deactivate-dialog.jpg`). Activate swaps immediately, with no dialog.
- **Archive Program** acts immediately. The row then reads **Unarchive Program**.
- **Delete Program** (red) asks "Are you sure you want to delete this program?" / "The program and workouts within the program will be deleted." with Delete Program and Go Back (`m2-program-delete-dialog.jpg`).

### 2.6 Archive

The Workout tab's ⋮ > Archive shows "N programs, M workouts" and opens "Workout Archive" (`m2-archive-list.jpg`). It uses the Workout Library's row style. A program is a card with its icon tile, name, "N workouts", a collapse chevron, and its day rows. Tapping the program name opens the program editor, whose settings offer Unarchive Program and Delete Program. Archiving moved P23 out of the library. The ⋮ count went from "1 program" (milestone 1) to "2 programs". **Observed.**
