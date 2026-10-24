# MF Workouts App binary strings

Literal strings from MF Workouts v1.4.1's compiled Dart snapshot (`Runner.app/Wrapper/Runner.app/Frameworks/App.framework/App`), grouped by topic.
Extract them with `python3 -I tools/app-strings.py > /tmp/mf-strings.txt`.
The snapshot's string pool is not ordered by screen, so the grouping and every "probably" note here is inference. The strings themselves are verbatim.
Strings that end with a trailing space are the first half of an interpolation, and the app appends a value.
The pool also holds German copies of most strings. They are left out here.
The extractor sometimes attaches a stray byte pair such as `²â` to a string. That is snapshot data, not part of the copy, and it is removed here.

## Exercise Assessment

- Exercise Assessment
- A questionnaire about your experience with foundational movements that determines access to advanced exercises
- A few questions about your experience with the following exercises
- Can you bench press a barbell for at least 10 reps?
- Can you incline press a barbell for at least 10 reps?
- Can you overhead press (shoulder press) a barbell for at least 10 reps?
- Can you do at least 5 strict, unassisted pull-ups or chin-ups?
- Can you do at least 10 strict, unassisted pull-ups or chin-ups?
- Can you do at least 15 strict, bodyweight push-ups?
- Can you perform at least 10 body weight dips?

These are the only "Can you" questions in the binary. Their answers probably satisfy the bundle's `preconditions` entries; see [`smart-generation-fields.md`](smart-generation-fields.md).

## New Program wizard and Smart Generation

- How would you like to create your program?
- Use Smart Generation
- We will create a personalized training program tailored to your goals. Or, you can import or build your own.
- We will create a custom plan tailored to your goals, fitness level, and gym equipment
- Start with a fully blank slate and no guidance
- What is your primary goal?
- Muscle Hypertrophy
- Muscle Strength
- Both Strength & Hypertrophy
- Workouts will focus on increasing muscle size using moderate weights and reps.
- Workouts will focus on increasing maximal strength using heavier weights for fewer reps.
- What is your experience level with lifting?
- Lifting Experience
- Beginner
- Intermediate
- Advanced
- What is your experience level with cardio?
- Cardio Experience
- How many times per week would you like to train?
- times per week
- How much time would you like to budget per session?
- Up to 20 minutes
- 20 to 40 minutes
- 40 to 60 minutes
- 60 to 90 minutes
- 90 to 120 minutes
- Over 120 minutes
- How do you prefer to structure your training?
- We'll choose a recommended split for you
- We'll choose a recommended option for you.
- Full-body splits support 2 through 6 days
- Which muscles should get more or less focus?
- Muscle prioritization
- Emphasis
- Deprioritized
- Which of your gyms will you be using during this program?
- How do you prefer your rep ranges to update each week?
- What would you like to name this program?
- What color should we use to display this program?
- Exit the Program Builder?

Generation progress messages:

- Considering your experience...
- Checking equipment availability
- Analyzing muscle prioritization
- Optimizing for workout duration
- Programming your split
- Generating your program based on the latest science

Split names:

- Full Body
- Upper/Lower Split
- Upper/Lower/Full Body Split
- Upper/Lower/Upper/Lower Split
- Upper/Lower/Upper/Lower/Upper Split
- Push/Pull Split
- Push/Pull/Legs Split
- Push/Pull/Legs + Accessories
- Push/Pull/Legs/Upper/Lower Split
- Push/Pull/Legs/Push/Pull/Legs Split
- Push/Pull/Hinge/Squat Split
- Push/Pull/Hinge/Squat + Accessories
- Push/Pull/Hinge/Squat/Upper/Lower Split

Enum identifiers seen as bare strings: `hypertrophy`, `strength`, `both`, `beginner`, `intermediate`, `advanced`, `fullBody`, `upperLower`, `pushPullLegs`, `primaryCompound`, `secondaryCompound`, `accessory`, `core`, `over120`.

## Periodization

- Periodization
- Periodizing
- Periodization is what allows cycle-to-cycle variation. When disabled, all
- for an exercise will use identical sets and targets. The impact of turning this off is not reversible.
- Turn off periodization?
- Organize your training into phases that vary intensity and volume to support continuous progress and effective recovery
- Linear
- Reverse Linear
- Undulating
- Keep the same rep targets each week.
- Gradually decrease rep targets and increase weights over the program.
- Gradually increase rep targets and decrease weights over the program.
- Alternate between lower rep targets with heavier weights and higher rep targets with lighter weights each week.
- Failed to build periodized targets for day

Enum identifiers: `linear`, `reverseLinear`, `undulating`, `none`. Dart class names: `SimplePeriodization`, `PeriodizedPeriodization`, `ProgramPeriodization`, with fields `isPeriodized` and `periodizedTargets`.
The four descriptions probably answer "How do you prefer your rep ranges to update each week?". Keep the same is no periodization, decrease reps is Linear, increase reps is Reverse Linear, and alternate is Undulating. That pairing is inferred from the wording.

## Cycles and program blocks

- Cycle
- Cycles
- Cycle Settings
- Cycle Workouts
- First Cycle
- Last Cycle
- Upcoming program cycle
- Duration and Cycle Length
- -Day Cycle
- -day cycle.
- Change how long the program runs and how the workouts recur
- Program Block Complete
- Repeat Program Block
- You could repeat this program block once or continue running this block until you activate a different program.
- Create a new program block
- Activate First Block
- Drag workouts or program blocks here
- Adding a workout to your program will amend your progression and schedule. Would you like to continue?
- Your active program will be moved to your Workout Library and its progress will be reset.
- Rest Day

## Deload

- Deload
- Deload:
- deload week
- semi-deload week
- Would you like to add a deload to your program block?
- Add a deload to the beginning or end of your program, or remove it entirely
- Start each training block with a lower-intensity
- Extend set with lengthened partials on non-deload weeks.
- Extend set by holding the stretched position under full tension for 30 seconds on non-deload weeks

Field and class names: `useDeload`, `deload`, `WorkoutDeload`, `beginning`.

## Smart Progression

- Smart Progression
- Data-driven progressive overload
- We can progress your workout targets automatically
- Choose whether to progress workouts yourself or use our smart auto-progression
- We automatically adjust your weights and reps before and during workouts based on your past progress and program settings
- Your program auto-adjusts based on your progress, so you make gains without guesswork
- When you start a workout, Smart Progression will pre-fill your weight and rep logs based on your workout history and goals
- Allow Smart Progression to fill in new values for exercise data entry fields mid-workout.
- Allow Smart Progression to widen your target rep range when adding or lowering weight alone can't achieve an optimal result.
- Smart Progression will use your logged sets to learn your strength profile and recommend the right weights. Log your first set for it to come online.
- Smart Progression will use your logged sets to learn your strength profile and recommend the right reps. Log your first workout for it to come online.
- Add targets using the target editor in order to enable smart progression for this exercise.
- Your available equipment doesn’t allow for the exact load Smart Progression would recommend for these sets.
- Based on your performance in Week 1, the app will recommend personalized training loads that ensure progress while accounting for your individual rate of fatigue during training.
- The longer you use the app, the better it will understand you. Optimized training recommendations will accommodate your individual rate of progress, strength/endurance relationship, and much more.
- Expand Rep Range
- Weight Match
- Smart Progression values
- Configure smart progression settings
- Enabling smart progression

Event log and adjustment messages:

- Event Log
- Smart Progression has widened the target rep range of
- Linear progression applied
- Target rep ranges were adjusted
- Progression unavailable within target rep range
- Progression Fix
- Prior Weight Exceeds Initial
- Applying a fix can help optimize your workout
- Adjusted Targets
- Proposed Targets
- Current Targets
- Get new workout targets
- Edit Targets Manually
- Today’s targets
- Increase
- Decrease
- Adjustment

Class and field names: `AutofillProgression`, `applyInSession`, `applySmartProgressionInSession`, `autoprogression`, `AutoTargetsEvent`, `fixableAutoTargets`, `baseTargets`.

New exercise guidance:

- To determine an appropriate weight for a new exercise, start by selecting a conservative weight that will definitely allow you to achieve your rep target with good technique. If this set felt at least somewhat challenging, record it as your first working set. If the set felt very easy, go up in weight. Repeat this process until you find a somewhat challenging load that still allows you to complete all of your reps with great technique – record this set as your first working set.

## RIR

- What is RIR?
- RIR stands for Reps in Reserve—a simple way to describe how challenging a set felt.
- A lower RIR (0–1) means you pushed to your limit. A higher RIR (like 4–6+) means the set felt easier and you had plenty left in the tank.
- What you see above is an RIR scale
- No reps in reserve
- Many reps in reserve
- RIR Targets
- RIR Tracking
- Automatically populate RIR selection in the session log based on program
- Early Set RPE
- Last Set RPE

## Warm-ups

- Warm-Up
- Warm Up
- Warm-Up Set
- Add a warm-up set to your workout
- Add empty warm-up set
- Warm-up automation
- Warm-Up Automation
- Smart Warm-Up
- Optimized Warm-Up
- Scheme Warm-Up
- Warm-ups will be automatically added to exercises in your workout depending on how fresh your muscles are and how heavy the weight is
- Detect when a muscle group has not been worked from prior exercises and automatically add warm-ups as needed
- Automatically add warm-ups from a manually configured scheme
- Warm-ups will not be automatically added to your workouts
- Warm-Up Scheme
- Warm-Up Scheme (
- Configure the default warm-up scheme used in the workout warm-up calculator
- Set warm-up automation behavior for specific exercises
- Specify warm-up automation behavior for specific exercises
- These take precedence over the default warm-up automation
- Add Exercise Warm-Up Automation
- Simplify Warm-Up Plates
- Adjust warm-up weights to the nearest load that doesn’t require trivially small plates
- Rest After Last Warm-up Set
- Use rest timers after the last warm-up set
- Completed warm-up sets will be hidden behind the Warm Up menu in your workout
- Smart warm-ups will appear after you’ve completed a workout that includes this exercise.
- Your first working weight is too low relative to your 1RM to generate smart warmups.
- And we can intelligently manage your warm-ups
- Configure warm-up settings

Field and class names: `WarmUpScheme(sets: `, `WarmUpSchemeSet(percent: `, `warmupLastPercentage`, `warmUpRestPercentLast`, `restBetweenWarmUpSetsLast`, `afterLastWarmupSet`, `hideCompletedWarmUpSets`, `simplifyWarmUpPlates`, `warmUpSchemeByCategory`, `warmUpAutomationOverride`, `CalculatedWarmUpSource.smart(index: `, `CalculatedWarmUpSource.scheme(index: `, `smartWarmUpTargets`, `betweenBlocksPercentage`.

## Plate calculator and gym equipment

- Plate Calculator
- Available Plate Weights
- Available Bumper Plates
- Include Bumper Plates
- Utilize Mixed Unit Plates
- No plate weights available in this gym
- No bumper plate weights available in this gym
- External Plates
- Plate Color
- Photos of Plate Stack
- Plate Loaded Machines
- Fixed Weight Bars
- Loadable Accessories
- Add Micro-Adjustments
- Fine-tunes the weight using a small adjustment dial on top of the selected load. Allows one adjustment at a time.
- Lets you select a single incremental weight by inserting a pin into the micro-adjustment stack.
- Loads additional plates directly onto the machine. Allows more than one adjustment at a time.
- Adds the ability to optionally offset the total weight targeted by the weight calculator
- % target weight
- Highest generated stack weight:
- Base not available in this gym
- Settings below will override your gym profile weights for this exercise. Equipment availability is still determined by the profile.

Gym types:

- Commercial Gym
- Warehouse Gym
- Local Gym
- Garage Gym
- Home Gym
- Everything Gym
- A gym that includes every piece of equipment
- A strength-focused space with racks, barbells, plates, benches, and some machines
- Gym with essential equipment like racks, barbells, plates, benches, and cable machines
- A home setup with a rack, barbell, plates, a bench, and dumbbells
- A compact space with dumbbells, kettlebells, bands, and household furniture

The bundle's equipment entries carry matching `commercialGym`, `warehouseGym`, `localGym`, `garageGym`, and `homeGym` flags.

## Exercise settings

- Do Not Recommend
- This exercise will not be recommended when creating programs
- Bodyweight Contribution
- This is the amount of bodyweight that contributes to resistance for this exercise and will be optionally displayed in your workout analytics

## Data export and import

- Data Export
- Quick Export
- Granular Export
- Export
- Export Workout
- Export Workout Log
- Export Program
- Can't Export
- Due to its format and size, the workout log must be exported as a single file.
- Import Workout From File
- Import program from file
- Imported Program Blocks
- Imported Workouts
- Program Spreadsheet
- Workout Spreadsheet (Not For Programs)
- You can upload .xlsx files from previously exported programs
- You can upload .xlsx files from previously exported workouts
- We only support select spreadsheet formats with a .xlsx extension. If the program spreadsheet wasn't exported from MacroFactor Workouts or explicitly advertised to work with MacroFactor Workouts, it will likely fail to import. Only upload content you have permission to use.
- We only support select spreadsheet formats with a .xlsx extension. If the workout spreadsheet wasn't exported from MacroFactor Workouts or explicitly advertised to work with MacroFactor Workouts, it will likely fail to import. Only upload content you have permission to use. Use the program importer, not this single day workout importer, in order to import a program.
- Import successful
- Import failed

Column-like labels. These exist in the binary, but their use as xlsx headers and their order are not confirmed:

- Date
- Workout
- Workout Name
- Program
- Cycle
- Week
- Session
- Exercise
- Exercise Name
- Exercise Note
- Superset
- Set Type
- Weight
- Weight (Assistance)
- Weight (Max 2)
- Volume (Max 2)
- Reps
- Rep Range
- Duration
- Distance
- Rest
- Rest Timer (sec)
- Side
- Left
- Right
- Start Time
- Note
- Notes
- Sets
- Working Sets
- Total Volume

The program importer's row pattern names its per-set columns: `^Set\s+(\d+)\s+(Type|Rep Range|RIR|Rest|Duration|Distance)$`. The importer field names include `substitution1Column`, `substitution2Column`, and `percent1RmColumn`, and there are parsers for Jeff Nippard programs (`workout_program_import_jeff_nippard_pure_bodybuilding_parser.dart`, `ProgramImportJeffNippardMinMaxPhase2PeakPhysiqueParser`).
