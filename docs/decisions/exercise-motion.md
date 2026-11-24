# Exercise motion

The catalog's exercises come with instructions and two or three still frames, and the videos can't be had ([Workouts](workouts.md#exercise-catalog-source)). `exercise-motion/` generates the missing animation: a replayable 3D rep per exercise, with the muscles and tendons it loads at each frame and a list of anything a person couldn't or wouldn't do. It is a Bun and three.js tool outside the shipped apps. Nothing in the iOS app plays its output yet.

## Scope

- **Three exercises are the test bed** (owner's ask, 2026-11-24): Smith Machine Back Squat (a machine), Dumbbell Romanian Deadlift (free weights, balance), and Barbell Bench Press (lying, a bench and rack). The system is built to cover the catalog's other exercises one spec at a time; none are written yet.
- **The figure follows the app's body map.** A procedural mesh uses the collision capsules as a guide for an athletic build, with a broad rib cage, rounded shoulders, and shaped feet. Dual-quaternion skinning blends the chest, collarbone, and upper arm at each shoulder. The muscle atlas spans the pelvis-to-thigh join so each glute plate stays continuous as the hip bends. Rounded plate relief and recessed gaps make the same 23 groups per side as `Muscle` visible at rest. Plates fill with `Theme.muscle` blue as the muscle works, or orange as it lengthens. The hands curl around the grip or press anchor.

## How a rep is made

- **An exercise is a spec, not keyframes** (`src/exercises/`). It states the contacts that hold all rep as solver goals, two key poses as rough joint-angle hints plus the condition that defines each (thighs parallel, the bar on the lower sternum, hamstrings at 85% of their range), where the weight bears, what carries the body, and form checks that quote the instruction they measure.
- **Poses are solved, not drawn** (`solver.ts`). Levenberg-Marquardt finds the pose nearest a reference that meets the goals, keeps every joint inside its range of motion, and keeps the body's capsules out of each other and the equipment. Equipment is placed from the solved poses, as the instructions place it: safety stops just under the bar's lowest point, J-hooks 5 cm under lockout, the rack at the lifter's mouth.
- **The rep is the weight's path between the key poses.** Each of 33 samples along that path starts from the blend of the two key poses that puts the weight there, moved back onto its planted contact. Starting from the neighbouring sample or the blend at the same fraction both failed: a squat has a second way to lower the bar (hips forward), and the solver took it.
- **Timing is a minimum-jerk profile per phase**, the velocity curve of human reaching: lower, pause, lift, pause, at 30 frames a second.
- **A two-sided lift is held symmetric** by a solver goal. Without it the arms settled on different elbow positions.
- **The output is a `Sequence`**: plain JSON with one pose per frame (45 degrees of freedom), prop positions, equipment shapes, and where the load bears. Replaying or analysing it needs no solver.

## Muscles and tendons

- **Engagement is static optimisation over inverse dynamics** (`biomech.ts`). Each frame's joint torques come from gravity and each mass's acceleration under the chosen weight, then are shared among the muscle groups that can produce them with the least total squared activation. Engagement reads as a share of the group's peak torque, so it changes with the weight, live in the viewer.
- **The floor and the machine are part of it.** A free-standing lifter's centre of pressure falls where the moments balance. On a Smith machine it stays under mid-foot and the rails take the horizontal remainder, which is why that squat loads the hips and back more than its bar weight suggests. With both feet down, friction is solved to leave the hips the least sideways and twisting torque.
- **Stretch and tendon load.** A muscle-tendon unit's length is its moment arms times the joint angles, read as 0 at standing length and 1 at the end of the joint's passive range. Tendon load is activation plus the passive tension of a stretch, as a share of peak muscle force, shown as strain at 4.9% per unit (Millard et al., 2013).
- **It is a first-order model, and says so.** Capacities are peak torques for a trained 80 kg lifter (`muscles.ts`), with fixed moment arms except where a comment says otherwise, no muscle wrapping, no rotational inertia, and no strength curve. Two-joint coupling is kept only in the plane of the lift (hamstrings, quads, calves, biceps, triceps). It ranks muscles well enough to match the catalog on the squat and the bench press; on the deadlift it puts the lats and front delts above the hamstrings, because holding dumbbells against the legs costs the model shoulder torque that a lifter avoids by letting the arms hang.

## Flags

- **Motion flags** (`validateMotion`): a joint past its range, the body through itself, the body through equipment beyond what a contact allows, anything under the floor, a required contact lost or sliding, a joint moving faster than a controlled rep, a pop between frames, a left and right side that differ, and a loop that doesn't close.
- **Load flags** (`validateLoad`): the centre of pressure outside the feet, a joint asked for more torque than its muscles have, a muscle past its end range, a tendon loaded past peak muscle force.
- **Form checks** come from the exercise's own instructions, each quoting the sentence it measures.
- **The detectors are tested by breaking reps on purpose** (`faults.ts`): a rounded back, a bar pushed through the chest, missing frames, a jitter too small to count as a pop, hyperextended knees, too much weight. The build fails when one goes uncaught, since a clean rep only means something if a broken one fails.

## Evaluation (2026-11-24)

All three reps generate in under 0.2 s each with no flags, and pass every instruction check (11, 12, and 13). All 11 fault tests are caught. Against the catalog: the squat's four listed muscles and the bench press's three are exactly the model's most engaged; the deadlift has four of six. Of the muscles the catalog marks as stretched, the model stretches eight of nine past 40% of their range.

## What it defers

- **Playing a rep in the app.** The `Sequence` format is renderer-neutral so SceneKit or RealityKit can replay it, and the muscle model would need a Swift port or baked values per weight.
- **Setup and unracking.** A rep loops from the start position; walking in, unracking, and reracking aren't animated.
- **Effort as the solver's objective.** Poses follow the instructions' cues and the reference blend. Choosing among valid poses by least muscle effort would remove most hand-given hints.
- **Body proportions.** One 1.78 m, 80 kg lifter. `createBody` scales by height, and nothing varies limb ratios.
