# NetEase Cloud Music · 网易云音乐

A minimal NetEase Cloud Music (网易云音乐) player for the Hermes Desktop
status bar. 一个运行在 Hermes 桌面版底部状态栏的极简网易云音乐播放器。

> **English (for reviewers & international users)**
>
> A status-bar mini player for NetEase Cloud Music, in the spirit of the
> built-in Radio plugin. The plugin's local backend calls NetEase Cloud Music
> public web endpoints (`music.163.com`, `interface3.music.163.com`, and the
> `p*.music.163.com` CDNs) for search, playlists, lyrics and playable audio
> URLs. **No other third-party services and no telemetry.**
>
> **Stored credential:** after you log in, your NetEase session cookie
> (`MUSIC_U`) is stored in the plugin's own data directory
> (`data/cookie.json`, git-ignored). "Log out" deletes it. The cookie is sent
> only to NetEase hosts; it is never passed to any other service. VIP songs
> stream through this session. QR login may be blocked by NetEase risk
> control; pasting the `MUSIC_U` cookie is the reliable fallback.
>
> No build step, no Python dependencies beyond what Hermes already ships
> (FastAPI) — NetEase's weapi/eapi crypto (AES-CBC/ECB + RSA) is implemented
> with the standard library only.

---

## 功能一览

- 🔎 **搜索** 单曲与歌单（单曲 / 歌单 双标签）
- ▶️ **播放控制**：播放 / 暂停 / 上一首 / 下一首、进度条、音量（统一镂空细线风格）
- 📜 **滚动歌词**：自动高亮当前行
- ❤️ **收藏**：红心 / 取消红心、「喜欢的音乐」歌单
- 📁 **我的歌单**：浏览并直接在面板内播放自己的网易云歌单
- 🔑 **登录**：扫码登录 **或** 粘贴 `MUSIC_U` Cookie（扫码常被网易风控拦截，Cookie 是最稳的兜底方案）
- 🔁 **播放模式**：列表循环 / 单曲循环 / 随机播放
- 🖥️ **状态栏**：底部状态栏迷你控制 + 紧凑弹出面板，跟随 Hermes 主题，无需构建

## 安装

```bash
hermes plugins install BoosterCore/hermes-netease-cloud
hermes plugins enable netease-cloud
```

然后在 **Capabilities → Plugins（能力 → 插件）** 里打开「网易云音乐」。
VIP 歌曲需要已登录的网易云 VIP 账号。

## 登录教程（二选一）

**方式 A · 扫码登录**
进入「账号」标签 → 用网易云音乐 App 扫码。若提示「检测到当前设备环境异常，本次操作已拦截」，说明被风控拦截，请改用方式 B。

**方式 B · Cookie 登录（推荐，最稳）**
1. 在电脑浏览器登录 [music.163.com](https://music.163.com)
2. 按 F12 打开开发者工具 → Application/存储 → Cookies → 找到 `MUSIC_U` 这一项，复制它的**值**
3. 回到插件「账号」标签，把值粘贴进输入框，点导入即可
   （直接粘贴整串 Cookie 也可以；若误粘了 `NMTID`，插件会提示你）

## 界面截图 Screenshots

![banner](docs/banner.png)

| 正在播放 Now Playing | 滚动歌词 Lyrics | 搜索·单曲 Search · Songs |
|---|---|---|
| ![now playing](docs/screenshots/01-now-playing.png) | ![lyrics](docs/screenshots/02-lyrics.png) | ![search songs](docs/screenshots/03-search-songs.png) |

| 搜索·歌单 Search · Playlists | 我的歌单 My Playlists | 歌单内播放 Playlist Tracks |
|---|---|---|
| ![search playlists](docs/screenshots/04-search-playlists.png) | ![my playlists](docs/screenshots/05-my-playlists.png) | ![playlist tracks](docs/screenshots/06-liked-tracks.png) |

## 已知限制

- 超大歌单载入前 1000 首（面板会显示真实总首数）
- 音质跟随你的网易云账号（VIP → 更高码率）；插件优先请求 `exhigh`，不可用时回退 `standard`
- 扫码登录可能被网易风控拦截（「环境异常」），此时用 Cookie 登录，通用且稳定

## 目录结构

```
netease-cloud/
├── plugin.yaml            # Hermes 插件清单
├── dashboard/
│   ├── manifest.json      # 后端 API 声明
│   └── plugin_api.py      # FastAPI 路由：search / url / lyric / login ...
└── desktop/
    └── plugin.js          # 桌面状态栏 UI（单文件 ESM，@hermes/plugin-sdk）
```

## 许可 License

MIT
