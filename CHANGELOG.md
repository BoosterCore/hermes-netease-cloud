# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [Semantic Versioning](https://semver.org/).
中文版本见 [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md)。

## [0.4.0] - 2026-11-09

### Added
- The status-bar dots now dance to the **real audio spectrum**: the fake scrolling marquee is replaced by a live analyser (Web Audio) wired straight into the playing stream — bass hits punch through the dot grid, pauses decay smoothly.
- Per-track CORS probe with automatic fallback: if a CDN ever stops sending `Access-Control-Allow-Origin`, playback stays audible and the visualiser quietly steps aside.

### Changed
- Visualiser loop rebuilt to survive pause/resume/track changes without re-creating the audio graph; AudioContext is closed on plugin dispose.

## [0.3.0] - 2026-11-09

### Added
- Like button (♥) on the status bar itself, next to the transport controls — tap to collect, tap again to un-collect, exactly like the official player bar. Filled red when the current song is already liked.
- Heart states are synced from the server after login, so the button (and every song row) reflects the real "Liked Music" playlist, including songs collected on other devices.

### Fixed
- Like/unlike API call used wrong request parameters and silently never worked for logged-in accounts; it now toggles reliably in both directions.
- Unlicensed / delisted songs can now still be collected (forced insert into the liked playlist fallback).

## [0.2.0] - 2026-11-09

### Added
- "For You" tab: Daily Recommendations, recommended playlists (including the official Private Radar dynamic list), and Personal FM with one-tap play.

## [0.1.0] - 2026-11-07

### Added
- Initial release: status-bar mini player for NetEase Cloud Music — search, playback, synced lyrics, playlists, liked songs, volume/mode controls, QR login and cookie login, bilingual UI (EN/中文).
