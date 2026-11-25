# Canonical machine catalog

One GLB per kind of machine, shared by every exercise that uses it, with articulated nodes for the parts that move or adjust. Exercises pick a machine, set its state (backrest angle, hook height, sled travel), and attach the lifter to its surfaces, handles, and pulleys. They never ship their own copy.

## Clustering the catalog

The catalog's 1,345 exercises name 350 distinct equipment labels: 236 resistance labels and 114 support labels. Each list holds alternatives (any one will do), and a support label can itself be a combo ("Adjustable bench, squat stand, and plyometric box"). Most labels are vendor or loading variants of the same thing: `Pin-loaded cable crossover`, `Plate-loaded functional trainer`, `Motorized dual cable machine`, and `Pin-loaded Smith machine functional trainer` are all two cable columns with adjustable pulleys.

`src/machines/equipment-map.ts` collapses them with ordered rules (first match wins), and `scripts/machines/cluster-catalog.ts` resolves every exercise to its best-covered option. It writes `src/machines/catalog-clusters.json` (exercise id to machines, props, tier, the option it chose, and what is still missing) and fails on any label that no rule claims.

| | Count |
|---|---|
| Raw equipment labels | **350** (236 resistance + 114 support) |
| Canonical ids they collapse to | **68** |
| Built (GLB + factory, or drawn by the engine) | **33**: 21 machines, 11 prop families (bars, plates, dumbbell, kettlebell, cable attachments, balls, ab wheel), band tethers |
| Tier 1: every piece built | **1,012 exercises (75.2%)** |
| Tier 2: needs one canonical not yet modelled | 325 (24.2%) |
| Tier 3: out of scope (cardio, pool, partner) | 8 (0.6%) |

Tier 1 by catalog category: free weights 523/552 (94.7%), bodyweight 242/274 (88.3%), machines 230/500 (46.0%). Two Tier-1 exercises are substitutes: a couch, chair, or bed drawn as the bench, and a staircase drawn as the step.

### The largest collapses

| Canonical | Raw labels it absorbs (examples) |
|---|---|
| `prop-plates` | 41 labels: every "… and weight plates" loading |
| `power-rack` | 33: power rack, half rack, squat stand, and every "bench and rack/stand" combo |
| `adjustable-bench` | 32: flat, adjustable, seated, hip-thrust bench, flat bench station, and their combos |
| `aerobic-step` | 12: steps, deadlift blocks, calf block, staircase |
| `landmine` | 10: landmine attachment or wall corner and its combos, jammer |
| `dual-adjustable-pulley` | 9: crossovers, functional trainers, dual handle towers, motorized dual cable, total quad/hip |
| `plyo-box` | 9: plyo boxes, squat boxes, and their rack/stand combos |
| `lat-pulldown` | 7: pin, plate, cable, dual-cable, fixed, and front pulldowns |
| `single-cable-tower` | 6: single cable machines, digital trainer, high/low and high pulley systems, pulldown/row rack attachment |
| `chest-press-machine` | 6: horizontal and seated, pin and plate, wide chest press |

### What would raise coverage next (Tier 2, exercises unblocked)

`arm-machine` 31 (selectorized curl, triceps, lateral raise, pullover), `row-machine` 25 (chest-supported and plate-loaded rows, seal row), `press-machine` 21 (shoulder, incline, decline, seated dip), `prop-small-tools` 11, `hack-squat` 18, `calf-raise-machine` 18, `multi-hip` 18, `hip-abductor-adductor` 16, `pec-deck` 15, `assisted-dip-chin` 14, `prop-specialty-bar` 13 (cambered, swiss, log, farmer's handles), `seated-leg-press` 13. The first three alone would put Tier 1 near 81%.

## Built library

`models/machines/<id>.glb`, built by `scripts/machines/` and served by `serve.ts` as `/gym-models/machines/<id>.glb`.

| Machine | Size W × H × D (m) | Tris | Articulated nodes |
|---|---|---|---|
| `adjustable-bench` | 0.59 × 0.45 × 1.38 | 4,236 | `backrest` (0–85°), `back_strut` (closes onto the ladder), `seat` (0–20°) |
| `power-rack` | 1.39 × 2.30 × 1.41 | 7,164 | `jhook_L/R`, `safety_L/R` (slide on the uprights), `pullup_bar` |
| `olympic-incline-bench` | 1.25 × 1.53 × 1.23 | 4,812 | `jhook_L/R` (upper cradles; lower cradles fixed) |
| `decline-bench` | 1.21 × 1.27 × 1.61 | 4,824 | `jhook_L/R` |
| `dual-adjustable-pulley` | 2.00 × 2.29 × 0.87 | 13,752 | `carriage_L/R` (height), `pulley_L/R` (swivel), `stack_L/R`, `pullup_bar` |
| `single-cable-tower` | 0.69 × 2.29 × 0.87 | 7,188 | `carriage`, `pulley`, `stack` |
| `lat-pulldown` | 0.59 × 2.21 × 1.34 | 8,128 | `thigh_pad` (height), `stack` |
| `seated-cable-row` | 0.63 × 1.66 × 1.89 | 7,496 | `stack` |
| `smith-machine` | 2.00 × 2.25 × 1.33 | 9,052 | `carriage` (bar on the rails), `safety_L/R` |
| `leg-press-45` | 1.22 × 1.31 × 2.14 | 6,512 | `sled` (0–0.62 m along the 45° rails) |
| `leg-extension` | 0.68 × 1.56 × 1.48 | 8,588 | `lever_arm` (knee axis), `stack` |
| `seated-leg-curl` | 0.68 × 1.56 × 1.59 | 8,632 | `lever_arm` (knee axis), `stack` |
| `chest-press-machine` | 0.77 × 1.96 × 1.41 | 8,632 | `arm_L/R` (overhead pivots), `stack` |
| `dip-pullup-station` | 1.24 × 2.29 × 1.41 | 4,940 | `pullup_bar` |
| `preacher-bench` | 0.71 × 0.95 × 1.14 | 3,192 | — |
| `back-extension-bench` | 0.75 × 0.74 × 1.64 | 3,840 | `hip_pad` (slides along the 45° body line) |
| `ghd` | 0.71 × 1.29 × 1.79 | 3,992 | `foot_carriage` (slides along Z) |
| `landmine` | 0.56 × 0.15 × 0.59 | 1,108 | `yaw` → `sleeve` (aims at the bar end) |
| `plyo-box` | 0.76 × 0.51 × 0.61 | 996 | — (rests on any face: 0.51, 0.61, 0.76 m) |
| `aerobic-step` | 0.92 × 0.15 × 0.38 | 888 | — |
| `slant-board` | 0.46 × 0.23 × 0.50 | 656 | — |

Props: `prop-barbell` (20 kg Olympic), `prop-plate-25/20/15/10/5/2_5/1_25` (the same sizes as `platesFor`), `prop-ez-bar`, `prop-trap-bar`, `prop-safety-squat-bar`, `prop-axle-bar`, `prop-dumbbell` (hex, 22.5 kg), `prop-kettlebell` (16 kg), `prop-d-handle`, `prop-lat-bar`, `prop-v-bar`, `prop-rope`, `prop-medicine-ball`, `prop-stability-ball`, `prop-ab-wheel`. Bands have no GLB: the engine draws them as `band` tethers.

All 42 GLBs together are 4.4 MB, none over 14k triangles.

## Design

- **Built from first principles, not cleaned vendor meshes.** The 283 debranded commercial GLBs are a third-party catalog kept out of git (`dist/`, `.cache/`), and a build that reads them would not run from this repo. Every canonical is authored in Blender from primitives (beveled tubes, rounded pads, revolved plates and sheaves, swept bars) by `scripts/machines/`. The vendor models served as size references: the dual pulley, power rack, Smith machine, and leg press land within a few centimetres of their footprints. Owning the geometry is also what makes the interaction areas exact: handles are 28–33 mm, pads stop where a 1.78 m lifter's head and back need them, and nothing is baked in (no bars on the racks, no handles on the cables).
- **One measurement source.** The build writes `src/machines/anchors.json` from the same calls that create the meshes: every collider, pad surface, footplate, handle, pulley exit, rail, pivot, and hook, each tagged with the node that carries it. The TypeScript factories only read it, so a collider cannot drift from its mesh. `verify-machines.ts` checks that each GLB's bounds and triangle count match the JSON.
- **Conventions.** glTF meters, +Y up, floor at y = 0 (±1 mm), centered on x = 0, and the lifter at the primary station faces +Z (their left is +X), so a figure needs no yaw to use a machine. Each machine's `facing` note says where the lifter is. The leg extension and leg curl carry the lever on the lifter's right; for them x = 0 is the lifter's midline, not the bounding box's center. No quantization or compression extensions: plain glTF 2.0 binary.
- **Articulation.** Every moving or adjustable part is an empty node at its hinge or slide reference, with identity rotation, its meshes parented under it. A `GlbNodePose` of `rotOffset: [a, 0, 0]` turns it about world X; `posOffset` slides it. The backrest strut is a child of the backrest whose angle the factory solves so its foot lands on the ladder at every incline. Swivel pulleys are children of their carriages.
- **Semantic materials.** Every primitive uses one of the ten `SEMANTIC_MATERIALS` names and nothing else: no textures, images, or vendor names. Recoloring a machine is a lookup by material name. `src/machines/skins.json` holds three palettes (studio charcoal, the baked default; arctic white; heritage red), read by both the Blender build and `skins.ts`.
- **Factories** (`src/machines/<id>.ts`, registry in `index.ts`) take a typed state plus placement (`pos`, `yawDeg`, `idPrefix`) and return a `CanonicalMachineInstance`: the GLB ref with `hideEquipment`, colliders and every anchor transformed to that state, default contact allowances keyed by part prefix, and `glbState`. `at(state)` gives the same machine at another state (a rep's start and end). A `drive` callback, or the helpers built on it, animates nodes per frame: the dual pulley's swivels track the handles and its stacks lift with cable payout (`stackLift`, ratio 0.5), the lat pulldown and row stacks follow their attachment, the landmine sleeve aims at the bar end, and the lever machines lift their stacks with the lever angle.
- **Free weights** (`free-weights.ts`): `loadedBar` puts the canonical bar plus `platesFor` plates on its sleeves as GLB props sharing one state, with every collider on the bar prop; dumbbells and kettlebells carry their colliders for the load while the mesh stays one size; cable attachments expose their cable eye for tethers.

## Commands

- `blender -b --factory-startup -P exercise-motion/scripts/machines/build_machines.py [-- --only id,id]` rebuilds the GLBs and `anchors.json` in about 2 s. Output is byte-identical across runs on the same Blender (5.3).
- `blender -b --factory-startup -P exercise-motion/scripts/machines/render_sheets.py [-- --only id,id] [--out DIR]` re-imports each GLB and renders contact sheets on white to `/tmp/motion-inspect/`: `machines-<id>.png` (angle, back-angle, front, side, top, and an articulated rig pose), `machines-overview.png`, `machines-rig.png`, `machines-props.png`, and `machines-skin-test.png` (four machines in three palettes, recolored by material name only). About 2 minutes on the GPU.
- `exercise-motion/scripts/verify-machines.ts` checks every GLB (semantic materials only, no textures or extensions, floor and centering, expected nodes, size and polycount, bounds against anchors, colliders inside the mesh) and builds every factory across representative states.
- `exercise-motion/scripts/machines/cluster-catalog.ts [--stats]` regenerates `catalog-clusters.json` and prints coverage.

## Limits

- The dumbbell and kettlebell mesh is one size (22.5 kg and 16 kg); colliders follow the load.
- The chest press uses overhead pendulum arms, which gives a flat horizontal press path. Converging plate-loaded presses that pivot low behind the seat are a separate Tier-2 `press-machine`.
- The aerobic step is fixed at 0.15 m. The plyo box changes height by resting on another face, not by scaling.
- Static cable runs inside the columns are fixed geometry; the working cable from pulley exit to attachment is the exercise's tether.
