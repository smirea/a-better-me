# Stack

- Language: Swift
- Minimum target: the newest iOS (27), iPhone only, portrait, dark mode. No legacy support: use the newest APIs freely and never add `#available` fallbacks.
- Prefer native SwiftUI components and Liquid Glass over custom ones. Style native components with `DesignSystem/` tokens before building a replacement.
- Keep dependencies rare and intentional

# Development

- Run `./scripts/run` to build, install, and launch the app, with automatic rebuild and relaunch after saving. Requires Bun and Xcode. Stop with Ctrl-C, or use `--no-watch` for one launch.
- Use `./scripts/run --targets` to list devices and simulators; `*` marks the effective default. Select with `-t simulator` or `-t "iPhone 17"` (also accepts an identifier). It opens Device Hub on Xcode 27 or Simulator.app on earlier Xcode versions.
- Selection precedence is `-t` / `--target`, then `SWIFT_RUN_DEFAULT_TARGET`, then a connected iOS device, booted simulator, or available simulator. Duplicate simulator names prefer a booted instance, then the newest runtime; use an identifier to select exactly. Add simulator runtimes in Xcode's settings.
- Physical devices need Xcode pairing, Developer Mode, and an unlocked screen. Configure automatic signing in Xcode, pass `--team`, or set `SWIFT_RUN_DEVELOPMENT_TEAM`.
- Edit SwiftUI code and resources in `Sources/App`; Xcode picks up new files automatically. Open `App.xcodeproj` and use the shared `App` scheme for debugging.
- Build errors leave the watcher running; fix the error and save again. Build output is in `DerivedData/device/build.log`, or `DerivedData/simulator/build.log`. Use `xcrun simctl io <UDID> screenshot /tmp/app.png` to inspect the screen.
- There is no Swift package. The Xcode project is the only build: `xcodebuild build -project App.xcodeproj -scheme App -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO` checks compilation, and `./scripts/run -t simulator --no-watch` builds and launches it.

# Environment

- When nested in `monorepo-swift`, this directory is an env-manager target of the root `.env`. Edit local values only in the root `.env.local` and run `env-manager gen --local` from either directory.
- Generated `Config/LocalSecrets.xcconfig` is ignored. `Config/Base.xcconfig` includes it for Debug and Release; `Config/Info.plist` makes `API_URL` available to `AppEnvironment.apiURL`.
- Saving generated configuration also triggers the launcher watcher. Native settings are bundled into the app, so keep server credentials out of the Swift target.
