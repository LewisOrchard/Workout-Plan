# Workout Log

A personal workout logger with your push/pull/legs/accessories plan built
in. Log a set on your phone at the gym, see it show up on your laptop at
home — no build step, just a static site backed by a free Firebase project.

## Features

- "Today's Plan" tabs (Push/Pull/Legs/Accessories) pre-loaded with your
  exercises, target sets/reps, and form cues — tap **Log set** to quick-fill
  the form with the target reps and your last-used weight
- The right day tab is pre-selected automatically based on what you last
  logged (e.g. logged Push yesterday → Pull is selected today), not a fixed
  weekday schedule — so it still works with rest days or an irregular
  routine. Switching tabs manually sticks for the rest of that day.
- A Start/Pause/Reset stopwatch at the top of the page, for timing rest or
  the whole session
- Log **one set at a time** (reps, weight in kg/lb, date, optional notes) —
  since real sets vary in weight/reps, there's no aggregate "3 sets of X"
  entry; each set you log is its own row
- Shows your progress today per exercise (e.g. "Set 1: 19.5kg × 17, Set 2:
  21.25kg × 15...") and your last logged set as you type an exercise name
- History grouped by day, then by exercise, with each individual set listed
  and numbered
- Edit or delete any individual set
- Signed-in accounts, synced in real time across every device via Firestore
- Export your log to a JSON file for backup, and import it back later

## Setup (one-time)

The app is static (just HTML/CSS/JS), but it needs a free
[Firebase](https://firebase.google.com/) project to store your data and
sync it between devices.

### 1. Create a Firebase project

1. Go to the [Firebase console](https://console.firebase.google.com/) and
   create a new project (Google Analytics is not needed — you can skip it).
2. In your new project, click the **Web** icon (`</>`) to register a web
   app. Give it any nickname. You don't need Firebase Hosting.
3. Firebase will show you a `firebaseConfig` object. Copy it.
4. Open `firebase-config.js` in this repo and paste your values in, replacing
   the placeholders. These values are safe to commit — they identify your
   project, not secrets; access is controlled by the rules below.

### 2. Enable email/password sign-in

1. In the Firebase console, go to **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Email/Password**.

### 3. Create the Firestore database

1. Go to **Build → Firestore Database → Create database**.
2. Choose any nearby region, and start in **production mode**.
3. Once created, go to the **Rules** tab and replace the rules with:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/entries/{entryId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

   This makes sure only your signed-in account can read or write your own
   entries.

### 4. Commit and host it

1. Commit your `firebase-config.js` changes and push.
2. In this repo's GitHub settings, enable **Pages** for the `main` branch
   (root).
3. Open the published `https://<you>.github.io/<repo>/` URL.

### 5. Create your account

The first time you open the app (on your phone or laptop, doesn't matter
which), click **Create account** and set an email + password. Then sign in
with that *same* email and password on your other device — your log syncs
automatically between them from then on.

If `firebase-config.js` still has placeholder values, the app will show a
"Setup required" screen instead of the sign-in form.

## Data & backups

Your entries are stored in Firestore under your account, so they're
available on any device you sign into. Use the **Export** button
occasionally to download a JSON backup anyway — cheap insurance, and handy
if you ever want to move to a different backend. **Import** merges entries
in, so it's safe to re-run.
