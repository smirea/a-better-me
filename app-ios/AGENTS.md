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
- Build errors leave the watcher running; fix the error and save again. Build output is in `DerivedData/device/build.log`, or `DerivedData/simulator/build.log`. Drive the running app with T3 Code's device tools: `device_open` on your own simulator returns an `agent-device` command (`snapshot -i`, `click @eN`, `fill`, `screenshot`). Its flags must reach the command as separate words, which a zsh variable does not do, so call it through a small bash wrapper. Keep the wrapper inside your worktree (under the git-ignored `DerivedData/`), never at a shared path such as `/tmp/ad`: parallel agents overwrote each other's wrapper there and drove the wrong simulator. Run it from that folder too, because agent-device binds a session to the working directory. Give interactive elements accessibility labels so snapshots name them.
- Agents drive simulators headless through T3 Code's tools, not `./scripts/run` (it opens Device Hub or Simulator.app) or raw `simctl`. Build with `xcodebuild` (below), then `device_open` boots the simulator without Simulator.app and returns the `--config` and `--session` flags. `agent-device install` and `agent-device open` install and launch the build. Call `device_close` with `shutdown: false` right away so the Device panel stays closed while the CLI keeps working; keep the panel open only when the user should watch.
- Clean up before reporting: `agent-device close` with your flags ends the session, then `device_close` with `shutdown: true` powers the simulator off. A session left open locks the device, and the next agent gets `DEVICE_IN_USE`. T3 has no delete tool, so a simulator you created yourself still needs `xcrun simctl delete <udid>`.
- Relaunch with `xcrun simctl launch --terminate-running-process <udid> com.stefan.a-better-me -seedSampleData` to fill an empty store with two templates and ten weeks of history (Debug builds only). `-syncToken <token>` stores the owner token so the simulator syncs with the worktree's server (`insecure-local-dev-owner-token` locally). Erase the app's data by uninstalling it (`xcrun simctl uninstall <udid> com.stefan.a-better-me`). The local database is `Library/Application Support/a-better-me/a-better-me.sqlite` in the app's data container; `sqlite3` can read the tables, the `_outbox` queue, and `_meta` (client id and cursor) directly.
- Regenerate the default gym equipment loads with `bun scripts/gym-defaults.ts`.
- Regenerate the bundled exercise catalog with `bun scripts/catalog.ts` and fonts with `uv run --with fonttools python scripts/make-fonts.py <MF fonts dir> Sources/App/Resources/Fonts`.
- The one dependency is the sync engine's Swift package, `https://github.com/smirea/sync-engine` on branch `master` in `App.xcodeproj`, which brings GRDB (see `docs/decisions/sync.md`). The launcher signs simulator builds ad hoc so the Keychain entitlement in `Config/App.entitlements` is embedded.
- There is no Swift package. The Xcode project is the only build: `xcodebuild build -project App.xcodeproj -scheme App -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO` checks compilation, and `./scripts/run -t simulator --no-watch` builds and launches it.

# Environment

- When nested in `monorepo-swift`, this directory is an env-manager target of the root `.env`. Edit local values only in the root `.env.local` and run `env-manager gen --local` from either directory.
- Generated `Config/LocalSecrets.xcconfig` is ignored. `Config/Base.xcconfig` includes it for Debug and Release; `Config/Info.plist` makes `API_URL` available to `AppEnvironment.apiURL`.
- Saving generated configuration also triggers the launcher watcher. Native settings are bundled into the app, so keep server credentials out of the Swift target.
