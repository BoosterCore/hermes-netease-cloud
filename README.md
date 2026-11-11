# NetEase Cloud Music · 网易云音乐

**English** · [简体中文](README.zh-CN.md)

A minimal NetEase Cloud Music player for the Hermes Desktop status bar, in the
spirit of the built-in Radio plugin.

> **Disclosure**
>
> The plugin's local backend calls NetEase Cloud Music public web endpoints
> (`music.163.com`, `interface3.music.163.com`, and the `p*.music.163.com`
> CDNs) for search, playlists, lyrics and playable audio URLs.
> **No other third-party services and no telemetry.**
>
> **Stored credential:** after you log in, your NetEase session cookie
> (`MUSIC_U`) is stored in the plugin's own data directory
> (`data/cookie.json`, git-ignored). "Log out" deletes it. The cookie is sent
> only to NetEase hosts; it is never passed to any other service. VIP songs
> stream through this session. QR / SMS sign-in may be blocked by NetEase
> risk control — the panel then links to NetEase's official verification
> page, and pasting the `MUSIC_U` cookie remains the reliable fallback.
>
> No build step, no Python dependencies beyond what Hermes already ships
> (FastAPI) — NetEase's weapi/eapi crypto (AES-CBC/ECB + RSA) is implemented
> with the standard library only.

## Features

- 🔎 **Search** songs and playlists (two tabs: Songs / Playlists)
- ✨ **For You tab** (login required): Daily Recommendations (30 songs),
  Personal FM, and recommended playlists — including the official Private Radar
- ▶️ **Playback controls**: play / pause / previous / next, progress bar,
  volume — all in a consistent thin-outline style
- 📜 **Scrolling synced lyrics** with the current line highlighted
- ❤️ **Favorites**: like / unlike right from the status bar (official-player
  style ♥ toggle) or any song row, plus the "Liked Music" playlist
- 📁 **My Playlists**: browse your own NetEase playlists and play them
  right inside the panel
- 🔑 **Login**: QR code, phone number + SMS verification code, **or** paste
  your `MUSIC_U` cookie (if risk control blocks QR/SMS, the panel links to
  NetEase's official verification page; the cookie is the reliable fallback)
- 🔁 **Play modes**: list loop / single loop / shuffle
- 🖥️ **Status bar**: mini controls on the bottom status bar (plus a live audio-spectrum
  dot visualiser) and a compact popover panel; follows the Hermes theme, no build step
- 💿 **Vinyl player art**: the Now Playing cover spins as a black-groove record with an
  articulated tonearm (drops on play, parks on pause); the current track shows as a mini
  spinning disc in every list

## Install

```bash
hermes plugins install BoosterCore/hermes-netease-cloud
hermes plugins enable netease-cloud
```

Then enable **NetEase Cloud Music** under **Capabilities → Plugins**.
VIP tracks require a logged-in NetEase VIP account.

## Login (pick one)

**Option A · QR code** — open the 账号 (Account) tab and scan with the
NetEase Cloud Music app. If you see "检测到当前设备环境异常，本次操作已拦截"
(risk control), try Option B.

**Option B · SMS verification code** — on the 账号 (Account) tab, enter your
phone number, tap send, type the 6-digit code. If NetEase answers with
error 8810 ("网络环境存在安全风险"), click the 打开验证页面 button the panel
shows, finish the official verification in your browser, and retry about
24 hours later (avoid repeated retries meanwhile).

**Option C · Cookie (recommended, most reliable)**
1. Log in to [music.163.com](https://music.163.com) in a desktop browser
2. Open DevTools (F12) → Application/Storage → Cookies → copy the **value** of
   `MUSIC_U`
3. Paste it into the input on the 账号 (Account) tab and hit import
   (pasting the full cookie string also works; if you accidentally paste
   `NMTID` the plugin will tell you)

## Screenshots

![banner](docs/banner.png)

| Now Playing | Lyrics | Search · Songs |
|---|---|---|
| ![now playing](docs/screenshots/01-now-playing.png) | ![lyrics](docs/screenshots/02-lyrics.png) | ![search songs](docs/screenshots/03-search-songs.png) |

| Search · Playlists | My Playlists | Playlist Tracks |
|---|---|---|
| ![search playlists](docs/screenshots/04-search-playlists.png) | ![my playlists](docs/screenshots/05-my-playlists.png) | ![playlist tracks](docs/screenshots/06-liked-tracks.png) |

## Known limitations

- Playlists load the first 1000 tracks (the panel shows the real total)
- Audio quality follows your NetEase account (VIP → higher bitrate); the
  plugin requests `exhigh` and falls back to `standard` when unavailable
- QR / SMS sign-in may be blocked by NetEase risk control ("environment
  anomaly") — complete the official verification page the panel links to, or
  use cookie login instead

## Repository layout

```
netease-cloud/
├── plugin.yaml            # Hermes plugin manifest
├── CHANGELOG.md           # release history (EN; 中文: CHANGELOG.zh-CN.md)
├── dashboard/
│   ├── manifest.json      # backend API declaration
│   └── plugin_api.py      # FastAPI routes: search / recommend / url / lyric / like / login ...
└── desktop/
    ├── src/               # canonical UI sources (plugin.src.js + qrlib.js)
    └── plugin.js          # built status-bar UI (single-file ESM, @hermes/plugin-sdk)
```

## License

MIT
