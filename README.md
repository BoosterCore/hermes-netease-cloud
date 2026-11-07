# NetEase Cloud Music — Hermes Desktop Plugin

A minimal NetEase Cloud Music (网易云音乐) player that lives in the Hermes
Desktop status bar, in the spirit of the built-in Radio plugin.

## Features

- 🔎 Search **songs** and **playlists** (单曲 / 歌单)
- ▶️ Play / pause / previous / next, seek bar, volume — thin outline style
- 📜 Scrolling lyrics (歌词) with the current line highlighted
- ❤️ Like / unlike songs, "Liked Music" playlist
- 📁 Your own NetEase playlists, browse and play in place
- 🔑 Login by QR scan **or** by pasting your `MUSIC_U` cookie (QR login is
  sometimes blocked by NetEase risk control; cookie import is the reliable
  fallback)
- 🔁 Playback modes: playlist loop / single loop / shuffle
- 🖥️ Status-bar mini controls + a compact popover panel; follows the
  Hermes theme, no build step

## Install

```bash
hermes plugins install <owner>/hermes-netease-cloud
hermes plugins enable netease-cloud
```

Then open **Capabilities → Plugins** and enable “网易云音乐”. VIP songs
require a logged-in NetEase VIP account.

## Disclosure

- **Network:** the plugin's local backend calls NetEase Cloud Music public
  web endpoints (`music.163.com`, `interface3.music.163.com`, `p*.music.163.com`
  CDNs) for search, playlists, lyrics and playable audio URLs. No other
  third-party services; no telemetry.
- **Stored credential:** after you log in, your NetEase session cookie
  (`MUSIC_U`) is stored in the plugin's own data directory
  (`data/cookie.json`, not tracked by git). "Log out" deletes it. VIP songs
  stream through this session.
- **Credentials never leave for other services:** the cookie is sent only to
  NetEase hosts.

## Layout

```
netease-cloud/
├── plugin.yaml            # Hermes plugin manifest
├── dashboard/
│   ├── manifest.json      # backend API declaration
│   └── plugin_api.py      # FastAPI router: search / url / lyric / login ...
└── desktop/
    └── plugin.js          # Desktop status-bar UI (single-file ESM, @hermes/plugin-sdk)
```

The Python backend has **no third-party dependencies** beyond what Hermes
ships (FastAPI): NetEase's weapi/eapi crypto (AES-CBC/ECB + RSA) is
implemented with the standard library only.

## Notes & limits

- Very large playlists load their first 1000 tracks (the panel shows the
  real total).
- Audio quality follows your NetEase account (VIP → higher bitrates); the
  plugin requests `exhigh` and falls back to `standard`.
- QR login may be intercepted by NetEase risk control ("环境异常"); in that
  case use cookie import — it works everywhere.

## License

MIT
