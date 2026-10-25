# MacroFactor Workouts: Apple Watch, Live Activity, and Apple Health

Source: MacroFactor Workouts v1.4.1 build 130 (bundle id `com.sbs.train`), studied on 2026-10-24 from the macOS wrapper at `/Applications/Runner.app/Wrapper/Runner.app`, plus MacroFactor's public posts.

**Evidence caveat.** The Mac wrapper has no `Watch/` folder, so the watch app binary was not available. The watch facts below come from three places:

- Swift code that the iPhone app and its widget extension share with the watch app: the `StrongerModels`, `StrongerEnvironment`, `StrongerSwiftUI`, `StrongerModelsUI`, and `WorkoutComponents` packages. Their type and field names survive in both binaries.
- The Live Activity's watch Smart Stack rendering, which lives in the widget extension.
- Marketing renders and newsletter text from macrofactor.com.

No watch screen was driven by hand. The watch app has been in TestFlight beta since August 2026 and has not shipped. The beta is full. Treat every watch layout detail as provisional.

**Abbreviations used in citations:**

- `WX`: the widget extension binary, `PlugIns/RunnerWidgets.appex/RunnerWidgets`.
- `RUN`: the main binary, `Runner.app/Runner`.
- "fields" means Swift reflection metadata (`__swift5_fieldmd`), the source of type, case, and property names. "sym" means a demangled `nm` symbol. "str" means a literal from `strings -a`.
- Localized UI strings are in `RunnerWidgets.appex/StrongerModels_StrongerModels.bundle/en.lproj/Localizable.strings`, cited below as `SM.strings`.

**How to reproduce.** `nm WX | swift-demangle --simplified` lists symbols, and the widget extension is not stripped. A small parser over `__swift5_fieldmd` and `__swift5_reflstr` (relative pointers, with symbolic references resolved through context descriptors) dumps every Codable model with its fields. It works on `RUN` too, though `RUN`'s own symbols are stripped. `plutil -p Metadata.appintents/extract.actionsdata` dumps the App Intents. `xcrun assetutil --info` lists the asset catalogs. Flutter strings come from `tools/app-strings.py` ([`app-strings.md`](app-strings.md)).

Screens in `screens/`:

- `watch-beta-preview-aug2026.jpg`: three watch renders with a blue tint (workout overview, set entry, plate calculator). Source: https://macrofactor.com/wp-content/uploads/2026/08/Watch-preview.png
- `watch-annual-report-hero.jpg`: three watch renders with a red tint (set entry, rest, workout overview). Source: https://macrofactor.com/wp-content/uploads/2026/09/Watch-scaled.png
- `watch-liveactivity-annual-report-lockscreen.jpg`: two Live Activity lock screen banners (active set, rest). Source: https://macrofactor.com/wp-content/uploads/2026/09/Live-Activity-scaled.png
- `watch-liveactivity-rest-timer-notification.jpg`: the time-sensitive "Rest timer complete" notification. This is a notification, not a Live Activity. Source: https://macrofactor.com/wp-content/uploads/2026/02/new-release.png

---

## 1. Timeline and positioning

- **Live Activity shipped in v1.2.0** on 2026-05-12, with the release note "Added live activity" (App Store version history, https://apps.apple.com/us/app/macrofactor-workouts-tracker/id6737156524). The May 2026 newsletter says "Now you can track your lifts, time your rest, and quickly access MacroFactor Workouts from your lock screen." (https://macrofactor.com/mm-may-2026/).
- **The March pre-announcement** said "see your active set and rest timer on your lock screen, and see your rest timer in your dynamic island" (https://macrofactor.com/mm-march-2026/).
- **Apple Health workout writing shipped in v1.1.1 to v1.1.3** (Jan to Feb 2026). The February newsletter says "Workouts can now write data directly to Apple Health, making it easier to keep everything in one place." (https://macrofactor.com/mm-feb-2026/).
- **The watch beta started in August 2026.** TestFlight link: https://testflight.apple.com/join/yUTDqz3R, now full (https://macrofactor.com/mm-august-2026/).
- **The annual report pitch** (https://macrofactor.com/annual-report-2026/), verbatim:
  - "With Workouts on Apple Watch, you can leave your phone in your locker or gym bag."
  - "Use your watch to start your workout, track your lifts, and time your rest."
  - "Get Ready: You can choose your workout, review upcoming exercises, and start your workout all from your watch."
  - "Lift: See your target weight, reps and RIR for each exercise as you follow along your plan."
  - "Adjust: Enter your working weight for each set, and utilize the plate calculator to make gym setup a breeze."
  - "Measure: Track your RIR so that our algorithms can progress you for your next workout."
  - "Rest: Manage your rest times and preview what's next while you recover."
  - "Get Technical: Track asymmetric exercises, drop sets, Myo sets and more."
- **The Live Activity is also pitched to non-watch users.** "If you have an iPhone but don't use Apple Watch, we also added a 'Live Activities' feature…" (annual report).
- **Do not confuse it with the Nutrition watch app.** The help center's "MacroFactor Watch App" collection covers the Nutrition app only (https://help.macrofactorapp.com/en/collections/41-macrofactor-watch-app). The shared code still carries Nutrition watch types (`WatchDeepLink` cases `logWater, logNow, logNowAI, logWeight, timeline`, `WatchTodayToolbar`, complication transfer strings), so ignore those for Workouts.

## 2. Watch app

### 2.1 Architecture: standalone, with the phone as a peer

- **The watch runs the workout itself.**
  - The watch is a full HealthKit workout host. `RUN` has `HKWorkoutSession`, `HKLiveWorkoutBuilder`, and `HKLiveWorkoutDataSource`, and the delegate method `workoutSession:didReceiveDataFromRemoteWorkoutSession:` (str).
  - The phone's `HandheldWorkout` logs mention `subscribeToMirroredSession(_:workout:)`, "session is mirrored", `startHealthKitWorkoutOnBestAvailableDevice(initialState:didDiscardRecoveredWorkout:)`, and `__startLiveWorkoutOnPhone(initialState:)` (`RUN` str).
  - Inference: when a workout starts on either device, the app starts the HealthKit session on the watch if one is available. It mirrors that session to the phone (watchOS 10 `startMirroringToCompanionDevice`) and exchanges workout state over the mirrored session's data channel. Without a watch, it runs the session on the iPhone (iOS 26 iPhone workout sessions).
- **Messages over the mirrored session.** `StrongerModels.WorkoutMessage` has the cases `discardedWorkout(instanceId)`, `state(snapshot, t)`, `completed(RemoteWorkout)`, `preferences(prefs, t)`, and `remoteDidConnect` (`WX` fields). `WorkoutMessage.ReducedMessages` coalesces them: the latest snapshot, completed, preferences, discarded, and `isRemoteConnected`.
- **Conflict rule.** Both devices edit one `InProgressMFWorkout`. The winner is chosen by `winsInstanceConflict(against:)` (str `StrongerModels/InProgressMFWorkout+InstanceConflict.swift`) and diff dates. The error "Unexpected: workouts with identical start and diff dates, but different instance IDs" and the log "Received remote message for a different workout. Resolving the instance conflict without merging sensor history." (`RUN` str) show that conflicts are resolved by instance ID first, then by the latest diff date.
- **Everything else goes through a sync router with fallbacks.**
  - `StrongerEnvironment.WatchPhoneSyncRouter` holds `transports: [WatchPhoneSyncTransport]` and `attemptsPerTransport`.
  - The transports are `WCSessionWatchPhoneSyncTransport` (WatchConnectivity messages and file transfers), `DirectConnectionWatchPhoneSyncTransport`, and `CloudWatchPhoneSyncTransport` (`WX` fields). Their transport ids are the strings `watchConnectivity`, `directConnection`, `cloud`, and `liveWorkout` (`WX` str).
  - Errors: `unreachable`, `allTransportsFailed(underlying)`, `unknownMethod`, `remote(message)`, `notImplemented`, `timedOut` ("Phone sync timed out", "All phone sync transports failed: ").
  - `WatchPhoneSyncDelivery` is either `interactive` or `potentialSystemLongTermCache`.
  - Inference: when the phone is unreachable, requests fall back to the MacroFactor cloud. This matches the "leave your phone in your locker" pitch. The exact behavior with no phone and no network is unknown.
- **Request types** (`WX` fields, each a `WatchPhoneSyncRequest` with a `method`, `displayName`, `coalesceKey`, and `allowsBackgroundDelivery`):

  | Request                                                                              | Payload                                                                                                                                                                                                                                                                 |
  | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `MFInitialWorkoutLaunchContentRequest` (phone method `getWatchInitialScreenContent`) | Asks for autoprogression, customExercises, exercises, exerciseNotes, gyms, preferences, programs, programNotes, and workouts (`workoutsPopulateAll`). The response adds `lastSynced`, `workoutsAreFullyPopulated`, and `library`. This is the watch home screen's data. |
  | `GetHydratedWorkoutsRequest(ids, gym)` → `results: [id: workout]`                    | Fills in a chosen workout for a gym.                                                                                                                                                                                                                                    |
  | `SyncFutureWorkoutsRequest`, `SyncWorkoutsRequest`                                   | `MFFutureWorkout {id, name, lastCompleted, updatedAt, program?, content, defaultGym}`.                                                                                                                                                                                  |
  | `LiveWorkoutStateRequest`, `LiveWorkoutIdentityRequest` → `LiveWorkoutSyncResponse`  | Cases `active`, `terminated(instanceID)`, `noChange`.                                                                                                                                                                                                                   |
  | `CompletedWorkoutWatchPhoneSyncRequest(workout: RemoteWorkout)`                      | See §2.6.                                                                                                                                                                                                                                                               |
  | `DiscardedWorkoutWatchPhoneSyncRequest(instanceID)`                                  |                                                                                                                                                                                                                                                                         |
  | `WatchLogsRequest` / `WatchLogsDeliveryRequest`                                      | Debug logs.                                                                                                                                                                                                                                                             |

  The phone's Flutter bridge (`RUN` fields `FlutterWorkoutsContent.SwiftMethod`) serves `getWatchInitialScreenContent`, `exerciseNotes`, `exercisePreferences`, `exerciseStatistics`, `gyms`, `customExercises`, `preferences`, `programs`, `programNotes`, and `getHydratedWorkouts`. The relay log is `relayToWatch(_:)`.

- **Watch-side persistence.** `InProgressWorkoutClient` (disk file "workoutInProgress", versioned), `MFWorkoutLibraryClient` ("workoutLibrary"), `MFWorkoutPreferencesClient` ("prefsWorkout"), and `WorkoutsWatchPreferencesClient` ("prefsWorkoutsWatch") (`WX` str). The watch therefore caches the library and resumes an in-progress workout from disk.
- **Crash recovery.** "Recoverable HKWorkout session is available", `kickstartRecoveredSession()`, and the `RecoveryError` cases `missingMetadataAndStartDate`, `differentWorkout`, `startDateMismatch`, and `invalidWorkoutStatus` (`RUN` str and fields). HealthKit session recovery is matched to the MF workout by metadata (§4.1).

### 2.2 Home / start screen

- **Content.** The home screen is the watch's copy of the workout library and program plan (`MFInitialWorkoutLaunchContentRequest`).
  - Guess: it lists the next program workout first, then library workouts, like the phone's Workout tab.
  - `WorkoutsWatchPreferences.restDays` is `hiddenAutoComplete` or `shown`, which controls whether program rest days appear on the watch (fields).
- **Start countdown.** `WorkoutCountdownStyles {enabled}` plus `WorkoutCountdownStyle` with ten animation styles: `count, plates, slots, zoom, iris, chroma, rise, heartbeat, slide, frames` (`WX` fields). The countdown is a user-selectable animation before the session starts. The visuals are unknown.
- **Quick start.** The annual report says you "choose your workout, review upcoming exercises, and start your workout all from your watch." Starting a workout on the watch with the phone absent is the headline use case.

### 2.3 Workout overview (exercise list)

From `watch-beta-preview-aug2026.jpg` (left) and `watch-annual-report-hero.jpg` (right):

- **Toolbar.** The left button is "…" (options) in the beta render and "X" (end) in the later render. The clock is centered. The right button is "+" (add, beta) or a tint-filled circle with a repeat/swap glyph (later render). Guess: the right button is the `arrow.trianglehead.swap` symbol, used for substitute exercise. That symbol is present in `WX` str.
- **Header.**
  - The workout name is in the tint color ("Lower").
  - Below it, the elapsed time is in white bold ("56 min").
  - Then the program cycle in gray ("Cycle 12").
- **Blocks.** Each block has a header with a repeat glyph and a set count ("3 sets"). Below it is a rounded card with the exercise name and "160–175 lb · 10–11 reps" (the target range) in gray. In the beta render, the current exercise card has a tint-colored outline.
- **Menu items.** These are the `SM.strings` entries for the current-task menu: "Add set", "Add drop", "Add segment", "Add round", "Add exercise", "Add exercise to superset", "Add exercise to circuit", "Substitute exercise", "Delete exercise", "Delete set", "Delete segment", "Jump to %@", "Mark all complete", "To where I was", "To the timeline", "Review & End", and "End workout". The phone and watch share these (`InProgressMFWorkout` operations `addRoundAfterCurrentRound`, `addSegmentToCurrentSetMarkingCurrentTaskCompletedAt`, `delete(exercise:in:)`, `markComplete(path:...)`, and `markIncomplete`).

### 2.4 Current-task (set entry) screen

From the middle and left renders:

- **Toolbar.** "…" at left, the clock at center, and a check button at right. The check completes the set and advances to rest or the next task.
- **Set dots.** A row of numbered circles ("1 2 3"). The current set is white-filled with a dark number. The others are dark gray.
- **Title.** The exercise name, centered, white, in SF semibold, on two lines.
- **Metric pills.** Three pills in a row: weight (`175` over `LB`), reps (`11` over `REPS`), and RIR (`2` over `RIR`).
  - The value is large and bold. The caption is small, gray, and uppercase.
  - Weight and reps pills are tinted with a translucent tint. In the beta render, the focused pill has a tint-colored outline and caption, which marks the field the Digital Crown edits.
- **Background.** Black, with a radial tint glow from the bottom when `tintBackground = bottom` (prefs `TintBackground {off, bottom}`).
- **Input model** (`WorkoutComponents` fields):
  - Each metric has a Crown state: `WeightCrownState`, `RepsCrownState`, `RIRCrownState`, `DurationCrownState`, and `DistanceCrownState`.
  - All have `crownValue`, `crownDetent`, `crownRange`, `showDecimalAlways`, `didModify`, `valueMaxWidthFormatted`, and the target and previous values. Examples are `targetKg` and `previousKg`, `previous: Int?` and `target: ClosedRange<Int>?` for reps, and `partials` for partial reps.
  - Weight and Distance keep `displayUnit` and `displayUnitOriginal`.
  - So the Crown scrubs the focused value with detents, and the target and previous values are shown as reference.
- **Preferences that change input** (`WorkoutsWatchPreferences.CurrentTaskTab`, with the option descriptions from `WX` str):
  - `preferredInput`: `crown` "Uses the digital crown", or `calculator` "Opens the keypad".
  - `nextButton`: `immediate` "Advances immediately", `conservativeIfRestIncomplete` "Advances immediately, but confirms if a rest is incomplete", or `conservative` "Confirms and previews next task".
  - `handGesture` (double tap): `off`, `explanation` "Explain exercise technique", or `next`.
  - `swipeUp` and `swipeDown`, each one of `off`, `music`, `next`, or `pauseResumeToggle`.
  - `crownIteratesEquipmentWeight: Bool`. Guess: the Crown steps through the gym profile's achievable loads (plates and dumbbell sets) instead of a fixed increment.
- **Per-side and laterality.** `TaskVM` has `didComplete`, `didCompleteRight`, `isLeftLoggedSeparatelyThanRight`, and right-side copies of every metric (`weightRight`, `repsRight`, and so on). The strings are "Left/Right/L/R" (`train_WorkoutComponents.bundle`), "%@/side", and "reps/side". Asymmetric exercises log left and right separately.
- **Set types.** `SetSpecialization {drop, failure, myo, warmup, warmupAuto}`. The one-letter badges are W, D, F, and M (`SM.strings` `*_ONECHARACTER`). The captions are "Set %lld of %lld", "Drop %lld of %lld", "Dropset %lld of %lld", "Round %lld of %lld", "Segment %lld of %lld", "Warmup set", "Failure set", "Myo set", "Partial set", and "Drop set". The check-button labels are "Complete set", "Complete set %lld", "Complete warmup", "Complete topset", "Complete drop %lld", "Complete segment %lld", and "Complete exercise %lld of round %lld". The undo labels are "Mark set %lld incomplete" and related.
- **Plate calculator** (beta render, right):
  - The toolbar has a back chevron, the clock, and a barbell (resize) button.
  - A colored plate breakdown "45x2 35 5" uses IPF-like colors (45 blue, 35 yellow, 5 blue).
  - Below it is a side-view drawing of the loaded bar and a total pill "305 lb" with a "+".
  - Prefs: `PlateCalculator.plateDisplayStyle {basic, handles, twelveSided, twelveSidedWithHandles}` and `bumperDisplayStyle {standard, rounded}`. The `loadedBar` image is in `StrongerSwiftUI.bundle/Assets.car`.

### 2.5 Rest screen

From the middle red render:

- **Layout.**
  - The toolbar has "…" at left, the clock with "REST" in the tint color under it, and a fast-forward (skip rest) button at right.
  - A huge white countdown "1:10" sits in the center.
  - Below it is the up-next line "⏩ SET 3 OF 3".
  - A translucent card previews the next set: "FAILURE SET" with "35 LB · 12 REPS · 0 RIR".
- **Rest model.** `MFWorkout.Rest {id, exit}`. `Rest.Exit` is one of:
  - `time(seconds)`
  - `heartRateIsOrBelow(zone, seconds, fallbackWhenNoHeartRate)`

  (`WX` fields). Rest can end when heart rate drops to a zone, with a time fallback. There is no phone UI for this yet, so it is probably watch-first.

- **Rest preferences.** `MFWorkoutPreferences.Rest` keys: `useRestTimers`, `afterLastWarmupSet`, `betweenBlocks(Percentage)`, `betweenSplit(Percentage)`, `warmupLastPercentage`, `standard` (per-category durations), `myoSegmentSeconds`, `sound`, `vibration`, and `notifications {headsUpOffset?, end, ended: reminder(interval, duration) | autoAdvance}`.
  - `ended = autoAdvance` moves to the next task automatically when rest ends.
  - `reminder` repeats a haptic or alert. The Live Activity log "LiveActivity rest reminder preferences are invalid" (`RUN` str) confirms these reminders run from the phone too.
- **Rest adjust.** The watch strings are "Rest more", "Rest less", "End rest", "%lld seconds left", and "Rested" (`SM.strings`). `StrongerSwiftUI` assets include `plus10` and `minus10` glyphs, and `WX` str includes "Subtract 10 Seconds". Guess: the watch rest screen adjusts by 10 s, while the phone and Live Activity use 15 s (§3.3).

### 2.6 Heart rate, zones, calories, stats page

- **Controls/Stats tab.** `WorkoutsWatchPreferences.ControlsStatsTab {showControlsFirst, stats: [ActiveWorkoutStatistics]}`. The statistics are `heartRate`, `heartRateAndZone`, `timeElapsed`, and `timeRemainingEstimate`.
  - So the workout is a paged (TabView) layout: a Controls page (end, pause/resume, and similar) and a Stats page with a user-chosen stat list. Either can come first.
  - `leadingItem: LeadingItemCustomization? = heartRate` can put live heart rate in the current-task toolbar's leading slot.
- **Time remaining.** `RemainingTimeInWorkoutRoughEstimator {perRepCount, exerciseRestTime, fallbackRestEstimate, exerciseRequiresExtraSetup, setupExtra, setupSingle, setupSuperset, setupCircuit}` (`WX` fields). The estimate is reps × seconds-per-rep, plus rest, plus setup time per block type.
- **Zones.** `MFWorkoutPreferences.zones: HeartRateZones? {algorithm: manual | karvonen, ranges: [ClosedRange<Double>]}` and `HeartRateZone {one…five}`, labelled "Zone %lld". The UI views are `HeartRateZonesIndicator {currentZone}` and `HeartRateZoneProgressBar {currentZone, targetZone, progress}` (`StrongerModelsUI`). `EfficientHeartBeat {isDisplayInAlwaysOnMode, lastHeartRateObservation}` is an animated heart that stops animating in Always On.
- **Heart-rate exit conditions for timed sets.** `MFWorkout.ExitCondition` is one of `time(seconds)`, `burned(activeKcal)`, `heartRateZoneIsOrAbove(zone, totalDuration)`, or `heartRateZoneIsOrBelow(zone, totalDuration)`. The phone has `HeartRateTimer.Value {elapsed, percentProgress, secondsInTarget, heartRate}` (`RUN` fields). These are cardio tasks that end after N seconds in a zone or N kcal.
- **Calories.**
  - The watch reads energy from `HKLiveWorkoutBuilder`.
  - For workouts logged without a live session, `WorkoutActiveCalorieBurnEstimator {userBodyMassKg, isFemale, algorithmVersion}` estimates active kcal (`WX` fields). It is used by `build(completedWorkout:completedAt:burnEstimator:)` (`RUN` str).
- **Completed-workout payload.** `SyncWorkoutsRequest.RemoteWorkout {completedAt, completed: MFWorkout, healthKitId?, stats?}` with `Stats {duration, heartRateAverage?, heartRateRange?, kcalActive?, kcalTotal?, volumeTotalKg}`. This is the summary the watch sends back. Guess: the watch summary shows these same numbers (duration, average and range HR, active and total kcal, volume).
- **Sensor history.** `MFWorkout.SensorHistory {heartRate, uwb}` stores HR samples in the MF workout itself. `uwb` is Nearby Interaction distance: the app declares `NSNearbyInteractionUsageDescription` "Record your movements during selected workouts for deeper insights" and has an `NISession` client in `RUN`. Guess: this is experimental phone-to-watch distance tracking.
- **Timeline.** `MFWorkout.TimelineEvent.Event` is one of `rest(rest)`, `start(path)`, `end(path)`, `pause`, or `resume`. Pause and resume exist.

### 2.7 Finish and summary

- **End flow.** The strings are "End workout", "Review & End", "Workout complete", "Finished", and `workoutStartTimeLabel` "Start" / `workoutEndTimeLabel` "End" (`SM.strings`). `NextButtonInteractionStyle` "Confirms and previews next task" implies a confirm step at the end too.
  - Guess: "Review & End" opens a summary list (start and end time, stats) before saving.
- **On completion,** the watch sends `CompletedWorkoutWatchPhoneSyncRequest`. The phone persists it ("Saving completed workout to local cache failed", `persistCompletedWorkout`) and hands it to Flutter (`FlutterWorkout.SwiftNotificationToFlutter.workoutCompleted / workoutCompletedBySystem`). The phone's normal Workout Complete flow (README §8) then runs on the phone.

### 2.8 Visual language (watch)

- **Tint.**
  - Each workout has `MFWorkout.Tint {red, orange, yellow, green, teal, blue, purple}`, the program color.
  - Watch prefs add `tint?` (an override), `tintAdHocFallback` (the tint for unplanned workouts), and `tintBackground {off, bottom}`.
  - The renders use red (`watch-annual-report-hero.jpg`) and blue (`watch-beta-preview-aug2026.jpg`). The title text, the "REST" label, the primary button fill, and a bottom radial glow all use the tint.
- **Palette.** `StrongerSwiftUI_StrongerSwiftUI.bundle/Assets.car` defines the shared palette, with light and dark values:

  | Tint   | Primary           | Medium  | Secondary         | Tertiary          |
  | ------ | ----------------- | ------- | ----------------- | ----------------- |
  | red    | #DE1135 / #DE5B5D | #F83446 | #FFE1DE / #A32C34 | #FFE8E5 / #950F22 |
  | orange | #FF8660 / #FF8B66 | #FF6636 | #FFB59F / #7E2C10 | #FFDBD0 / #461F16 |
  | yellow | #FFC447 / #FFD15E | #FBAA12 | #FFDF97 / #826100 | #FFEFD1 / #42330B |
  | green  | #4CB179 / #5DBA87 | #419D6A | #9FD9B9 / #005231 | #CBE7DB / #253C2F |
  | teal   | #01B8CA / #77D5E3 | #0095A4 | #CDEEF3 / #016974 | #E2F8FB / #1A535A |
  | blue   | #5A95F9 / #689FFA | #276EF1 | #AAC7FF / #00458E | #D7E3FF / #0E2A4E |
  | purple | #8F7FE0 / #B28DF7 | #9662F8 | #D4BBFF / #553095 | #EBDCFF / #362C49 |

  Neutrals (light / dark):

  - background: #F6F6F6 / #141414
  - surface: #FFFFFF / #1F1F1F
  - surfaceSecondary: #E8E8E8 / #383838
  - surfaceTertiary: #F6F6F6 / #2A2A2A
  - content: #000 / #FFF
  - contentSecondary: #4B4B4B / #DDDDDD
  - contentTertiary: #5E5E5E / #A6A6A6
  - contentCritical: #DE1135 / #DE5B5D

  Guess: the watch uses the dark values on its black background.

- **Fonts.** Watch screens use SF (system), not MacroSans, per the renders. The widget extension bundles `MacroSans-VF.ttf` (`UIAppFonts`) for Live Activity headings such as "REST". It also imports `Font.custom(_:size:relativeTo:)`, the `.rounded` design, `monospacedDigit()`, and `smallCaps()` (`WX` dyld imports).
- **SF Symbols seen in shared code** (`WX` str): `checkmark.circle.fill`, `forward.fill`, `backward.fill`, `arrowtriangle.forward`, `arrowtriangle.backward`, `15.arrow.trianglehead.clockwise`, `15.arrow.trianglehead.counterclockwise`, `pause.fill`, `play.fill`, `heart.fill`, `flame.fill`, `arrow.trianglehead.swap`, `arrow.uturn.backward`, `note.text`, `note.text.badge.plus`, `delete.left.fill` (keypad), `antenna.radiowaves.left.and.right.slash` (disconnected), `iphone.badge.exclamationmark`, `figure.arms.open`, and `square.grid.3x3.fill`. The custom glyphs `lift.checkmark`, `lift.play`, `dumbbell`, `loadedBar`, and `workouts.logo` are in `StrongerSwiftUI.bundle`.
- **Glass.** `WatchInformationFooterGlassBackground` is a Liquid Glass footer behind informational text.

## 3. iPhone Live Activity and Dynamic Island

### 3.1 Data model

`WorkoutLiveActivity` attributes are `{name: String, workoutID?}`. `ContentState` (`WX` and `RUN` fields, identical in both) is an enum:

- `initialState`: placeholder (`PlaceholderStats`).
- `workout(Active)`.
- `finished(confirmEndAction: Bool)`.

`Active` fields:

| Field                                                                                               | Meaning                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exercise`, `exerciseInitials`, `exerciseDbId`                                                      | The name, the initials fallback, and the thumbnail key.                                                                                                                                                                                   |
| `set`, `setCompact?`                                                                                | "Set 1 of 3" and a short form.                                                                                                                                                                                                            |
| `specialization?`, `specializationLetter?`                                                          | "Failure set", and "F".                                                                                                                                                                                                                   |
| `circuit? {count, index}`                                                                           | Rendered by `CircuitBubbles.swift` as superset or circuit position dots.                                                                                                                                                                  |
| `stats: [Stat {id, unit, value: String, rir?}]`                                                     | Metric pills. `id` is a metric kind: `weight`, `weightAssisted`, `weightPerSide`, `weightPerSidePersistent`, `reps`, `repsPerSide`, `duration`, `durationPerSide`, `distanceShort`, `distanceShortPerSide`, or `distanceLong` (`WX` str). |
| `rest? {range: ClosedRange<Date>, nextTaskIsNovel}`                                                 | Rest countdown window. Guess: `nextTaskIsNovel` shows the next exercise's identity when it differs.                                                                                                                                       |
| `timer? {target, start?, paused?}`                                                                  | Timed set (duration task) countdown, with pause.                                                                                                                                                                                          |
| `taskPath?`                                                                                         | Identity of the current task, used to invalidate stale content (`invalidatableContent`).                                                                                                                                                  |
| `tint?`                                                                                             | The workout tint.                                                                                                                                                                                                                         |
| `disableBackButton`, `disableNextButton`, `disabledNextButtonGeneralTapURLOverride?`                | Previous is disabled on the first task. When Next is disabled, a tap deep-links into the app.                                                                                                                                             |
| `invalidating: InvalidatedFields` (option set: `exercise`, `set`, `specialization`, `stats`, `all`) | Which parts to grey out while an intent is in flight.                                                                                                                                                                                     |
| `animations {pushRight, prev, next, restLess, restMore}`                                            | Transition hints, using `ContentTransition.numericText(countsDown:)`, `.opacity`, and `.symbolEffect`.                                                                                                                                    |
| `useDarwinIntents`                                                                                  | Picks the intent variant (§3.3).                                                                                                                                                                                                          |
| `forceDiff?`                                                                                        | Forces an update.                                                                                                                                                                                                                         |

`widgetBackgroundTapURL` is `sbstrain://workout/live` (`WX` str). `NSSupportsLiveActivities` and `NSSupportsLiveActivitiesFrequentUpdates` are both true (`Info.plist`). Thumbnails are 622 bundled 160×160 exercise images keyed `Exercise/<exerciseDbId>` in `train_WorkoutThumbnails.bundle/Assets.car`. Widgets cannot fetch the network, so the app ships them. Exercises without an image fall back to `exerciseInitials`.

### 3.2 Views

The source files (`WX` str) are `LiveActivityLockScreenBanner{ActiveWorkout,Rest,Task,TaskControls,FinishedWorkout}.swift`, `LiveActivityLockScreenThumbnail.swift`, `LiveActivityStat.swift`, `LiveActivityButtons.swift`, `LiveActivityDynamicIsland{Compact,Expanded,Thumbnails}.swift`, `WatchSmartStack{ActiveTask,FinishedWorkout,Thumbnail}.swift`, `CircuitBubbles.swift`, `PlaceholderStats.swift`, and `WorkoutLiveActivityWidget.swift`. The widget bundle has one widget (`WidgetBundleBuilder.buildBlock<A>`).

- **Lock screen, active set** (`LiveActivityLockScreenBannerActiveWorkout` = `Task` + `TaskControls`). See `watch-liveactivity-annual-report-lockscreen.jpg`, top.
  - The card is dark navy (the tint at a dark value via `activityBackgroundTint`).
  - The top row has a rounded-square exercise thumbnail at left (`LiveActivityLockScreenThumbnail {cornerRadius}`). At right, a gray caption "Set 1 of 3" and a white bold two-line exercise name.
  - The bottom control row has a ⏪ Previous button (dimmed when `disableBackButton`), the stat pills, and a ⏩ Next button in white.
  - The stat pills are dark rounded capsules with a value ("140") over a small uppercase unit caption ("LB"), then "10" over "REPS".
  - A small yellow circle with the RIR number ("2") overlaps the reps pill's top-right corner. The RIR color follows the RIR scale (README §1: 2 and 3 are amber).
- **Lock screen, rest** (`LiveActivityLockScreenBannerRest`). See the same image, bottom.
  - A "REST" heading in MacroSans (wide caps).
  - The countdown "2:57" is large, bold, and monospaced. It uses `Text(timerInterval:pauseTime:countsDown:true)`, so it ticks without updates.
  - "-15" sits left of the countdown and "+15" right. These are `LiveActivityRestSubtractTimeButton` and `LiveActivityRestAddTimeButton`, using the `15.arrow.trianglehead.*` symbols or text.
  - Below that is the same ⏪ / stats / ⏩ row, showing the next set's target ("130 LB · 10 REPS · RIR 2").
  - `_luminanceReducedStat` and `_fullScreenStat` (fields) indicate a separate layout for Always On (dimmed) and for StandBy or full-screen.
- **Lock screen, finished** (`LiveActivityLockScreenBannerFinishedWorkout {showTitle, useDeeplinkForEndButton}`). Not seen.
  - Guess: the title "Workout complete" with an "End" or "Review & End" button. `confirmEndAction` decides whether the button confirms in-app.
- **Dynamic Island.**
  - **Compact leading:** `LiveActivityDynamicIslandCompactThumbnail`, a small circular exercise thumbnail or initials.
  - **Compact trailing:** `LiveActivityDynamicIslandTrailing`, the rest countdown during rest (`Rest {rest, alignment, force}`). Guess: the set caption otherwise.
  - **Minimal:** `LiveActivityDynamicIslandMinimal`, which shows either `Logo` (the MF Workouts logo) or `Rest` (the countdown).
  - **Expanded:** only the `.bottom` region is used (`DynamicIslandExpandedRegionPosition.bottom` is the only position imported). `LiveActivityDynamicIslandExpandedBottom` holds `HorizontallyStackedThumbnailLayout {thumbnailOffset}`, `RestCounter`, and `RestTitle`. Guess: it mirrors the lock-screen banner (thumbnail, title, controls) inside the island.
  - The island sets `keylineTint` (the tint) and `widgetURL`.
  - Not seen in any image.
- **Watch Smart Stack.**
  - The Live Activity opts into `supplementalActivityFamilies([.small])` (`WX` imports `WidgetConfiguration.supplementalActivityFamilies` and `ActivityFamily.small`). It therefore appears in the paired Apple Watch's Smart Stack, and on the Mac menu bar via iPhone Mirroring. The Flutter setting copy confirms the Watch and Mac targets (§3.4).
  - The small-family views are `WatchSmartStackActiveTask`, `WatchSmartStackThumbnail`, `SmartStackStat {compactLayout, useAbbreviatedPerSide}`, and `LiveActivityWatchSmartStackFinishedWorkout`.
  - Not seen.

### 3.3 Buttons (App Intents)

From `RunnerWidgets.appex/Metadata.appintents/extract.actionsdata`:

| Intent                                                      | Title                  | Opens app | Auth policy                | Params                           |
| ----------------------------------------------------------- | ---------------------- | --------- | -------------------------- | -------------------------------- |
| `LiveActivityIntentPrevious`                                | "Previous"             | no        | 0 (always allowed)         | none                             |
| `LiveActivityIntentNext`                                    | "Next"                 | no        | 0                          | none                             |
| `LiveActivityIntentRestLess`                                | "Rest 10 Seconds Less" | no        | 0                          | `duration` (seconds, default 10) |
| `LiveActivityIntentRestMore`                                | "Rest 10 Seconds More" | no        | 0                          | `duration` (seconds, default 10) |
| `LiveActivityIntentEndWorkout`                              | "End"                  | yes       | 2 (requires device unlock) | none                             |
| `LiveActivityDarwinIntent{Previous,Next,RestLess,RestMore}` | same                   | no        | 0                          | none                             |

- **Intent protocols.** All `LiveActivityIntent*` adopt `com.apple.link.systemProtocol.SessionStarting`, so they are `LiveActivityIntent`s that run in the app process. The `Darwin` variants post a Darwin notification on `com.sbs.train.liveActivity` with the payload `previous`, `next`, `restLess`, or `restMore` (`WorkoutLiveActivityNotification`). The app handles it in `WorkoutLiveActivityActions.onDarwinNotification` (`RUN` str). `useDarwinIntents` picks the path.
- **Handlers.** `previous(preciseInvocationTime:)`, `next(...)`, `rest(less:...)`, `rest(more:...)`, and `end(...)`. The logs "User interacted with rest LiveActivity, but workout was not resting or available" and "User interacted with an abandoned LiveActivity" (`RUN` str) show how each case is handled.
- **What Next does.** It completes the current task with the displayed values and advances. During rest it skips the rest. This is the same as `userDidTapNext(date:exclude:withAlert:)` in `HandheldWorkout`. Previous calls `retreatToPreviousStepMarkingCurrentStepIncomplete`. There is no in-banner editing of weight or reps.
- **Rest step.** The intent titles and the default `duration` say 10 s, but the shipped banner shows "-15 / +15" and the widget uses the `15.arrow.trianglehead.*` symbols. The phone's Rest Timer sheet also steps by ±15 s (README §7). Measured conclusion: the banner passes 15. Note that help article 320 says "Add or subtract 10 seconds" (https://help.macrofactorapp.com/en/articles/320-changing-rest-time-during-a-workout), which is stale or describes another surface.
- **`LiveActivityToggle`.** `{isOn, intent, darwinIntent, label}` uses `Toggle(isOn:intent:)`. Guess: the Next/complete control is a toggle so it can flip optimistically before the app confirms.
- **Rest-end alert.** The rest-end notification text is "Time for your next set", with the sound `silentLiveActivity.wav` (`RUN` str). The time-sensitive "Rest timer complete" notification predates the Live Activity (`watch-liveactivity-rest-timer-notification.jpg`). The entitlement `com.apple.developer.usernotifications.time-sensitive` is present.

### 3.4 Lifecycle and settings

- **Flutter channel.** `com.sbs.train.activitykit` with the methods `setUseActivityKit`, `onStartupSetUseActivityKit`, `startOrForceUpdateLiveActivityForCurrentWorkout`, `endLiveActivity`, `endAllLiveActivities`, and `state`. State is `ActivityKitState {permissions: unavailableOnThisDevice | disabled | allowed, activities: [{systemID, workoutInstanceId, name, isActive}]}` (`RUN` fields).
- **Who updates it.** `HandheldWorkout.BroadcastDestinations` is `flutter`, `healthKitPeer`, `lan`, `widget`, `liveActivity`, and `restTimer`. The native `HandheldWorkout` broadcasts every state change to each one. `RUN` imports `Activity.request(attributes:content:pushType:)` but no `pushTokenUpdates`, and `WX` has no push-token strings. Guess: the phone updates the Live Activity locally and passes `pushType: nil`.
- **Setting.** "Use Live Activity", with the subtitle "Show your current task and rest timer on your lock screen, Dynamic Island, Watch and Mac" or a shorter variant "Show your current task and rest timer on your lock screen" (Flutter str, [`app-strings.md`](app-strings.md) pool).
  - Guess: the short variant is for devices without a Dynamic Island.
  - The toggle does not appear on the Mac build's Workout settings page (`screens/settings-workout-02.jpg`), so it is iPhone-only.

## 4. Apple Health

### 4.1 Writes

- **Workouts** (`HKWorkout`) are written three ways:
  - **Live, from the watch:** `HKWorkoutSession` with `HKLiveWorkoutBuilder` and `HKLiveWorkoutDataSource`. Heart rate, active energy, basal energy, and pause/resume `HKWorkoutEvent`s are collected by the builder.
  - **Live, from the iPhone:** the same classes (`HKWorkoutBuilderBox.Live`), gated by the `useHealthKitLive` flag (Flutter channel `com.sbs.train.general` method `setUseHealthKitLive`).
  - **Manual or past:** `HKWorkoutBuilderBox.Local` (a plain `HKWorkoutBuilder`), `SavePastMFWorkoutToHealthKitRequest {completedAt, completed, userBodyMassKg?, sex}`, and `saveManualLocalHKWorkout(_:ended:)`. The builder adds estimated `activeEnergyBurned` samples ("Manual HKWorkoutBuilder failed to add activeEnergyBurned", `RUN` str). The flag is `useHealthKitWorkouts` (`setUseHealthKitWorkouts`).
- **Activity type.** Guess: `.traditionalStrengthTraining`. The code carries the whole `WorkoutActivityType` list (`WX` fields), and `RestDayAutomation.allowedOnRestDays` uses it, but the literal used for MF sessions was not found.
- **Metadata.** `attachMetadata(workoutInstanceId:workoutName:workoutPlanName:)` (`RUN` str). The MF instance ID, the workout name, and the program name are stored on the HKWorkout. The ID is what lets session recovery match (§2.1). The metadata key names were not recovered.
- **Workout effort.**
  - `HealthKitStore.transferWorkoutEffortScores(from:to:)` and `extractAndRemoveEffortScores(from:)` call `relateWorkoutEffortSample:withWorkout:activity:` and `unrelateWorkoutEffortSample:...`. `HKQuantityTypeIdentifierWorkoutEffortScore` and `HKQuantityTypeIdentifierEstimatedWorkoutEffortScore` are both referenced (`RUN` str).
  - When MF rewrites a workout, it moves any effort rating the user gave in Fitness to the new HKWorkout. `combineSequentialWorkoutsOmittingManualEnergyBurnedSamples(_:start:)` merges sequential HKWorkouts, for example after a resume.
  - Guess: MF does not compute its own effort score from RIR.
- **Deletion and cleanup.**
  - Deleting a logged workout in MF deletes its HKWorkout (`deleteSavedWorkout`, "Deleting workouts by UUID via Workout Channel").
  - "A live HKWorkoutSession completed, but useHealthKitWorkouts is now false. Deleting the workout." shows that turning writing off mid-session discards the HK copy.
  - The error cases `permissionsWriteDeniedLiveWorkoutNotStarted`, `userDisabledHealthKitIntegrationLiveWorkoutNotStarted`, `stoppedAnotherAppStartedWorkout`, `healthKitUnavailableOnThisDevice`, and `manualWorkoutFailedToSaveToHealthKit` surface to Flutter. One message is "Workout could not be saved to HealthKit. Try unlocking your device and try again." (`RUN` str).
- **The healthKitId round-trip.** `RemoteWorkout.healthKitId` links the MF workout to its HKWorkout UUID.
- **Other writes.** Body weight (`HealthKitClient.logWeight`) and the shared MF Nutrition food logging code (`logFood`/`deleteFood`) are present, but the food path belongs to the Nutrition app.

### 4.2 Reads

- **Steps, weight, body metrics.** The Integrations page copy is "Sync your steps, weight, body metrics, and workouts with Apple Health" (Flutter str).
  - Help article 354: integrations "read or share training-related data", path More > General > Integrations, with steps as the example (https://help.macrofactorapp.com/en/articles/354-integrations-workouts).
  - The Flutter side uses MacroFactor's fork of the `health` plugin (`SwiftHealthPlugin` in `RUN`). Its type list includes STEPS, WEIGHT, BODY_FAT_PERCENTAGE, WAIST_CIRCUMFERENCE, HEIGHT, HEART_RATE, RESTING_HEART_RATE, ACTIVE/BASAL_ENERGY_BURNED, EXERCISE_TIME, and WORKOUT. Which of these Workouts requests is not proven; guess: steps, weight, body fat, and waist.
- **Workouts, for rest-day autodetection.** `HKHealthStore.restDays(in:minimumWorkoutDuration:allowedActivitiesOnRestDay:)` (`RUN` sym) backs `MFWorkoutPreferences.restDayAutomation {autodetect, allowedOnRestDays: Set<WorkoutActivityType>}`. Days with a qualifying workout from any app are not treated as rest days. Workouts of the allowed types (for example walking) still count as rest. "Apple Health Manager: Reading exercise data via Workout Channel" (Flutter str).
- **Heart-rate zones.** The `karvonen` algorithm needs resting HR and age. `PreferencesUser {dob, height, sex}` and `HKCharacteristicTypeIdentifierDateOfBirth` and `BiologicalSex` are referenced. Guess: resting HR and DOB come from Health.
- **Entitlements and usage strings.**
  - `com.apple.developer.healthkit` and `healthkit.background-delivery` are present.
  - `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription` are both "We will sync your data with the Apple Health app to give you better insights".
  - The `fetch`, `remote-notification`, `nearby-interaction`, and `audio` background modes are present. `audio` keeps rest-timer sounds alive (`RestTimerAudio.keepAlivePlayer`).

### 4.3 Settings that control Health

- **More > General > Integrations > Apple Health:** enable or "Disable Integration" (Flutter str). This sets `useHealthKitWorkouts` and `useHealthKitLive` (UserDefaults keys in `WX` str).
  - Guess: the two flags are the "save workouts" and "record live session (heart rate, calories)" toggles inside that page. The page was not driven because macOS has no Health data.
- **Per-type permissions** come from the iOS Health sheet (`askForAllPermissions`).

## 5. Watch widgets and complications

- **The Live Activity in the Smart Stack** is the only watch surface whose code is present (§3.2).
- **Watch widget kinds.** `StableWidgetKind` (`WX` fields) lists the Workouts kinds:
  - `com.sbs.train.watch.currentWorkout`
  - `com.sbs.train.watch.currentWorkout.exercise`
  - `com.sbs.train.watch.currentWorkout.exercise.relevance`
  - `com.sbs.train.watch.currentWorkout.metricsNext.relevance`
  - `com.sbs.train.watch.currentWorkout.next`
  - `com.sbs.train.watch.currentWorkout.previous`

  `WidgetCenter.invalidateRelevance(ofKind:)` is imported. These kinds are implemented in the watch app's own widget extension, which is absent here.
  - Guess: a "current workout" complication, an exercise widget and a "next metrics" widget that use watchOS 26 RelevanceKit to surface in the Smart Stack during a workout, and Previous and Next Control widgets.

- **The `UserDefaults` key `workoutWidgetCurrent`** (`WX` str) is the shared app-group payload (`group.com.sbs.train`) that those widgets read.
- **Classic complications.** The `complicationSchedule` and "Watch complications" strings belong to the Nutrition watch path. No Workouts-specific complication copy was found.

## Open questions

- Watch home screen: the exact list order, gym picker, and whether ad-hoc (empty) workouts can start on the watch. `tintAdHocFallback` suggests they can.
- Watch Controls page contents: which buttons (pause, end, water lock, music), and whether it is the left page as in Apple's Workout app.
- The Digital Crown step size for weight, and what `crownIteratesEquipmentWeight` steps through.
- Behavior with no phone and no internet. Can the cloud transport queue everything, and does the in-progress workout stay usable?
- The HK activity type, the metadata key names, and whether MF writes per-set `HKWorkoutActivity` intervals or only a single workout.
- The exact Dynamic Island compact and expanded layouts, the finished-banner layout, and the Smart Stack small-family layout. No image exists.
- Whether the watch rest adjust is ±10 s (the `plus10` and `minus10` glyphs) while the Live Activity is ±15 s.
- Which Health types Workouts reads (steps only, or also weight, body fat, resting HR, DOB).
- Whether the watch summary screen exists or the watch hands off to the phone's Workout Complete flow.
- Reddit beta threads (r/MacroFactor) were not reachable (HTTP 403). They are the best remaining source for real watch screenshots.
