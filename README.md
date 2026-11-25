# Daily Posts — 24 Hour Feed

A small website on GitHub Pages. Upload up to **10 posts a day** (photo + title + caption).
Every post **deletes itself exactly 24 hours after upload** — photo, title and caption, all gone.
Photos are shown in their **original size** — never cropped, never resized.

Each post is a **card like the reference**: photo full-bleed, big ALL CAPS headline over the
bottom of the photo, and the site wordmark at the foot of the photo. Under the card:
the caption, a live countdown, and buttons — Download Photo, Copy Title, Copy Caption, Delete.

## How the 24-hour delete works

Two layers, so nothing old is ever shown:

1. **Instant (in the browser):** `assets/app.js` hides any post older than 24 hours the moment the page loads, and shows a live countdown ("23h 12m left") on every post.
2. **Real delete (every hour):** the GitHub Action in `.github/workflows/cleanup.yml` runs `cleanup.mjs`, which removes expired entries from `posts.json` **and deletes the image files from the repo**, then commits. So the post is truly gone, not just hidden.

## Setup (one time, about 5 minutes)

1. **Create the repo on GitHub**
   - GitHub → New repository → name it e.g. `daily-posts` → Public → Create.
   - Upload ALL the files from this folder into it (including the hidden `.github` folder).

2. **Turn on GitHub Pages**
   - Repo → Settings → Pages → Source: **Deploy from a branch** → Branch: `main`, folder `/ (root)` → Save.
   - Your site will be live at `https://YOUR-USERNAME.github.io/daily-posts/` (takes about a minute).

3. **Make a token (so the upload page can save posts)**
   - GitHub → your profile photo → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic) → tick **`repo`** → Generate.
   - Copy the token (starts with `ghp_`). You only see it once.

4. **Upload posts**
   - Open `https://YOUR-USERNAME.github.io/daily-posts/upload.html`
   - Paste your username, repo name and token once (saved only in your own browser, never in the repo).
   - Pick up to 10 photos, write each post's **title** (the big headline on the photo) and **caption**, press **Upload all**.
   - The counter shows how many of today's 10 are used. After 10, it locks until tomorrow.

## Files

| File | What it does |
|---|---|
| `index.html` | The feed — shows live posts with countdown |
| `upload.html` | Upload page (10/day limit, token setup) |
| `assets/app.js` | Feed rendering, 24h expiry, GitHub upload |
| `assets/style.css` | Dark theme, original-size photos |
| `posts.json` | The list of posts: file, title, caption, uploadedAt |
| `posts/` | Uploaded images live here |
| `.github/workflows/cleanup.yml` | Hourly auto-delete Action |
| `.github/scripts/cleanup.mjs` | The delete script the Action runs |

## Notes

- One post = one image file, uploaded exactly as it is (original size, original quality). GitHub allows files up to 100 MB.
- The daily limit counts by calendar day, max 10 posts.
- If GitHub Pages takes a minute to update after an upload, refresh once — the feed reads `posts.json` fresh every time.
- Nothing on this site sends your token anywhere except to GitHub's own API.
