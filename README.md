# 🎵 BJ Suno Songs Library

A modern, responsive, Suno-inspired personal web music library for **BJ Akui's** original AI songs. Built for zero-latency progressive audio streaming, complete lyrics & generation prompt preservation, and instant mobile listening.

Live Target Domain: `https://bjsunosongs.mastern8n.cc`

---

## ✨ Features

- **Suno-Inspired Dark Aesthetic**: Deep obsidian slate surfaces (`#07080c`), subtle glassmorphism cards, and Suno-signature neon gradient accents (`#ff5722` → `#ec4899` → `#8b5cf6`).
- **Progressive Audio Streaming**: Direct native HTML5 audio playback from high-quality progressive `.m4a` streams.
- **Sticky Audio Dock**:
  - Persistent bottom music player with scrubber seek bar, live elapsed/total time, volume slider, and track artwork.
  - Controls for Play/Pause, Next, Previous, Shuffle, and Repeat mode.
  - Keyboard shortcuts: `Spacebar` (Play/Pause), `←`/`→` (Skip 5s), `M` (Mute), `L` (Toggle lyrics).
  - Native **Media Session API**: Syncs song title, artist, and album artwork with iOS/Android lock screens and car displays.
- **Search & Dynamic Tag Filtering**: Instant search across song titles, style tags, and lyrics prompts. One-click genre pills (e.g. *Upbeat Pop-Rock*, *K-pop Romantic*, *Gospel/Soul*, *Acoustic Ballad*).
- **Dual View Modes**: Switch between immersive **Grid Cards** (large album artwork) and compact **Tracklist Table** with 1 click.
- **Lyrics & Prompt Modal**: Verse-structured lyrics viewer (`[Verse 1]`, `[Chorus]`, `[Bridge]`) with one-click copy and direct link to the original Suno song page.
- **Zero Runtime Server**: Pure static SPA (`public/`) requiring zero server-side compute. Deployable on Cloudflare Pages, GitHub Pages, or any static CDN.

---

## 📁 Repository Structure

```
bj-suno-songs/
├── .github/workflows/deploy.yml   # Optional automated Cloudflare Pages deploy action
├── data/
│   └── songs.json                # Canonical structured metadata catalog (11 tracks)
├── public/                       # Production static build
│   ├── css/style.css             # Suno dark theme & responsive player styling
│   ├── js/
│   │   ├── app.js                # Audio engine, scrubber, search/filter, lyrics modal
│   │   └── songs.js              # Inlined catalog data for zero-CORS static hosting
│   ├── favicon.svg               # Gradient audio waveform icon
│   └── index.html                # Single-page web application
├── scripts/
│   └── sync-suno.py              # CLI extractor using Suno Studio API
├── wrangler.toml                 # Cloudflare Pages / Workers configuration
├── package.json                  # Node scripts
└── README.md
```

---

## 🚀 Adding New Songs

Whenever BJ (or friends/family) sends new Suno song links, run the sync script:

### 1. By Direct URL
```bash
python scripts/sync-suno.py --urls https://suno.com/s/3HjkjwrzZzWMlgGm https://suno.com/s/...
```

### 2. From a Text File
```bash
python scripts/sync-suno.py --file links.txt
```

### 3. Automatically from WhatsApp Messages
```bash
python scripts/sync-suno.py --thread "120363431699058744"
```

The script automatically:
1. Resolves short URLs (`suno.com/s/...` → `suno.com/song/<uuid>`).
2. Queries Suno's Studio API (`https://studio-api-prod.suno.com/api/clip/<uuid>`).
3. Extracts progressive audio URL, high-resolution artwork, duration, tags, and full lyrics.
4. Updates both `data/songs.json` and `public/js/songs.js`.

Commit and push to trigger an instant live update.

---

## ☁️ Connecting to Cloudflare (`bjsunosongs.mastern8n.cc`)

### Method 1: Cloudflare Pages Git Integration (Recommended)
This follows the exact same zero-maintenance pattern as `jwlibrary-merge.mastern8n.cc`:

1. In [Cloudflare Dashboard](https://dash.cloudflare.com/) $\rightarrow$ **Workers & Pages** $\rightarrow$ **Create Application** $\rightarrow$ **Pages** $\rightarrow$ **Connect to Git**.
2. Select repository: `JWCow/bj-suno-songs`.
3. Configure build settings:
   - **Framework preset**: None
   - **Build command**: *(leave blank)*
   - **Build output directory**: `public`
4. Click **Save and Deploy**.
5. Under **Custom domains**, click **Set up a custom domain** and enter:
   ```
   bjsunosongs.mastern8n.cc
   ```
   Cloudflare automatically provisions the DNS CNAME record and issues the SSL/TLS certificate.

---

## 🛠 Local Development Preview

Preview the site locally:

```bash
# Using python
python -m http.server 3456 --directory public

# Or using npx serve
npm run dev
```

Open `http://localhost:3456` in any browser.
