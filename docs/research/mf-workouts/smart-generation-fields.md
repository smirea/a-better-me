# Smart Generation fields

MF Workouts ships per-exercise selection data in `app_file.json` that its New Program wizard ("Use Smart Generation") draws on.
This file documents those fields so the program generator can be built without driving MF.
Every claim is tagged **measured** (computed from the bundle by `tools/generation-fields.py`) or **hypothesis** (inferred, needs calibration against programs MF generates).
The generated half below the marker holds the numbers; rerun the script when MF updates.
`generation-candidates.json` holds the full ranked candidate lists per feature muscle and slot.
Literal UI strings from the compiled app are in [`app-strings.md`](app-strings.md).

## Regenerate

```sh
python3 -I docs/research/mf-workouts/tools/generation-fields.py
python3 -I docs/research/mf-workouts/tools/app-strings.py > /tmp/mf-strings.txt
```

The first rewrites the generated section of this file and `generation-candidates.json`.
The second dumps the App binary's strings (one-byte and UTF-16) for grepping.

## Field reference

### Recommendation levels (six fields)

- `{strength,hypertrophy}{PrimaryCompound,SecondaryCompound,Accessory}RecommendationLevel` are numbers or null. **Measured.**
- Values run 1 to 7 for primary compound, 1 to 9 for secondary compound, and 1 to 8 for accessory. **Measured.**
- They are mostly integers. Primary and secondary compound levels also use 1.5 and 2.5 (10 and 7 exercises in the strength fields); accessory levels are always whole. **Measured.**
- **Lower is better.** Level 1 is the top tier. **Measured** on the anchors: barbell bench press, back squat, overhead press, and bent-over barbell row are level 1 in the primary slot; barbell RDL is hypertrophy primary 1; overhand pull-up and chin-up are 1.5. Mean `searchBoostValue` also falls as the level rises (strength primary: 7.6 at level 1, 4.3 at level 7). **Measured.**
- Levels are coarse tiers with many ties: 55 exercises sit at hypertrophy primary level 1. **Measured.** The generator therefore needs a tiebreak; `searchBoostValue` (higher is more common) is the natural one. **Hypothesis.**
- A level is a property of the exercise in that slot, not of a muscle. The per-muscle tables filter by `primaryFeatureMuscle`, so a leg press appears under Quads, Glutes, and Adductors with the same level. **Measured.**
- The six fields mean: the exercise may fill a program slot of that kind (primary compound, the main heavy lift of a day; secondary compound; accessory) for that goal, and the number is its preference rank there. Null means never pick it for that slot. **Hypothesis**, consistent with classification below.
- Strength and hypertrophy levels are equal for most exercises (1,279 of 1,345 for primary, 1,250 for secondary, 1,271 for accessory, counting both-null as equal). **Measured.** The differences favor machines for hypertrophy: 45° leg press is strength primary 2 but hypertrophy primary 1. **Measured** (Quads table).
- The wizard's goal options are "Muscle Hypertrophy", "Muscle Strength", and "Both Strength & Hypertrophy" (strings in `app-strings.md`). "Both" probably mixes or averages the two level sets. **Hypothesis.**
- Some muscles have no compound slots at all. Side Delts has 0 primary and 4 secondary compound candidates, Calves, Abs, Abductors, Upper Traps, Obliques, Neck, Tibs, Serratus and Hip flexors have only accessory candidates. **Measured.** So those muscles are only ever trained by accessories. **Hypothesis.**

### `exerciseClassificationStrength`, `exerciseClassificationHypertrophy`

- Lists of `exerciseDescriptor` ids. Only four descriptors are ever used: Primary Compound, Secondary Compound, Isolation/Accessory, Core. **Measured.**
- They predict level presence almost exactly. "Primary Compound" in the set means the primary level is non-null (116 of 120 for Primary + Secondary), "Isolation/Accessory" means the accessory level is non-null, and "Core" alone or an empty set means no level at all. **Measured** (crosstab below).
- Classification is the slot eligibility and the level is the rank within it. **Hypothesis.** The handful of mismatches (for example 3 "Secondary Compound"-only exercises with a primary level) look like data-entry drift, so the generator should key off the level fields, not classification. **Hypothesis.**
- The other 16 `exerciseDescriptor` entries (Strength, Hypertrophy, Both, Neither, Bodyweight/Home Equipment, and the numbers 1 to 9, 1.5, 2.5) are never referenced by an exercise. They look like the vocabulary of the source database's select columns, exported alongside. **Measured** that they are unreferenced; the origin is a **hypothesis**.

### `exclusionGroupings`

- 0 to 5 ids of uuidIndex type `exclusionGroupings` (340 entries). 888 exercises have exactly one. **Measured.**
- Members of a grouping are near-duplicates: "Bilateral Romanian deadlifts" holds 20 RDL variants, "Flat machine chest presses" holds 11 machines. 285 of 338 multi-member groupings share one primary feature muscle set. **Measured.**
- Groupings overlap and nest by design: 45° incline barbell press sits in "45° incline barbell presses", "45° to high incline barbell presses", and "45° to low incline barbell presses". **Measured.**
- Meaning: a generated program never holds two exercises that share any exclusion grouping, so it never picks a flat barbell bench and a paused flat barbell bench together, while the "45° to low" overlap still blocks adjacent angles. **Hypothesis**, the name says exclusion and the structure fits.
- Some grouping names carry a tier: "Primary Barbell Bench press" holds the standard, flat-back, and paused bench; "Tertiary barbell bench presses" holds feet-up and banded. **Measured.**

### `exerciseGroup`

- 0 to 6 ids of type `exerciseGroup` (321 entries, 49 with `alternativeName` ids). **Measured.**
- Groups are broader families used for swapping and search: "Barbell bench presses" (26) contains "Flat barbell bench presses" (16); 109 groups are strict subsets of another group. 126 groups have exactly the members of some exclusion grouping. **Measured.**
- Some groups exist for MF's program importers ("Min-Max program squat variations", matching the Jeff Nippard parsers named in the binary). **Measured** that the names exist; their importer use is a **hypothesis**.
- Use in generation: pick variety across groups, and offer same-group exercises as swaps. **Hypothesis.**

### `preconditions`

- 0 or 1 id of type `preconditions` (46 entries, 43 referenced, 140 exercises). **Measured.**
- Each names a gated skill or load: "Barbell bench press preconditions" (28 exercises, every barbell bench variant), "Bodyweight vertical pulls preconditions" (12), "Weighted vertical pulls preconditions" (3), "Bodyweight dip preconditions" (8), "Weighted dip preconditions" (7), and so on. **Measured.**
- The binary describes the Exercise Assessment as "A questionnaire about your experience with foundational movements that determines access to advanced exercises", and it holds seven yes-or-no questions (bench, incline, and overhead press a barbell for 10 reps; 5 and 10 pull-ups; 15 push-ups; 10 dips). **Measured** (strings).
- An exercise with a precondition is a candidate only when the assessment answers satisfy it, for example "Can you bench press a barbell for at least 10 reps?" gates the bench family and "at least 10 pull-ups" gates weighted pulls. The mapping from 7 answers to 43 preconditions lives in compiled code and is not in the bundle. **Hypothesis**; the generator needs our own table.

### `stretchedMuscle`, `emphasizedAgonist`, `deemphasizedAgonist`

- `stretchedMuscle` lists anatomical `muscle` ids (same vocabulary as `primaryMuscle`); 434 exercises have at least one. **Measured.** It marks exercises that load the muscle at long length (RDL: hamstrings and glute max; dumbbell bench: pecs). A generator can prefer them for hypertrophy, which MF's marketing and articles emphasize. **Hypothesis.**
- `emphasizedAgonist` and `deemphasizedAgonist` list `featureMuscleGroup` ids. Emphasized is always a subset of the exercise's primary plus secondary feature muscles (250 of 250); deemphasized is for 154 of 227 and otherwise names a stabilizer such as Lower Back on a leg press. **Measured.**
- They likely feed "Which muscles should get more or less focus?": an emphasized muscle prefers exercises that emphasize it, and a deemphasized one avoids exercises that hit it as an agonist. **Hypothesis.**

### Scalar descriptors

- `searchBoostValue` is 1 to 10, integer, missing for 5 exercises; 10 marks staples (27 exercises). **Measured.** Picker search ranking and generation tiebreak. **Hypothesis** for the tiebreak.
- `movementPattern` lists 1 to 3 of 43 patterns (Horizontal Push, Hip Hinge, Squat, Vertical Pull, "Biceps Accessory", and so on). **Measured.** The wizard's split names (Push/Pull/Hinge/Squat, Upper/Lower) suggest days are filled by pattern. **Hypothesis.**
- `regionTrained` is Upper body, Lower body, Core, or Full body. **Measured.**
- `rom` (1 to 5) and `stability` (1 to 5) are `rom` and `stability` entries whose names are the digits. Most exercises are rom 3 or 4 and stability 4 or 5. **Measured.** Higher rom is a longer range of motion and higher stability a more stable setup. **Hypothesis**, supported by spot checks: machines (leg press, leg extension, pec deck, lying hamstring curl) are stability 5, Bosu ball push-up is 1, dumbbell Bulgarian split squat is rom 5 and stability 2. **Measured** for those values; useful to prefer stable, long-ROM picks for hypertrophy.
- `bodyweight` is the fraction of body weight that counts as load (0 to 0.99). **Measured** range; the UI string "This is the amount of bodyweight that contributes to resistance for this exercise" confirms the meaning.

## Generator sketch (hypothesis)

1. Choose a split and day count from the wizard answers.
2. For each day slot (primary compound, secondary compound, accessory) and target muscle, take candidates whose `primaryFeatureMuscle` contains the muscle and whose goal level for that slot is non-null.
3. Drop exercises whose equipment no gym profile has, whose precondition the assessment doesn't satisfy, or that the owner marked Do Not Recommend.
4. Sort by level ascending, then `searchBoostValue` descending.
5. Skip any candidate sharing an exclusion grouping with an exercise already in the program.
6. Apply muscle focus with the emphasized and deemphasized agonists.

Calibrate each step against programs the research thread generates in MF.

## Measured data

<!-- GENERATED:START -->

Source: `app_file.json`, generatedAt `2026-09-28T22:29:08Z`, 1345 exercises, 5301 uuidIndex entries. All numbers in this section are measured.

### uuidIndex entry shapes

| type                      | count | keys                                                                                                                                                                                                                               |
| ------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| alternativeName           | 2069  | name                                                                                                                                                                                                                               |
| exercise                  | 1345  | name, name_jp                                                                                                                                                                                                                      |
| exclusionGroupings        | 340   | name                                                                                                                                                                                                                               |
| exerciseGroup             | 321   | alternativeName, name                                                                                                                                                                                                              |
| equipment                 | 297   | alternativeName, category, commercialGym, garageGym, homeGym, localGym, name, name_jp, plateCalculatorLaterality, pluralOf, warehouseGym, weightIncrementKg, weightIncrementLb, weightKg, weightLb, weightSelectKg, weightSelectLb |
| exerciseNote              | 280   | name                                                                                                                                                                                                                               |
| muscle                    | 233   | name                                                                                                                                                                                                                               |
| jointAction               | 150   | name                                                                                                                                                                                                                               |
| supportEquipmentGroup     | 53    | equipment, name                                                                                                                                                                                                                    |
| preconditions             | 46    | name                                                                                                                                                                                                                               |
| movementPattern           | 43    | name                                                                                                                                                                                                                               |
| resistanceEquipmentGroup  | 35    | equipment, name                                                                                                                                                                                                                    |
| featureMuscleGroup        | 23    | name                                                                                                                                                                                                                               |
| exerciseDescriptor        | 20    | name                                                                                                                                                                                                                               |
| appEquipmentCategory      | 13    | name                                                                                                                                                                                                                               |
| exerciseMetric            | 11    | name                                                                                                                                                                                                                               |
| rom                       | 5     | name                                                                                                                                                                                                                               |
| stability                 | 5     | name                                                                                                                                                                                                                               |
| regionTrained             | 4     | name                                                                                                                                                                                                                               |
| exerciseType              | 3     | name                                                                                                                                                                                                                               |
| laterality                | 3     | name                                                                                                                                                                                                                               |
| plateCalculatorLaterality | 2     | name                                                                                                                                                                                                                               |

### Referenced uuidIndex types per field

| field                             | referenced type and count | distinct ids | list length: exercises                                   |
| --------------------------------- | ------------------------- | ------------ | -------------------------------------------------------- |
| exclusionGroupings                | exclusionGroupings 1490   | 340          | 0:179, 1:888, 2:238, 3:35, 4:4, 5:1                      |
| exerciseGroup                     | exerciseGroup 1552        | 321          | 0:356, 1:574, 2:290, 3:108, 4:14, 6:3                    |
| preconditions                     | preconditions 140         | 43           | 0:1205, 1:140                                            |
| stretchedMuscle                   | muscle 2013               | 84           | 0:911, 1:26, 2:54, 3:48, 4:118, 5:44, 6:10, 7:119, 10:15 |
| emphasizedAgonist                 | featureMuscleGroup 314    | 15           | 0:1095, 1:201, 2:34, 3:15                                |
| deemphasizedAgonist               | featureMuscleGroup 413    | 15           | 0:1118, 1:103, 2:82, 3:22, 4:20                          |
| movementPattern                   | movementPattern 1474      | 41           | 0:2, 1:1220, 2:115, 3:8                                  |
| exerciseClassificationStrength    | exerciseDescriptor 1716   | 4            | 0:28, 1:943, 2:349, 3:25                                 |
| exerciseClassificationHypertrophy | exerciseDescriptor 1738   | 4            | 0:28, 1:921, 2:371, 3:25                                 |
| rom                               | rom 1320                  | 5            | null:25                                                  |
| stability                         | stability 1324            | 5            | null:21                                                  |
| regionTrained                     | regionTrained 1336        | 4            | null:9                                                   |
| exerciseType                      | exerciseType 1341         | 3            | null:4                                                   |

### Recommendation levels

| field                        | non-null | min | max | non-integer | level:count                                                       |
| ---------------------------- | -------- | --- | --- | ----------- | ----------------------------------------------------------------- |
| strengthPrimaryCompound      | 155      | 1.0 | 7.0 | 10          | 1:22, 1.5:3, 2:40, 2.5:7, 3:41, 4:19, 5:13, 6:4, 7:6              |
| strengthSecondaryCompound    | 566      | 1.0 | 9.0 | 7           | 1:75, 1.5:3, 2:94, 2.5:4, 3:172, 4:142, 5:50, 6:6, 7:16, 8:2, 9:2 |
| strengthAccessory            | 793      | 1.0 | 8.0 | 0           | 1:156, 2:172, 3:154, 4:185, 5:64, 6:27, 7:31, 8:4                 |
| hypertrophyPrimaryCompound   | 166      | 1.0 | 7.0 | 3           | 1:55, 1.5:3, 2:19, 3:45, 4:21, 5:13, 6:4, 7:6                     |
| hypertrophySecondaryCompound | 582      | 1.0 | 9.0 | 7           | 1:93, 1.5:3, 2:76, 2.5:4, 3:173, 4:152, 5:55, 6:6, 7:16, 8:2, 9:2 |
| hypertrophyAccessory         | 795      | 1.0 | 8.0 | 0           | 1:162, 2:150, 3:158, 4:181, 5:68, 6:40, 7:32, 8:4                 |

Mean searchBoostValue per level (lower level should mean more popular if level 1 is best):

| field                        | level:mean boost                                                                |
| ---------------------------- | ------------------------------------------------------------------------------- |
| strengthPrimaryCompound      | 1:7.6, 1.5:9.7, 2:6.9, 2.5:7.4, 3:5.2, 4:5.0, 5:5.5, 6:3.8, 7:4.3               |
| strengthSecondaryCompound    | 1:6.7, 1.5:8.3, 2:5.7, 2.5:6.8, 3:4.4, 4:3.7, 5:3.9, 6:3.5, 7:4.4, 8:4.5, 9:5.5 |
| strengthAccessory            | 1:6.3, 2:5.4, 3:4.7, 4:4.1, 5:4.1, 6:4.9, 7:4.0, 8:4.8                          |
| hypertrophyPrimaryCompound   | 1:7.1, 1.5:9.7, 2:6.3, 3:5.2, 4:5.0, 5:5.5, 6:3.8, 7:4.3                        |
| hypertrophySecondaryCompound | 1:6.8, 1.5:8.3, 2:5.5, 2.5:6.8, 3:4.6, 4:3.7, 5:3.9, 6:3.5, 7:4.4, 8:4.5, 9:5.5 |
| hypertrophyAccessory         | 1:6.4, 2:5.4, 3:4.6, 4:4.0, 5:4.2, 6:5.1, 7:4.0, 8:4.8                          |

### Anchor exercises

| exercise                      | strengthPrimaryCompound | strengthSecondaryCompound | strengthAccessory | hypertrophyPrimaryCompound | hypertrophySecondaryCompound | hypertrophyAccessory | boost | classificationHypertrophy               |
| ----------------------------- | ----------------------- | ------------------------- | ----------------- | -------------------------- | ---------------------------- | -------------------- | ----- | --------------------------------------- |
| Barbell bench press           | 1                       |                           |                   | 1                          |                              |                      | 10.0  | Primary Compound                        |
| Barbell back squat            | 1                       | 1                         |                   | 1                          | 1                            |                      | 10.0  | Secondary Compound, Primary Compound    |
| Barbell Romanian deadlift     |                         | 1                         |                   | 1                          | 1                            |                      | 10.0  | Secondary Compound, Primary Compound    |
| Overhand grip pull-up         | 1.5                     | 2                         |                   | 1.5                        | 2                            |                      | 10.0  | Secondary Compound, Primary Compound    |
| Chin-up                       | 1.5                     | 2                         |                   | 1.5                        | 2                            |                      | 10.0  | Secondary Compound, Primary Compound    |
| Barbell overhead press        | 1                       | 1                         |                   | 1                          | 1                            |                      | 10.0  | Secondary Compound, Primary Compound    |
| Bent-over barbell row         | 1                       | 1                         |                   | 1                          | 1                            |                      | 10.0  | Secondary Compound, Primary Compound    |
| Seated dumbbell lateral raise |                         |                           | 1                 |                            |                              | 1                    | 9.0   | Isolation/Accessory                     |
| Barbell biceps curl           |                         |                           | 2                 |                            |                              | 2                    | 9.0   | Isolation/Accessory                     |
| Leg extension                 |                         |                           | 1                 |                            |                              | 1                    | 10.0  | Isolation/Accessory                     |
| Lying hamstring curl          |                         |                           | 1                 |                            |                              | 1                    | 10.0  | Isolation/Accessory                     |
| Barbell hip thrust            |                         | 2                         | 2                 |                            | 2                            | 2                    | 9.0   | Secondary Compound, Isolation/Accessory |
| Standing machine calf raise   |                         |                           | 1                 |                            |                              | 1                    | 9.0   | Isolation/Accessory                     |

### Classification vs level presence

Rows are the classification set; columns count exercises whose level field is non-null.

| exerciseClassificationStrength                              | exercises | strengthPrimaryCompound | strengthSecondaryCompound | strengthAccessory |
| ----------------------------------------------------------- | --------- | ----------------------- | ------------------------- | ----------------- |
| Isolation/Accessory                                         | 562       | 0                       | 1                         | 525               |
| Secondary Compound                                          | 365       | 3                       | 313                       | 21                |
| Primary Compound + Secondary Compound                       | 120       | 116                     | 117                       | 2                 |
| Isolation/Accessory + Secondary Compound                    | 120       | 2                       | 111                       | 111               |
| Core + Isolation/Accessory                                  | 108       | 0                       | 0                         | 108               |
| (empty)                                                     | 28        | 0                       | 0                         | 0                 |
| Isolation/Accessory + Primary Compound + Secondary Compound | 25        | 21                      | 24                        | 24                |
| Primary Compound                                            | 12        | 12                      | 0                         | 1                 |
| Core                                                        | 4         | 0                       | 0                         | 0                 |
| Isolation/Accessory + Primary Compound                      | 1         | 1                       | 0                         | 1                 |

| exerciseClassificationHypertrophy                           | exercises | hypertrophyPrimaryCompound | hypertrophySecondaryCompound | hypertrophyAccessory |
| ----------------------------------------------------------- | --------- | -------------------------- | ---------------------------- | -------------------- |
| Isolation/Accessory                                         | 545       | 0                          | 1                            | 510                  |
| Secondary Compound                                          | 363       | 3                          | 307                          | 30                   |
| Primary Compound + Secondary Compound                       | 134       | 130                        | 131                          | 2                    |
| Isolation/Accessory + Secondary Compound                    | 128       | 2                          | 119                          | 119                  |
| Core + Isolation/Accessory                                  | 108       | 0                          | 0                            | 108                  |
| (empty)                                                     | 28        | 0                          | 0                            | 0                    |
| Isolation/Accessory + Primary Compound + Secondary Compound | 25        | 21                         | 24                           | 24                   |
| Primary Compound                                            | 9         | 9                          | 0                            | 1                    |
| Core                                                        | 4         | 0                          | 0                            | 0                    |
| Isolation/Accessory + Primary Compound                      | 1         | 1                          | 0                            | 1                    |

Strength and hypertrophy classification sets are identical for 1301 of 1345 exercises.
Strength vs hypertrophy level equality per slot (equal includes both null): Accessory differ:74, Accessory equal:1271, PrimaryCompound differ:66, PrimaryCompound equal:1279, SecondaryCompound differ:95, SecondaryCompound equal:1250.

Classification vs exerciseType:

| exerciseType             | classificationHypertrophy                                   | count |
| ------------------------ | ----------------------------------------------------------- | ----- |
| Single joint (isolation) | Isolation/Accessory                                         | 475   |
| Multi-joint (compound)   | Secondary Compound                                          | 355   |
| Multi-joint (compound)   | Primary Compound + Secondary Compound                       | 133   |
| Multi-joint (compound)   | Isolation/Accessory + Secondary Compound                    | 118   |
| Core                     | Core + Isolation/Accessory                                  | 106   |
| Multi-joint (compound)   | Isolation/Accessory                                         | 45    |
| Multi-joint (compound)   | (empty)                                                     | 25    |
| Core                     | Isolation/Accessory                                         | 25    |
| Multi-joint (compound)   | Isolation/Accessory + Primary Compound + Secondary Compound | 22    |
| Multi-joint (compound)   | Primary Compound                                            | 9     |
| Single joint (isolation) | Isolation/Accessory + Secondary Compound                    | 9     |
| Single joint (isolation) | Secondary Compound                                          | 8     |
| Core                     | Core                                                        | 4     |
| null                     | (empty)                                                     | 3     |
| Single joint (isolation) | Isolation/Accessory + Primary Compound + Secondary Compound | 3     |
| Multi-joint (compound)   | Core + Isolation/Accessory                                  | 2     |
| Single joint (isolation) | Primary Compound + Secondary Compound                       | 1     |
| Single joint (isolation) | Isolation/Accessory + Primary Compound                      | 1     |
| null                     | Isolation/Accessory + Secondary Compound                    | 1     |

exerciseDescriptor entries never referenced by an exercise classification: 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, Bodyweight/Home Equipment, Both, Hypertrophy, Neither, Strength.

### Scalar descriptors

| field            | value:count                                                                  |
| ---------------- | ---------------------------------------------------------------------------- |
| rom              | 1:33, 2:164, 3:580, 4:455, 5:88, null:25                                     |
| stability        | 1:1, 2:99, 3:264, 4:655, 5:305, null:21                                      |
| regionTrained    | Core:132, Full body:37, Lower body:441, Upper body:726, null:9               |
| exerciseType     | Core:135, Multi-joint (compound):709, Single joint (isolation):497, null:4   |
| searchBoostValue | 1:13, 2:141, 3:258, 4:232, 5:261, 6:175, 7:122, 8:70, 9:41, 10:27, missing:5 |

Movement patterns (exercise count):

Horizontal Push 142, Hip Hinge 118, Lunge/Split Squat/Step Up/Single Leg Squat 99, Horizontal Pull 97, Squat 82, Ab Accessory 82, Biceps Accessory 81, Triceps Accessory 59, Vertical Pull 58, Glute Max Accessory 55, Vertical Push 53, Hamstring Accessory 49, Lat Accessory 47, Lateral Delt Accessory 41, Anterior Forearm Accessory 35, Calf Accessory 34, Chest Accessory 29, Upper Back Accessory 29, Rear Delt Accessory 28, Hip Abductor Accessory 28, Oblique Acessory 26, Upper Trap Accessory 24, Quad Accessory 22, Lower Back Accessory 18, Cardio 15, Front Delt Accessory 14, Misc. Forearm 12, Olympic Lift Variation 12, Hip Adductor Accessory 12, Other 11, Loaded Carry 11, Shoulder Rotation Accessory 9, Posterior Forearm Accessory 9, Neck Flexor Accessory 7, Neck Extensor Accessory 7, Tibialis Anterior Accessory 6, Serratus Accessory 4, Core Stabilization 3, Hip Flexor Isolation 2, Other Ankle Accessory 2, Throw 2.

### exclusionGroupings

340 groupings referenced. Group size:count 1:2, 2:107, 3:61, 4:52, 5:26, 6:31, 7:11, 8:19, 9:9, 10:7, 11:5, 12:6, 13:2, 14:1, 20:1.
Exercises with no exclusion grouping but some non-null level: 95.
Multi-member groupings whose members all share the same primaryFeatureMuscle set: 285 of 338.

Largest 15 groupings with sample members:

| grouping                             | size | top members by boost                                                                                                                                                                                                            |
| ------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bilateral Romanian deadlifts         | 20   | Barbell Romanian deadlift; Dumbbell Romanian deadlift; Shrug machine Romanian deadlift; Smith machine Romanian deadlift; Stiff-leg deadlift from floor                                                                          |
| Reverse lunges                       | 14   | Dumbbell reverse lunge; Barbell reverse lunge; Bodyweight reverse lunge; Smith machine lunge; Bodyweight glute-dominant reverse lunge                                                                                           |
| Glute bridges                        | 13   | Barbell glute bridge; Dumbbell glute bridge; Single leg bodyweight glute bridge; Bodyweight glute bridge; Feet-elevated bodyweight glute bridge                                                                                 |
| Chest-supported machine rows         | 13   | Overhand grip pin-loaded machine row; Neutral grip pin-loaded machine row; Neutral grip plate-loaded machine row; Overhand grip plate-loaded machine row; Machine D.Y. row                                                      |
| Leg press                            | 12   | 45° leg press; Pin-loaded leg press; Single leg pin-loaded leg press; Leverage leg press; Single leg 45° leg press                                                                                                              |
| Single leg squats                    | 12   | Assisted pistol squat; Assisted skater squat; Bodyweight single leg box squat; Bodyweight skater squat; Single leg goblet box squat                                                                                             |
| Sit-ups                              | 12   | Bodyweight sit-up with hands behind head; Decline weighted sit-up; Weighted sit-up; Bodyweight sit-up with hands on floor; Bodyweight sit-up with hands on shoulders                                                            |
| Decline presses                      | 12   | Plate-loaded machine decline press; Decline barbell press; Decline close grip press; Pin-loaded machine decline press; Decline Smith machine press                                                                              |
| Single leg leg curls                 | 12   | Kneeling pin-loaded hamstring curl; Kneeling plate-loaded hamstring curl; Lying single leg hamstring curl; Standing plate-loaded hamstring curl; Lying single leg plate-loaded hamstring curl                                   |
| Machine hip abduction                | 12   | Seated machine hip abduction; Seated plate-loaded machine hip abduction; Leaned forward machine hip abduction; Reclined machine hip abduction; Standing pin-loaded machine hip abduction                                        |
| Dumbbell hammer curls (non-preacher) | 11   | Standing dumbbell hammer curl; Seated dumbbell hammer curl; Incline hammer curl; Alternating cross-body dumbbell hammer curl; Dumbbell hammer cheat curl                                                                        |
| Rear foot elevated split squats      | 11   | Dumbbell Bulgarian split squat; Bodyweight Bulgarian split squat; Kettlebell Bulgarian split squat; Smith machine Bulgarian split squat; Barbell Bulgarian split squat                                                          |
| Barbell rows                         | 11   | Bent-over barbell row; Pendlay row; Smith machine row; Bent-over underhand grip barbell row; Deficit Pendlay row                                                                                                                |
| Seated cable rows                    | 11   | Neutral grip cable row; Overhand grip cable row; Underhand grip cable row; Wide grip cable row; Seated dual handle cable row (elbows-in)                                                                                        |
| Flat machine chest presses           | 11   | Pin-loaded machine chest press; Seated plate-loaded machine chest press; Neutral grip pin-loaded machine chest press; Seated neutral grip plate-loaded machine chest press; Lying neutral grip plate-loaded machine chest press |

Exercises in 3 or more groupings (sample):

| exercise                                         | groupings                                                                                                                                             |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 45° incline Smith machine press                  | 45° incline barbell presses; Low to 45° incline Smith machine presses; 45° to high incline barbell presses; High to 45° incline Smith machine presses |
| 45° incline barbell press                        | 45° incline barbell presses; 45° to high incline barbell presses; 45° to low incline barbell presses                                                  |
| 45° incline close grip press                     | 45° incline barbell presses; Close grip bench press; 45° to high incline barbell presses; 45° to low incline barbell presses                          |
| 45° incline pause barbell press                  | 45° incline barbell presses; 45° to high incline barbell presses; 45° to low incline barbell presses                                                  |
| 45° incline wide grip press                      | 45° incline barbell presses; 45° to high incline barbell presses; 45° to low incline barbell presses                                                  |
| Accentuated eccentric leg extension              | Accentuated eccentric leg extensions; Unilateral leg extensions; Leg extensions                                                                       |
| Accentuated eccentric plate-loaded leg extension | Accentuated eccentric leg extensions; Unilateral leg extensions; Leg extensions                                                                       |
| Barbell back squat to a box                      | Back squats; Box squats; General back squats                                                                                                          |
| Barbell glute bridge                             | Weighted bilateral glute bridges; Barbell glute bridges; Barbell hip thrust and glute bridge; Glute bridges                                           |
| Barbell hip thrust                               | Bilateral free weight hip thrust; Bilateral hip thrusts; Barbell hip thrust and glute bridge                                                          |
| Bodyweight Roman chair back extension            | Bodyweight Roman chair back extensions; Bodyweight back extensions; Roman chair/GHD back extensions                                                   |
| Bodyweight glute bridge                          | Bilateral bodyweight glute bridges; Bodyweight glute bridges; Glute bridges                                                                           |

### exerciseGroup

321 groups referenced. Group size:count 1:1, 2:106, 3:58, 4:40, 5:22, 6:25, 7:14, 8:13, 9:4, 10:8, 11:12, 12:3, 13:2, 14:3, 15:2, 16:1, 17:1, 18:2, 19:1, 20:1, 26:1, 27:1.
Groups that are a strict subset of another group: 109.
Groups carrying alternativeName ids: 49.
Groups whose member set equals some exclusion grouping's member set: 126.

Largest 15 groups:

| exerciseGroup                  | size | top members by boost                                                                                                                                                                                                      |
| ------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Romanian deadlifts             | 27   | Barbell Romanian deadlift; Dumbbell Romanian deadlift; Smith machine Romanian deadlift; Single leg dumbbell Romanian deadlift; Trap bar Romanian deadlift                                                                 |
| Barbell bench presses          | 26   | Barbell bench press; Close grip bench press; 45° incline barbell press; Pause barbell bench press; 45° incline close grip press                                                                                           |
| Overhead triceps extensions    | 20   | Cable straight bar overhead triceps extension; Seated dumbbell overhead triceps extension; Cable rope overhead triceps extension; Standing EZ bar overhead triceps extension; Single arm cable overhead triceps extension |
| Hip abductions                 | 19   | Seated machine hip abduction; Seated plate-loaded machine hip abduction; Cable hip abduction (leg in front of body); Cable hip abduction (leg behind body); Leaned forward machine hip abduction                          |
| Machine calf raises            | 18   | Standing machine calf raise; 45° leg press calf raise; Pin-loaded leg press calf raise; Seated pin-loaded machine calf raise; Standing plate-loaded machine calf raise                                                    |
| Standard and advanced push-ups | 18   | Push-up; Wide grip push-up; Close grip push-up; Push-up plus; Weighted push-up                                                                                                                                            |
| Lat pulldowns                  | 17   | Overhand grip cable lat pulldown; Overhand grip pin-loaded machine lat pulldown; Neutral shoulder width grip cable lat pulldown; Wide grip cable lat pulldown; Neutral close grip cable lat pulldown                      |
| Flat barbell bench presses     | 16   | Barbell bench press; Close grip bench press; Pause barbell bench press; Wide grip bench press; Feet-up barbell bench press                                                                                                |
| Hammer curls                   | 15   | Standing dumbbell hammer curl; Seated dumbbell hammer curl; Incline hammer curl; Single arm dumbbell preacher hammer curl; Cable rope hammer curl                                                                         |
| Cable curls                    | 15   | Cable straight bar biceps curl; Cable EZ bar biceps curl; Single arm Bayesian curl; Single arm cable biceps curl (facing toward machine); Cable rope hammer curl                                                          |
| Dumbbell bench presses         | 14   | Dumbbell bench press; 45° incline dumbbell press; Low incline dumbbell press; Neutral grip dumbbell bench press; 45° incline neutral grip dumbbell press                                                                  |
| Hip thrusts                    | 14   | Barbell hip thrust; Plate-loaded machine hip thrust (starting from the top); Plate-loaded machine hip thrust (starting from the bottom); Pin-loaded machine hip thrust; Bodyweight hip thrust                             |
| Bodyweight vertical pulls      | 14   | Chin-up; Overhand grip pull-up; Neutral grip pull-up; Wide grip pull-up; Overhand grip dead hang pull-up                                                                                                                  |
| Machine hip abductions         | 13   | Seated machine hip abduction; Seated plate-loaded machine hip abduction; Standing plate-loaded machine hip abduction; Leaned forward machine hip abduction; Reclined machine hip abduction                                |
| Standing calf raises           | 13   | Standing machine calf raise; Standing plate-loaded machine calf raise; Standing on step single leg dumbbell calf raise; Standing dumbbell calf raise; Standing on step bodyweight calf raise                              |

Example: groups and groupings of the barbell bench press family:

| exercise                      | exerciseGroup                                     | exclusionGroupings                              | preconditions                            |
| ----------------------------- | ------------------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| Banded barbell bench press    | Flat barbell bench presses; Barbell bench presses | Tertiary barbell bench presses                  | Banded barbell bench press preconditions |
| Barbell bench press           | Flat barbell bench presses; Barbell bench presses | Primary Barbell Bench press                     | Barbell bench press preconditions        |
| Feet-up barbell bench press   | Flat barbell bench presses; Barbell bench presses | Tertiary barbell bench presses                  | Barbell bench press preconditions        |
| Flat-back barbell bench press | Flat barbell bench presses; Barbell bench presses | Primary Barbell Bench press                     | Barbell bench press preconditions        |
| Pause barbell bench press     | Flat barbell bench presses; Barbell bench presses | Paused bench press; Primary Barbell Bench press | Barbell bench press preconditions        |

### preconditions

43 of 46 precondition entries are referenced; 140 exercises carry one (never more than one).

| precondition                                                   | exercises | members                                                                                                                                                                                                                  |
| -------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 45° incline barbell press preconditions                        | 5         | 45° incline barbell press; 45° incline close grip press; 45° incline pause barbell press; 45° incline wide grip press; Barbell guillotine press                                                                          |
| Advanced bodyweight push-up preconditions                      | 5         | Bosu ball push-up; Close grip medicine ball push-up; Decline push-up; Diamond push-up; Pike push-up                                                                                                                      |
| Advanced single leg squat preconditions                        | 3         | Dumbbell skater squat; Goblet skater squat; Shrimp squat                                                                                                                                                                 |
| Banded barbell bench press preconditions                       | 1         | Banded barbell bench press                                                                                                                                                                                               |
| Banded push-up preconditions                                   | 1         | Banded push-up                                                                                                                                                                                                           |
| Barbell JM preconditions                                       | 1         | Barbell JM press                                                                                                                                                                                                         |
| Barbell Jefferson curl preconditions                           | 2         | Barbell Jefferson curl; Snatch grip Jefferson curl                                                                                                                                                                       |
| Barbell Z press preconditions                                  | 1         | Barbell Z press                                                                                                                                                                                                          |
| Barbell bench press preconditions                              | 28        | Barbell bench press; Barbell floor press; Buffalo bar bench press; Cambered bar bench press; Close grip bench press; Decline barbell press ...                                                                           |
| Barbell fixed-hip Jefferson curl preconditions                 | 1         | Barbell fixed-hip Jefferson curl                                                                                                                                                                                         |
| Barbell front raise preconditions                              | 1         | Barbell front raise                                                                                                                                                                                                      |
| Barbell lunge/split squat preconditions                        | 6         | Barbell Bulgarian split squat; Barbell forward lunge; Barbell front foot elevated split squat; Barbell reverse lunge; Barbell split squat; Barbell walking lunge                                                         |
| Barbell overhead press preconditions                           | 11        | Barbell overhead press; Barbell overhead shrug; Barbell push press; Barbell thruster; Close grip barbell overhead press; Overhead lockout pin press ...                                                                  |
| Barbell pullover preconditions                                 | 1         | Barbell pullover                                                                                                                                                                                                         |
| Barbell seal row preconditions                                 | 3         | Barbell seal row; Cambered bar seal row; Underhand grip barbell seal row                                                                                                                                                 |
| Barbell upright row preconditions                              | 1         | Barbell upright row                                                                                                                                                                                                      |
| Basic push-up preconditions                                    | 3         | Close grip push-up; Push-up; Wide grip push-up                                                                                                                                                                           |
| Behind the neck overhead press preconditions                   | 4         | Bradford press; Seated barbell behind-the-neck overhead press; Standing barbell behind-the-neck overhead press; Wide grip barbell behind-the-neck overhead press                                                         |
| Bodyweight dip preconditions                                   | 8         | Bodyweight chest dip; Bodyweight ring dip; Dip; Pause chest dip; Pause dip; Pause ring dip ...                                                                                                                           |
| Bodyweight vertical pulls preconditions                        | 12        | Chin-up; Close grip chin-up; Kipping pull-up; Neutral close grip pull-up; Neutral grip pull-up; Neutral wide grip pull-up ...                                                                                            |
| Handstand push-up preconditions                                | 1         | Handstand push-up                                                                                                                                                                                                        |
| High incline barbell press preconditions                       | 1         | High incline barbell press                                                                                                                                                                                               |
| Intermediate push-up preconditions                             | 5         | Deficit push-up; Hand release push-up; Knuckle push-up; Neutral grip deficit push-up; Pause push-up                                                                                                                      |
| L-sit pull-up preconditions                                    | 1         | L-sit pull-up                                                                                                                                                                                                            |
| Long lever Copenhagen plank preconditions                      | 2         | Dynamic long lever Copenhagen plank; Static long lever Copenhagen plank                                                                                                                                                  |
| Lying barbell triceps extension pullover preconditions         | 1         | Lying barbell triceps extension pullover                                                                                                                                                                                 |
| Machine-loaded single leg hip thrust preconditions             | 4         | Single leg Smith machine hip thrust; Single leg pin-loaded machine hip thrust; Single leg plate-loaded machine hip thrust (starting from the bottom); Single leg plate-loaded machine hip thrust (starting from the top) |
| Muscle-up preconditions                                        | 1         | Muscle-up                                                                                                                                                                                                                |
| Nordic curl preconditions                                      | 1         | Nordic hamstring curl                                                                                                                                                                                                    |
| Plyometric push-up preconditions                               | 1         | Plyometric push-up                                                                                                                                                                                                       |
| Safety squat bar lunge/split squat preconditions               | 2         | Safety squat bar reverse lunge; Safety squat bar split squat                                                                                                                                                             |
| Side plank with leg lift preconditions                         | 2         | Side plank with dynamic leg lift; Side plank with leg lift hold                                                                                                                                                          |
| Single arm dead hang preconditions                             | 1         | Single arm dead hang                                                                                                                                                                                                     |
| Single arm push-up preconditions                               | 1         | Single arm push-up                                                                                                                                                                                                       |
| Single leg bodyweight leg curl preconditions                   | 2         | Single leg slider leg curl; Single leg stability ball leg curl                                                                                                                                                           |
| Sternum chin-up preconditions                                  | 1         | Sternum chin-up                                                                                                                                                                                                          |
| Weighted dip preconditions                                     | 7         | Pause weighted chest dip; Pause weighted dip; Pause weighted triceps dip; Weighted chest dip; Weighted dip; Weighted ring dip ...                                                                                        |
| Weighted glute ham raise preconditions                         | 1         | Weighted glute ham raise                                                                                                                                                                                                 |
| Weighted machine sissy squat (as squat movement) preconditions | 1         | Weighted machine sissy squat                                                                                                                                                                                             |
| Weighted push-up preconditions                                 | 1         | Weighted push-up                                                                                                                                                                                                         |
| Weighted vertical pulls preconditions                          | 3         | Neutral grip weighted pull-up; Overhand grip weighted pull-up; Weighted chin-up                                                                                                                                          |
| Wide grip pull-up preconditions                                | 1         | Wide grip pull-up                                                                                                                                                                                                        |
| Wide grip weighted pull-up preconditions                       | 1         | Wide grip weighted pull-up                                                                                                                                                                                               |

### stretchedMuscle, emphasizedAgonist, deemphasizedAgonist

stretchedMuscle top values: Gluteus Maximus Upper Region 151, Gluteus Maximus Lower Region 142, Adductor Magnus Anterior Portion 141, Adductor Magnus Posterior Portion 141, Anconeus 91, Vastus Medialis 75, Vastus Lateralis 75, Vastus Intermedius 75, Semitendinosus 61, Semimembranosus 61, Biceps Femoris Long Head 61, Deltoid Anterior Head 57, Pectoralis Major Sternocostal Head 56, Pectoralis Major (Clavicular Head 56, Coracobrachialis 56, Triceps Brachii Lateral Head 54, Triceps Brachii Medial Head 54, Triceps Brachii Long Head 36, Soleus 23, Medial Head of Gastrocnemius 19, Lateral Head of Gastrocnemius 19, Plantaris 19, Brachialis 19, Brachioradialis 19, Biceps Brachii Long Head 18.

emphasizedAgonist top values: Hamstrings 41, Glutes 40, Lats 33, Rear Delts 27, Lower Back 25, Biceps 23, Front Delts 22, Quads 22, Chest 22, Triceps 18, Upper Back 13, Upper Traps 11, Adductors 9, Forearms 4, Side Delts 4.

deemphasizedAgonist top values: Adductors 56, Upper Back 55, Lower Back 51, Triceps 46, Upper Traps 33, Hamstrings 32, Front Delts 24, Chest 23, Glutes 23, Biceps 19, Side Delts 16, Rear Delts 12, Lats 10, Quads 9, Serratus 4.

emphasizedAgonist is a subset of the exercise's primary plus secondary feature muscles for 250 of 250 exercises that have one.
deemphasizedAgonist is a subset of primary plus secondary feature muscles for 154 of 227.
434 exercises name at least one stretched anatomical muscle (uuidIndex type `muscle`, the same vocabulary as primaryMuscle).

Examples:

| exercise                           | primaryFeatureMuscle          | emphasized         | deemphasized                       | stretched                                                                                                         |
| ---------------------------------- | ----------------------------- | ------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 45° leg press                      | Glutes, Quads, Adductors      |                    | Lower Back                         | Adductor Magnus Anterior Portion, Gluteus Maximus Lower Region, Vastus Medialis, Gluteus Maximus Upper Region ... |
| Barbell Romanian deadlift          | Hamstrings, Glutes, Adductors | Hamstrings         |                                    | Adductor Magnus Anterior Portion, Semitendinosus, Gluteus Maximus Lower Region, Semimembranosus ...               |
| Bent-over barbell row              | Lats, Rear Delts, Upper Back  | Lower Back         |                                    |                                                                                                                   |
| Chin-up                            | Biceps, Lats                  | Biceps, Rear Delts |                                    |                                                                                                                   |
| Dumbbell bench press               | Chest                         | Chest              | Triceps                            | Anconeus, Deltoid Anterior Head, Pectoralis Major Sternocostal Head, Pectoralis Major (Clavicular Head ...        |
| Pin-loaded leg press               | Glutes, Quads, Adductors      |                    | Lower Back                         | Adductor Magnus Anterior Portion, Gluteus Maximus Lower Region, Vastus Medialis, Gluteus Maximus Upper Region ... |
| Seated dumbbell overhead press     | Front Delts                   |                    | Triceps                            |                                                                                                                   |
| Single arm dumbbell row (elbow-in) | Lats, Rear Delts, Upper Back  | Lats               | Upper Traps, Upper Back            |                                                                                                                   |
| Standing dumbbell overhead press   | Front Delts                   |                    | Triceps                            |                                                                                                                   |
| 45° incline barbell press          | Chest, Front Delts            | Front Delts        |                                    |                                                                                                                   |
| Barbell glute bridge               | Glutes                        | Glutes             | Hamstrings, Lower Back, Upper Back |                                                                                                                   |
| Barbell good morning               | Hamstrings, Glutes, Adductors | Lower Back         |                                    | Adductor Magnus Anterior Portion, Semitendinosus, Gluteus Maximus Lower Region, Semimembranosus ...               |

### Candidate counts per primary feature muscle

| muscle      | strengthPrimaryCompound | strengthSecondaryCompound | strengthAccessory | hypertrophyPrimaryCompound | hypertrophySecondaryCompound | hypertrophyAccessory |
| ----------- | ----------------------- | ------------------------- | ----------------- | -------------------------- | ---------------------------- | -------------------- |
| Abductors   | 0                       | 0                         | 27                | 0                          | 0                            | 27                   |
| Abs         | 0                       | 0                         | 79                | 0                          | 0                            | 79                   |
| Adductors   | 39                      | 198                       | 109               | 45                         | 207                          | 111                  |
| Biceps      | 24                      | 53                        | 101               | 24                         | 53                           | 101                  |
| Calves      | 0                       | 0                         | 34                | 0                          | 0                            | 34                   |
| Chest       | 36                      | 121                       | 25                | 38                         | 119                          | 25                   |
| Forearms    | 0                       | 1                         | 42                | 0                          | 1                            | 42                   |
| Front Delts | 20                      | 61                        | 21                | 19                         | 62                           | 21                   |
| Glutes      | 46                      | 224                       | 173               | 52                         | 240                          | 175                  |
| Hamstrings  | 11                      | 59                        | 44                | 15                         | 69                           | 46                   |
| Hip flexors | 0                       | 0                         | 18                | 0                          | 0                            | 18                   |
| Lats        | 52                      | 130                       | 34                | 53                         | 131                          | 34                   |
| Lower Back  | 0                       | 1                         | 18                | 0                          | 1                            | 18                   |
| Neck        | 0                       | 0                         | 11                | 0                          | 0                            | 11                   |
| Obliques    | 0                       | 0                         | 26                | 0                          | 0                            | 26                   |
| Quads       | 29                      | 149                       | 112               | 36                         | 149                          | 112                  |
| Rear Delts  | 29                      | 89                        | 32                | 30                         | 90                           | 32                   |
| Serratus    | 0                       | 0                         | 4                 | 0                          | 0                            | 4                    |
| Side Delts  | 0                       | 4                         | 40                | 0                          | 4                            | 40                   |
| Tibs        | 0                       | 0                         | 6                 | 0                          | 0                            | 6                    |
| Triceps     | 2                       | 18                        | 59                | 2                          | 18                           | 59                   |
| Upper Back  | 29                      | 87                        | 26                | 30                         | 88                           | 26                   |
| Upper Traps | 0                       | 0                         | 38                | 0                          | 0                            | 38                   |

### Top 5 per slot for major muscles

Sorted by level ascending, then searchBoostValue descending. Full lists for all feature muscles are in `generation-candidates.json`.

#### Chest

| slot                         | level | boost | exercise                                | exerciseGroup                                                   | equipment groups (first 3)                                                             |
| ---------------------------- | ----- | ----- | --------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| strengthPrimaryCompound      | 1     | 10.0  | Barbell bench press                     | Flat barbell bench presses; Barbell bench presses               | Barbell and weight plates                                                              |
| strengthPrimaryCompound      | 1     | 9.0   | Close grip bench press                  | Flat barbell bench presses; Barbell bench presses               | Barbell and weight plates                                                              |
| strengthPrimaryCompound      | 1     | 7.0   | Pause barbell bench press               | Flat barbell bench presses; Barbell bench presses               | Barbell and weight plates                                                              |
| strengthPrimaryCompound      | 1     | 5.0   | Swiss bar bench press                   | Flat barbell bench presses; Barbell bench presses               | Swiss bar and weight plates                                                            |
| strengthPrimaryCompound      | 2     | 9.0   | Smith machine bench press               | Smith machine bench presses                                     | Smith machine and weight plates; Pin-loaded Smith machine functional trainer           |
| strengthSecondaryCompound    | 1     | 10.0  | Dumbbell bench press                    | Dumbbell bench presses                                          | Dumbbells                                                                              |
| strengthSecondaryCompound    | 1     | 9.0   | 45° incline barbell press               | Barbell bench presses; 45° incline barbell presses              | Barbell and weight plates                                                              |
| strengthSecondaryCompound    | 1     | 8.0   | 45° incline dumbbell press              | Dumbbell bench presses; 45° incline dumbbell presses            | Dumbbells                                                                              |
| strengthSecondaryCompound    | 1     | 7.0   | 45° incline close grip press            | Barbell bench presses; 45° incline barbell presses              | Barbell and weight plates                                                              |
| strengthSecondaryCompound    | 1     | 7.0   | Low incline dumbbell press              | Dumbbell bench presses; Low incline presses                     | Dumbbells                                                                              |
| strengthAccessory            | 1     | 10.0  | Dumbbell fly                            | Dumbbell flies                                                  | Dumbbells                                                                              |
| strengthAccessory            | 1     | 9.0   | Horizontal cable fly                    | Cable chest flies                                               | Pin-loaded cable crossover; Plate-loaded cable crossover; Motorized dual cable machine |
| strengthAccessory            | 1     | 8.0   | Pec deck fly                            | Machine flies                                                   | Pec deck                                                                               |
| strengthAccessory            | 1     | 7.0   | Low-to-high cable fly                   | Cable chest flies                                               | Pin-loaded cable crossover; Plate-loaded cable crossover; Motorized dual cable machine |
| strengthAccessory            | 1     | 7.0   | Machine fly with arm pads               | Machine flies                                                   | Chest fly with arm pads                                                                |
| hypertrophyPrimaryCompound   | 1     | 10.0  | Barbell bench press                     | Flat barbell bench presses; Barbell bench presses               | Barbell and weight plates                                                              |
| hypertrophyPrimaryCompound   | 1     | 9.0   | Close grip bench press                  | Flat barbell bench presses; Barbell bench presses               | Barbell and weight plates                                                              |
| hypertrophyPrimaryCompound   | 1     | 7.0   | Pause barbell bench press               | Flat barbell bench presses; Barbell bench presses               | Barbell and weight plates                                                              |
| hypertrophyPrimaryCompound   | 1     | 3.0   | Cambered bar bench press                |                                                                 | Cambered bench press bar and weight plates                                             |
| hypertrophyPrimaryCompound   | 1     | 2.0   | Buffalo bar bench press                 |                                                                 | Buffalo bar and weight plates                                                          |
| hypertrophySecondaryCompound | 1     | 10.0  | Dumbbell bench press                    | Dumbbell bench presses                                          | Dumbbells                                                                              |
| hypertrophySecondaryCompound | 1     | 9.0   | 45° incline barbell press               | Barbell bench presses; 45° incline barbell presses              | Barbell and weight plates                                                              |
| hypertrophySecondaryCompound | 1     | 8.0   | 45° incline dumbbell press              | Dumbbell bench presses; 45° incline dumbbell presses            | Dumbbells                                                                              |
| hypertrophySecondaryCompound | 1     | 8.0   | Pin-loaded machine chest press          | Flat machine chest presses; Overhand grip machine chest presses | Seated pin-loaded chest press                                                          |
| hypertrophySecondaryCompound | 1     | 8.0   | Seated plate-loaded machine chest press | Flat machine chest presses; Overhand grip machine chest presses | Seated plate-loaded chest press                                                        |
| hypertrophyAccessory         | 1     | 10.0  | Dumbbell fly                            | Dumbbell flies                                                  | Dumbbells                                                                              |
| hypertrophyAccessory         | 1     | 9.0   | Horizontal cable fly                    | Cable chest flies                                               | Pin-loaded cable crossover; Plate-loaded cable crossover; Motorized dual cable machine |
| hypertrophyAccessory         | 1     | 8.0   | Pec deck fly                            | Machine flies                                                   | Pec deck                                                                               |
| hypertrophyAccessory         | 1     | 7.0   | Low-to-high cable fly                   | Cable chest flies                                               | Pin-loaded cable crossover; Plate-loaded cable crossover; Motorized dual cable machine |
| hypertrophyAccessory         | 1     | 7.0   | Machine fly with arm pads               | Machine flies                                                   | Chest fly with arm pads                                                                |

#### Quads

| slot                         | level | boost | exercise                        | exerciseGroup                                                 | equipment groups (first 3)                                                           |
| ---------------------------- | ----- | ----- | ------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| strengthPrimaryCompound      | 1     | 10.0  | Barbell back squat              | Back squats; Min-Max program squat variations                 | Barbell and weight plates                                                            |
| strengthPrimaryCompound      | 1     | 8.0   | Front squat                     | Front squats; Min-Max program squat variations                | Barbell and weight plates                                                            |
| strengthPrimaryCompound      | 1     | 7.0   | Pause back squat                |                                                               | Barbell and weight plates                                                            |
| strengthPrimaryCompound      | 1     | 6.0   | Safety squat bar squat          |                                                               | Safety squat bar and weight plates                                                   |
| strengthPrimaryCompound      | 2     | 10.0  | 45° leg press                   | Leg presses                                                   | 45° leg press                                                                        |
| strengthSecondaryCompound    | 1     | 10.0  | Barbell back squat              | Back squats; Min-Max program squat variations                 | Barbell and weight plates                                                            |
| strengthSecondaryCompound    | 1     | 9.0   | Dumbbell Bulgarian split squat  | Rear foot elevated split squats; Dumbbell lunges/split squats | Dumbbells                                                                            |
| strengthSecondaryCompound    | 1     | 8.0   | Dumbbell reverse lunge          | Reverse lunges; Dumbbell lunges/split squats                  | Dumbbells                                                                            |
| strengthSecondaryCompound    | 1     | 8.0   | Front squat                     | Front squats; Min-Max program squat variations                | Barbell and weight plates                                                            |
| strengthSecondaryCompound    | 1     | 8.0   | Single leg pin-loaded leg press | Single leg leg presses                                        | Pin-loaded leg press                                                                 |
| strengthAccessory            | 1     | 10.0  | Leg extension                   | Leg extensions                                                | Pin-loaded leg extension; Pin-loaded leg extension/leg curl combo machine            |
| strengthAccessory            | 1     | 9.0   | Dumbbell Bulgarian split squat  | Rear foot elevated split squats; Dumbbell lunges/split squats | Dumbbells                                                                            |
| strengthAccessory            | 1     | 9.0   | Plate-loaded leg extension      | Leg extensions                                                | Plate-loaded leg extension; Seated plate-loaded leg curl/leg extension combo machine |
| strengthAccessory            | 1     | 8.0   | Dumbbell reverse lunge          | Reverse lunges; Dumbbell lunges/split squats                  | Dumbbells                                                                            |
| strengthAccessory            | 1     | 8.0   | Single leg leg extension        | Single leg leg extensions                                     | Pin-loaded leg extension; Pin-loaded leg extension/leg curl combo machine            |
| hypertrophyPrimaryCompound   | 1     | 10.0  | 45° leg press                   | Leg presses                                                   | 45° leg press                                                                        |
| hypertrophyPrimaryCompound   | 1     | 10.0  | Barbell back squat              | Back squats; Min-Max program squat variations                 | Barbell and weight plates                                                            |
| hypertrophyPrimaryCompound   | 1     | 10.0  | Pin-loaded leg press            | Leg presses                                                   | Pin-loaded leg press                                                                 |
| hypertrophyPrimaryCompound   | 1     | 9.0   | Smith machine back squat        | Machine squats; Min-Max program squat variations              | Smith machine and weight plates; Pin-loaded Smith machine functional trainer         |
| hypertrophyPrimaryCompound   | 1     | 8.0   | Hack squat                      | Machine squats; Min-Max program squat variations              | Hack squat                                                                           |
| hypertrophySecondaryCompound | 1     | 10.0  | 45° leg press                   | Leg presses                                                   | 45° leg press                                                                        |
| hypertrophySecondaryCompound | 1     | 10.0  | Barbell back squat              | Back squats; Min-Max program squat variations                 | Barbell and weight plates                                                            |
| hypertrophySecondaryCompound | 1     | 10.0  | Pin-loaded leg press            | Leg presses                                                   | Pin-loaded leg press                                                                 |
| hypertrophySecondaryCompound | 1     | 9.0   | Dumbbell Bulgarian split squat  | Rear foot elevated split squats; Dumbbell lunges/split squats | Dumbbells                                                                            |
| hypertrophySecondaryCompound | 1     | 9.0   | Smith machine back squat        | Machine squats; Min-Max program squat variations              | Smith machine and weight plates; Pin-loaded Smith machine functional trainer         |
| hypertrophyAccessory         | 1     | 10.0  | Leg extension                   | Leg extensions                                                | Pin-loaded leg extension; Pin-loaded leg extension/leg curl combo machine            |
| hypertrophyAccessory         | 1     | 9.0   | Dumbbell Bulgarian split squat  | Rear foot elevated split squats; Dumbbell lunges/split squats | Dumbbells                                                                            |
| hypertrophyAccessory         | 1     | 9.0   | Plate-loaded leg extension      | Leg extensions                                                | Plate-loaded leg extension; Seated plate-loaded leg curl/leg extension combo machine |
| hypertrophyAccessory         | 1     | 8.0   | Dumbbell reverse lunge          | Reverse lunges; Dumbbell lunges/split squats                  | Dumbbells                                                                            |
| hypertrophyAccessory         | 1     | 8.0   | Single leg leg extension        | Single leg leg extensions                                     | Pin-loaded leg extension; Pin-loaded leg extension/leg curl combo machine            |

#### Hamstrings

| slot                         | level | boost | exercise                                       | exerciseGroup                                   | equipment groups (first 3)                                                                |
| ---------------------------- | ----- | ----- | ---------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| strengthPrimaryCompound      | 1     | 10.0  | Conventional deadlift                          | Deadlifts; Conventional deadlifts               | Barbell and weight plates                                                                 |
| strengthPrimaryCompound      | 2     | 9.0   | Dumbbell Romanian deadlift                     | Dumbbell Romanian deadlifts; Romanian deadlifts | Dumbbells                                                                                 |
| strengthPrimaryCompound      | 2     | 6.0   | Smith machine Romanian deadlift                | Romanian deadlifts                              | Smith machine and weight plates; Pin-loaded Smith machine functional trainer              |
| strengthPrimaryCompound      | 2     | 5.0   | Smith machine deficit Romanian deadlift        | Romanian deadlifts                              | Smith machine and weight plates; Pin-loaded Smith machine functional trainer              |
| strengthPrimaryCompound      | 3     | 7.0   | Cable pull-through                             |                                                 | Pin-loaded single cable machine; Pin-loaded cable crossover; Plate-loaded cable crossover |
| strengthSecondaryCompound    | 1     | 10.0  | Barbell Romanian deadlift                      | Romanian deadlifts; Barbell Romanian deadlifts  | Barbell and weight plates                                                                 |
| strengthSecondaryCompound    | 1     | 6.0   | Pause conventional deadlift                    | Pause deadlifts; Conventional deadlifts         | Barbell and weight plates                                                                 |
| strengthSecondaryCompound    | 1     | 6.0   | Safety squat bar good morning                  | Good mornings                                   | Safety squat bar and weight plates                                                        |
| strengthSecondaryCompound    | 1     | 6.0   | Shrug machine Romanian deadlift                |                                                 | Shrug/deadlift machine                                                                    |
| strengthSecondaryCompound    | 1     | 5.0   | Trap bar Romanian deadlift                     | Romanian deadlifts                              | Trap bar and weight plates; Open trap bar and weight plates                               |
| strengthAccessory            | 1     | 10.0  | Lying hamstring curl                           | Lying leg curls                                 | Lying pin-loaded leg curl                                                                 |
| strengthAccessory            | 1     | 9.0   | Lying plate-loaded hamstring curl              | Lying leg curls                                 | Lying plate-loaded leg curl                                                               |
| strengthAccessory            | 1     | 9.0   | Seated hamstring curl                          | Seated leg curls                                | Seated pin-loaded leg curl; Pin-loaded leg extension/leg curl combo machine               |
| strengthAccessory            | 1     | 8.0   | Seated plate-loaded hamstring curl             | Seated leg curls                                | Seated plate-loaded leg curl; Seated plate-loaded leg curl/leg extension combo machine    |
| strengthAccessory            | 1     | 7.0   | Kneeling pin-loaded hamstring curl             | Single leg leg curls                            | Kneeling pin-loaded leg curl                                                              |
| hypertrophyPrimaryCompound   | 1     | 10.0  | Barbell Romanian deadlift                      | Romanian deadlifts; Barbell Romanian deadlifts  | Barbell and weight plates                                                                 |
| hypertrophyPrimaryCompound   | 1     | 6.0   | Shrug machine Romanian deadlift                |                                                 | Shrug/deadlift machine                                                                    |
| hypertrophyPrimaryCompound   | 1     | 5.0   | Trap bar Romanian deadlift                     | Romanian deadlifts                              | Trap bar and weight plates; Open trap bar and weight plates                               |
| hypertrophyPrimaryCompound   | 1     | 3.0   | Lever-arm belt squat machine Romanian deadlift |                                                 | Lever-arm belt squat                                                                      |
| hypertrophyPrimaryCompound   | 1     | 3.0   | Pulley belt squat machine Romanian deadlift    |                                                 | Pulley belt squat                                                                         |
| hypertrophySecondaryCompound | 1     | 10.0  | Barbell Romanian deadlift                      | Romanian deadlifts; Barbell Romanian deadlifts  | Barbell and weight plates                                                                 |
| hypertrophySecondaryCompound | 1     | 7.0   | Smith machine good morning                     | Good mornings                                   | Smith machine and weight plates; Pin-loaded Smith machine functional trainer              |
| hypertrophySecondaryCompound | 1     | 6.0   | Safety squat bar good morning                  | Good mornings                                   | Safety squat bar and weight plates                                                        |
| hypertrophySecondaryCompound | 1     | 6.0   | Shrug machine Romanian deadlift                |                                                 | Shrug/deadlift machine                                                                    |
| hypertrophySecondaryCompound | 1     | 5.0   | Trap bar Romanian deadlift                     | Romanian deadlifts                              | Trap bar and weight plates; Open trap bar and weight plates                               |
| hypertrophyAccessory         | 1     | 10.0  | Lying hamstring curl                           | Lying leg curls                                 | Lying pin-loaded leg curl                                                                 |
| hypertrophyAccessory         | 1     | 9.0   | Lying plate-loaded hamstring curl              | Lying leg curls                                 | Lying plate-loaded leg curl                                                               |
| hypertrophyAccessory         | 1     | 9.0   | Seated hamstring curl                          | Seated leg curls                                | Seated pin-loaded leg curl; Pin-loaded leg extension/leg curl combo machine               |
| hypertrophyAccessory         | 1     | 8.0   | Seated plate-loaded hamstring curl             | Seated leg curls                                | Seated plate-loaded leg curl; Seated plate-loaded leg curl/leg extension combo machine    |
| hypertrophyAccessory         | 1     | 7.0   | Kneeling pin-loaded hamstring curl             | Single leg leg curls                            | Kneeling pin-loaded leg curl                                                              |

#### Glutes

| slot                         | level | boost | exercise                                                   | exerciseGroup                                                 | equipment groups (first 3)                                                                |
| ---------------------------- | ----- | ----- | ---------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| strengthPrimaryCompound      | 1     | 10.0  | Barbell back squat                                         | Back squats; Min-Max program squat variations                 | Barbell and weight plates                                                                 |
| strengthPrimaryCompound      | 1     | 10.0  | Conventional deadlift                                      | Deadlifts; Conventional deadlifts                             | Barbell and weight plates                                                                 |
| strengthPrimaryCompound      | 1     | 9.0   | Sumo deadlift                                              | Deadlifts; Sumo deadlifts                                     | Barbell and weight plates                                                                 |
| strengthPrimaryCompound      | 1     | 8.0   | Front squat                                                | Front squats; Min-Max program squat variations                | Barbell and weight plates                                                                 |
| strengthPrimaryCompound      | 1     | 7.0   | Pause back squat                                           |                                                               | Barbell and weight plates                                                                 |
| strengthSecondaryCompound    | 1     | 10.0  | Barbell Romanian deadlift                                  | Romanian deadlifts; Barbell Romanian deadlifts                | Barbell and weight plates                                                                 |
| strengthSecondaryCompound    | 1     | 10.0  | Barbell back squat                                         | Back squats; Min-Max program squat variations                 | Barbell and weight plates                                                                 |
| strengthSecondaryCompound    | 1     | 9.0   | Dumbbell Bulgarian split squat                             | Rear foot elevated split squats; Dumbbell lunges/split squats | Dumbbells                                                                                 |
| strengthSecondaryCompound    | 1     | 8.0   | Dumbbell reverse lunge                                     | Reverse lunges; Dumbbell lunges/split squats                  | Dumbbells                                                                                 |
| strengthSecondaryCompound    | 1     | 8.0   | Front squat                                                | Front squats; Min-Max program squat variations                | Barbell and weight plates                                                                 |
| strengthAccessory            | 1     | 10.0  | Seated machine hip abduction                               | Seated machine hip abductions; Machine hip abductions         | Pin-loaded hip abductor/adductor combo machine; Seated pin-loaded hip abductor            |
| strengthAccessory            | 1     | 9.0   | Dumbbell Bulgarian split squat                             | Rear foot elevated split squats; Dumbbell lunges/split squats | Dumbbells                                                                                 |
| strengthAccessory            | 1     | 8.0   | Dumbbell reverse lunge                                     | Reverse lunges; Dumbbell lunges/split squats                  | Dumbbells                                                                                 |
| strengthAccessory            | 1     | 8.0   | Pin-loaded machine hip thrust                              | Machine hip thrusts; Hip thrusts                              | Pin-loaded hip thrust                                                                     |
| strengthAccessory            | 1     | 8.0   | Plate-loaded machine hip thrust (starting from the bottom) | Machine hip thrusts; Hip thrusts                              | Plate-loaded hip thrust (starting from the bottom)                                        |
| hypertrophyPrimaryCompound   | 1     | 10.0  | 45° leg press                                              | Leg presses                                                   | 45° leg press                                                                             |
| hypertrophyPrimaryCompound   | 1     | 10.0  | Barbell Romanian deadlift                                  | Romanian deadlifts; Barbell Romanian deadlifts                | Barbell and weight plates                                                                 |
| hypertrophyPrimaryCompound   | 1     | 10.0  | Barbell back squat                                         | Back squats; Min-Max program squat variations                 | Barbell and weight plates                                                                 |
| hypertrophyPrimaryCompound   | 1     | 10.0  | Pin-loaded leg press                                       | Leg presses                                                   | Pin-loaded leg press                                                                      |
| hypertrophyPrimaryCompound   | 1     | 9.0   | Smith machine back squat                                   | Machine squats; Min-Max program squat variations              | Smith machine and weight plates; Pin-loaded Smith machine functional trainer              |
| hypertrophySecondaryCompound | 1     | 10.0  | 45° leg press                                              | Leg presses                                                   | 45° leg press                                                                             |
| hypertrophySecondaryCompound | 1     | 10.0  | Barbell Romanian deadlift                                  | Romanian deadlifts; Barbell Romanian deadlifts                | Barbell and weight plates                                                                 |
| hypertrophySecondaryCompound | 1     | 10.0  | Barbell back squat                                         | Back squats; Min-Max program squat variations                 | Barbell and weight plates                                                                 |
| hypertrophySecondaryCompound | 1     | 10.0  | Pin-loaded leg press                                       | Leg presses                                                   | Pin-loaded leg press                                                                      |
| hypertrophySecondaryCompound | 1     | 9.0   | Dumbbell Bulgarian split squat                             | Rear foot elevated split squats; Dumbbell lunges/split squats | Dumbbells                                                                                 |
| hypertrophyAccessory         | 1     | 10.0  | Seated machine hip abduction                               | Seated machine hip abductions; Machine hip abductions         | Pin-loaded hip abductor/adductor combo machine; Seated pin-loaded hip abductor            |
| hypertrophyAccessory         | 1     | 9.0   | Cable glute kickback                                       |                                                               | Pin-loaded single cable machine; Pin-loaded cable crossover; Plate-loaded cable crossover |
| hypertrophyAccessory         | 1     | 9.0   | Dumbbell Bulgarian split squat                             | Rear foot elevated split squats; Dumbbell lunges/split squats | Dumbbells                                                                                 |
| hypertrophyAccessory         | 1     | 8.0   | Dumbbell reverse lunge                                     | Reverse lunges; Dumbbell lunges/split squats                  | Dumbbells                                                                                 |
| hypertrophyAccessory         | 1     | 8.0   | Pin-loaded machine hip thrust                              | Machine hip thrusts; Hip thrusts                              | Pin-loaded hip thrust                                                                     |

#### Lats

| slot                         | level | boost | exercise                                       | exerciseGroup                                            | equipment groups (first 3)                                                              |
| ---------------------------- | ----- | ----- | ---------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| strengthPrimaryCompound      | 1     | 10.0  | Bent-over barbell row                          | Barbell rows                                             | Barbell and weight plates                                                               |
| strengthPrimaryCompound      | 1     | 9.0   | Overhand grip weighted pull-up                 | Overhand medium grip pull-ups; Overhand grip pull-ups    | Pull-up belt and weight plates; Pull-up belt and kettlebell; Weighted vest              |
| strengthPrimaryCompound      | 1     | 9.0   | Weighted chin-up                               | Chin-ups; Weighted vertical pulls                        | Pull-up belt and weight plates; Pull-up belt and kettlebell; Weighted vest              |
| strengthPrimaryCompound      | 1     | 8.0   | Pendlay row                                    | Pendlay rows; Barbell rows                               | Barbell and weight plates                                                               |
| strengthPrimaryCompound      | 1     | 7.0   | Neutral grip weighted pull-up                  | Neutral grip pull-ups; Weighted vertical pulls           | Pull-up belt and weight plates; Pull-up belt and kettlebell; Weighted vest              |
| strengthSecondaryCompound    | 1     | 10.0  | Bent-over barbell row                          | Barbell rows                                             | Barbell and weight plates                                                               |
| strengthSecondaryCompound    | 1     | 10.0  | Overhand grip cable lat pulldown               | Overhand grip lat pulldowns; Lat pulldowns               | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| strengthSecondaryCompound    | 1     | 10.0  | Single arm dumbbell row (elbow-in)             | Dumbbell rows; Single arm dumbbell rows                  | Dumbbell                                                                                |
| strengthSecondaryCompound    | 1     | 9.0   | Chest-supported overhand grip T-bar row        | Chest-supported T-bar rows; Chest-supported machine rows | Chest-supported T-bar row                                                               |
| strengthSecondaryCompound    | 1     | 9.0   | Overhand grip cable row                        | Seated cable rows                                        | Seated cable row; Pin-loaded single cable machine; Pin-loaded cable crossover           |
| strengthAccessory            | 1     | 10.0  | Overhand grip cable lat pulldown               | Overhand grip lat pulldowns; Lat pulldowns               | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| strengthAccessory            | 1     | 9.0   | Overhand grip pin-loaded machine lat pulldown  | Overhand grip lat pulldowns; Lat pulldowns               | Pin-loaded fixed lat pulldown                                                           |
| strengthAccessory            | 1     | 8.0   | Neutral shoulder width grip cable lat pulldown | Neutral grip lat pulldowns; Lat pulldowns                | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| strengthAccessory            | 1     | 8.0   | Wide grip cable lat pulldown                   | Overhand grip lat pulldowns; Lat pulldowns               | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| strengthAccessory            | 1     | 7.0   | Neutral close grip cable lat pulldown          | Neutral grip lat pulldowns; Lat pulldowns                | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| hypertrophyPrimaryCompound   | 1     | 10.0  | Bent-over barbell row                          | Barbell rows                                             | Barbell and weight plates                                                               |
| hypertrophyPrimaryCompound   | 1     | 10.0  | Overhand grip cable lat pulldown               | Overhand grip lat pulldowns; Lat pulldowns               | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| hypertrophyPrimaryCompound   | 1     | 10.0  | Single arm dumbbell row (elbow-in)             | Dumbbell rows; Single arm dumbbell rows                  | Dumbbell                                                                                |
| hypertrophyPrimaryCompound   | 1     | 9.0   | Chest-supported overhand grip T-bar row        | Chest-supported T-bar rows; Chest-supported machine rows | Chest-supported T-bar row                                                               |
| hypertrophyPrimaryCompound   | 1     | 9.0   | Overhand grip cable row                        | Seated cable rows                                        | Seated cable row; Pin-loaded single cable machine; Pin-loaded cable crossover           |
| hypertrophySecondaryCompound | 1     | 10.0  | Bent-over barbell row                          | Barbell rows                                             | Barbell and weight plates                                                               |
| hypertrophySecondaryCompound | 1     | 10.0  | Overhand grip cable lat pulldown               | Overhand grip lat pulldowns; Lat pulldowns               | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| hypertrophySecondaryCompound | 1     | 10.0  | Single arm dumbbell row (elbow-in)             | Dumbbell rows; Single arm dumbbell rows                  | Dumbbell                                                                                |
| hypertrophySecondaryCompound | 1     | 9.0   | Chest-supported overhand grip T-bar row        | Chest-supported T-bar rows; Chest-supported machine rows | Chest-supported T-bar row                                                               |
| hypertrophySecondaryCompound | 1     | 9.0   | Overhand grip cable row                        | Seated cable rows                                        | Seated cable row; Pin-loaded single cable machine; Pin-loaded cable crossover           |
| hypertrophyAccessory         | 1     | 10.0  | Overhand grip cable lat pulldown               | Overhand grip lat pulldowns; Lat pulldowns               | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| hypertrophyAccessory         | 1     | 9.0   | Overhand grip pin-loaded machine lat pulldown  | Overhand grip lat pulldowns; Lat pulldowns               | Pin-loaded fixed lat pulldown                                                           |
| hypertrophyAccessory         | 1     | 8.0   | Neutral shoulder width grip cable lat pulldown | Neutral grip lat pulldowns; Lat pulldowns                | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| hypertrophyAccessory         | 1     | 8.0   | Wide grip cable lat pulldown                   | Overhand grip lat pulldowns; Lat pulldowns               | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| hypertrophyAccessory         | 1     | 7.0   | Neutral close grip cable lat pulldown          | Neutral grip lat pulldowns; Lat pulldowns                | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |

#### Upper Back

| slot                         | level | boost | exercise                                | exerciseGroup                                                         | equipment groups (first 3)                                                                |
| ---------------------------- | ----- | ----- | --------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| strengthPrimaryCompound      | 1     | 10.0  | Bent-over barbell row                   | Barbell rows                                                          | Barbell and weight plates                                                                 |
| strengthPrimaryCompound      | 1     | 8.0   | Pendlay row                             | Pendlay rows; Barbell rows                                            | Barbell and weight plates                                                                 |
| strengthPrimaryCompound      | 1     | 6.0   | Bent-over underhand grip barbell row    | Barbell rows                                                          | Barbell and weight plates                                                                 |
| strengthPrimaryCompound      | 1     | 5.0   | Bent-over plate-loaded machine row      |                                                                       | Bent-over plate-loaded row                                                                |
| strengthPrimaryCompound      | 2     | 10.0  | Single arm dumbbell row (elbow-in)      | Dumbbell rows; Single arm dumbbell rows                               | Dumbbell                                                                                  |
| strengthSecondaryCompound    | 1     | 10.0  | Bent-over barbell row                   | Barbell rows                                                          | Barbell and weight plates                                                                 |
| strengthSecondaryCompound    | 1     | 10.0  | Single arm dumbbell row (elbow-in)      | Dumbbell rows; Single arm dumbbell rows                               | Dumbbell                                                                                  |
| strengthSecondaryCompound    | 1     | 9.0   | Chest-supported overhand grip T-bar row | Chest-supported T-bar rows; Chest-supported machine rows              | Chest-supported T-bar row                                                                 |
| strengthSecondaryCompound    | 1     | 9.0   | Overhand grip cable row                 | Seated cable rows                                                     | Seated cable row; Pin-loaded single cable machine; Pin-loaded cable crossover             |
| strengthSecondaryCompound    | 1     | 8.0   | Chest-supported neutral grip T-bar row  | Chest-supported T-bar rows; Chest-supported neutral grip machine rows | Chest-supported T-bar row                                                                 |
| strengthAccessory            | 1     | 9.0   | Cable face pull                         | Face pulls                                                            | Pin-loaded single cable machine; Pin-loaded cable crossover; Plate-loaded cable crossover |
| strengthAccessory            | 1     | 6.0   | Pin-loaded row machine Kelso shrug      | Machine Kelso shrugs                                                  | Chest-supported pin-loaded row                                                            |
| strengthAccessory            | 1     | 6.0   | T-bar Kelso shrug                       | Machine Kelso shrugs                                                  | Chest-supported T-bar row                                                                 |
| strengthAccessory            | 1     | 6.0   | Wide grip cable row                     | Seated cable rows                                                     | Seated cable row; Pin-loaded single cable machine; Pin-loaded cable crossover             |
| strengthAccessory            | 1     | 5.0   | Plate-loaded row machine Kelso shrug    | Machine Kelso shrugs                                                  | Chest-supported plate-loaded row                                                          |
| hypertrophyPrimaryCompound   | 1     | 10.0  | Bent-over barbell row                   | Barbell rows                                                          | Barbell and weight plates                                                                 |
| hypertrophyPrimaryCompound   | 1     | 10.0  | Single arm dumbbell row (elbow-in)      | Dumbbell rows; Single arm dumbbell rows                               | Dumbbell                                                                                  |
| hypertrophyPrimaryCompound   | 1     | 9.0   | Chest-supported overhand grip T-bar row | Chest-supported T-bar rows; Chest-supported machine rows              | Chest-supported T-bar row                                                                 |
| hypertrophyPrimaryCompound   | 1     | 9.0   | Overhand grip cable row                 | Seated cable rows                                                     | Seated cable row; Pin-loaded single cable machine; Pin-loaded cable crossover             |
| hypertrophyPrimaryCompound   | 1     | 8.0   | Chest-supported neutral grip T-bar row  | Chest-supported T-bar rows; Chest-supported neutral grip machine rows | Chest-supported T-bar row                                                                 |
| hypertrophySecondaryCompound | 1     | 10.0  | Bent-over barbell row                   | Barbell rows                                                          | Barbell and weight plates                                                                 |
| hypertrophySecondaryCompound | 1     | 10.0  | Single arm dumbbell row (elbow-in)      | Dumbbell rows; Single arm dumbbell rows                               | Dumbbell                                                                                  |
| hypertrophySecondaryCompound | 1     | 9.0   | Chest-supported overhand grip T-bar row | Chest-supported T-bar rows; Chest-supported machine rows              | Chest-supported T-bar row                                                                 |
| hypertrophySecondaryCompound | 1     | 9.0   | Overhand grip cable row                 | Seated cable rows                                                     | Seated cable row; Pin-loaded single cable machine; Pin-loaded cable crossover             |
| hypertrophySecondaryCompound | 1     | 8.0   | Chest-supported neutral grip T-bar row  | Chest-supported T-bar rows; Chest-supported neutral grip machine rows | Chest-supported T-bar row                                                                 |
| hypertrophyAccessory         | 1     | 9.0   | Cable face pull                         | Face pulls                                                            | Pin-loaded single cable machine; Pin-loaded cable crossover; Plate-loaded cable crossover |
| hypertrophyAccessory         | 1     | 6.0   | Pin-loaded row machine Kelso shrug      | Machine Kelso shrugs                                                  | Chest-supported pin-loaded row                                                            |
| hypertrophyAccessory         | 1     | 6.0   | T-bar Kelso shrug                       | Machine Kelso shrugs                                                  | Chest-supported T-bar row                                                                 |
| hypertrophyAccessory         | 1     | 6.0   | Wide grip cable row                     | Seated cable rows                                                     | Seated cable row; Pin-loaded single cable machine; Pin-loaded cable crossover             |
| hypertrophyAccessory         | 1     | 5.0   | Plate-loaded row machine Kelso shrug    | Machine Kelso shrugs                                                  | Chest-supported plate-loaded row                                                          |

#### Side Delts

| slot                         | level | boost | exercise                                         | exerciseGroup                                         | equipment groups (first 3)                                                                |
| ---------------------------- | ----- | ----- | ------------------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| strengthSecondaryCompound    | 3     | 6.0   | Standing barbell behind-the-neck overhead press  | Barbell overhead presses; Behind the neck presses     | Barbell and weight plates                                                                 |
| strengthSecondaryCompound    | 4     | 4.0   | Seated barbell behind-the-neck overhead press    | Barbell overhead presses; Behind the neck presses     | Barbell and weight plates                                                                 |
| strengthSecondaryCompound    | 4     | 4.0   | Wide grip barbell behind-the-neck overhead press | Barbell overhead presses; Behind the neck presses     | Barbell and weight plates                                                                 |
| strengthSecondaryCompound    | 4     | 3.0   | Bradford press                                   | Behind the neck presses                               | Barbell and weight plates                                                                 |
| strengthAccessory            | 1     | 9.0   | Seated dumbbell lateral raise                    | Dumbbell lateral raises                               | Dumbbells                                                                                 |
| strengthAccessory            | 1     | 9.0   | Standing dumbbell lateral raise                  | Dumbbell lateral raises                               | Dumbbells                                                                                 |
| strengthAccessory            | 1     | 7.0   | Single arm high cable lateral raise              | Single arm cable lateral raises; Cable lateral raises | Pin-loaded single cable machine; Pin-loaded cable crossover; Plate-loaded cable crossover |
| strengthAccessory            | 1     | 7.0   | Standing machine lateral raise                   | Machine lateral raises                                | Standing pin-loaded lateral raise; Standing multi flight                                  |
| strengthAccessory            | 1     | 6.0   | Dual cable lateral raise                         | Cable lateral raises                                  | Pin-loaded cable crossover; Plate-loaded cable crossover; Motorized dual cable machine    |
| hypertrophySecondaryCompound | 3     | 6.0   | Standing barbell behind-the-neck overhead press  | Barbell overhead presses; Behind the neck presses     | Barbell and weight plates                                                                 |
| hypertrophySecondaryCompound | 4     | 4.0   | Wide grip barbell behind-the-neck overhead press | Barbell overhead presses; Behind the neck presses     | Barbell and weight plates                                                                 |
| hypertrophySecondaryCompound | 4     | 3.0   | Bradford press                                   | Behind the neck presses                               | Barbell and weight plates                                                                 |
| hypertrophySecondaryCompound | 5     | 4.0   | Seated barbell behind-the-neck overhead press    | Barbell overhead presses; Behind the neck presses     | Barbell and weight plates                                                                 |
| hypertrophyAccessory         | 1     | 9.0   | Seated dumbbell lateral raise                    | Dumbbell lateral raises                               | Dumbbells                                                                                 |
| hypertrophyAccessory         | 1     | 9.0   | Standing dumbbell lateral raise                  | Dumbbell lateral raises                               | Dumbbells                                                                                 |
| hypertrophyAccessory         | 1     | 7.0   | Single arm high cable lateral raise              | Single arm cable lateral raises; Cable lateral raises | Pin-loaded single cable machine; Pin-loaded cable crossover; Plate-loaded cable crossover |
| hypertrophyAccessory         | 1     | 7.0   | Standing machine lateral raise                   | Machine lateral raises                                | Standing pin-loaded lateral raise; Standing multi flight                                  |
| hypertrophyAccessory         | 1     | 6.0   | Dual cable lateral raise                         | Cable lateral raises                                  | Pin-loaded cable crossover; Plate-loaded cable crossover; Motorized dual cable machine    |

#### Biceps

| slot                         | level | boost | exercise                                       | exerciseGroup                                         | equipment groups (first 3)                                                              |
| ---------------------------- | ----- | ----- | ---------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| strengthPrimaryCompound      | 1     | 9.0   | Overhand grip weighted pull-up                 | Overhand medium grip pull-ups; Overhand grip pull-ups | Pull-up belt and weight plates; Pull-up belt and kettlebell; Weighted vest              |
| strengthPrimaryCompound      | 1     | 9.0   | Weighted chin-up                               | Chin-ups; Weighted vertical pulls                     | Pull-up belt and weight plates; Pull-up belt and kettlebell; Weighted vest              |
| strengthPrimaryCompound      | 1     | 7.0   | Neutral grip weighted pull-up                  | Neutral grip pull-ups; Weighted vertical pulls        | Pull-up belt and weight plates; Pull-up belt and kettlebell; Weighted vest              |
| strengthPrimaryCompound      | 1.5   | 10.0  | Chin-up                                        | Chin-ups; Bodyweight vertical pulls                   | Bodyweight only                                                                         |
| strengthPrimaryCompound      | 1.5   | 10.0  | Overhand grip pull-up                          | Overhand medium grip pull-ups; Overhand grip pull-ups | Bodyweight only                                                                         |
| strengthSecondaryCompound    | 1     | 10.0  | Overhand grip cable lat pulldown               | Overhand grip lat pulldowns; Lat pulldowns            | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| strengthSecondaryCompound    | 1     | 9.0   | Overhand grip pin-loaded machine lat pulldown  | Overhand grip lat pulldowns; Lat pulldowns            | Pin-loaded fixed lat pulldown                                                           |
| strengthSecondaryCompound    | 1     | 8.0   | Neutral shoulder width grip cable lat pulldown | Neutral grip lat pulldowns; Lat pulldowns             | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| strengthSecondaryCompound    | 1     | 8.0   | Wide grip cable lat pulldown                   | Overhand grip lat pulldowns; Lat pulldowns            | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| strengthSecondaryCompound    | 1     | 7.0   | Neutral close grip cable lat pulldown          | Neutral grip lat pulldowns; Lat pulldowns             | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| strengthAccessory            | 1     | 10.0  | Overhand grip cable lat pulldown               | Overhand grip lat pulldowns; Lat pulldowns            | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| strengthAccessory            | 1     | 10.0  | Standing dumbbell biceps curl                  | Dumbbell biceps curls                                 | Dumbbells                                                                               |
| strengthAccessory            | 1     | 9.0   | Overhand grip pin-loaded machine lat pulldown  | Overhand grip lat pulldowns; Lat pulldowns            | Pin-loaded fixed lat pulldown                                                           |
| strengthAccessory            | 1     | 8.0   | EZ bar biceps curl                             | Bar biceps curls; EZ bar curls                        | EZ bar and weight plates; Fixed-weight EZ bar                                           |
| strengthAccessory            | 1     | 8.0   | Incline dumbbell biceps curl                   | Dumbbell biceps curls                                 | Dumbbells                                                                               |
| hypertrophyPrimaryCompound   | 1     | 10.0  | Overhand grip cable lat pulldown               | Overhand grip lat pulldowns; Lat pulldowns            | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| hypertrophyPrimaryCompound   | 1     | 9.0   | Overhand grip pin-loaded machine lat pulldown  | Overhand grip lat pulldowns; Lat pulldowns            | Pin-loaded fixed lat pulldown                                                           |
| hypertrophyPrimaryCompound   | 1     | 9.0   | Overhand grip weighted pull-up                 | Overhand medium grip pull-ups; Overhand grip pull-ups | Pull-up belt and weight plates; Pull-up belt and kettlebell; Weighted vest              |
| hypertrophyPrimaryCompound   | 1     | 9.0   | Weighted chin-up                               | Chin-ups; Weighted vertical pulls                     | Pull-up belt and weight plates; Pull-up belt and kettlebell; Weighted vest              |
| hypertrophyPrimaryCompound   | 1     | 8.0   | Wide grip cable lat pulldown                   | Overhand grip lat pulldowns; Lat pulldowns            | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| hypertrophySecondaryCompound | 1     | 10.0  | Overhand grip cable lat pulldown               | Overhand grip lat pulldowns; Lat pulldowns            | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| hypertrophySecondaryCompound | 1     | 9.0   | Overhand grip pin-loaded machine lat pulldown  | Overhand grip lat pulldowns; Lat pulldowns            | Pin-loaded fixed lat pulldown                                                           |
| hypertrophySecondaryCompound | 1     | 8.0   | Neutral shoulder width grip cable lat pulldown | Neutral grip lat pulldowns; Lat pulldowns             | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| hypertrophySecondaryCompound | 1     | 8.0   | Wide grip cable lat pulldown                   | Overhand grip lat pulldowns; Lat pulldowns            | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| hypertrophySecondaryCompound | 1     | 7.0   | Neutral close grip cable lat pulldown          | Neutral grip lat pulldowns; Lat pulldowns             | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| hypertrophyAccessory         | 1     | 10.0  | Overhand grip cable lat pulldown               | Overhand grip lat pulldowns; Lat pulldowns            | Pin-loaded cable lat pulldown; Plate-loaded cable lat pulldown; Dual cable lat pulldown |
| hypertrophyAccessory         | 1     | 10.0  | Standing dumbbell biceps curl                  | Dumbbell biceps curls                                 | Dumbbells                                                                               |
| hypertrophyAccessory         | 1     | 9.0   | Overhand grip pin-loaded machine lat pulldown  | Overhand grip lat pulldowns; Lat pulldowns            | Pin-loaded fixed lat pulldown                                                           |
| hypertrophyAccessory         | 1     | 8.0   | EZ bar biceps curl                             | Bar biceps curls; EZ bar curls                        | EZ bar and weight plates; Fixed-weight EZ bar                                           |
| hypertrophyAccessory         | 1     | 8.0   | Incline dumbbell biceps curl                   | Dumbbell biceps curls                                 | Dumbbells                                                                               |

#### Triceps

| slot                         | level | boost | exercise                                      | exerciseGroup                                                               | equipment groups (first 3)                                                                |
| ---------------------------- | ----- | ----- | --------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| strengthPrimaryCompound      | 1     | 9.0   | Close grip bench press                        | Flat barbell bench presses; Barbell bench presses                           | Barbell and weight plates                                                                 |
| strengthPrimaryCompound      | 2     | 7.0   | Close grip Smith machine bench press          | Smith machine bench presses                                                 | Smith machine and weight plates; Pin-loaded Smith machine functional trainer              |
| strengthSecondaryCompound    | 1     | 7.0   | 45° incline close grip press                  | Barbell bench presses; 45° incline barbell presses                          | Barbell and weight plates                                                                 |
| strengthSecondaryCompound    | 1     | 5.0   | Pause close grip bench press                  | Flat barbell bench presses; Barbell bench presses                           | Barbell and weight plates                                                                 |
| strengthSecondaryCompound    | 2     | 7.0   | Close grip Smith machine bench press          | Smith machine bench presses                                                 | Smith machine and weight plates; Pin-loaded Smith machine functional trainer              |
| strengthSecondaryCompound    | 3     | 5.0   | Weighted triceps dip                          | Triceps dips; Weighted dips                                                 | Dip belt and weight plates; Dip belt and kettlebell; Weighted vest                        |
| strengthSecondaryCompound    | 3     | 3.0   | Pause triceps dip                             | Triceps dips; Bodyweight dips                                               | Bodyweight only                                                                           |
| strengthAccessory            | 1     | 10.0  | Cable straight bar overhead triceps extension | Cable straight bar overhead triceps extensions; Overhead triceps extensions | Pin-loaded single cable machine; Pin-loaded cable crossover; Plate-loaded cable crossover |
| strengthAccessory            | 1     | 8.0   | Cable rope overhead triceps extension         | Cable rope overhead triceps extensions; Overhead triceps extensions         | Pin-loaded single cable machine; Pin-loaded cable crossover; Plate-loaded cable crossover |
| strengthAccessory            | 1     | 8.0   | EZ bar skull crusher                          | Lying triceps extensions; Lying bar triceps extensions                      | EZ bar and weight plates; Fixed-weight EZ bar                                             |
| strengthAccessory            | 1     | 8.0   | Standing EZ bar overhead triceps extension    | Overhead triceps extensions                                                 | EZ bar and weight plates; Fixed-weight EZ bar                                             |
| strengthAccessory            | 1     | 4.0   | Pin-loaded machine overhead triceps extension | Machine overhead triceps extensions; Overhead triceps extensions            | Pin-loaded overhead triceps extension                                                     |
| hypertrophyPrimaryCompound   | 1     | 9.0   | Close grip bench press                        | Flat barbell bench presses; Barbell bench presses                           | Barbell and weight plates                                                                 |
| hypertrophyPrimaryCompound   | 2     | 7.0   | Close grip Smith machine bench press          | Smith machine bench presses                                                 | Smith machine and weight plates; Pin-loaded Smith machine functional trainer              |
| hypertrophySecondaryCompound | 1     | 7.0   | 45° incline close grip press                  | Barbell bench presses; 45° incline barbell presses                          | Barbell and weight plates                                                                 |
| hypertrophySecondaryCompound | 2     | 7.0   | Close grip Smith machine bench press          | Smith machine bench presses                                                 | Smith machine and weight plates; Pin-loaded Smith machine functional trainer              |
| hypertrophySecondaryCompound | 2     | 5.0   | Pause close grip bench press                  | Flat barbell bench presses; Barbell bench presses                           | Barbell and weight plates                                                                 |
| hypertrophySecondaryCompound | 3     | 5.0   | Weighted triceps dip                          | Triceps dips; Weighted dips                                                 | Dip belt and weight plates; Dip belt and kettlebell; Weighted vest                        |
| hypertrophySecondaryCompound | 3     | 3.0   | Pause triceps dip                             | Triceps dips; Bodyweight dips                                               | Bodyweight only                                                                           |
| hypertrophyAccessory         | 1     | 10.0  | Cable straight bar overhead triceps extension | Cable straight bar overhead triceps extensions; Overhead triceps extensions | Pin-loaded single cable machine; Pin-loaded cable crossover; Plate-loaded cable crossover |
| hypertrophyAccessory         | 1     | 8.0   | Cable rope overhead triceps extension         | Cable rope overhead triceps extensions; Overhead triceps extensions         | Pin-loaded single cable machine; Pin-loaded cable crossover; Plate-loaded cable crossover |
| hypertrophyAccessory         | 1     | 8.0   | EZ bar skull crusher                          | Lying triceps extensions; Lying bar triceps extensions                      | EZ bar and weight plates; Fixed-weight EZ bar                                             |
| hypertrophyAccessory         | 1     | 8.0   | Standing EZ bar overhead triceps extension    | Overhead triceps extensions                                                 | EZ bar and weight plates; Fixed-weight EZ bar                                             |
| hypertrophyAccessory         | 1     | 4.0   | Pin-loaded machine overhead triceps extension | Machine overhead triceps extensions; Overhead triceps extensions            | Pin-loaded overhead triceps extension                                                     |

#### Calves

| slot                 | level | boost | exercise                                 | exerciseGroup                                      | equipment groups (first 3)       |
| -------------------- | ----- | ----- | ---------------------------------------- | -------------------------------------------------- | -------------------------------- |
| strengthAccessory    | 1     | 9.0   | Standing machine calf raise              | Standing machine calf raises; Standing calf raises | Standing pin-loaded calf raise   |
| strengthAccessory    | 1     | 8.0   | 45° leg press calf raise                 | Leg press calf raises; Machine calf raises         | 45° leg press                    |
| strengthAccessory    | 1     | 8.0   | Pin-loaded leg press calf raise          | Leg press calf raises; Machine calf raises         | Pin-loaded leg press             |
| strengthAccessory    | 1     | 8.0   | Standing plate-loaded machine calf raise | Standing machine calf raises; Standing calf raises | Standing plate-loaded calf raise |
| strengthAccessory    | 1     | 6.0   | Pin-loaded machine donkey calf raise     | Donkey calf raises; Machine calf raises            | Pin-loaded donkey calf raise     |
| hypertrophyAccessory | 1     | 9.0   | Standing machine calf raise              | Standing machine calf raises; Standing calf raises | Standing pin-loaded calf raise   |
| hypertrophyAccessory | 1     | 8.0   | 45° leg press calf raise                 | Leg press calf raises; Machine calf raises         | 45° leg press                    |
| hypertrophyAccessory | 1     | 8.0   | Pin-loaded leg press calf raise          | Leg press calf raises; Machine calf raises         | Pin-loaded leg press             |
| hypertrophyAccessory | 1     | 8.0   | Standing plate-loaded machine calf raise | Standing machine calf raises; Standing calf raises | Standing plate-loaded calf raise |
| hypertrophyAccessory | 1     | 6.0   | Pin-loaded machine donkey calf raise     | Donkey calf raises; Machine calf raises            | Pin-loaded donkey calf raise     |

#### Abs

| slot                 | level | boost | exercise                                   | exerciseGroup              | equipment groups (first 3)                                                                |
| -------------------- | ----- | ----- | ------------------------------------------ | -------------------------- | ----------------------------------------------------------------------------------------- |
| strengthAccessory    | 1     | 8.0   | Kneeling cable crunch                      | Cable crunches             | Pin-loaded single cable machine; Pin-loaded cable crossover; Plate-loaded cable crossover |
| strengthAccessory    | 1     | 7.0   | Decline weighted sit-up                    | Weighted sit-ups; Sit-ups  | Weight plate; Kettlebell; Dumbbell                                                        |
| strengthAccessory    | 1     | 7.0   | Hanging straight leg raise                 | Hanging leg raises         | Bodyweight only                                                                           |
| strengthAccessory    | 1     | 5.0   | Ab coaster exercise                        |                            | Ab coaster machine                                                                        |
| strengthAccessory    | 1     | 5.0   | Captain’s chair straight leg raise         | Captain’s chair leg raises | Bodyweight only                                                                           |
| hypertrophyAccessory | 1     | 8.0   | Kneeling cable crunch                      | Cable crunches             | Pin-loaded single cable machine; Pin-loaded cable crossover; Plate-loaded cable crossover |
| hypertrophyAccessory | 1     | 7.0   | Decline weighted sit-up                    | Weighted sit-ups; Sit-ups  | Weight plate; Kettlebell; Dumbbell                                                        |
| hypertrophyAccessory | 1     | 7.0   | Hanging straight leg raise                 | Hanging leg raises         | Bodyweight only                                                                           |
| hypertrophyAccessory | 1     | 6.0   | Pin-loaded machine crunch (with chest pad) | Machine crunches           | Pin-loaded crunch (with chest pad)                                                        |
| hypertrophyAccessory | 1     | 5.0   | Ab coaster exercise                        |                            | Ab coaster machine                                                                        |

<!-- GENERATED:END -->
