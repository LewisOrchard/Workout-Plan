const STORAGE_KEY = "workout-log-entries";

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

let entries = loadEntries();
let editingId = null;
let filterText = "";

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

function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

function deleteEntry(id) {
  if (!confirm("Delete this entry?")) return;
  entries = entries.filter((e) => e.id !== id);
  saveEntries(entries);
  if (editingId === id) resetForm();
  renderExerciseDatalist();
  renderHistory();
  updateLastEntryHint();
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

logForm.addEventListener("submit", (ev) => {
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

  if (editingId) {
    const idx = entries.findIndex((e) => e.id === editingId);
    if (idx !== -1) {
      entries[idx] = { ...entries[idx], ...data };
    }
  } else {
    entries.push({ id: uid(), createdAt: Date.now(), ...data });
  }

  saveEntries(entries);
  resetForm();
  renderExerciseDatalist();
  renderHistory();
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

    const existingIds = new Set(entries.map((e) => e.id));
    let added = 0;
    imported.forEach((item) => {
      if (item && item.exercise && item.date && !existingIds.has(item.id)) {
        entries.push({
          id: item.id || uid(),
          createdAt: item.createdAt || Date.now(),
          exercise: item.exercise,
          sets: Number(item.sets) || 1,
          reps: Number(item.reps) || 1,
          weight: Number(item.weight) || 0,
          unit: item.unit === "lb" ? "lb" : "kg",
          date: item.date,
          notes: item.notes || "",
        });
        added++;
      }
    });
    saveEntries(entries);
    renderExerciseDatalist();
    renderHistory();
    alert(`Imported ${added} new entr${added === 1 ? "y" : "ies"}.`);
  } catch (err) {
    alert("Could not import file: " + err.message);
  } finally {
    ev.target.value = "";
  }
});

dateInput.value = todayISO();
renderExerciseDatalist();
renderHistory();
