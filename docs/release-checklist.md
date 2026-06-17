# Release Checklist

## Code Health

- `npm run lint`
- `npm test`
- `cargo test` in `src-tauri/`
- Confirm no unintended local changes in `git diff`

## Core Flows

- Create alarm task
- Create countdown task
- Edit existing task
- Delete task with confirmation
- Import backup and verify replacement
- Export backup and open file

## Runtime Features

- Trigger a flight manually
- Countdown complete triggers flight
- Emergency landing stops active flights
- Mini window displays upcoming task
- Deep link `gugufly://add?...` creates task

## Settings

- Theme switch works
- Mute toggle syncs to tray
- Quiet hours are respected
- Autostart toggle works in Tauri runtime
- Flight settings persist after restart

## Media

- Upload custom image and preview it
- Upload custom audio and preview it
- Clear uploaded image/audio

## Release UX

- Update check dialog opens and shows status
- Feedback / release links open correctly
- App version displays correctly

## Packaging

- `npm run tauri build`
- Verify expected bundles exist for target platform
- Smoke test produced app bundle once before publishing
