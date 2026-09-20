# Workout Log

A tiny, personal workout logger. No backend, no build step, no account —
just open `index.html` and start logging sets.

## Features

- Log an exercise with sets, reps, weight (kg/lb), date, and optional notes
- Shows your last logged sets/reps/weight for an exercise as you type it
- History grouped by day, newest first
- Filter history by exercise name
- Edit or delete any past entry
- Export your log to a JSON file for backup, and import it back later
- All data is stored locally in your browser (`localStorage`) — nothing is
  sent anywhere

## Usage

Just open `index.html` in a browser. That's it.

To use it from your phone at the gym, host it somewhere static, e.g. GitHub
Pages:

1. Push this repo to GitHub (already done if you're reading this from there).
2. In the repo settings, enable **GitHub Pages** for the `main` branch (root).
3. Open the published URL on your phone and add it to your home screen.

## Data & backups

Your entries live only in the browser you're using (`localStorage`), scoped
to the page's origin. That means:

- Data does **not** sync between devices or browsers automatically.
- Clearing browser data/history can wipe your log.

Use the **Export** button occasionally to download a JSON backup, and
**Import** it on another device/browser to bring your history along (import
merges by entry id, so re-importing the same file won't create duplicates).
