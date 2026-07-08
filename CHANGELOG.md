# Changelog

## v0.8.0 (2026-07-07)

### ✨ New Features
- **Task card overflow menu**: Consolidated less-used buttons (copy, delete, stop, repeat) into ⋯ dropdown menu, keeping cards clean
- **Quick create Chinese time**: Support "三点"/"三点钟" → 3:00 parsing
- **+5/+10 minute buttons**: Now work correctly with countdown timers (persist + re-render)

### 🐛 Bug Fixes
- **Detail sidebar English params**: Fixed `{{status}}`, `{{summary}}`, `{{time}}` placeholders showing in task detail drawer
- **Detail sidebar unclickable buttons**: Fixed z-index issue where overlay intercepted button clicks
- **Flight statistics = 0**: Fixed post-flight "repeat" action not recording flights to log
- **SettingsPanel test**: Fixed failing import preview test (200/200 tests passing)

### 🌍 Internationalization
- Added missing en.js keys: `stats.flight_count`, `stats.loading`, `stats.times`
- Replaced 29+ hardcoded Chinese strings across 14 files with i18n `t()` calls
- Added `labelOnly()` helper to strip `{{param}}` placeholders from drawer labels
- Fixed ESC hint in edit modal showing raw `{{key}}` placeholder

### 🎨 UI/UX
- **Dark theme**: Added 11 missing CSS overrides (task-list, task-toggle, hero-toolbar, form-block, etc.)
- **Task card buttons**: Only expand + play/pause remain inline; all others in ⋯ dropdown
- **Dropdown z-index**: Added `.task-drawer-content { z-index: 1 }` and `.task-card--menu-open { z-index: 10 }` to prevent overlay/button click issues

### ⚡ Performance
- **Video playback optimization**: Replaced Canvas 2D drawImage with DOM video element for hardware-accelerated compositing (2-4x faster on Intel Macs)

### 🔧 Infrastructure
- **storage.js**: Added `setStoreFailureHandler()` with toast notification when Tauri store fails to initialize
- **Windows packaging**: Removed unused `staticlib` crate type; wrapped global shortcuts in try-catch to prevent startup crashes
- **Crash log**: Improved to append with timestamps instead of overwriting
- **NSIS config**: Added bundle.nsis configuration for Windows installer
- **Code quality**: Changed 3 placeholder `showToast` functions from `console.log` to `console.warn`

### 📦 Dependencies
- Tauri 2.11.2 (unchanged)
