# Stack

- Language: Swift
- Package Manager: Swift Package Manager
- Minimum targets: iOS 17 and macOS 14
- Keep dependencies rare and intentional

# Development

- Run `./scripts/run` to build, install, and launch the app, with automatic rebuild and relaunch after saving. Requires Bun and Xcode. Stop with Ctrl-C, or use `--no-watch` for one launch.
- Use `./scripts/run --targets` to list devices and simulators; `*` marks the effective default. Select with `-t simulator`, `-t mac`, or `-t "iPhone 17"` (also accepts an identifier). It opens Device Hub on Xcode 27 or Simulator.app on earlier Xcode versions.
- Selection precedence is `-t` / `--target`, then `SWIFT_RUN_DEFAULT_TARGET`, then a connected iOS device, booted simulator, available simulator, or My Mac. Duplicate simulator names prefer a booted instance, then the newest runtime; use an identifier to select exactly. Add simulator runtimes in Xcode's settings.
- Physical devices need Xcode pairing, Developer Mode, and an unlocked screen. Configure automatic signing in Xcode, pass `--team`, or set `SWIFT_RUN_DEVELOPMENT_TEAM`.
- Edit SwiftUI code and resources in `Sources/App`; Xcode picks up new files automatically. Open `App.xcodeproj` and use the shared `App` scheme for debugging.
- Build errors leave the watcher running; fix the error and save again. Build output is in `DerivedData/device/build.log`, `DerivedData/simulator/build.log`, or `DerivedData/mac/build.log`. Use `xcrun simctl io <UDID> screenshot /tmp/app.png` to inspect the screen.
- `swift build` checks the shared code on macOS. Use the Xcode project for simulator builds and bundled resources; `swift run` launches the macOS executable.

# Environment

- When nested in `monorepo-swift`, this directory is an env-manager target of the root `.env`. Edit local values only in the root `.env.local` and run `env-manager gen --local` from either directory.
- Generated `Config/LocalSecrets.xcconfig` is ignored. `Config/Base.xcconfig` includes it for Debug and Release; `Config/Info.plist` makes `API_URL` available to `AppEnvironment.apiURL`.
- Saving generated configuration also triggers the launcher watcher. Native settings are bundled into the app, so keep server credentials out of the Swift target.
