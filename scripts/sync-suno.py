#!/usr/bin/env python3
"""
sync-suno.py — Extract Suno song metadata via Suno Studio API and sync to local web catalog.

Features:
- Takes URLs directly, from a text file, or by searching WhatsApp captured messages.
- Resolves short share links (https://suno.com/s/<id>) to song UUIDs.
- Queries Suno Studio API (https://studio-api-prod.suno.com/api/clip/<uuid>) for:
    * Title & Artist
    * High-quality progressive audio streaming URL (.m4a)
    * HD cover artwork (.jpeg)
    * MP4 video rendering URL
    * Duration and formatted timestamp
    * Style tags & prompt (complete lyrics)
    * Creation date
- Merges into data/songs.json and generates public/js/songs.js (for zero-CORS static hosting).
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_JSON_PATH = os.path.join(REPO_ROOT, "data", "songs.json")
PUBLIC_JS_PATH = os.path.join(REPO_ROOT, "public", "js", "songs.js")

# Optional fallback location for WhatsApp captured messages in workspace
WORKSPACE_CAPTURED_MSGS = r"D:\CURSOR PROJECTS\claude-jw\whatsapp\inbox\captured-messages.json"


def resolve_clip_id(url):
    """Resolve Suno share link or direct link to clip UUID."""
    url = url.strip().rstrip(".,;!?:")
    m = re.search(r"song/([0-9a-fA-F-]+)", url)
    if m:
        return m.group(1), url

    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        final_url = resp.geturl()

    m = re.search(r"song/([0-9a-fA-F-]+)", final_url)
    if not m:
        raise ValueError(f"Could not resolve song UUID from URL: {url} -> {final_url}")
    return m.group(1), final_url


def fetch_clip_metadata(clip_id, original_url=""):
    """Query Suno Studio API for rich clip metadata."""
    api_url = f"https://studio-api-prod.suno.com/api/clip/{clip_id}"
    req = urllib.request.Request(api_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        clip_data = json.loads(resp.read().decode("utf-8"))

    meta = clip_data.get("metadata", {}) or {}
    duration_sec = meta.get("duration", 0) or 0
    mins = int(duration_sec // 60)
    secs = int(duration_sec % 60)

    # Extract best progressive streamable audio URL
    audio_url = ""
    for item in clip_data.get("media_urls", []) or []:
        if item.get("url"):
            audio_url = item["url"]
            break

    # If media_urls didn't contain url, check audio_url
    if not audio_url:
        cand = clip_data.get("audio_url", "")
        if cand and "forbidden" not in cand:
            audio_url = cand

    # Extract artwork
    image_url = clip_data.get("image_large_url") or clip_data.get("image_url") or ""

    # Lyrics / prompt
    prompt = meta.get("prompt", "") or ""
    # Extract hook (first 2-3 clean lyric lines without bracketed tags)
    clean_lines = [l.strip() for l in prompt.split("\n") if l.strip() and not l.strip().startswith("[")]
    hook = " / ".join(clean_lines[:3]) if clean_lines else ""

    tags = meta.get("tags", "") or ""

    return {
        "id": clip_id,
        "title": clip_data.get("title", "Untitled").strip(),
        "artist": "BJ Akui",
        "audio_url": audio_url,
        "video_url": clip_data.get("video_url", ""),
        "image_url": image_url,
        "duration": round(duration_sec, 2),
        "duration_formatted": f"{mins}:{secs:02d}",
        "tags": tags,
        "prompt": prompt,
        "hook": hook,
        "model": clip_data.get("major_model_version", "v6"),
        "created_at": clip_data.get("created_at", ""),
        "share_url": original_url or f"https://suno.com/song/{clip_id}",
        "suno_url": f"https://suno.com/song/{clip_id}"
    }


def extract_urls_from_captured_messages(thread_query, captured_path=WORKSPACE_CAPTURED_MSGS):
    """Extract Suno URLs from WhatsApp captured messages file."""
    if not os.path.exists(captured_path):
        raise FileNotFoundError(f"Captured messages not found at {captured_path}")

    with open(captured_path, "r", encoding="utf-8") as f:
        msgs = json.load(f)

    query_lower = thread_query.lower()
    matching = []
    for m in msgs:
        tid = str(m.get("threadId", "")).lower()
        tname = str(m.get("threadName", "")).lower()
        if query_lower in tid or query_lower in tname:
            matching.append(m)

    matching.sort(key=lambda x: x.get("timestamp", ""))

    urls = []
    seen = set()
    suno_pattern = re.compile(r"https?://(?:www\.)?suno\.com/(?:s|song)/[^\s\)]+")

    for m in matching:
        body = m.get("body", "")
        for u in suno_pattern.findall(body):
            clean = u.strip().rstrip(".,;!?:")
            if clean not in seen:
                seen.add(clean)
                urls.append(clean)

    return urls


def save_catalog(songs):
    """Write songs to data/songs.json and public/js/songs.js."""
    os.makedirs(os.path.dirname(DATA_JSON_PATH), exist_ok=True)
    with open(DATA_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(songs, f, ensure_ascii=False, indent=2)

    os.makedirs(os.path.dirname(PUBLIC_JS_PATH), exist_ok=True)
    js_content = f"// Autogenerated by scripts/sync-suno.py — DO NOT EDIT DIRECTLY\nwindow.SUNO_CATALOG = {json.dumps(songs, ensure_ascii=False, indent=2)};\n"
    with open(PUBLIC_JS_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)

    print(f"✅ Catalog saved with {len(songs)} tracks:")
    print(f"   -> {DATA_JSON_PATH}")
    print(f"   -> {PUBLIC_JS_PATH}")


def main():
    parser = argparse.ArgumentParser(description="Sync Suno songs to JSON catalog.")
    parser.add_argument("--urls", nargs="+", help="One or more Suno URLs.")
    parser.add_argument("--file", help="File containing Suno URLs (one per line).")
    parser.add_argument("--thread", help="Search captured WhatsApp messages by thread name/JID.")
    parser.add_argument("--artist", default="BJ Akui", help="Artist name (default: BJ Akui).")
    args = parser.parse_args()

    urls_to_sync = []
    if args.urls:
        urls_to_sync = args.urls
    elif args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            urls_to_sync = [l.strip() for l in f if l.strip() and not l.startswith("#")]
    elif args.thread:
        print(f"Searching captured messages for: '{args.thread}'...")
        urls_to_sync = extract_urls_from_captured_messages(args.thread)
        print(f"Found {len(urls_to_sync)} URLs in captured messages.")
    else:
        # Default fallback to BJ & wongs thread if available
        if os.path.exists(WORKSPACE_CAPTURED_MSGS):
            print("No arguments provided. Searching captured messages for 'BJ & wongs'...")
            urls_to_sync = extract_urls_from_captured_messages("BJ & wongs")
        else:
            parser.error("Please provide --urls, --file, or --thread.")

    if not urls_to_sync:
        print("No Suno URLs found.")
        sys.exit(0)

    # Load existing songs if any to merge
    existing_map = {}
    if os.path.exists(DATA_JSON_PATH):
        try:
            with open(DATA_JSON_PATH, "r", encoding="utf-8") as f:
                for s in json.load(f):
                    existing_map[s["id"]] = s
        except Exception as e:
            print(f"Note: Could not parse existing songs.json ({e}). Starting fresh.")

    print(f"\nProcessing {len(urls_to_sync)} Suno song links...")
    ordered_songs = []
    seen_ids = set()

    for idx, u in enumerate(urls_to_sync, 1):
        try:
            print(f"[{idx}/{len(urls_to_sync)}] Resolving: {u}")
            clip_id, resolved_url = resolve_clip_id(u)
            if clip_id in seen_ids:
                continue
            seen_ids.add(clip_id)

            # Check if we already have it with full audio_url
            if clip_id in existing_map and existing_map[clip_id].get("audio_url"):
                song = existing_map[clip_id]
                song["artist"] = args.artist
                print(f"   ✓ [Cached] '{song['title']}' ({song.get('duration_formatted', '')})")
            else:
                song = fetch_clip_metadata(clip_id, original_url=u)
                song["artist"] = args.artist
                print(f"   ⭐ [Fetched] '{song['title']}' ({song['duration_formatted']})")
                time.sleep(0.3)

            ordered_songs.append(song)
        except Exception as e:
            print(f"   ❌ Error fetching {u}: {e}")

    # Also keep any existing songs that were in data/songs.json but not in this sync batch
    for cid, s in existing_map.items():
        if cid not in seen_ids:
            ordered_songs.append(s)

    save_catalog(ordered_songs)


if __name__ == "__main__":
    main()
