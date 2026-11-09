"""NetEase Cloud Music (网易云音乐) backend for the Hermes desktop plugin.

Endpoints mount under /api/plugins/netease-cloud/. Pure stdlib (urllib) plus a
self-contained AES-128-CBC implementation so no crypto package is required in
the gateway venv. The weapi encryption follows the public Web-API scheme
(double AES-128-CBC + bare RSA modexp) used by the official web player.

Login is QR-code based: /qr/create returns a PNG data-URL, /qr/poll reports
801 waiting / 802 scanned / 803 confirmed / 800 expired; on 803 the MUSIC_U
cookie is captured and persisted to the plugin's data folder.

Plugin contract: handlers must never raise — every route folds failures into
{"ok": false, "error": ...}.
"""

from __future__ import annotations

import base64
import hashlib
import json
import random
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from http.cookies import SimpleCookie
from pathlib import Path

from fastapi import APIRouter, Request

router = APIRouter()

# ---------------------------------------------------------------- AES-128 ---

def _xtime(a: int) -> int:
    return ((a << 1) ^ 0x1B) & 0xFF if a & 0x80 else (a << 1)


def _gmul(a: int, b: int) -> int:
    r = 0
    while b:
        if b & 1:
            r ^= a
        a = _xtime(a)
        b >>= 1
    return r


def _gen_sbox() -> list[int]:
    inv = [0] * 256
    for i in range(1, 256):
        for j in range(1, 256):
            if _gmul(i, j) == 1:
                inv[i] = j
                break
    sbox = []
    for i in range(256):
        s = v = inv[i]
        for _ in range(4):
            v = ((v << 1) | (v >> 7)) & 0xFF
            s ^= v
        sbox.append(s ^ 0x63)
    return sbox


_SBOX = _gen_sbox()
_RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1B, 0x36]


def _key_expansion(key: bytes) -> list[list[int]]:
    w = [list(key[i * 4:i * 4 + 4]) for i in range(4)]
    for i in range(4, 44):
        t = list(w[i - 1])
        if i % 4 == 0:
            t = t[1:] + t[:1]
            t = [_SBOX[b] for b in t]
            t[0] ^= _RCON[i // 4 - 1]
        w.append([w[i - 4][j] ^ t[j] for j in range(4)])
    return [sum(w[r * 4:r * 4 + 4], []) for r in range(11)]


def _encrypt_block(s: list[int], rks: list[list[int]]) -> bytes:
    s = [s[i] ^ rks[0][i] for i in range(16)]
    for rnd in range(1, 10):
        s = [_SBOX[b] for b in s]
        s = [s[((c + r) % 4) * 4 + r] for c in range(4) for r in range(4)]
        out = []
        for c in range(4):
            a = s[c * 4:c * 4 + 4]
            t = a[0] ^ a[1] ^ a[2] ^ a[3]
            out += [a[0] ^ t ^ _xtime(a[0] ^ a[1]), a[1] ^ t ^ _xtime(a[1] ^ a[2]),
                    a[2] ^ t ^ _xtime(a[2] ^ a[3]), a[3] ^ t ^ _xtime(a[3] ^ a[0])]
        s = [out[i] ^ rks[rnd][i] for i in range(16)]
    s = [_SBOX[b] for b in s]
    s = [s[((c + r) % 4) * 4 + r] for c in range(4) for r in range(4)]
    return bytes(s[i] ^ rks[10][i] for i in range(16))


def aes_cbc_encrypt(data: bytes, key: bytes, iv: bytes) -> bytes:
    pad = 16 - len(data) % 16
    data = data + bytes([pad]) * pad
    rks = _key_expansion(key)
    prev = list(iv)
    out = bytearray()
    for i in range(0, len(data), 16):
        blk = [data[i + j] ^ prev[j] for j in range(16)]
        prev = list(_encrypt_block(blk, rks))
        out += bytes(prev)
    return bytes(out)


# sanity: FIPS-197 known-answer vector, cheap (runs at import)
if _encrypt_block(list(bytes.fromhex("00112233445566778899aabbccddeeff")),
                  _key_expansion(bytes.fromhex("000102030405060708090a0b0c0d0e0f"))) \
        .hex() != "69c4e0d86a7b0430d8cdb78070b4c55a":
    raise RuntimeError("netease-cloud: bundled AES failed its self-test")

# ---------------------------------------------------------------- weapi -----

_IV = b"0102030405060708"
_PRESET = b"0CoJUm6Qyw8W8jud"
_MOD = int("00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876a"
           "ea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05"
           "c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289"
           "dc6935b3ece0462db0a22b8e7", 16)
_B62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")


def _weapi_body(payload: dict) -> dict:
    text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    sec = "".join(random.choice(_B62) for _ in range(16))
    p1 = base64.b64encode(aes_cbc_encrypt(text.encode(), _PRESET, _IV)).decode()
    p2 = base64.b64encode(aes_cbc_encrypt(p1.encode(), sec.encode(), _IV)).decode()
    enc = format(pow(int.from_bytes(sec.encode()[::-1], "big"), 0x10001, _MOD), "x").zfill(256)
    return {"params": p2, "encSecKey": enc}


# ------------------------------------------------------------- cookies ------

def _data_dir() -> Path:
    try:
        from hermes_constants import get_hermes_home
        home = Path(get_hermes_home())
    except Exception:  # standalone dev/test without hermes on the path
        home = Path.home() / ".hermes"
    d = home / "plugins" / "netease-cloud" / "data"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _cookie_path() -> Path:
    return _data_dir() / "cookie.json"


def _load_cookies() -> dict:
    try:
        raw = json.loads(_cookie_path().read_text(encoding="utf-8"))
        cookies = raw.get("cookies") if isinstance(raw, dict) else None
        return dict(cookies) if isinstance(cookies, dict) else {}
    except Exception:
        return {}


def _save_cookies(cookies: dict) -> None:
    _cookie_path().write_text(json.dumps({"cookies": cookies, "savedAt": time.time()},
                                         ensure_ascii=False), encoding="utf-8")


def _cookie_header(cookies: dict) -> str:
    base = {"appver": "8.9.70"}
    base.update(cookies)
    return "; ".join(f"{k}={v}" for k, v in base.items())


def _harvest_set_cookies(response, cookies: dict) -> bool:
    """Merge any Set-Cookie values (notably MUSIC_U) into the jar; True when changed."""
    changed = False
    raw_headers = response.headers.get_all("Set-Cookie") if hasattr(response.headers, "get_all") else None
    for raw in raw_headers or []:
        try:
            morsel = SimpleCookie()
            morsel.load(raw)
            for key, morsel_value in morsel.items():
                value = morsel_value.value
                if value and cookies.get(key) != value:
                    cookies[key] = value
                    changed = True
        except Exception:
            continue
    return changed


# -------------------------------------------------------------- requests ----

def _http(url: str, data: dict | None = None, cookies: dict | None = None,
          timeout: float = 12.0, raw: bool = False, response=None):
    headers = {
        "User-Agent": _UA,
        "Referer": "https://music.163.com/",
        "Origin": "https://music.163.com",
        "Cookie": _cookie_header(cookies or {}),
    }
    body = None
    if data is not None:
        body = urllib.parse.urlencode(data).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=body, headers=headers)
    resp = urllib.request.urlopen(req, timeout=timeout)
    if raw:
        payload = resp.read()
        return (payload, resp) if response is not None else payload
    return json.loads(resp.read().decode("utf-8", "replace"))


def _weapi(path: str, payload: dict, cookies: dict | None = None):
    cookies = cookies if cookies is not None else _load_cookies()
    csrf = cookies.get("__csrf", "")
    url = f"https://music.163.com/weapi/{path}?csrf_token={urllib.parse.quote(csrf)}"
    return _http(url, _weapi_body(payload), cookies)


# ----------------------------------------------------------------- eapi -----
# Client-grade API (interface3). URLs issued here carry no os_web origin
# signature, so <audio> can fetch them directly (2026 weapi mp3 links 403
# with "auth failed - origin failed" for non-browser TLS clients).

def _aes_ecb_encrypt(data: bytes, key: bytes) -> bytes:
    pad = 16 - len(data) % 16
    data = data + bytes([pad]) * pad
    rks = _key_expansion(key)
    out = bytearray()
    for i in range(0, len(data), 16):
        out += _encrypt_block(list(data[i:i + 16]), rks)
    return bytes(out)


_EAPI_KEY = b"e82ckenh8dichen8"


def _eapi(path: str, payload: dict, cookies: dict | None = None):
    cookies = cookies if cookies is not None else _load_cookies()
    hdr = {
        "osver": "undefined", "deviceId": "undefined", "appver": "8.0.0",
        "versioncode": "140", "mobilename": "undefined", "buildver": "1623435496",
        "resolution": "1920x1080", "__csrf": "", "os": "pc", "channel": "undefined",
        "requestId": f"{int(time.time() * 1000)}_{random.randint(0, 1000):04}",
    }
    if cookies.get("MUSIC_U"):
        hdr["MUSIC_U"] = cookies["MUSIC_U"]
    req_text = json.dumps({**payload, "header": hdr}, separators=(",", ":"), ensure_ascii=False)
    api_path = f"/api{path}"
    digest = hashlib.md5(f"nobody{api_path}use{req_text}md5forencrypt".encode("latin1")).hexdigest()
    data = f"{api_path}-36cd479b6b5-{req_text}-36cd479b6b5-{digest}".encode("latin1")
    params = _aes_ecb_encrypt(data, _EAPI_KEY).hex().upper()
    req = urllib.request.Request(
        f"https://interface3.music.163.com/eapi{path}",
        data=f"params={params}".encode(),
        headers={
            "User-Agent": _UA,
            "Referer": "https://music.163.com",
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": "; ".join(f"{k}={v}" for k, v in hdr.items()),
        })
    with urllib.request.urlopen(req, timeout=12) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


# ------------------------------------------------------------ normalize -----

def _pic(url: str, size: int = 240) -> str:
    if not isinstance(url, str) or not url:
        return ""
    return f"{url}?param={size}y{size}" if "?" not in url else url


def _song_row(song: dict, privilege: dict | None = None) -> dict:
    artist_list = song.get("artists") or song.get("ar") or []
    artists = " / ".join(a.get("name", "") for a in artist_list if isinstance(a, dict) and a.get("name"))
    album = song.get("album") or song.get("al") or {}
    if isinstance(album, str):
        album = {"name": album}
    priv = privilege or {}
    fee = song.get("fee", priv.get("fee", 0))
    max_br = priv.get("st_maxbr") or priv.get("maxbr") or 0
    playable = priv.get("pl", 0) if priv else 0
    pic = album.get("picUrl") or album.get("blurPicUrl") or album.get("pic") or ""
    row = {
        "id": song.get("id"),
        "name": song.get("name", ""),
        "artists": artists,
        "album": album.get("name", ""),
        "pic": _pic(pic),
        "duration": int(song.get("duration") or song.get("dt") or 0),
        "fee": fee,
        # playable hint: 0 means the server currently refuses a stream for this song
        "maxbr": max_br,
        "pl": playable,
    }
    return row


# ------------------------------------------------------------- handlers -----

@router.get("/health")
async def health():
    cookies = _load_cookies()
    return {"ok": True, "loggedIn": bool(cookies.get("MUSIC_U")), "api": 1}


@router.post("/search")
@router.get("/search")
async def search(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = dict(request.query_params)
    query = str(body.get("q") or "").strip()
    if not query:
        return {"ok": False, "error": "empty query"}
    try:
        limit = max(1, min(60, int(body.get("limit") or 30)))
        offset = max(0, int(body.get("offset") or 0))
    except (TypeError, ValueError):
        limit, offset = 30, 0
    kind = str(body.get("kind") or "song")
    try:
        if kind == "playlist":
            res = _http("https://music.163.com/api/search/get",
                        {"s": query, "type": 1000, "limit": limit, "offset": offset})
            rows = []
            for p in (res.get("result") or {}).get("playlists") or []:
                creator = p.get("creator")
                if isinstance(creator, list):
                    creator = creator[0].get("userName", "") if creator and isinstance(creator[0], dict) else ""
                elif isinstance(creator, dict):
                    creator = creator.get("userName", "")
                else:
                    creator = ""
                rows.append({"id": p.get("id"), "name": p.get("name", ""),
                             "cover": _pic(p.get("coverImgUrl", "")),
                             "playCount": p.get("playCount", 0), "trackCount": p.get("trackCount", 0),
                             "creator": creator or ""})
            return {"ok": True, "playlists": rows}
        res = _http("https://music.163.com/api/search/get",
                    {"s": query, "type": 1, "limit": limit, "offset": offset})
        songs = ((res.get("result") or {}).get("songs")) or []
        # the legacy search payload omits album.picUrl — one batched v3 detail
        # call refills covers (and keeps working if it fails: rows just lack pic).
        pics: dict = {}
        ids = [s.get("id") for s in songs if s.get("id")]
        if ids:
            try:
                det = _weapi("v3/song/detail",
                             {"c": json.dumps([{"id": i} for i in ids[:100]], separators=(",", ":")),
                              "ids": json.dumps(ids[:100])}, _load_cookies())
                pics = {s.get("id"): _pic((s.get("al") or {}).get("picUrl") or "")
                        for s in det.get("songs") or []}
            except Exception:
                pics = {}
        rows = []
        for s in songs:
            row = _song_row(s)
            if pics.get(s.get("id")):
                row["pic"] = pics[s.get("id")]
            rows.append(row)
        return {"ok": True, "songs": rows}
    except Exception as exc:
        return {"ok": False, "error": f"search failed: {exc}"}


@router.post("/url")
async def song_url(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    try:
        song_id = int(body.get("id"))
    except (TypeError, ValueError):
        return {"ok": False, "error": "bad id"}
    cookies = _load_cookies()
    first_error: dict = {}
    for level in ("exhigh", "standard"):
        try:
            res = _eapi("/song/enhance/player/url/v1",
                        {"ids": f"[{song_id}]", "level": level, "encodeType": "mp3"}, cookies)
        except Exception as exc:
            return {"ok": False, "error": f"url failed: {exc}"}
        data = (res.get("data") or [{}])[0]
        url = data.get("url")
        if url:
            return {"ok": True, "url": url, "br": data.get("br", 0), "size": data.get("size", 0),
                    "level": data.get("level") or level, "type": data.get("type") or "mp3",
                    "expiry": data.get("expi", 1200), "fee": data.get("fee", 0)}
        # no url usually means VIP-only or region block; freeTrialInfo
        # carries the 30s preview when offered.
        trial = data.get("freeTrialInfo") or None
        if trial and trial.get("url"):
            return {"ok": True, "url": trial["url"], "trial": True,
                    "end": trial.get("end", 30), "fee": data.get("fee", 1),
                    "br": 0, "size": 0, "level": "trial", "type": "mp3", "expiry": 1200}
        first_error = data
    return {"ok": False, "error": "unplayable", "code": first_error.get("code"),
            "fee": first_error.get("fee", 0)}


@router.get("/lyric")
async def lyric(id: int = 0):
    if not id:
        return {"ok": False, "error": "bad id"}
    try:
        res = _http(f"https://music.163.com/api/song/lyric?id={id}&lv=-1&kv=-1&tv=-1")
        text = ((res.get("lrc") or {}).get("lyric")) or ""
        return {"ok": True, "lyric": text}
    except Exception as exc:
        return {"ok": False, "error": f"lyric failed: {exc}"}


@router.post("/detail")
async def detail(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    ids = body.get("ids") or []
    try:
        ids = [int(i) for i in ids][:100]
    except (TypeError, ValueError):
        return {"ok": False, "error": "bad ids"}
    if not ids:
        return {"ok": True, "songs": []}
    try:
        res = _weapi("v3/song/detail",
                     {"c": json.dumps([{"id": i} for i in ids], separators=(",", ":")), "ids": json.dumps(ids)})
        songs = res.get("songs") or []
        by_id = {s.get("id"): s for s in songs}
        rows = []
        for i in ids:
            s = by_id.get(i)
            if s is not None:
                rows.append(_song_row(s))
        return {"ok": True, "songs": rows}
    except Exception as exc:
        return {"ok": False, "error": f"detail failed: {exc}"}


# ---------------------------------------------------------------- login -----

# Current web QR login (2024+ flow): api/login/qrcode/unikey issues a unikey,
# the client renders the scanlogin URL as a QR, and api/login/qrcode/client/login
# is polled with the SAME attempt-scoped anonymous cookie jar + chain id.
# Codes: 800 expired, 801 waiting for scan, 802 scanned (awaiting phone confirm,
# may already carry cookies), 803 confirmed (MUSIC_U arrives via Set-Cookie).
_QR_ATTEMPTS: dict[str, dict] = {}


def _new_attempt_jar() -> tuple[dict, str]:
    import secrets as _secrets
    import string
    import time as _time
    ts = int(_time.time() * 1000)
    alphabet = string.ascii_letters + string.digits + "-_"
    token = lambda n: "".join(_secrets.choice(alphabet) for _ in range(n))  # noqa: E731
    nuid = _secrets.token_hex(16)
    jar = {
        "JSESSIONID-WYYY": token(190),
        "_iuqxldmzr_": "33",
        "_ntes_nnid": f"{nuid},{ts}",
        "_ntes_nuid": nuid,
        "NMTID": "00" + token(39),
        "WEVNSM": "1.0.0",
        "WNMCID": "".join(_secrets.choice(string.ascii_lowercase) for _ in range(6)) + f".{ts}.01.0",
    }
    chain_id = f"v1_unknown-{_secrets.randbelow(1000000)}_web_login_{ts}"
    return jar, chain_id


def _qr_request(path: str, payload: dict, jar: dict, chain_id: str, checking: bool):
    url = f"https://music.163.com{path}"
    headers = {
        "User-Agent": _UA, "Referer": "https://music.163.com/", "Origin": "https://music.163.com",
        "Cookie": _cookie_header(jar),
        "Content-Type": "application/x-www-form-urlencoded",
        "x-os": "web", "Nm-GCore-Status": "1",
    }
    if checking:
        headers["X-loginMethod"] = "QrCode"
        headers["x-login-chain-id"] = chain_id
    req = urllib.request.Request(url, data=urllib.parse.urlencode(payload).encode(), headers=headers)
    return urllib.request.urlopen(req, timeout=12)


@router.post("/qr/create")
async def qr_create():
    try:
        jar, chain_id = _new_attempt_jar()
        resp = _qr_request("/api/login/qrcode/unikey", {"type": 1, "noCheckToken": True}, jar, chain_id, False)
        _harvest_set_cookies(resp, jar)
        result = json.loads(resp.read().decode("utf-8", "replace"))
        key = result.get("unikey") or result.get("uniKey") or (result.get("data") or {}).get("unikey")
        if result.get("code") != 200 or not key:
            return {"ok": False, "error": f"create failed: code={result.get('code')}"}
        _QR_ATTEMPTS[key] = {"jar": jar, "chainId": chain_id, "createdAt": time.time()}
        for stale in [k for k, v in _QR_ATTEMPTS.items() if time.time() - v["createdAt"] > 300]:
            _QR_ATTEMPTS.pop(stale, None)
        qr_url = ("https://music.163.com/st/platform/scanlogin?"
                  + urllib.parse.urlencode({"codekey": key, "chainId": chain_id,
                                            "hdw_device": "web", "hdw_appid": "web", "hitExp": "1"}))
        return {"ok": True, "uniid": key, "qrUrl": qr_url}
    except Exception as exc:
        return {"ok": False, "error": f"qr create failed: {exc}"}


@router.post("/qr/poll")
async def qr_poll(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    uniid = str(body.get("uniid") or "")
    attempt = _QR_ATTEMPTS.get(uniid)
    if not attempt:
        return {"ok": False, "code": 800, "error": "expired"}
    try:
        resp = _qr_request("/api/login/qrcode/client/login",
                           {"key": uniid, "type": 1, "noCheckToken": True},
                           attempt["jar"], attempt["chainId"], True)
        payload = resp.read().decode("utf-8", "replace")
        try:
            result = json.loads(payload)
        except Exception:
            result = {}
        code = result.get("code")
        jar = attempt["jar"]
        _harvest_set_cookies(resp, jar)
        # cookie may also arrive inside the JSON body
        for candidate in (result.get("cookie"),
                          (result.get("qrLogin") or {}).get("cookieInfo", {}).get("cookie")
                          if isinstance((result.get("qrLogin") or {}).get("cookieInfo"), dict) else None):
            if isinstance(candidate, str):
                try:
                    parsed = SimpleCookie(candidate)
                    for key, morsel in parsed.items():
                        if morsel.value:
                            jar[key] = morsel.value
                except Exception:
                    pass
        music_u = jar.get("MUSIC_U")
        if code in (802, 803):
            if music_u:
                cookies = _load_cookies()
                for key in ("MUSIC_U", "__csrf", "NMTID", "MUSIC_A"):
                    if jar.get(key):
                        cookies[key] = jar[key]
                _save_cookies(cookies)
            if code == 803:
                _QR_ATTEMPTS.pop(uniid, None)
                return {"ok": True, "code": 803, "loggedIn": bool(music_u)}
            return {"ok": True, "code": 802}
        if code == 800:
            _QR_ATTEMPTS.pop(uniid, None)
        return {"ok": True, "code": code}
    except Exception as exc:
        return {"ok": False, "error": f"qr poll failed: {exc}"}


@router.get("/account")
async def account():
    cookies = _load_cookies()
    if not cookies.get("MUSIC_U"):
        return {"ok": True, "loggedIn": False}
    try:
        res = _weapi("nuser/account/get", {}, cookies)
        acct = res.get("account") or res.get("profile") or {}
        if not acct:
            # MUSIC_U present but the API refused: keep it simple and report logged out
            return {"ok": True, "loggedIn": False}
        return {"ok": True, **_account_payload(res)}
    except Exception as exc:
        return {"ok": False, "error": f"account failed: {exc}"}


def _account_payload(res: dict) -> dict:
    """Normalise the nuser/account/get response (shared by /account and /login/cookie)."""
    acct = res.get("account") or res.get("profile") or {}
    profile = res.get("profile") or acct
    return {"loggedIn": True, "account": {
        "userId": acct.get("id"),
        "nickname": acct.get("nickname") or profile.get("nickname") or "",
        "avatar": _pic(acct.get("avatarUrl") or profile.get("avatarUrl") or "", 80),
        "vipType": acct.get("vipType", 0),
        "likedListId": (profile.get("likelist") or acct.get("likelist") or {}).get("id")
        if isinstance(profile.get("likelist") or acct.get("likelist"), dict) else None,
        "likedSongsCount": profile.get("likedSongsCount", 0),
    }}


@router.post("/login/cookie")
async def login_cookie(request: Request):
    """Browser-cookie fallback login: paste the music.163.com cookie (needs MUSIC_U).

    Bypasses the app-side QR risk-control wall entirely; verification is the same
    account weapi call /account makes."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    raw = str(body.get("cookie") or "").strip()
    pairs: dict = {}
    for part in raw.replace("\n", ";").split(";"):
        part = part.strip()
        if not part or "=" not in part:
            continue
        key, _, value = part.partition("=")
        key = key.strip().lstrip("$")
        value = value.strip()
        if key and value:
            pairs[key] = value
    if "MUSIC_U" not in pairs:
        # value-only paste (users copy just the Value cell): a bare token with no
        # '=' or ';' anywhere is treated as the MUSIC_U value itself.
        if raw and "=" not in raw and ";" not in raw and "," not in raw:
            if re.fullmatch(r"00[A-Za-z0-9]{25,48}", raw):
                # NMTID looks like this (starts with 00, ~40 uppercase chars) and is
                # the neighbour people grab instead of MUSIC_U in DevTools.
                return {"ok": False, "error": "looks-like-nmtid"}
            pairs["MUSIC_U"] = raw
    if "MUSIC_U" not in pairs:
        return {"ok": False, "error": "missing MUSIC_U"}
    cookies = _load_cookies()
    cookies.update(pairs)
    _save_cookies(cookies)
    try:
        res = _weapi("nuser/account/get", {}, cookies)
        acct = res.get("account") or res.get("profile") or {}
        if acct:
            return {"ok": True, **_account_payload(res)}
        return {"ok": True, "loggedIn": False, "error": "server rejected the cookie"}
    except Exception as exc:
        return {"ok": True, "loggedIn": False, "error": f"saved, verify failed: {exc}"}


@router.post("/logout")
async def logout():
    try:
        _cookie_path().unlink(missing_ok=True)
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


# ----------------------------------------------------------- playlists ------

@router.get("/playlists")
async def playlists():
    cookies = _load_cookies()
    if not cookies.get("MUSIC_U"):
        return {"ok": False, "error": "login required"}
    try:
        res = _weapi("nuser/account/get", {}, cookies)
        acct = res.get("account") or {}
        uid = acct.get("id")
        if not uid:
            return {"ok": False, "error": "not logged in"}
        res2 = _weapi("user/playlist/v1", {"uid": uid, "limit": 100, "offset": 0}, cookies)
        rows = []
        liked_id = (acct.get("likelist") or {}).get("id") if isinstance(acct.get("likelist"), dict) else None
        if liked_id:
            rows.append({"id": liked_id, "name": "我喜欢的音乐", "cover": "", "count": acct.get("vipType") and None,
                         "playCount": 0, "specialType": 5})
        for p in res2.get("playlist") or []:
            rows.append({"id": p.get("id"), "name": p.get("name", ""),
                         "cover": _pic(p.get("coverImgUrl", "")),
                         "playCount": p.get("playCount", 0), "trackCount": p.get("trackCount", 0),
                         "specialType": p.get("specialType", 0)})
        return {"ok": True, "playlists": rows, "userId": uid}
    except Exception as exc:
        return {"ok": False, "error": f"playlists failed: {exc}"}


@router.post("/playlist")
async def playlist_tracks(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    try:
        pid = int(body.get("id"))
    except (TypeError, ValueError):
        return {"ok": False, "error": "bad id"}
    cookies = _load_cookies()
    try:
        # playlist/track/all was retired upstream (404 since 2026): v6 detail
        # carries trackIds + privileges, song detail fills the rest in chunks.
        res = _weapi("v6/playlist/detail", {"id": pid, "n": 0, "s": 0}, cookies)
        pl = res.get("playlist") or {}
        if not pl:
            return {"ok": False, "error": f"playlist unavailable (code={res.get('code')})"}
        ids = [t.get("id") for t in pl.get("trackIds") or [] if isinstance(t, dict) and t.get("id")]
        privileges = {p.get("id"): p for p in pl.get("privileges") or [] if isinstance(p, dict)}
        cap = 1000
        rows: dict = {}
        for i in range(0, min(len(ids), cap), 100):
            chunk = ids[i:i + 100]
            det = _weapi("v3/song/detail",
                         {"c": json.dumps([{"id": x} for x in chunk], separators=(",", ":")),
                          "ids": json.dumps(chunk)}, cookies)
            by_id = {s.get("id"): s for s in det.get("songs") or []}
            for x in chunk:
                s = by_id.get(x)
                if s is not None:
                    rows[x] = _song_row(s, privileges.get(x))
        songs = [rows[x] for x in ids if x in rows]
        return {"ok": True, "songs": songs, "name": pl.get("name", ""),
                "total": len(ids), "partial": len(ids) > cap}
    except Exception as exc:
        return {"ok": False, "error": f"playlist failed: {exc}"}


@router.post("/like")
async def like(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    try:
        song_id = int(body.get("id"))
    except (TypeError, ValueError):
        return {"ok": False, "error": "bad id"}
    cookies = _load_cookies()
    if not cookies.get("MUSIC_U"):
        return {"ok": False, "error": "login required"}
    try:
        res = _weapi("song/like", {"id": song_id, "like": bool(body.get("like", True))}, cookies)
        return {"ok": bool(res.get("feedback") or res.get("created") or res.get("closed") is not None)}
    except Exception as exc:
        return {"ok": False, "error": f"like failed: {exc}"}


@router.get("/liked")
async def liked(limit: int = 200):
    cookies = _load_cookies()
    if not cookies.get("MUSIC_U"):
        return {"ok": False, "error": "login required"}
    try:
        res = _weapi("song/like/get", {}, cookies)
        ids = res.get("ids") or []
        ids = ids[:max(1, min(500, limit))]
        rows = []
        for i in range(0, len(ids), 100):
            chunk = ids[i:i + 100]
            det = _weapi("v3/song/detail",
                         {"c": json.dumps([{"id": x} for x in chunk], separators=(",", ":")),
                          "ids": json.dumps(chunk)})
            by_id = {s.get("id"): s for s in det.get("songs") or []}
            for x in chunk:
                s = by_id.get(x)
                if s is not None:
                    rows.append(_song_row(s))
        return {"ok": True, "songs": rows, "total": len(res.get("ids") or [])}
    except Exception as exc:
        return {"ok": False, "error": f"liked failed: {exc}"}


@router.post("/scrobble")
async def scrobble(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    try:
        song_id = int(body.get("id"))
    except (TypeError, ValueError):
        return {"ok": False, "error": "bad id"}
    cookies = _load_cookies()
    if not cookies.get("MUSIC_U"):
        return {"ok": True}  # silently skip anonymous scrobbles
    try:
        _weapi("feedback/webenergy", {"id": song_id, "source": 0, "skipType": 1}, cookies)
        return {"ok": True}
    except Exception:
        return {"ok": False}  # fire-and-forget; never surface scrobble noise


# ------------------------------------------------------------- recommend ----
# 2026-11 probe: legacy v1/recommend/resource is retired (404). Daily picks
# live on eapi /v3/discovery/recommend/songs; recommended playlists (incl.
# the official 私人雷达 dynamic list) on v1/discovery/recommend/resource;
# Personal FM on the legacy radio/get. All three verified live with MUSIC_U.

@router.post("/recommend/daily")
@router.get("/recommend/daily")
async def recommend_daily():
    cookies = _load_cookies()
    if not cookies.get("MUSIC_U"):
        return {"ok": False, "error": "login required"}
    try:
        res = _eapi("/v3/discovery/recommend/songs", {}, cookies)
        data = res.get("data") or {}
        songs = [_song_row(s, s.get("privilege")) for s in data.get("dailySongs") or [] if isinstance(s, dict)]
        if not songs:
            return {"ok": False, "error": f"daily empty (code={res.get('code')})"}
        return {"ok": True, "songs": songs}
    except Exception as exc:
        return {"ok": False, "error": f"daily failed: {exc}"}


@router.post("/recommend/resource")
async def recommend_resource():
    cookies = _load_cookies()
    if not cookies.get("MUSIC_U"):
        return {"ok": False, "error": "login required"}
    try:
        res = _weapi("v1/discovery/recommend/resource", {}, cookies)
        cards = []
        for item in res.get("recommend") or []:
            if not isinstance(item, dict) or item.get("type") != 1:
                continue  # phase 1: playlists only
            creator = item.get("creator")
            creator = creator.get("nickname", "") if isinstance(creator, dict) else ""
            cards.append({
                "id": item.get("id"),
                "name": item.get("name", ""),
                "cover": _pic(item.get("picUrl")),
                "creator": creator or item.get("copywriter") or "",
                "trackCount": 0,
            })
        return {"ok": True, "playlists": cards}
    except Exception as exc:
        return {"ok": False, "error": f"resource failed: {exc}"}


@router.post("/fm/next")
async def fm_next():
    cookies = _load_cookies()
    if not cookies.get("MUSIC_U"):
        return {"ok": False, "error": "login required"}
    try:
        res = _weapi("v1/radio/get", {}, cookies)
        songs = [_song_row(s) for s in res.get("data") or [] if isinstance(s, dict)]
        if not songs:
            return {"ok": False, "error": f"fm empty (code={res.get('code')})"}
        return {"ok": True, "songs": songs}
    except Exception as exc:
        return {"ok": False, "error": f"fm failed: {exc}"}
