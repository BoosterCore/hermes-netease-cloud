import {
  atom, Button, createBudgetedLoop, GlyphSpinner, icons, Popover, PopoverContent, PopoverTrigger,
  randomUuid, RowButton, SearchField, STATUSBAR_AREAS, Tip, usePluginI18n,
  useQuery, useQueryClient, useValue
} from '@hermes/plugin-sdk'
import { useEffect, useRef, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const ID = 'netease-cloud'

/*__QRLIB__*/

// ------------------------------------------------------------------ i18n ---
const EN = {
  netease: 'NetEase Music', search: 'Search songs…', searchHint: 'Search by song, artist or album.',
  noResults: 'No results', searching: 'Searching', play: 'Play', pause: 'Pause', next: 'Next', prev: 'Previous',
  volume: 'Volume', mute: 'Mute', unmute: 'Unmute', lyric: 'Lyrics', back: 'Back', tabSearch: 'Search',
  tabLiked: 'Liked', tabPlaylists: 'Playlists', tabAccount: 'Account', vip: 'VIP', album: 'Album',
  likedEmpty: 'Tap ♥ on a song to collect it here.', playlistsEmpty: 'No playlists yet.',
  loginRequired: 'Scan-to-login unlocks personal playlists and VIP songs.', login: 'Scan to log in',
  qrWaiting: 'Scan with the NetEase app', qrScanned: 'Confirm on your phone', qrExpired: 'QR expired',
  qrBlocked: 'NetEase risk control blocked this scan — try another QR, or use the SMS-code login below', qrSwitch: 'Scan blocked or unresponsive? Try another QR',
  qrRetry: 'Refresh QR', qrCreateError: 'Could not create the QR code', logout: 'Log out', loggedInAs: 'Signed in',
  unplayable: 'Needs VIP or is unavailable in your region', loadError: 'Request failed', notLoggedIn: 'Not signed in',
  vipTag: 'VIP', nowPlaying: 'Now playing', idle: 'NetEase Music', like: 'Like', unlike: 'Unlike',
  noLyric: 'No lyrics for this song', lyricOn: 'Hide lyrics', localOnly: 'Favorites are local until you sign in',
  cookieImport: 'Use cookie', cookiePlaceholder: 'paste the MUSIC_U value (or a full cookie)',
  cookieHint: 'QR blocked by risk control? Open music.163.com in a browser, sign in, copy the cookie (F12 → Application → Cookies) and paste it here.',
  cookieInvalid: 'Saved, but the server rejected it — check MUSIC_U', cookieBusy: 'Verifying…',
  cookieNmtid: 'That looks like NMTID — click the row named MUSIC_U and copy its value',
  cookieNeed: 'No MUSIC_U found — paste the MUSIC_U value or a full cookie',
  smsTitle: 'Or sign in with a phone number + SMS code', smsPhone: 'Phone number', smsCode: 'SMS code',
  smsSend: 'Send code', smsLogin: 'Log in', smsLogging: 'Signing in…', smsGo: 'Use SMS login instead',
  smsSent: 'Code sent — check your text messages', smsBadPhone: 'Enter a valid phone number',
  smsBadCode: 'Enter the code from the text message', smsNoSession: 'Server returned no session — try again',
  smsResend: s => `Resend (${s}s)`,
  partialCount: total => `total ${total} · first 1000 shown`,
  tabNow: 'Now playing', tabRec: 'For You', recDaily: 'Daily Recommendations',
  recDailyHint: '30 songs picked for you, refreshed daily', recFm: 'Personal FM',
  recFmHint: 'Play the current FM batch', recLists: 'Recommended Playlists', recEmpty: 'Nothing to recommend yet',
  modeLoop: 'Playlist loop', modeOne: 'Single loop', modeShuffle: 'Shuffle',
  kindSong: 'Songs', kindPlaylist: 'Playlists',
  noPlayingNow: 'Nothing is playing yet — pick a song first'
}
const LOCALES = {
  en: EN,
  zh: {
    ...EN,
    netease: '网易云音乐', search: '搜索歌曲…', searchHint: '搜索歌曲、歌手或专辑',
    noResults: '没有找到结果', searching: '搜索中', play: '播放', pause: '暂停', next: '下一首', prev: '上一首',
    volume: '音量', mute: '静音', unmute: '取消静音', lyric: '歌词', back: '返回', tabSearch: '搜索',
    tabLiked: '收藏', tabPlaylists: '歌单', tabAccount: '账号', vip: 'VIP', album: '专辑',
    likedEmpty: '点歌名右侧的 ♥ 收藏歌曲', playlistsEmpty: '还没有歌单',
    loginRequired: '扫码登录后解锁个人歌单与 VIP 歌曲', login: '扫码登录',
    qrWaiting: '用手机网易云 App 扫码', qrScanned: '请在手机上确认', qrExpired: '二维码已过期',
    qrBlocked: '网易风控拦截了本次扫码，可点下面换个二维码再试，或直接用下方短信验证码登录', qrSwitch: '扫码被拦或没反应？换一个二维码',
    qrRetry: '刷新二维码', qrCreateError: '二维码获取失败', logout: '退出登录', loggedInAs: '已登录',
    unplayable: '需要 VIP 或版权受限', loadError: '请求失败', notLoggedIn: '未登录',
    nowPlaying: '正在播放', idle: '网易云音乐', like: '收藏', unlike: '取消收藏',
    noLyric: '暂无歌词', lyricOn: '收起歌词', localOnly: '未登录时收藏仅保存在本地',
    cookieImport: '用 Cookie 登录', cookiePlaceholder: '粘贴 MUSIC_U 的值（或整串 cookie）',
    cookieHint: '扫码被风控拦截？用浏览器打开 music.163.com 登录，按 F12 → Application → Cookies，点 Name 为 MUSIC_U 的行，把下面的值粘到这里',
    cookieInvalid: '已保存，但服务器不认，请检查 MUSIC_U 是否复制完整', cookieBusy: '验证中…',
    cookieNmtid: '你粘的这串像 NMTID——请点 Name 为 MUSIC_U 的那一行，再复制它的值',
    cookieNeed: '没找到 MUSIC_U，直接粘贴 MUSIC_U 的值也可以',
    smsTitle: '不想扫码？用手机号 + 短信验证码登录', smsPhone: '手机号', smsCode: '验证码',
    smsSend: '发送验证码', smsLogin: '登录', smsLogging: '登录中…', smsGo: '改用短信登录',
    smsSent: '验证码已发送，请查看手机短信', smsBadPhone: '请输入正确的手机号',
    smsBadCode: '请输入短信里的验证码', smsNoSession: '服务器没返回登录态，请再试一次',
    smsResend: s => `${s}s 后重发`,
    partialCount: total => `共 ${total} 首 · 显示前 1000`,
    tabNow: '正在播放', tabRec: '推荐', recDaily: '每日推荐',
    recDailyHint: '每天 30 首根据你的口味生成', recFm: '私人 FM',
    recFmHint: '播放电台当前推荐的一批歌曲', recLists: '推荐歌单', recEmpty: '暂无推荐，稍后再试',
    modeLoop: '列表循环', modeOne: '单曲循环', modeShuffle: '随机播放',
    kindSong: '单曲', kindPlaylist: '歌单',
    noPlayingNow: '当前没有播放，先去挑一首吧'
  }
}

// ------------------------------------------------------------------- css ---
const CSS = `
.hermes-ncm-bar{display:flex;align-items:center;gap:2px;height:100%;color:var(--ui-text-tertiary)}
.hermes-ncm-wave{height:12px;width:40px;margin-inline:2px;flex-shrink:0;position:relative;font-family:var(--font-mono,monospace);font-size:12px;line-height:12px;color:var(--ui-text-tertiary);opacity:.45;overflow:hidden}
.hermes-ncm-wave-layer{position:absolute;inset:0;display:grid;grid-template-columns:repeat(var(--ncm-columns),minmax(0,1fr));grid-auto-rows:12px}
.hermes-ncm-wave-layer>span{text-align:center;min-width:0}
.hermes-ncm-wave[data-active=true]{color:var(--ui-accent);opacity:1}
.hermes-ncm-bar .ncm-name{max-width:132px;min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;text-align:left}
.hermes-ncm-action{width:20px;height:20px;padding:0;flex-shrink:0}
.hermes-ncm-glyph{display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1}
.hermes-ncm-panel{width:360px;max-width:calc(100vw - 24px);--popover-surface:color-mix(in srgb,var(--ui-bg-elevated) 62%,transparent);backdrop-filter:blur(12px) saturate(1.25);-webkit-backdrop-filter:blur(12px) saturate(1.25)}
.hermes-ncm-tabs{display:flex;gap:2px;padding:2px 4px 6px}
.hermes-ncm-body{max-height:320px;overflow-y:auto;overscroll-behavior:contain}
.hermes-ncm-hint{padding:14px 10px;font-size:11px;color:var(--ui-text-tertiary);text-align:center}
.hermes-ncm-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto auto;align-items:center;gap:8px;padding:4px 8px;width:100%;text-align:left;background:none;border:0;cursor:pointer;color:var(--ui-text-secondary)}
.hermes-ncm-row:hover{background:var(--chrome-action-hover)}
.hermes-ncm-row[data-current=true]{color:var(--ui-accent)}
.hermes-ncm-cover{width:28px;height:28px;border-radius:4px;object-fit:cover;background:var(--chrome-action-hover)}
.hermes-ncm-covericon{display:inline-flex;align-items:center;justify-content:center;color:var(--ui-text-tertiary)}
.hermes-ncm-covericon svg{width:15px;height:15px}
.hermes-ncm-rowmain{min-width:0}
.hermes-ncm-rowtitle{display:flex;align-items:center;gap:5px;font-size:12px;color:inherit;min-width:0}
.hermes-ncm-rowtitle>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.hermes-ncm-tag{font-size:9px;line-height:12px;padding:0 3px;border-radius:3px;border:1px solid currentColor;opacity:.8;flex-shrink:0}
.hermes-ncm-rowmeta{font-size:10px;color:var(--ui-text-quaternary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hermes-ncm-duration{font-size:10px;color:var(--ui-text-quaternary);font-variant-numeric:tabular-nums}
.hermes-ncm-heart{background:none;border:0;cursor:pointer;color:inherit;opacity:.55;padding:2px;border-radius:4px}
.hermes-ncm-heart:hover{opacity:1}
.hermes-ncm-heart[data-on=true]{color:#ec4141;opacity:1}
.hermes-ncm-heart[data-on=true] svg{fill:currentColor}
.hermes-ncm-barheart[aria-pressed=true]{color:#ec4141}
.hermes-ncm-barheart[aria-pressed=true] svg{fill:currentColor}
.hermes-ncm-cookie{flex:1;min-width:0;font-size:11px;padding:3px 6px;border-radius:5px;border:1px solid var(--chrome-action-hover);background:transparent;color:var(--ui-text-primary)}
.hermes-ncm-back{padding:6px 8px}
.hermes-ncm-footer{padding:6px 8px 4px;border-top:1px solid var(--chrome-action-hover)}
.hermes-ncm-transport{display:flex;align-items:center;gap:6px}
.hermes-ncm-time{font-size:10px;color:var(--ui-text-quaternary);font-variant-numeric:tabular-nums;min-width:34px;text-align:center}
.hermes-ncm-progress{flex:1;min-width:0}
.hermes-ncm-volume{display:flex;align-items:center;gap:6px;padding:2px 0 0}
.hermes-ncm-volume input{flex:1;min-width:0}
.hermes-ncm-error{font-size:10px;color:#e0a03c;padding:2px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hermes-ncm-lyric{padding:8px 10px;max-height:320px;overflow-y:auto;overscroll-behavior:contain}
.hermes-ncm-lyric-line{padding:4px 2px;font-size:12px;line-height:1.5;color:var(--ui-text-quaternary);cursor:pointer;text-align:center}
.hermes-ncm-lyric-line[data-active=true]{color:var(--ui-accent);font-size:13px}
.hermes-ncm-account{padding:12px 10px;display:flex;flex-direction:column;align-items:center;gap:8px}
.hermes-ncm-qr{border-radius:8px;background:#fff;padding:6px;line-height:0}
.hermes-ncm-qr img{image-rendering:pixelated}
.hermes-ncm-status{font-size:11px;color:var(--ui-text-tertiary)}
.hermes-ncm-user{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ui-text-secondary)}
.hermes-ncm-avatar{width:34px;height:34px;border-radius:50%;object-fit:cover}
.hermes-ncm-plhead{display:flex;align-items:center;gap:4px;padding:6px 8px;font-size:12px;color:var(--ui-text-primary)}
.hermes-ncm-playcount{font-size:10px;color:var(--ui-text-quaternary)}
.hermes-ncm-chip{font-size:11px;opacity:.5;border-radius:999px;padding:0 8px}
.hermes-ncm-chip[aria-pressed=true]{opacity:1;color:var(--ui-accent);background:var(--chrome-action-hover)}
.hermes-ncm-glyph svg{width:1em;height:1em;display:block}
input[type=range].hermes-ncm-range{-webkit-appearance:none;appearance:none;height:12px;background:transparent;cursor:pointer}
input[type=range].hermes-ncm-range::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:linear-gradient(to right,var(--ui-accent) var(--ncm-pct,0%),var(--chrome-action-hover) var(--ncm-pct,0%))}
input[type=range].hermes-ncm-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:9px;height:9px;margin-top:-3px;border-radius:50%;border:1.5px solid var(--ui-accent);background:transparent}
input[type=range].hermes-ncm-range:hover::-webkit-slider-thumb{background:var(--ui-accent)}
.hermes-ncm-now{display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 10px 8px}
.hermes-ncm-nowcover{width:96px;height:96px;border-radius:8px;object-fit:cover;background:var(--chrome-action-hover)}
/* 唱片化封面：黑胶沟槽盘 + 旋转的封面芯标 + 可选折角唱臂 */
.hermes-ncm-vinyl{position:relative;border-radius:50%;flex-shrink:0;
  background:repeating-radial-gradient(circle at 50% 50%,#101013 0 2px,#17171b 2px 3.2px),#0c0c0e;
  box-shadow:0 4px 12px rgba(0,0,0,.45),inset 0 0 0 1px #26262c}
.hermes-ncm-vinyl::before{content:'';position:absolute;inset:0;border-radius:50%;pointer-events:none;z-index:2;
  background:conic-gradient(from 210deg,transparent 0 40%,rgba(255,255,255,.08) 46%,transparent 52% 100%)}
.hermes-ncm-vinyl::after{content:'';position:absolute;left:50%;top:50%;width:6%;height:6%;margin:-3%;
  border-radius:50%;background:#060608;box-shadow:0 0 0 2px #1d1d22;z-index:3}
.hermes-ncm-vinyl-spin{position:absolute;inset:0;border-radius:50%;animation:hermes-ncm-spin 4.5s linear infinite}
.hermes-ncm-vinyl[data-playing=false] .hermes-ncm-vinyl-spin{animation-play-state:paused}
.hermes-ncm-vinyl img{position:absolute;left:27%;top:27%;width:46%;height:46%;border-radius:50%;object-fit:cover;
  background:var(--chrome-action-hover);box-shadow:0 0 0 3px #0c0c0e,0 0 0 4px #2b2b31}
@keyframes hermes-ncm-spin{to{transform:rotate(360deg)}}
.hermes-ncm-vinyl-big{width:96px;height:96px}
.hermes-ncm-vinyl-mini{width:28px;height:28px;
  background:repeating-radial-gradient(circle at 50% 50%,#101013 0 1px,#17171b 1px 1.6px),#0c0c0e}
.hermes-ncm-vinyl-mini img{left:24%;top:24%;width:52%;height:52%;box-shadow:0 0 0 2px #0c0c0e,0 0 0 3px #2b2b31}
.hermes-ncm-vinyl-arm{position:absolute;right:-12%;top:-4%;width:58%;height:88%;z-index:4;
  transform-origin:87% 10%;transition:transform 1s cubic-bezier(.4,0,.2,1);filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))}
.hermes-ncm-vinyl-arm[data-playing=true]{transform:rotate(-6deg)}
.hermes-ncm-vinyl-arm[data-playing=false]{transform:rotate(-34deg)}
@media (prefers-reduced-motion: reduce){.hermes-ncm-vinyl-spin{animation:none}.hermes-ncm-vinyl-arm{transition:none}}
.hermes-ncm-nowtitle{font-size:13px;color:var(--ui-text-primary);text-align:center;max-width:100%;overflow-wrap:anywhere}
.hermes-ncm-nowmeta{font-size:11px;color:var(--ui-text-tertiary);text-align:center}
`

// --------------------------------------------------------------- helpers ---
const svgIcon = children => function NcmIcon(props) {
  return jsx('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2,
    strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, ...props, children })
}
const CUSTOM_ICONS = {
  SkipBack: svgIcon([jsx('path', { d: 'M5 5v14', key: 'a' }), jsx('path', { d: 'M20 6v12a.8.8 0 0 1-1.25.66l-8.5-6a.8.8 0 0 1 0-1.32l8.5-6A.8.8 0 0 1 20 6z', key: 'b' })]),
  SkipForward: svgIcon([jsx('path', { d: 'M19 5v14', key: 'a' }), jsx('path', { d: 'M4 6v12a.8.8 0 0 0 1.25.66l8.5-6a.8.8 0 0 0 0-1.32l-8.5-6A.8.8 0 0 0 4 6z', key: 'b' })]),
  Repeat: svgIcon([jsx('path', { d: 'M4 9V8a3 3 0 0 1 3-3h10', key: 'a' }), jsx('path', { d: 'M14 2l3 3-3 3', key: 'b' }),
    jsx('path', { d: 'M20 15v1a3 3 0 0 1-3 3H7', key: 'c' }), jsx('path', { d: 'M10 22l-3-3 3-3', key: 'd' })]),
  Repeat1: svgIcon([jsx('path', { d: 'M4 9V8a3 3 0 0 1 3-3h10', key: 'a' }), jsx('path', { d: 'M14 2l3 3-3 3', key: 'b' }),
    jsx('path', { d: 'M20 15v1a3 3 0 0 1-3 3H7', key: 'c' }), jsx('path', { d: 'M10 22l-3-3 3-3', key: 'd' }),
    jsx('path', { d: 'M11 10.5L12.5 9.5V15', key: 'e' })]),
  Shuffle: svgIcon([jsx('path', { d: 'M17 4l4 3-4 3', key: 'a' }), jsx('path', { d: 'M3 7h3.4c1.4 0 2.3.6 3.2 1.8l6 8.4c.9 1.2 1.8 1.8 3.2 1.8H21', key: 'b' }),
    jsx('path', { d: 'M17 14l4 3-4 3', key: 'c' }), jsx('path', { d: 'M3 17h3.4c1.1 0 1.9-.4 2.6-1.2', key: 'd' }),
    jsx('path', { d: 'M14.2 8.7l.4-.5c.9-1.2 1.7-1.2 3-1.2H21', key: 'e' })]),
  Music: svgIcon([jsx('path', { d: 'M9 18V5l11-2v13', key: 'a' }),
    jsx('circle', { cx: 6, cy: 18, r: 3, key: 'b' }), jsx('circle', { cx: 17, cy: 16, r: 3, key: 'c' })]),
  Heart: svgIcon([jsx('path', { d: 'M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572', key: 'a' })]),
  Radio: svgIcon([jsx('circle', { cx: 12, cy: 12, r: 2, key: 'a' }),
    jsx('path', { d: 'M8.5 8.5a5 5 0 0 0 0 7', key: 'b' }), jsx('path', { d: 'M15.5 8.5a5 5 0 0 1 0 7', key: 'c' }),
    jsx('path', { d: 'M5.6 5.6a9 9 0 0 0 0 12.8', key: 'd' }), jsx('path', { d: 'M18.4 5.6a9 9 0 0 1 0 12.8', key: 'e' })])
}
const ic = (name, glyph) => icons[name] || CUSTOM_ICONS[name]
  || function GlyphFallback() { return jsx('span', { className: 'hermes-ncm-glyph', children: glyph }) }

function brailleBars(heights, dotColumns, rows = 2) {
  // heights: 0..1 energy per dot column (dotColumns = charWidth*2). Bottom-up bars.
  const cells = new Uint16Array((dotColumns / 2) * rows)
  const dots = [[1, 2, 4, 64], [8, 16, 32, 128]]
  const dotRows = rows * 4
  for (let x = 0; x < dotColumns; x++) {
    const lit = Math.max(0, Math.min(dotRows, Math.round(heights[x] * dotRows)))
    for (let y = dotRows - lit; y < dotRows; y++)
      cells[Math.floor(y / 4) * (dotColumns / 2) + Math.floor(x / 2)] |= dots[x % 2][y % 4]
  }
  return Array.from(cells, cell => cell ? String.fromCharCode(0x2800 | cell) : '⠀')
}

const fmt = seconds => {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function parseLrc(text) {
  const lines = []
  for (const raw of String(text || '').split(/\r?\n/)) {
    const times = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)/g)].map(m => Number(m[1]) * 60 + parseFloat(m[2]))
    const content = raw.replace(/\[[^\]]*\]/g, '').trim()
    if (times.length && content) for (const t of times) lines.push({ t, text: content })
  }
  return lines.sort((a, b) => a.t - b.t)
}

function Action({ label, icon: Icon, glyph, onClick, size = 'icon-xs', busy = false, pressed = false, className = '' }) {
  return jsx(Tip, { label, children: jsx(Button, {
    variant: 'ghost', size, className: `hermes-ncm-action ${className}`, 'aria-label': label,
    'aria-pressed': pressed, onClick,
    children: jsx('span', { className: 'hermes-ncm-glyph', children: busy ? jsx(GlyphSpinner, { ariaLabel: label }) : jsx(Icon || ic('Play', '♪'), {}) })
  }) })
}

// -------------------------------------------------------------- player -----
function createPlayer(ctx) {
  const stored = ctx.storage.get('local.volume', 70)
  const volume = atom(Number.isFinite(stored) ? Math.max(0, Math.min(100, stored)) : 70)
  const likedIds = atom(Array.isArray(ctx.storage.get('local.liked', [])) ? ctx.storage.get('local.liked', []) : [])
  const queue = atom({ list: [], index: -1 })
  const status = atom('idle') // idle | loading | playing | paused | error
  const error = atom('')
  const pos = atom(0)
  const dur = atom(0)
  const lyric = atom({ id: 0, lines: [] })
  const showLyric = atom(false)
  const account = atom(null) // null = unknown, false = logged out, object = profile
  const open = atom(false)
  const MODES = ['loop', 'one', 'shuffle']
  const storedMode = ctx.storage.get('local.mode', 'loop')
  const mode = atom(MODES.includes(storedMode) ? storedMode : 'loop')

  let audio = null
  let disposed = false
  let generation = 0
  let scrobbledId = 0
  const bus = new BroadcastChannel('hermes:netease:playback')
  const windowId = randomUuid()

  async function rest(path, opts) {
    try {
      const result = await ctx.rest(path, opts)
      return result && typeof result === 'object' ? result : { ok: false, error: 'bad response' }
    } catch (exc) {
      return { ok: false, error: String(exc?.message || exc) }
    }
  }
  const post = (path, body) => rest(path, { method: 'POST', body: body || {} })

  // ---- audio spectrum (drives the status-bar visualiser) -----------------
  let audioCtx = null, analyser = null, visualSource = null, bins = null, visualBroken = false
  let stalledFrames = 0, silentFrames = 0
  const diagEvents = []
  let diagTimer = 0
  function flushDiag() {
    diagTimer = 0
    if (!diagEvents.length) return
    const batch = diagEvents.splice(0)
    void Promise.resolve(post('/diag', { events: batch })).catch(() => {})
  }
  function diag(tag, detail) {
    // Packaged builds expose no renderer console — ship breadcrumbs to the
    // backend (/diag -> data/viz-diag.json) so breakage is diagnosable offline.
    try {
      diagEvents.push({ t: new Date().toISOString().slice(11, 23), tag, ...(detail || {}) })
      if (diagEvents.length >= 6) flushDiag()
      else if (!diagTimer) diagTimer = setTimeout(flushDiag, 700)
    } catch { /* diagnostics must never break playback */ }
  }
  const corsCache = new Map()
  async function corsOk(url) {
    // The analyser mutes a CORS-tainted media element, so only wire it up for
    // CDNs that answer Access-Control-Allow-Origin. NetEase's do (verified
    // 2026-11); probe once per host with a 1-byte ranged GET and remember it.
    let host = ''
    try { host = new URL(url).host } catch { diag('cors', { ok: false, why: 'bad url' }); return false }
    if (corsCache.has(host)) { const cached = corsCache.get(host); diag('cors', { host, ok: cached, cached: true }); return cached }
    let ok = false
    try {
      const probe = await fetch(url, { headers: { Range: 'bytes=0-0' }, cache: 'no-store' })
      ok = probe.ok || probe.status === 206
      void probe.body?.cancel?.()
    } catch { ok = false }
    corsCache.set(host, ok)
    diag('cors', { host, ok })
    return ok
  }
  function ensureVisualiser() {
    if (!audio || visualBroken) return
    document.addEventListener('pointerdown', () => {
      // Any click is a user gesture — use it to wake a context stuck in
      // 'suspended' (autoplay policy) so audio through the graph un-mutes.
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
    }, true)
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext
        if (!AC) { visualBroken = true; return }
        audioCtx = new AC()
        visualSource = audioCtx.createMediaElementSource(audio) // once per element
        analyser = audioCtx.createAnalyser()
        analyser.fftSize = 64                // 32 bins — plenty for a 20-column grid
        analyser.smoothingTimeConstant = 0.55
        visualSource.connect(analyser)
        analyser.connect(audioCtx.destination)
        bins = new Uint8Array(analyser.frequencyBinCount)
        diag('viz-wired', { state: audioCtx.state })
      }
      if (audioCtx.state === 'suspended') audioCtx.resume().then(
        () => diag('ctx-resumed'),
        e => diag('ctx-resume-rejected', { name: e && e.name }))
    } catch (e) { visualBroken = true; diag('viz-create-failed', { name: e && e.name }) }
  }
  function rerouteForCors(clean) {
    // Visualiser already wired and this track lacks CORS -> detach the source
    // so the element falls back to direct (audible) output. Reconnect later.
    if (!visualSource || !analyser) return
    try { clean ? visualSource.connect(analyser) : visualSource.disconnect() } catch {}
  }
  let nullFrames = 0
  function diagNull(why) {
    if (++nullFrames % 45 === 1) diag('spec-null', { why, ctx: audioCtx ? audioCtx.state : 'none', hasAnalyser: !!analyser, paused: !!(audio && audio.paused) })
  }
  function readSpectrum() {
    if (!analyser || !audio || audio.paused || status.get() !== 'playing') { if (audio && !audio.paused) diagNull(analyser ? 'no-analyser' : 'no-graph'); return null }
    if (!audioCtx || audioCtx.state !== 'running') {
      diagNull('ctx-' + (audioCtx ? audioCtx.state : 'none'))
      silentFrames = 0
      if (++stalledFrames > 60) reviveUnwired()      // ~4s of playing on a dead context
      return null
    }
    stalledFrames = 0
    analyser.getByteFrequencyData(bins)
    // A tainted element routed through the graph outputs *digital zero* —
    // 20s of absolute silence while claiming to play means it went deaf.
    let energy = 0
    for (let i = 0; i < bins.length; i++) energy += bins[i]
    if (energy < 3) { if (++silentFrames > 300) reviveUnwired() } else silentFrames = 0
    return bins
  }
  function reviveUnwired() {
    // Last resort, but it guarantees audible playback: rebuild a plain audio
    // element with no Web Audio routing at all and reload the current track.
    console.warn('[ncm] visualiser unusable -> rewiring plain audio')
    diag('revive-unwired')
    visualBroken = true
    try { visualSource?.disconnect() } catch {}
    const el = audio
    if (el) { el.pause(); el.removeAttribute('src'); el.load() }
    audio = null; analyser = null; visualSource = null
    void loadTrack()
  }

  function ensureAudio() {
    if (audio) return audio
    const element = new Audio()
    audio = element
    element.dataset.hermesNeteaseAudio = 'true'
    element.hidden = true
    element.volume = volume.get() / 100
    element.loop = mode.get() === 'one'
    // crossOrigin is decided per-track in loadTrack (CORS probe), because a
    // tainted element wired into the analyser graph would play *silent*.
    element.addEventListener('play', () => { diag('play', { crossOrigin: element.crossOrigin || 'none' }); if (element.crossOrigin) ensureVisualiser() })
    element.addEventListener('timeupdate', () => {
      pos.set(element.currentTime)
      if (element.currentTime > 30 && !element.paused) {
        const row = currentRow()
        if (row && scrobbledId !== row.id) { scrobbledId = row.id; void post('/scrobble', { id: row.id }) }
      }
    })
    element.addEventListener('loadedmetadata', () => dur.set(element.duration || 0))
    element.addEventListener('play', () => status.set('playing'))
    element.addEventListener('pause', () => { if (status.get() === 'playing') status.set('paused') })
    element.addEventListener('ended', () => next(true))
    element.addEventListener('error', () => {
      console.warn('[ncm] audio error code=', element.error && element.error.code, 'crossOrigin=', element.crossOrigin)
      diag('audio-error', { code: element.error && element.error.code, crossOrigin: element.crossOrigin || 'none' })
      if (element.dataset.ncmRetry !== '1' && element.dataset.ncmOriginal) {
        element.dataset.ncmRetry = '1'
        element.src = element.dataset.ncmOriginal
        void element.play().catch(() => {})
        return
      }
      status.set('error')
      error.set('playback failed')
    })
    return element
  }

  function currentRow() {
    const { list, index } = queue.get()
    return list[index] || null
  }

  async function loadTrack() {
    if (disposed) return
    const row = currentRow()
    if (!row) return
    const token = ++generation
    diag('load', { id: row.id })
    pos.set(0)
    dur.set(Math.round((row.duration || 0) / 1000))
    lyric.set({ id: row.id, lines: [] })
    status.set('loading')
    error.set('')
    void loadLyric(row.id, token)
    const result = await post('/url', { id: row.id })
    if (token !== generation || disposed) return
    if (!result.ok || !result.url) {
      status.set('error')
      error.set(result.error === 'unplayable' ? 'unplayable' : (result.error || 'url failed'))
      return
    }
    bus.postMessage({ type: 'play', sender: windowId })
    const element = ensureAudio()
    const playable = result.url.startsWith('http://') ? result.url.replace('http://', 'https://') : result.url
    const clean = await corsOk(playable)
    if (token !== generation || disposed) return
    element.crossOrigin = clean ? 'anonymous' : null
    rerouteForCors(clean)
    element.dataset.ncmRetry = '0'
    element.dataset.ncmOriginal = result.url
    element.src = playable
    dur.set(0)
    try { await element.play() } catch (e) { diag('play-rejected', { name: e && e.name }); status.set('paused') }
  }

  async function loadLyric(id, token) {
    const result = await rest(`/lyric?id=${encodeURIComponent(id)}`)
    if (token === generation && result.ok) lyric.set({ id, lines: parseLrc(result.lyric) })
  }

  function playFrom(list, index) {
    queue.set({ list, index })
    void loadTrack()
  }

  function next(auto = false) {
    const { list, index } = queue.get()
    if (!list.length) return
    let target
    if (mode.get() === 'shuffle' && list.length > 1) {
      do { target = Math.floor(Math.random() * list.length) } while (target === index)
    } else {
      target = (index + 1) % list.length // loop-mode wraps around; one-mode never reaches here (audio.loop)
    }
    queue.set({ list, index: target })
    void loadTrack()
  }

  function cycleMode() {
    const nextMode = MODES[(MODES.indexOf(mode.get()) + 1) % MODES.length]
    mode.set(nextMode)
    ctx.storage.set('local.mode', nextMode)
    if (audio) audio.loop = nextMode === 'one'
  }

  function previous() {
    const element = audio
    if (element && element.currentTime > 3) { element.currentTime = 0; pos.set(0); return }
    const { list, index } = queue.get()
    if (!list.length) return
    const target = (index - 1 + list.length) % list.length
    queue.set({ list, index: target })
    void loadTrack()
  }

  function toggle() {
    const state = status.get()
    if (state === 'playing') { audio?.pause(); return }
    if (state === 'paused') { audio?.play().catch(() => status.set('error')); return }
    const { list } = queue.get()
    if (list.length) void loadTrack()
  }

  function seek(seconds) {
    if (!audio) return
    audio.currentTime = seconds
    pos.set(seconds)
  }

  function setVolume(nextVolume) {
    const value = Math.max(0, Math.min(100, nextVolume))
    volume.set(value)
    ctx.storage.set('local.volume', value)
    if (audio) audio.volume = value / 100
  }
  let lastVolume = volume.get() || 70
  function mute() {
    if (volume.get() > 0) { lastVolume = volume.get(); setVolume(0) } else setVolume(lastVolume || 70)
  }

  async function toggleLike(row) {
    if (!row) return
    const ids = likedIds.get()
    const has = ids.includes(row.id)
    const ids2 = has ? ids.filter(id => id !== row.id) : [...ids, row.id]
    likedIds.set(ids2)
    ctx.storage.set('local.liked', ids2)
    if (account.get()) {
      const result = await post('/like', { id: row.id, like: !has })
      if (!result.ok && typeof result.liked !== 'boolean') {
        likedIds.set(ids)
        ctx.storage.set('local.liked', ids)
        error.set(result.error || 'like failed')
      } else if (typeof result.liked === 'boolean' && result.liked !== !has) {
        const fixed = result.liked ? ids2 : ids
        likedIds.set(fixed)
        ctx.storage.set('local.liked', fixed)
      }
    }
  }

  async function syncLiked() {
    // Server is the source of truth for heart state; union keeps songs liked
    // while anonymous in the local set.
    const result = await rest('/liked?mode=ids')
    if (result.ok && Array.isArray(result.ids)) {
      const merged = [...new Set([...likedIds.get(), ...result.ids])]
      likedIds.set(merged)
      ctx.storage.set('local.liked', merged)
    }
  }

  async function refreshAccount() {
    const result = await rest('/account')
    account.set(result.ok && result.loggedIn ? result.account : false)
    if (account.get()) void syncLiked()
    return account.get()
  }

  bus.onmessage = event => {
    if (event.data?.type === 'play' && event.data.sender !== windowId && audio && !audio.paused) audio.pause()
  }

  ctx.onDispose(() => {
    disposed = true
    generation++
    try { bus.close() } catch {}
    try { const c = audioCtx?.close?.(); if (c?.catch) c.catch(() => {}) } catch {}
    audioCtx = null; analyser = null; bins = null
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null }
  })

  return { queue, status, error, pos, dur, volume, lyric, likedIds, account, open, showLyric,
    rest, post, playFrom, next, previous, toggle, seek, setVolume, mute, cycleMode, toggleLike, refreshAccount, currentRow, mode, readSpectrum, diag }
}

// ------------------------------------------------------------ components ---
function MiniWave({ player }) {
  const status = useValue(player.status)
  const ref = useRef(null)
  const loopRef = useRef(null)
  const active = status === 'playing'
  const width = 10, rows = 2
  useEffect(() => { if (active) loopRef.current?.wake() }, [active])
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const blank = Array(width * rows).fill('⠀')
    const layers = [...node.children]
    const paint = (layer, cells) => cells.forEach((cell, i) => {
      if (layers[layer].children[i].textContent !== cell) layers[layer].children[i].textContent = cell
    })
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const dotColumns = width * 2, dotRows = rows * 4
    const heights = new Float32Array(dotColumns)
    let missFrames = 0, step = 0, tickN = 0
    const silent = () => heights.every(h => h <= 0.03)
    paint(0, blank)
    // Loop once, never re-created on status flips — pauses then decay smoothly.
    const loop = createBudgetedLoop(() => {
      if (motion.matches) { paint(1, blank); return }
      const playing = player.status.get() === 'playing'
      const spectrum = playing ? player.readSpectrum() : null
      if (playing && ++tickN % 110 === 1) player.diag('viz-tick', { hasData: !!spectrum })
      if (spectrum) {
        missFrames = 0
        const n = spectrum.length
        for (let x = 0; x < dotColumns; x++) {
          // Stretch the bass-heavy half of the bins across the whole grid so
          // kick drums visibly punch instead of only wiggling the left edge.
          const f = Math.pow(x / (dotColumns - 1), 1.6)
          const bin = Math.min(n - 1, Math.round(f * (n - 1)))
          const target = Math.max(spectrum[bin], bin > 0 ? spectrum[bin - 1] * 0.7 : 0) / 255
          heights[x] += (target - heights[x]) * (target > heights[x] ? 0.6 : 0.16)
        }
      } else {
        for (let x = 0; x < dotColumns; x++) heights[x] *= 0.7
        if (playing && ++missFrames > 22) {
          if (missFrames === 23) player.diag('viz-fallback-marquee')
          // Spectrum never arrived (probe failed / visualiser disabled) —
          // fall back to the classic marquee so the bar still feels alive.
          const cells = [...blank]
          cells[Math.floor(step++ / 2) % width] = '⠒'
          paint(1, cells)
          return
        }
        if (silent()) { paint(1, blank); return }
      }
      paint(1, brailleBars(heights, dotColumns, rows))
    }, { fps: 15, pauseWhenUnfocused: false, idleWhen: () => motion.matches
      || (player.status.get() !== 'playing' && silent()) })
    loopRef.current = loop
    return () => { loop.dispose(); loopRef.current = null; motion.removeEventListener?.('change', () => {}) }
  }, [])
  return jsx('div', { ref, className: 'hermes-ncm-wave', style: { '--ncm-columns': width }, 'data-active': active, 'aria-hidden': true,
    children: [0, 1].map(layer => jsx('span', { className: 'hermes-ncm-wave-layer', children: Array(width * rows).fill('⠀').map((cell, i) => jsx('span', { children: cell }, i)) }, layer)) })
}

function VinylCover({ pic, playing, arm, size }) {
  return jsxs('div', { className: `hermes-ncm-vinyl hermes-ncm-vinyl-${size}`, 'data-playing': playing, 'aria-hidden': true, children: [
    jsx('div', { className: 'hermes-ncm-vinyl-spin', children: pic ? jsx('img', { src: pic, loading: 'lazy', alt: '' }) : null }),
    arm ? jsx('svg', { className: 'hermes-ncm-vinyl-arm', 'data-playing': playing, viewBox: '0 0 60 80', children: [
      jsx('path', { d: 'M52 8 L40 36 L23 57', fill: 'none', stroke: '#46464f', 'stroke-width': 3.5, 'stroke-linecap': 'round' }),
      jsx('path', { d: 'M23 57 L19 65', fill: 'none', stroke: '#5c5c66', 'stroke-width': 5, 'stroke-linecap': 'round' }),
      jsx('circle', { cx: 40, cy: 36, r: 2.6, fill: '#3b3b44' }),
      jsx('circle', { cx: 52, cy: 8, r: 6, fill: '#23232a', stroke: '#4c4c56', 'stroke-width': 1.5 })
    ] }) : null
  ] })
}

function SongRow({ player, row, list, index }) {
  const t = usePluginI18n(ID)
  const queue = useValue(player.queue)
  const status = useValue(player.status)
  const liked = useValue(player.likedIds)
  const isCurrent = queue.index === index && queue.list === list
  const Heart = ic('Heart', '♥')
  const rowText = jsxs('div', { className: 'hermes-ncm-rowmain', children: [
    jsxs('span', { className: 'hermes-ncm-rowtitle', children: [
      isCurrent && status === 'playing' ? jsx('span', { children: '♪' }) : null,
      jsx('span', { children: row.name }),
      (row.fee === 1 || row.fee === 8) ? jsx('span', { className: 'hermes-ncm-tag', children: t('vip') }) : null,
      row.fee === 4 ? jsx('span', { className: 'hermes-ncm-tag', children: t('album') }) : null
    ] }),
    jsx('div', { className: 'hermes-ncm-rowmeta', children: [row.artists, row.album].filter(Boolean).join(' · ') })
  ] })
  return jsxs('div', { className: 'hermes-ncm-row', 'data-current': isCurrent, role: 'button', tabIndex: 0,
    onClick: () => player.playFrom(list, index),
    onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); player.playFrom(list, index) } },
    children: [
      isCurrent ? jsx(VinylCover, { pic: row.pic, playing: status === 'playing', size: 'mini' })
        : row.pic ? jsx('img', { className: 'hermes-ncm-cover', src: row.pic, loading: 'lazy', alt: '' }) : jsx('span', { className: 'hermes-ncm-cover' }),
      rowText,
      jsx('span', { className: 'hermes-ncm-duration', children: fmt(Math.round((row.duration || 0) / 1000)) }),
      jsx('button', { className: 'hermes-ncm-heart', 'data-on': liked.includes(row.id), 'aria-label': liked.includes(row.id) ? t('unlike') : t('like'),
        onClick: event => { event.stopPropagation(); void player.toggleLike(row) }, children: jsx(Heart, { style: { width: 13, height: 13 } }) })
    ] })
}

function SearchTab({ player }) {
  const t = usePluginI18n(ID)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('song')
  const [openPl, setOpenPl] = useState(null)
  const text = search.trim()
  useEffect(() => { const timer = setTimeout(() => setQuery(text), 350); return () => clearTimeout(timer) }, [text])
  useEffect(() => setOpenPl(null), [query, kind])
  const result = useQuery({
    queryKey: [ID, 'search', kind, query],
    queryFn: () => player.post('/search', { q: query, kind, limit: 30 }),
    enabled: query.length >= 1 && text === query, staleTime: 120000, retry: false
  })
  const pending = text.length >= 1 && (text !== query || result.isFetching)
  const data = text === query ? result.data : null
  const songs = data?.ok ? data.songs || [] : []
  const playlists = data?.ok ? data.playlists || [] : []
  if (openPl) return jsx(PlaylistOpen, { player, pl: openPl, onBack: () => setOpenPl(null) })
  const hint = pending ? t('searching')
    : text ? (data && !data.ok ? (data.error || t('loadError')) : t('noResults')) : t('searchHint')
  return jsxs('div', { children: [
    jsx('div', { className: 'hermes-ncm-tabs', children: jsx(SearchField, { value: search, onChange: setSearch, placeholder: t('search'),
      trailingAction: pending ? jsx(GlyphSpinner, { ariaLabel: t('searching') }) : null }) }),
    jsxs('div', { className: 'hermes-ncm-tabs', children: [
      jsx(Button, { variant: 'ghost', size: 'micro', className: 'hermes-ncm-chip', 'aria-pressed': kind === 'song',
        onClick: () => setKind('song'), children: t('kindSong') }),
      jsx(Button, { variant: 'ghost', size: 'micro', className: 'hermes-ncm-chip', 'aria-pressed': kind === 'playlist',
        onClick: () => setKind('playlist'), children: t('kindPlaylist') })
    ] }),
    jsx('div', { className: 'hermes-ncm-body', children: pending ? jsx('div', { className: 'hermes-ncm-hint', children: hint })
      : kind === 'playlist' && playlists.length ? playlists.map(pl => jsx(PlaylistRow, { pl, onOpen: setOpenPl }, pl.id))
      : kind !== 'playlist' && songs.length ? songs.map((row, i) => jsx(SongRow, { player, row, list: songs, index: i }, row.id))
      : jsx('div', { className: 'hermes-ncm-hint', children: hint }) })
  ] })
}

function PlaylistRow({ pl, onOpen }) {
  return jsxs('div', { className: 'hermes-ncm-row', onClick: () => onOpen(pl), role: 'button', tabIndex: 0, children: [
    pl.cover ? jsx('img', { className: 'hermes-ncm-cover', src: pl.cover, loading: 'lazy', alt: '' }) : jsx('span', { className: 'hermes-ncm-cover' }),
    jsxs('span', { className: 'hermes-ncm-rowmain', children: [
      jsx('span', { className: 'hermes-ncm-rowtitle', children: jsx('span', { children: pl.name }) }),
      pl.creator ? jsx('span', { className: 'hermes-ncm-rowmeta', children: pl.creator }) : null
    ] }),
    jsx('span', { className: 'hermes-ncm-playcount', children: pl.trackCount ? String(pl.trackCount) : '' }),
    jsx('span', {})
  ] }, pl.id)
}

function PlaylistOpen({ player, pl, onBack }) {
  const t = usePluginI18n(ID)
  const tracks = useQuery({ queryKey: [ID, 'pl', pl.id], queryFn: () => player.post('/playlist', { id: pl.id }),
    enabled: Boolean(pl), staleTime: 30000, retry: false })
  const songs = tracks.data?.ok ? tracks.data.songs || [] : []
  return jsxs('div', { children: [
    jsxs('div', { className: 'hermes-ncm-plhead', children: [
      jsx(Button, { variant: 'ghost', size: 'micro', onClick: onBack, children: `‹ ${t('back')}` }),
      jsx('span', { className: 'hermes-ncm-rowtitle', children: tracks.data?.name || pl.name || '' }),
      tracks.data?.partial ? jsx('span', { className: 'hermes-ncm-playcount', children: t('partialCount', tracks.data.total) }) : null
    ] }),
    jsx('div', { className: 'hermes-ncm-body', children: tracks.isFetching ? jsx('div', { className: 'hermes-ncm-hint', children: t('searching') })
      : songs.length ? songs.map((row, i) => jsx(SongRow, { player, row, list: songs, index: i }, `${pl.id}-${row.id}-${i}`))
      : jsx('div', { className: 'hermes-ncm-hint', children: tracks.data && !tracks.data.ok ? (tracks.data.error || t('loadError')) : t('playlistsEmpty') }) })
  ] })
}

function LikedTab({ player }) {
  const t = usePluginI18n(ID)
  const account = useValue(player.account)
  const liked = useValue(player.likedIds)
  const loggedIn = Boolean(account)
  const result = useQuery({
    queryKey: [ID, 'liked', loggedIn, liked.join(',')],
    queryFn: async () => {
      const remote = loggedIn ? await player.rest('/liked') : { ok: true, songs: [] }
      const merged = new Map()
      for (const row of remote.ok ? remote.songs || [] : []) merged.set(row.id, row)
      const missing = liked.filter(id => !merged.has(id))
      if (missing.length) {
        const local = await player.post('/detail', { ids: missing })
        for (const row of local.ok ? local.songs || [] : []) merged.set(row.id, row)
      }
      return { songs: [...merged.values()] }
    },
    staleTime: 30000, retry: false
  })
  const songs = result.data?.songs || []
  return jsx('div', { className: 'hermes-ncm-body', children: !result.isFetching && !songs.length
    ? jsx('div', { className: 'hermes-ncm-hint', children: t('likedEmpty') })
    : songs.map((row, i) => jsx(SongRow, { player, row, list: songs, index: i }, row.id)) })
}

function PlaylistsTab({ player }) {
  const t = usePluginI18n(ID)
  const account = useValue(player.account)
  const [selected, setSelected] = useState(null)
  const loggedIn = Boolean(account)
  const lists = useQuery({ queryKey: [ID, 'playlists', loggedIn], queryFn: () => player.rest('/playlists'),
    enabled: loggedIn, staleTime: 60000, retry: false })
  if (selected) return jsx(PlaylistOpen, { player, pl: selected, onBack: () => setSelected(null) })
  if (!loggedIn) return jsx('div', { className: 'hermes-ncm-hint', children: t('loginRequired') })
  const rows = lists.data?.ok ? lists.data.playlists || [] : []
  return jsx('div', { className: 'hermes-ncm-body', children: !lists.isFetching && !rows.length
    ? jsx('div', { className: 'hermes-ncm-hint', children: lists.data && !lists.data.ok ? (lists.data.error || t('loadError')) : t('playlistsEmpty') })
    : rows.map(pl => jsx(PlaylistRow, { pl, onOpen: setSelected }, pl.id)) })
}

function InlineSongs({ player, title, songs, onBack }) {
  const t = usePluginI18n(ID)
  return jsxs('div', { children: [
    jsxs('div', { className: 'hermes-ncm-plhead', children: [
      jsx(Button, { variant: 'ghost', size: 'micro', onClick: onBack, children: `‹ ${t('back')}` }),
      jsx('span', { className: 'hermes-ncm-rowtitle', children: title })
    ] }),
    jsx('div', { className: 'hermes-ncm-body', children: songs.length ? songs.map((row, i) =>
      jsx(SongRow, { player, row, list: songs, index: i }, `rec-${row.id}-${i}`))
      : jsx('div', { className: 'hermes-ncm-hint', children: t('recEmpty') }) })
  ] })
}

function RecTab({ player }) {
  const t = usePluginI18n(ID)
  const loggedIn = Boolean(useValue(player.account))
  const [openPl, setOpenPl] = useState(null)
  const [dailySongs, setDailySongs] = useState(null)
  const [fmBusy, setFmBusy] = useState(false)
  const daily = useQuery({ queryKey: [ID, 'rec', 'daily'], queryFn: () => player.post('/recommend/daily', {}),
    enabled: loggedIn, staleTime: 3600000, retry: false })
  const res = useQuery({ queryKey: [ID, 'rec', 'res'], queryFn: () => player.post('/recommend/resource', {}),
    enabled: loggedIn, staleTime: 600000, retry: false })
  const playFm = async () => {
    if (fmBusy) return
    setFmBusy(true)
    try {
      const r = await player.post('/fm/next', {})
      if (r && r.ok && (r.songs || []).length) player.playFrom(r.songs, 0)
    } finally { setFmBusy(false) }
  }
  if (!loggedIn) return jsx('div', { className: 'hermes-ncm-hint', children: t('loginRequired') })
  if (openPl) return jsx(PlaylistOpen, { player, pl: openPl, onBack: () => setOpenPl(null) })
  if (dailySongs) return jsx(InlineSongs, { player, title: t('recDaily'), songs: dailySongs, onBack: () => setDailySongs(null) })
  const cards = res.data?.ok ? res.data.playlists || [] : []
  const dailyRows = daily.data?.ok ? daily.data.songs || [] : []
  const loading = daily.isFetching || res.isFetching
  return jsx('div', { className: 'hermes-ncm-body', children: jsxs('div', { children: [
    jsxs('div', { className: 'hermes-ncm-row', role: 'button', tabIndex: 0,
      onClick: () => dailyRows.length && setDailySongs(dailyRows), children: [
      dailyRows.length && dailyRows[0].pic ? jsx('img', { className: 'hermes-ncm-cover', src: dailyRows[0].pic, loading: 'lazy', alt: '' }) : jsx('span', { className: 'hermes-ncm-cover' }),
      jsxs('span', { className: 'hermes-ncm-rowmain', children: [
        jsx('span', { className: 'hermes-ncm-rowtitle', children: jsx('span', { children: t('recDaily') }) }),
        jsx('span', { className: 'hermes-ncm-rowmeta', children: t('recDailyHint') }) ] }),
      jsx('span', { className: 'hermes-ncm-duration', children: dailyRows.length ? String(dailyRows.length) : '' }),
      jsx('span', {}) ] }),
    jsxs('div', { className: 'hermes-ncm-row', role: 'button', tabIndex: 0, onClick: playFm, 'data-busy': fmBusy, children: [
      jsx('span', { className: 'hermes-ncm-cover hermes-ncm-covericon', children: jsx(CUSTOM_ICONS.Radio, {}) }),
      jsxs('span', { className: 'hermes-ncm-rowmain', children: [
        jsx('span', { className: 'hermes-ncm-rowtitle', children: jsx('span', { children: t('recFm') }) }),
        jsx('span', { className: 'hermes-ncm-rowmeta', children: t('recFmHint') }) ] }),
      jsx('span', { className: 'hermes-ncm-duration', children: '' }),
      jsx('span', {}) ] }),
    jsx('div', { className: 'hermes-ncm-hint', children: loading && !cards.length ? t('searching') : t('recLists') }),
    cards.map(pl => jsx(PlaylistRow, { pl, onOpen: setOpenPl }, pl.id)),
    !loading && res.data && !res.data.ok ? jsx('div', { className: 'hermes-ncm-hint', children: res.data.error || t('loadError') }) : null
  ] }) })
}

function SmsForm({ player, phoneRef }) {
  const t = usePluginI18n(ID)
  const client = useQueryClient()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState('') // '' | 'send' | 'login'
  const [msg, setMsg] = useState({ text: '', error: false })
  const [deadEnd, setDeadEnd] = useState(0) // resend-until timestamp (ms)
  const [, tick] = useState(0)
  const remaining = Math.max(0, Math.ceil((deadEnd - Date.now()) / 1000))
  useEffect(() => {
    if (!deadEnd) return
    const timer = setInterval(() => {
      if (deadEnd - Date.now() <= 0) clearInterval(timer)
      tick(n => n + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [deadEnd])
  const errText = e => e === 'bad-phone' ? t('smsBadPhone')
    : e === 'bad-captcha' ? t('smsBadCode')
    : e === 'no-session' ? t('smsNoSession') : (e || t('loadError'))

  async function send() {
    const p = phone.trim()
    if (!/^1[3-9]\d{9}$/.test(p)) { setMsg({ text: t('smsBadPhone'), error: true }); return }
    setBusy('send'); setMsg({ text: '', error: false })
    const result = await player.post('/sms/send', { phone: p })
    setBusy('')
    if (result.ok) { setDeadEnd(Date.now() + 60000); setMsg({ text: t('smsSent'), error: false }) }
    else setMsg({ text: errText(result.error), error: true })
  }

  async function login() {
    const p = phone.trim(), c = code.trim()
    if (!/^1[3-9]\d{9}$/.test(p)) { setMsg({ text: t('smsBadPhone'), error: true }); return }
    if (!c) { setMsg({ text: t('smsBadCode'), error: true }); return }
    setBusy('login'); setMsg({ text: '', error: false })
    const result = await player.post('/sms/login', { phone: p, captcha: c })
    setBusy('')
    if (result.ok && result.loggedIn) {
      await player.refreshAccount()
      client.invalidateQueries({ queryKey: [ID] })
      return
    }
    setMsg({ text: errText(result.error), error: true })
  }

  return jsxs('div', { className: 'hermes-ncm-account', style: { gap: 5 }, children: [
    jsx('div', { className: 'hermes-ncm-status', style: { whiteSpace: 'normal' }, children: t('smsTitle') }),
    jsxs('div', { style: { display: 'flex', gap: 4, width: '100%', alignItems: 'center' }, children: [
      jsx('input', { ref: phoneRef, className: 'hermes-ncm-cookie', value: phone, placeholder: t('smsPhone'),
        inputMode: 'numeric', maxLength: 11, spellCheck: false,
        onChange: event => { setPhone(event.target.value.replace(/\D/g, '')); setMsg({ text: '', error: false }) } }),
      jsx(Button, { variant: 'secondary', size: 'micro', disabled: busy !== '' || remaining > 0,
        onClick: () => void send(),
        children: remaining > 0 ? t('smsResend', remaining) : busy === 'send' ? t('cookieBusy') : t('smsSend') })
    ] }),
    jsxs('div', { style: { display: 'flex', gap: 4, width: '100%', alignItems: 'center' }, children: [
      jsx('input', { className: 'hermes-ncm-cookie', value: code, placeholder: t('smsCode'),
        inputMode: 'numeric', maxLength: 8, spellCheck: false,
        onChange: event => { setCode(event.target.value.replace(/\D/g, '')); setMsg({ text: '', error: false }) },
        onKeyDown: event => { if (event.key === 'Enter') void login() } }),
      jsx(Button, { size: 'micro', disabled: busy !== '' || !phone.trim() || !code.trim(), onClick: () => void login(),
        children: busy === 'login' ? t('smsLogging') : t('smsLogin') })
    ] }),
    msg.text ? jsx('div', { className: msg.error ? 'hermes-ncm-error' : 'hermes-ncm-status',
      style: { textAlign: 'center', whiteSpace: 'normal' }, children: msg.text }) : null
  ] })
}

function AccountTab({ player }) {
  const t = usePluginI18n(ID)
  const client = useQueryClient()
  const account = useValue(player.account)
  const [qr, setQr] = useState({ phase: 'off' }) // off | loading | showing | scanned | expired | error
  const qrRef = useRef(qr)
  qrRef.current = qr
  const [cookie, setCookie] = useState('')
  const [cookieState, setCookieState] = useState({ busy: false, error: '' })
  const smsPhoneRef = useRef(null)

  async function importCookie() {
    const value = cookie.trim()
    if (!value || cookieState.busy) return
    setCookieState({ busy: true, error: '' })
    const result = await player.post('/login/cookie', { cookie: value })
    if (result.ok && result.loggedIn) {
      setCookie('')
      await player.refreshAccount()
      client.invalidateQueries({ queryKey: [ID] })
      setCookieState({ busy: false, error: '' })
      return
    }
    setCookieState({ busy: false, error: result.error === 'looks-like-nmtid' ? t('cookieNmtid')
      : result.error === 'missing MUSIC_U' ? t('cookieNeed')
      : (result.error || t('cookieInvalid')) })
  }

  useEffect(() => {
    if (qr.phase !== 'showing' && qr.phase !== 'scanned') return
    let stopped = false
    const timer = setInterval(async () => {
      const current = qrRef.current
      if (stopped || !current.uniid) return
      const result = await player.post('/qr/poll', { uniid: current.uniid })
      if (stopped) return
      if (result.code === 802) setQr(state => ({ ...state, phase: 'scanned' }))
      else if (result.code === 803) {
        setQr({ phase: 'off' })
        await player.refreshAccount()
        client.invalidateQueries({ queryKey: [ID] })
      } else if (result.blocked) setQr(state => ({ ...state, phase: 'blocked' }))
      else if (result.code === 800 || result.error) setQr(state => ({ ...state, phase: 'expired' }))
    }, 2000)
    return () => { stopped = true; clearInterval(timer) }
  }, [qr.phase === 'off', qr.uniid])

  async function create(strategy = 0) {
    setQr({ phase: 'loading', strategy })
    const result = await player.post('/qr/create', { strategy })
    if (!result.ok || !result.qrUrl) { setQr({ phase: 'error', strategy }); return }
    const code = QR(0, 'M')
    code.addData(result.qrUrl)
    code.make()
    setQr({ phase: 'showing', uniid: result.uniid, image: code.createDataURL(4, 10), strategy })
  }

  if (account) return jsxs('div', { className: 'hermes-ncm-account', children: [
    jsxs('div', { className: 'hermes-ncm-user', children: [
      account.avatar ? jsx('img', { className: 'hermes-ncm-avatar', src: account.avatar, alt: '' }) : null,
      jsx('span', { children: account.nickname || t('loggedInAs') }),
      account.vipType ? jsx('span', { className: 'hermes-ncm-tag', children: t('vip') }) : null
    ] }),
    jsx(Button, { variant: 'ghost', size: 'micro', onClick: async () => { await player.post('/logout', {}); player.account.set(false); client.invalidateQueries({ queryKey: [ID] }) }, children: t('logout') })
  ] })

  if (!account && qr.phase === 'off') return jsxs('div', { className: 'hermes-ncm-account', children: [
    jsx('div', { className: 'hermes-ncm-status', children: t('loginRequired') }),
    jsx(Button, { size: 'micro', onClick: () => void create(), children: t('login') }),
    jsx(SmsForm, { player, phoneRef: smsPhoneRef }),
    jsxs('div', { style: { display: 'flex', gap: 4, width: '100%', alignItems: 'center' }, children: [
      jsx('input', { className: 'hermes-ncm-cookie', value: cookie, placeholder: t('cookiePlaceholder'), spellCheck: false,
        onChange: event => setCookie(event.target.value), onKeyDown: event => { if (event.key === 'Enter') void importCookie() } }),
      jsx(Button, { variant: 'secondary', size: 'micro', disabled: cookieState.busy || !cookie.trim(), onClick: () => void importCookie(),
        children: cookieState.busy ? t('cookieBusy') : t('cookieImport') })
    ] }),
    jsx('div', { className: cookieState.error ? 'hermes-ncm-error' : 'hermes-ncm-status', style: { textAlign: 'center', whiteSpace: 'normal' },
      children: cookieState.error || t('cookieHint') })
  ] })
  if (qr.phase === 'loading') return jsx('div', { className: 'hermes-ncm-account', children: jsx(GlyphSpinner, { ariaLabel: t('login') }) })
  const label = qr.phase === 'showing' ? t('qrWaiting') : qr.phase === 'scanned' ? t('qrScanned') : qr.phase === 'expired' ? t('qrExpired') : qr.phase === 'blocked' ? t('qrBlocked') : t('qrCreateError')
  return jsxs('div', { className: 'hermes-ncm-account', children: [
    qr.image ? jsx('span', { className: 'hermes-ncm-qr', children: jsx('img', { src: qr.image, width: 190, height: 190, alt: t('login') }) }) : null,
    jsx('div', { className: 'hermes-ncm-status', style: { whiteSpace: 'normal' }, children: label }),
    qr.phase === 'showing' || qr.phase === 'scanned'
      ? jsx(Button, { variant: 'ghost', size: 'micro', onClick: () => void create(((qr.strategy ?? 0) + 1) % 3), children: t('qrSwitch') })
      : jsx(Button, { variant: 'ghost', size: 'micro', onClick: () => void create(((qr.strategy ?? 0) + 1) % 3), children: t('qrRetry') }),
    qr.phase === 'blocked' || qr.phase === 'error' || qr.phase === 'expired'
      ? jsx(Button, { size: 'micro', onClick: () => { const el = smsPhoneRef.current; if (el) { el.scrollIntoView({ block: 'nearest' }); el.focus() } },
          children: t('smsGo') })
      : null,
    jsx(SmsForm, { player, phoneRef: smsPhoneRef })
  ] })
}

function LyricView({ player }) {
  const t = usePluginI18n(ID)
  const lyric = useValue(player.lyric)
  const position = useValue(player.pos)
  const ref = useRef(null)
  const index = (() => {
    let lo = -1
    for (let i = 0; i < lyric.lines.length; i++) { if (lyric.lines[i].t <= position + 0.2) lo = i; else break }
    return lo
  })()
  useEffect(() => {
    const container = ref.current
    const line = container?.children?.[index]
    if (container && line) container.scrollTo({ top: line.offsetTop - container.clientHeight / 2 + line.clientHeight / 2, behavior: 'smooth' })
  }, [index])
  if (!lyric.lines.length) return jsx('div', { className: 'hermes-ncm-hint', children: t('noLyric') })
  return jsx('div', { className: 'hermes-ncm-lyric', ref, children: lyric.lines.map((line, i) =>
    jsx('div', { className: 'hermes-ncm-lyric-line', 'data-active': i === index, onClick: () => player.seek(line.t), children: line.text }, i)) })
}

function Footer({ player, ctx }) {
  const t = usePluginI18n(ID)
  const status = useValue(player.status)
  const volume = useValue(player.volume)
  const position = useValue(player.pos)
  const duration = useValue(player.dur)
  const error = useValue(player.error)
  const showLyric = useValue(player.showLyric)
  const row = player.currentRow()
  const playing = status === 'playing'
  const failed = status === 'error'
  const Play = ic('Play', '▶'), Pause = ic('Pause', '⏸'), Prev = ic('SkipBack', '⏮'), NextI = ic('SkipForward', '⏭'),
    Vol = ic('Volume2', '🔊'), VolX = ic('VolumeX', '🔇'), LyricIcon = ic('Music', '♫'),
    ModeLoop = ic('Repeat', '🔁'), ModeOne = ic('Repeat1', '🔂'), ModeShuffle = ic('Shuffle', '🔀')
  const mode = useValue(player.mode)
  const modeIcons = { loop: ModeLoop, one: ModeOne, shuffle: ModeShuffle }
  const modeLabels = { loop: t('modeLoop'), one: t('modeOne'), shuffle: t('modeShuffle') }
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0
  return jsxs('div', { className: 'hermes-ncm-footer', children: [
    error ? jsx('div', { className: 'hermes-ncm-error', children: error === 'unplayable' ? t('unplayable') : error }) : null,
    jsxs('div', { className: 'hermes-ncm-transport', children: [
      jsx(Action, { label: modeLabels[mode], icon: modeIcons[mode], onClick: player.cycleMode }),
      jsx(Action, { label: t('prev'), icon: Prev, onClick: player.previous }),
      jsx(Action, { label: t(playing ? 'pause' : 'play'), icon: playing ? Pause : Play, busy: status === 'loading', onClick: player.toggle }),
      jsx(Action, { label: t('next'), icon: NextI, onClick: () => player.next() }),
      jsx('span', { className: 'hermes-ncm-time', children: fmt(position) }),
      jsx('input', { className: 'hermes-ncm-progress hermes-ncm-range', type: 'range', min: 0, max: Math.max(1, duration), step: 1,
        value: Math.min(position, duration || position), 'aria-label': t('nowPlaying'),
        style: { '--ncm-pct': `${pct}%` },
        onChange: event => player.seek(Number(event.target.value)) }),
      jsx('span', { className: 'hermes-ncm-time', children: fmt(duration) }),
      jsx(Action, { label: t(showLyric ? 'lyricOn' : 'lyric'), icon: LyricIcon, pressed: showLyric,
        onClick: () => player.showLyric.set(!showLyric) })
    ] }),
    jsxs('div', { className: 'hermes-ncm-volume', children: [
      jsx(Action, { label: t(volume ? 'mute' : 'unmute'), icon: volume ? Vol : VolX, onClick: player.mute }),
      jsx('input', { className: 'hermes-ncm-range', type: 'range', min: 0, max: 100, step: 1, value: volume,
        'aria-label': t('volume'), style: { '--ncm-pct': `${volume}%` },
        onChange: event => player.setVolume(Number(event.target.value)) })
    ] })
  ] })
}

function NowTab({ player, setTab }) {
  const t = usePluginI18n(ID)
  const queue = useValue(player.queue)
  const status = useValue(player.status)
  const row = player.currentRow()
  if (!row) return jsx('div', { className: 'hermes-ncm-hint', children: t('noPlayingNow') })
  return jsxs('div', { children: [
    jsxs('div', { className: 'hermes-ncm-now', children: [
      jsx(VinylCover, { pic: row.pic, playing: status === 'playing', arm: true, size: 'big' }),
      jsx('div', { className: 'hermes-ncm-nowtitle', children: row.name }),
      row.artists ? jsx('div', { className: 'hermes-ncm-nowmeta', children: row.artists }) : null
    ] }),
    jsx('div', { className: 'hermes-ncm-body', children:
      jsx(SongRow, { player, row, list: queue.list, index: queue.index }, `now-${row.id}`) })
  ] })
}

function Panel({ player, ctx }) {
  const t = usePluginI18n(ID)
  const [tab, setTab] = useState(() => player.currentRow() ? 'now' : 'search')
  const showLyric = useValue(player.showLyric)
  const tabs = [['now', t('tabNow')], ['rec', t('tabRec')], ['search', t('tabSearch')], ['liked', t('tabLiked')], ['playlists', t('tabPlaylists')], ['account', t('tabAccount')]]
  return jsxs('div', { children: [
    showLyric ? jsx(LyricView, { player }) : null,
    showLyric ? null : jsxs('div', { className: 'hermes-ncm-tabs', children: tabs.map(([key, label]) =>
      jsx(Button, { variant: tab === key ? 'secondary' : 'ghost', size: 'micro', onClick: () => setTab(key), children: label }, key)) }),
    showLyric ? null : tab === 'now' ? jsx(NowTab, { player, setTab })
      : tab === 'rec' ? jsx(RecTab, { player })
      : tab === 'search' ? jsx(SearchTab, { player })
      : tab === 'liked' ? jsx(LikedTab, { player })
      : tab === 'playlists' ? jsx(PlaylistsTab, { player })
      : jsx(AccountTab, { player }),
    jsx(Footer, { player, ctx })
  ] })
}

function NcmBar({ player, ctx }) {
  const t = usePluginI18n(ID)
  const queue = useValue(player.queue)
  const status = useValue(player.status)
  const open = useValue(player.open)
  const liked = useValue(player.likedIds)
  const row = queue.list[queue.index]
  const playing = status === 'playing'
  const isLiked = row ? liked.includes(row.id) : false
  const Play = ic('Play', '▶'), Pause = ic('Pause', '⏸')
  const label = row ? `${row.name}${row.artists ? ` — ${row.artists}` : ''}` : t('idle')
  return jsxs('div', { className: 'hermes-ncm-bar', children: [
    jsx(MiniWave, { player }),
    jsxs(Popover, { open, onOpenChange: value => player.open.set(value), children: [
      jsx(PopoverTrigger, { asChild: true, children: jsx(Button, { variant: 'ghost', size: 'micro',
        'aria-label': `${t('netease')}: ${label}`, children: jsx('span', { className: 'ncm-name', children: label }) }) }),
      jsx(PopoverContent, { side: 'top', align: 'end', className: 'hermes-ncm-panel', 'aria-label': t('netease'),
        children: jsx(Panel, { player, ctx }) })
    ] }),
    jsx(Action, { label: t('prev'), icon: ic('SkipBack', '⏮'), onClick: () => player.previous() }),
    jsx(Action, { label: t(playing ? 'pause' : 'play'), icon: playing ? Pause : Play, busy: status === 'loading', onClick: player.toggle }),
    jsx(Action, { label: t('next'), icon: ic('SkipForward', '⏭'), onClick: () => player.next() }),
    row ? jsx(Action, { label: t(isLiked ? 'unlike' : 'like'), icon: ic('Heart', '♥'), pressed: isLiked,
      className: 'hermes-ncm-barheart', onClick: () => void player.toggleLike(row) }) : null
  ] })
}

export default {
  id: ID,
  name: '网易云音乐',
  description: 'NetEase Cloud Music in the status bar: search, recommendations, FM, play, synced lyrics, likes, QR login, playlists.',
  defaultEnabled: false,
  register(ctx) {
    ctx.i18n.register(LOCALES)
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.append(style)
    ctx.onDispose(() => style.remove())
    const player = createPlayer(ctx)
    void player.refreshAccount()
    ctx.register({ id: 'player', area: STATUSBAR_AREAS.right, order: 11, render: () => jsx(NcmBar, { player, ctx }) })
  }
}
