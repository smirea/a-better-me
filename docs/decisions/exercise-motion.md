# Exercise motion

The catalog's exercises come with instructions and two or three still frames, and the videos can't be had ([Workouts](workouts.md#exercise-catalog-source)). `exercise-motion/` generates the missing animation: a replayable 3D rep per exercise, with the muscles and tendons it loads at each frame and a list of anything a person couldn't or wouldn't do. It is a Bun and three.js tool outside the shipped apps. Nothing in the iOS app plays its output yet.

## Scope & Architecture (Updated 2026-11-25)

- **The figure is MakeHuman's CC0 body, fitted directly to a 47-DOF anatomical rig.** MakeHuman ships a production base mesh, body-shape targets, and skin weights as CC0, so the lifter is its young adult male at maximum muscle with regional muscle targets added on top. `scripts/figure-asset.ts` builds `viewer/assets/lifter.bin` and `viewer/assets/muscle-map.png` offline from a pinned MakeHuman commit, and the output is committed.
  - **Feet & metatarsal toe-break (`toes_L/R`):** Two metatarsophalangeal hinge joints (`ext` −35° to 75°, tilted along the 1st–5th metatarsal axis) bring the rig from 45 to 47 DOFs. MakeHuman's toe bones skin to `toes_L/R`, the foot collider splits into hindfoot + toes (with `Collider.contactAs = "foot_L/R"` so toes share footplate/floor contact allowances), and standing sole contact sits at −0.1 mm (hip height 0.9475 m). Biomechanics shifts floor reaction onto the toes when the heel rises.
  - **Hands & skin-tested grips (`HandRig`):** Wrist and forearm bind frames are fitted directly to MakeHuman's palm mesh so neutral pronation and grip anchors match the visible palm. `HandRig` in `viewer/figure.ts` closes fingers in anatomical flexion synergy and solves a 3-DOF opposing thumb against actual skinned surface vertices (`<= 2.7 mm` press, 330° bar wrap, radius-adaptive from 28–50 mm, per-hand independent `HandGripConfig` presets: `bar`, `press`, `neutral`, `hook`, `open`, `flat-floor`, `ball-stop`, `pinch`, `fist`, `relaxed`).
  - **Shoulders & wrists:** `makePose` adds automatic scapulohumeral collarbone elevation/protraction above 90° arm elevation to keep overhead armpit skin clean, and wrist extension extends to 85° for floor push-ups and front racks.
  - **Skinning & muscle map:** Optimized centre-of-rotation skinning (Le & Hodgins, 2016) over 107k triangles with carved 3.5 mm grooves between muscle plates from the app's body map.
- **Single-instance canonical machine & prop library (`src/machines/`, `models/machines/`):**
  - The 350 raw equipment labels across all 1,345 catalog exercises cluster into 68 canonical equipment IDs (`src/machines/catalog-clusters.json`, `docs/machine-catalog.md`).
  - 42 deterministic Blender-built GLBs (21 canonical machines + 21 free-weight/cable/bodyweight props, 4.4 MB total) cover 1,012 / 1,345 exercises (75.2%) with zero per-exercise GLB duplication.
  - Scenes pick canonical machines via `composeExercise()` (`src/scene.ts`) and configure their state (incline angle, pulley height, hook/safety height, or per-frame `drive` for sleds/levers/stacks/swivels). Animated machine nodes with colliders automatically emit hidden moving collider props synchronized frame-by-frame with the GLB node.
  - **Semantic material skinning (`src/contracts.ts`, `src/skin.ts`, `src/machines/skins.json`):** Every mesh primitive uses exclusively the 10 canonical semantic material names (`mat_frame`, `mat_pad`, `mat_chrome`, `mat_grip`, `mat_plate`, `mat_stack`, `mat_accent`, `mat_cable`, `mat_rubber`, `mat_wood`) with no baked textures, enabling instant runtime color-theme swapping across machines, props, and dynamic cable tethers without editing meshes.
- **Pure white stage default:** Both the live viewer (`viewer/settings.ts`) and headless 3D renderer (`scripts/render-3d.ts`) default to `studio-light` (`#ffffff` pure white backdrop with seamless floor shadow catcher).

## How a rep is made

- **An exercise is a spec composed on canonical machines (`src/exercises/`).** Using `composeExercise()` (`src/scene.ts`), it picks 0, 1, or N canonical machines from `src/machines/`, declares body contacts using first-principles solver primitives (`plantFootFlat`, `plantFootOnToeBreak`, `plantFootOnEdge`, `holdHandle`, `gripBar`, `braceHandOnSurface`, `palmOnFloor`, `restBackOnPad`, `sitOnSeat`), specifies rough start/end joint hints and key-pose conditions, declares loads, support, per-hand `grips`, and instruction-quoted form checks.
- **Poses are solved, not hand-keyframed** (`solver.ts`). Levenberg-Marquardt finds the pose nearest a reference that meets goals, stays inside joint limits, and clears self- and equipment-colliders.
- **The rep is the weight's path between the key poses** (33 samples, minimum-jerk timing at 30 fps, Catmull-Rom interpolation), with symmetric locking for bilateral lifts.
- **The output is a `Sequence`**: plain JSON with one 47-DOF pose per frame, prop states, GLB refs and articulated node poses (`glbStates`), tether polylines, equipment colliders, and load attachments.

## Muscles, tendons, and validation

- **Engagement & tendons (`biomech.ts`):** Static optimization over inverse dynamics with antagonist co-contraction, core bracing, first-order activation dynamics, and passive stretch/tendon strain (Millard et al., 2013). Supports gravity, cable pulley vectors (`pulley`), fixed directions (`direction`), and closed-chain bodyweight shares (`bodyweightShare`).
- **Two-layer validation (`validate.ts` + `glb-collision.ts`):**
  - Parametric motion & load validation (`validateMotion`, `validateLoad`): joint limits, self-collision, equipment clipping (respecting `Collider.contactAs`), floor sinking, cable-vs-body clipping (`cable-clip`), contact gaps/sliding (supporting both static equipment and animated machine nodes), velocity/jerk/loop continuity, asymmetry, balance, strength overload, and overstretch.
  - Real 3D GLB mesh BVH validation (`validateGlbMotion`): parses the actual GLB meshes headlessly in Bun (`@gltf-transform/core`), transforms every static/animated node and GLB prop per frame, and flags body-vs-GLB-triangle clipping (`glb-clip`), cable-vs-GLB-frame clipping (`cable-clip`), and required contacts floating away from actual GLB surfaces.
- **Visual QA (`scripts/render-3d.ts --closeups`):** Renders multi-view 3D stills plus dedicated hand-grip and foot-contact close-ups on pure white in headless Chrome WebGL.

## What it defers

- **Playing a rep in the iOS app.** The `Sequence` format is renderer-neutral so SceneKit/RealityKit can replay it; muscle tinting would need a Swift port or baked values per weight.
- **Remaining Tier-2 catalog machines (325 exercises).** Listed in `exercise-motion/docs/machine-catalog.md` for future additions to `scripts/machines/`.
- **Setup and unracking.** A rep loops from the start position; walking in, unracking, and reracking aren't animated.
- **Body proportions.** One 1.78 m, 80 kg lifter. `createBody` scales by height, and nothing varies limb ratios.
