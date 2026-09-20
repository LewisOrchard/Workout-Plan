const PLAN_DAY_KEY = "workout-log-selected-day";
const planDays = Object.keys(WORKOUT_PLAN);
let selectedDay = localStorage.getItem(PLAN_DAY_KEY) || planDays[0];
if (!planDays.includes(selectedDay)) selectedDay = planDays[0];

let entries = [];
let editingId = null;
let filterText = "";
let currentUser = null;
let unsubscribeEntries = null;

const setupNotice = document.getElementById("setupNotice");
const authOverlay = document.getElementById("authOverlay");
const appRoot = document.getElementById("appRoot");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authError = document.getElementById("authError");
const signUpBtn = document.getElementById("signUpBtn");
const forgotBtn = document.getElementById("forgotBtn");
const signOutBtn = document.getElementById("signOutBtn");

const logForm = document.getElementById("logForm");
const exerciseInput = document.getElementById("exerciseInput");
const setsInput = document.getElementById("setsInput");
const repsInput = document.getElementById("repsInput");
const weightInput = document.getElementById("weightInput");
const unitInput = document.getElementById("unitInput");
const dateInput = document.getElementById("dateInput");
const notesInput = document.getElementById("notesInput");
const exerciseList = document.getElementById("exerciseList");
const lastEntryHint = document.getElementById("lastEntryHint");
const historyList = document.getElementById("historyList");
const emptyState = document.getElementById("emptyState");
const filterInput = document.getElementById("filterInput");
const submitBtn = logForm.querySelector(".primary-btn");
const dayTabs = document.getElementById("dayTabs");
const planList = document.getElementById("planList");

function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function formatDateLabel(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today - date) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function uniqueExerciseNames() {
  const names = new Set();
  entries.forEach((e) => names.add(e.exercise));
  return [...names].sort((a, b) => a.localeCompare(b));
}

function renderExerciseDatalist() {
  exerciseList.innerHTML = "";
  uniqueExerciseNames().forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    exerciseList.appendChild(opt);
  });
}

function updateLastEntryHint() {
  const name = exerciseInput.value.trim().toLowerCase();
  if (!name) {
    lastEntryHint.textContent = "";
    return;
  }
  const matches = entries
    .filter((e) => e.exercise.toLowerCase() === name)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  if (matches.length === 0) {
    lastEntryHint.textContent = "";
    return;
  }
  const last = matches[0];
  const weightStr = last.weight ? `${last.weight}${last.unit}` : "bodyweight";
  lastEntryHint.textContent = `Last time: ${last.sets}x${last.reps} @ ${weightStr} (${formatDateLabel(last.date)})`;
}

function groupByDate(list) {
  const groups = new Map();
  list.forEach((e) => {
    if (!groups.has(e.date)) groups.set(e.date, []);
    groups.get(e.date).push(e);
  });
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function renderHistory() {
  const filtered = filterText
    ? entries.filter((e) => e.exercise.toLowerCase().includes(filterText.toLowerCase()))
    : entries;

  historyList.innerHTML = "";
  emptyState.hidden = entries.length !== 0;

  if (filtered.length === 0) {
    historyList.hidden = true;
    if (entries.length > 0) {
      emptyState.hidden = false;
      emptyState.textContent = "No entries match your filter.";
    }
    return;
  }

  historyList.hidden = false;
  const groups = groupByDate(filtered);

  groups.forEach(([date, dayEntries]) => {
    const group = document.createElement("div");
    group.className = "day-group";

    const label = document.createElement("div");
    label.className = "day-label";
    label.textContent = formatDateLabel(date);
    group.appendChild(label);

    dayEntries
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .forEach((entry) => {
        group.appendChild(renderEntry(entry));
      });

    historyList.appendChild(group);
  });
}

function renderEntry(entry) {
  const el = document.createElement("div");
  el.className = "entry";

  const main = document.createElement("div");
  main.className = "entry-main";

  const title = document.createElement("div");
  title.className = "entry-exercise";
  title.textContent = entry.exercise;
  main.appendChild(title);

  const detail = document.createElement("div");
  detail.className = "entry-detail";
  const weightStr = entry.weight ? `${entry.weight}${entry.unit}` : "bodyweight";
  detail.textContent = `${entry.sets} sets x ${entry.reps} reps @ ${weightStr}`;
  main.appendChild(detail);

  if (entry.notes) {
    const notes = document.createElement("div");
    notes.className = "entry-notes";
    notes.textContent = entry.notes;
    main.appendChild(notes);
  }

  el.appendChild(main);

  const actions = document.createElement("div");
  actions.className = "entry-actions";

  const editBtn = document.createElement("button");
  editBtn.textContent = "Edit";
  editBtn.type = "button";
  editBtn.addEventListener("click", () => startEdit(entry.id));
  actions.appendChild(editBtn);

  const delBtn = document.createElement("button");
  delBtn.textContent = "Delete";
  delBtn.type = "button";
  delBtn.className = "delete-btn";
  delBtn.addEventListener("click", () => deleteEntry(entry.id));
  actions.appendChild(delBtn);

  el.appendChild(actions);
  return el;
}

function parseRepsLow(repsStr) {
  const match = String(repsStr).match(/\d+/);
  return match ? Number(match[0]) : 10;
}

function todaysEntryFor(exerciseName) {
  const today = todayISO();
  const matches = entries
    .filter((e) => e.date === today && e.exercise.toLowerCase() === exerciseName.toLowerCase())
    .sort((a, b) => b.createdAt - a.createdAt);
  return matches[0] || null;
}

function renderDayTabs() {
  dayTabs.innerHTML = "";
  planDays.forEach((day) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day-tab" + (day === selectedDay ? " active" : "");
    btn.textContent = day;
    btn.addEventListener("click", () => {
      selectedDay = day;
      localStorage.setItem(PLAN_DAY_KEY, day);
      renderDayTabs();
      renderPlanList();
    });
    dayTabs.appendChild(btn);
  });
}

function renderPlanList() {
  planList.innerHTML = "";
  const exercises = WORKOUT_PLAN[selectedDay] || [];

  exercises.forEach((planEx) => {
    const done = todaysEntryFor(planEx.name);

    const item = document.createElement("div");
    item.className = "plan-item" + (done ? " done" : "");

    const main = document.createElement("div");
    main.className = "plan-item-main";

    const name = document.createElement("div");
    name.className = "plan-item-name";
    name.textContent = planEx.name;
    main.appendChild(name);

    const target = document.createElement("div");
    target.className = "plan-item-target";
    target.textContent = `Target: ${planEx.sets} sets x ${planEx.reps} reps`;
    main.appendChild(target);

    if (planEx.cue) {
      const cue = document.createElement("div");
      cue.className = "plan-item-cue";
      cue.textContent = planEx.cue;
      main.appendChild(cue);
    }

    if (done) {
      const doneInfo = document.createElement("div");
      doneInfo.className = "plan-item-done-info";
      const weightStr = done.weight ? `${done.weight}${done.unit}` : "bodyweight";
      doneInfo.textContent = `Logged today: ${done.sets}x${done.reps} @ ${weightStr}`;
      main.appendChild(doneInfo);
    }

    item.appendChild(main);

    const logBtn = document.createElement("button");
    logBtn.type = "button";
    logBtn.className = "plan-log-btn";
    logBtn.textContent = done ? "Log again" : "Log";
    logBtn.addEventListener("click", () => quickFillFromPlan(planEx));
    item.appendChild(logBtn);

    planList.appendChild(item);
  });
}

function quickFillFromPlan(planEx) {
  editingId = null;
  submitBtn.textContent = "Add entry";
  exerciseInput.value = planEx.name;
  setsInput.value = planEx.sets;
  repsInput.value = parseRepsLow(planEx.reps);
  dateInput.value = todayISO();
  notesInput.value = "";

  const last = entries
    .filter((e) => e.exercise.toLowerCase() === planEx.name.toLowerCase())
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)[0];
  weightInput.value = last ? last.weight || "" : "";
  if (last) unitInput.value = last.unit;

  updateLastEntryHint();
  document.getElementById("logSection").scrollIntoView({ behavior: "smooth" });
  weightInput.focus();
}

function startEdit(id) {
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  editingId = id;
  exerciseInput.value = entry.exercise;
  setsInput.value = entry.sets;
  repsInput.value = entry.reps;
  weightInput.value = entry.weight || "";
  unitInput.value = entry.unit;
  dateInput.value = entry.date;
  notesInput.value = entry.notes || "";
  submitBtn.textContent = "Save changes";
  exerciseInput.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  logForm.reset();
  dateInput.value = todayISO();
  setsInput.value = 3;
  repsInput.value = 10;
  submitBtn.textContent = "Add entry";
  lastEntryHint.textContent = "";
}

// --- Firestore-backed entry storage ---
// Entries live at users/{uid}/entries/{entryId}. A real-time listener keeps
// the in-memory `entries` array (and the whole UI) in sync across devices.

function entriesCollection() {
  return firebase.firestore().collection("users").doc(currentUser.uid).collection("entries");
}

function subscribeToEntries() {
  unsubscribeEntries = entriesCollection().onSnapshot(
    (snapshot) => {
      entries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderExerciseDatalist();
      renderHistory();
      renderPlanList();
    },
    (err) => {
      console.error("Failed to sync entries:", err);
    }
  );
}

async function addEntry(data) {
  await entriesCollection().add({ ...data, createdAt: Date.now() });
}

async function updateEntry(id, data) {
  await entriesCollection().doc(id).update(data);
}

async function deleteEntry(id) {
  if (!confirm("Delete this entry?")) return;
  if (editingId === id) resetForm();
  try {
    await entriesCollection().doc(id).delete();
  } catch (err) {
    alert("Could not delete entry: " + err.message);
  }
}

logForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const exercise = exerciseInput.value.trim();
  if (!exercise) return;

  const data = {
    exercise,
    sets: Number(setsInput.value),
    reps: Number(repsInput.value),
    weight: weightInput.value ? Number(weightInput.value) : 0,
    unit: unitInput.value,
    date: dateInput.value || todayISO(),
    notes: notesInput.value.trim(),
  };

  submitBtn.disabled = true;
  try {
    if (editingId) {
      await updateEntry(editingId, data);
    } else {
      await addEntry(data);
    }
    resetForm();
  } catch (err) {
    alert("Could not save entry: " + err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

exerciseInput.addEventListener("input", updateLastEntryHint);

filterInput.addEventListener("input", () => {
  filterText = filterInput.value.trim();
  renderHistory();
});

document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `workout-log-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importInput").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error("Invalid format");

    const batch = firebase.firestore().batch();
    const collection = entriesCollection();
    let added = 0;
    imported.forEach((item) => {
      if (item && item.exercise && item.date) {
        const ref = collection.doc();
        batch.set(ref, {
          exercise: item.exercise,
          sets: Number(item.sets) || 1,
          reps: Number(item.reps) || 1,
          weight: Number(item.weight) || 0,
          unit: item.unit === "lb" ? "lb" : "kg",
          date: item.date,
          notes: item.notes || "",
          createdAt: item.createdAt || Date.now(),
        });
        added++;
      }
    });
    await batch.commit();
    alert(`Imported ${added} entr${added === 1 ? "y" : "ies"}.`);
  } catch (err) {
    alert("Could not import file: " + err.message);
  } finally {
    ev.target.value = "";
  }
});

// --- Auth ---

function showAuthError(message) {
  authError.textContent = message;
  authError.hidden = !message;
}

authForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  showAuthError("");
  try {
    await firebase.auth().signInWithEmailAndPassword(authEmail.value.trim(), authPassword.value);
  } catch (err) {
    showAuthError(err.message);
  }
});

signUpBtn.addEventListener("click", async () => {
  showAuthError("");
  try {
    await firebase.auth().createUserWithEmailAndPassword(authEmail.value.trim(), authPassword.value);
  } catch (err) {
    showAuthError(err.message);
  }
});

forgotBtn.addEventListener("click", async () => {
  showAuthError("");
  const email = authEmail.value.trim();
  if (!email) {
    showAuthError("Enter your email above first.");
    return;
  }
  try {
    await firebase.auth().sendPasswordResetEmail(email);
    showAuthError("Password reset email sent.");
  } catch (err) {
    showAuthError(err.message);
  }
});

signOutBtn.addEventListener("click", () => {
  firebase.auth().signOut();
});

dateInput.value = todayISO();
renderDayTabs();
renderPlanList();

const isConfigured =
  typeof firebaseConfig !== "undefined" &&
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== "YOUR_API_KEY";

if (isConfigured) {
  setupNotice.hidden = true;
  firebase.auth().onAuthStateChanged((user) => {
    currentUser = user;

    if (unsubscribeEntries) {
      unsubscribeEntries();
      unsubscribeEntries = null;
    }

    if (user) {
      authOverlay.hidden = true;
      appRoot.hidden = false;
      authForm.reset();
      entries = [];
      subscribeToEntries();
    } else {
      appRoot.hidden = true;
      authOverlay.hidden = false;
    }
  });
} else {
  setupNotice.hidden = false;
  authOverlay.hidden = true;
  appRoot.hidden = true;
}
