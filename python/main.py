import json
import os
import threading
import time
import urllib.request

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
ASSETS_DIR = os.path.join(BASE_DIR, "assets")
ACTIVE_TTL = 60
REFRESH_INTERVAL = 5 * 60
PLAYLIST_ID = "PLUoQz2ARfFa0"
INSTANCES = [
    "https://inv.nadeko.net",
    "https://invidious.f5.si",
    "https://invidious.tiekoetter.com",
    "https://yt.chocolatemoo53.com",
]
FIELDS = "videoId,title,author,lengthSeconds,type,liveNow"
TRACKS_FILE = os.path.join(STATIC_DIR, "tracks.json")

app = FastAPI(title="Raju Mistri")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

sessions = {}
sessions_lock = threading.Lock()


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "RajuMistri/1.0"})
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read().decode("utf-8"))


def fetch_playlist():
    for base in INSTANCES:
        try:
            seen = set()
            tracks = []
            for page in range(1, 6):
                url = f"{base}/api/v1/playlists/{PLAYLIST_ID}?page={page}&fields={FIELDS}"
                data = get_json(url)
                before = len(tracks)
                for v in data.get("videos") or []:
                    vid = v.get("videoId")
                    if v.get("type") == "video" and not v.get("liveNow") and vid and vid not in seen:
                        seen.add(vid)
                        tracks.append({
                            "id": vid,
                            "title": v.get("title", ""),
                            "artist": v.get("author", ""),
                            "lengthSeconds": v.get("lengthSeconds") or 0,
                            "cover": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                        })
                if len(tracks) == before:
                    break
            if tracks:
                print(f"OK  {base} -> {len(tracks)} unique tracks")
                return tracks
        except Exception as e:
            print(f"fail {base}: {e}")
    return []


def write_playlist():
    tracks = fetch_playlist()
    if not tracks:
        print("playlist fetch failed - keeping existing tracks.json")
        return False
    with open(TRACKS_FILE, "w", encoding="utf-8") as f:
        json.dump(tracks, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"tracks.json updated -> {len(tracks)} tracks at {time.strftime('%Y-%m-%d %H:%M:%S')}")
    return True


def background_refresh():
    while True:
        time.sleep(REFRESH_INTERVAL)
        try:
            write_playlist()
        except Exception as e:
            print(f"background refresh failed: {e}")


write_playlist()
threading.Thread(target=background_refresh, daemon=True).start()


def prune(now):
    with sessions_lock:
        for sid in list(sessions):
            if now - sessions[sid] > ACTIVE_TTL:
                del sessions[sid]


@app.get("/api/stats")
def stats():
    now = time.time()
    prune(now)
    with sessions_lock:
        active = len(sessions)
    return JSONResponse({"active": active, "ttl": ACTIVE_TTL}, headers={"Cache-Control": "no-store"})


@app.post("/api/beat")
def beat(request: Request):
    sid = request.query_params.get("sid") or request.client.host
    with sessions_lock:
        sessions[sid] = time.time()
    return JSONResponse({"ok": True}, headers={"Cache-Control": "no-store"})


@app.get("/api/tracks")
def tracks():
    with open(TRACKS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return JSONResponse(data, headers={"Cache-Control": "no-store"})


@app.get("/fresh-tracks")
def fresh_tracks():
    data = fetch_playlist()
    if not data:
        return JSONResponse(
            {"error": "playlist unavailable"},
            status_code=503,
            headers={"Cache-Control": "no-store"},
        )
    return JSONResponse(data, headers={"Cache-Control": "no-store"})


@app.get("/healthz")
def healthz():
    return {"ok": True}


app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")