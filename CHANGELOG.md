# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [Semantic Versioning](https://semver.org/).
中文版本见 [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md)。

## [0.5.0] - 2026-11-10

### Added
- **SMS verification-code login**: sign in with phone number + 6-digit code beside the QR code on the Account tab — official web endpoints, 60s resend cooldown, Chinese/English error hints, and a one-click 打开验证页面 button that opens NetEase's official risk-control verification page when error 8810 / -462 appears.
- QR login strategy ladder: official classic web QR content + the new type=3 protocol, automatic downgrade when risk-control codes (-462 / -460 / 8810 / 8821) bite, plus a manual QR-swap button in the panel.
- Blocked-QR guidance now suggests switching to SMS login instead of regenerating codes; the cookie fallback hint covers both methods (以上两种方式被风控拦截？).
- Frosted-glass panel surface (translucent 62% surface + 12px blur, tuned on real hardware).
- Banner redrawn from a pure SVG source (`docs/banner.svg` is now authoritative): vinyl record + traced beamed note + articulated tonearm + x-gradient contour field.

### Fixed
- QR login now bootstraps a **server-minted NMTID** anti-fraud cookie (fresh cookie-less visit to /discover) before creating the code — a self-minted NMTID the server has never seen was the loudest third-party tell for the phone-side "device environment abnormal" check.
- Personal FM rows show a signal-tower placeholder icon when the track carries no cover (was an empty slot).
- Transient TLS/transport glitches (SSL EOF bursts from NetEase load balancers) now retry with exponential backoff instead of surfacing as panel errors.
- SMS endpoints corrected to the live official ones (the eapi captcha/login variants are dead upstream) and the login payload field fixed to `phone`.

## [0.4.0] - 2026-11-09

### Added
- The status-bar dots now dance to the **real audio spectrum**: the fake scrolling marquee is replaced by a live analyser (Web Audio) wired straight into the playing stream — bass hits punch through the dot grid, pauses decay smoothly.
- Per-track CORS probe with automatic fallback: if a CDN ever stops sending `Access-Control-Allow-Origin`, playback stays audible and the visualiser quietly steps aside.
- Visualiser self-heal: a dead audio chain (suspended context / tainted element) rebuilds a clean player automatically; the status bar falls back to the classic marquee when no spectrum is available.
- Previous-track button on the status bar with official rewind semantics (>3s restarts the current track, ≤3s jumps to the previous).
- Vinyl record player art: the Now Playing cover spins as a black-groove record with an articulated S-shaped tonearm that drops onto the record on play and parks off it on pause; the current track's thumbnail renders as a mini spinning disc in every list.
- `/diag` breadcrumb route persists visualiser events to disk for troubleshooting.

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
