# RunescapeOS

An Old School RuneScape-style life tracker: 23 skills on the real OSRS XP curve, repeatable Wilderness tasks, quests with quest points, boss fights with HP bars, and a daily login streak.

It's a plain web app (HTML, CSS and JavaScript). There's no build step and nothing to install, and once it's online you can install it on Android from Chrome.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page skeleton: header, bottom tabs, skill pop-up |
| `css/styles.css` | All the styling. Colors are variables at the top (`--orange`, `--level`, ...) |
| `js/app.js` | Everything the app does. Game rules are near the top |
| `manifest.webmanifest` | App name, colors and icons Chrome uses when you install it |
| `sw.js` | Service worker that makes it work offline |
| `icons/` | Home-screen icons |

### Common edits in `js/app.js`

- **XP per task difficulty**: `TASK_DIFF` (Easy 15, Medium 35, Hard 60, Elite 100)
- **Quest XP and quest points**: `QUEST_DIFF`
- **Boss XP**: `BOSS_DIFF`
- **Starter tasks**: `SEED_TASKS`. These only apply on first launch or after clearing data.
- **Starter quests and bosses**: `defaultState()`
- **Rank titles**: `rankFor()`

## Run it on your computer

1. Open this folder in VS Code (**File > Open Folder...**).
2. Install the **Live Server** extension. VS Code will suggest it when you open the folder.
3. Right-click `index.html` and choose **Open with Live Server**. The page reloads every time you save a file.

> Opening `index.html` by double-clicking works too, but offline mode and installing are turned off for `file://` pages.

## Put it on your Android phone

Installing and offline mode need an `https://` address. GitHub Pages hosts it for free:

1. Create a new **public** repository on GitHub, for example `runescapeos`.
2. Upload everything in this folder. **Add file > Upload files** works. Include the `css`, `js` and `icons` folders.
3. Go to **Settings > Pages**. Under *Build and deployment*, pick **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
4. After a minute, the site is at `https://<your-username>.github.io/runescapeos/`.
5. Open that address in Chrome on your phone, tap **⋮**, then **Install app** (or **Add to Home screen**).

### Updating the app after edits

1. Change the files and upload them to the repository again.
2. In `sw.js`, bump `VERSION` (for example `runescapeos-v2`) so installed copies refresh.
3. Close and reopen the app on your phone. It may take two opens to show the new version.

## Your data

- Progress is saved **in the browser on each device** (localStorage). Your phone and your computer keep separate saves, and nothing is sent anywhere.
- Uninstalling the app or clearing Chrome's site data erases the save. Tap **Save backup file** on the Profile tab now and then.
- To move a save between devices, or from the claude.ai version: use **Copy backup** or **Save backup file** on one device. Then on the other device, use **Load backup file** or paste into the restore box, and tap **Restore** twice.
- To start fresh while testing, run `localStorage.clear()` in the browser console (F12), then reload.
