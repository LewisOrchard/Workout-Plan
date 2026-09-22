function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

// Auto-suggests the day tab from workout history rather than the calendar,
// since rest days/irregular training make a fixed weekday rotation wrong.
// The suggestion is remembered per-date, so switching tabs manually during
// the day sticks until the next calendar day recomputes it.
const PLAN_DAY_KEY = "workout-log-selected-day";
const planDays = Object.keys(WORKOUT_PLAN);

const EXERCISE_DAY_INDEX = (() => {
  const index = new Map();
  planDays.forEach((day) => {
    WORKOUT_PLAN[day].forEach((ex) => {
      const key = ex.name.toLowerCase();
      if (!index.has(key)) index.set(key, new Set());
      index.get(key).add(day);
    });
  });
  return index;
})();

function loadDayChoice() {
  try {
    const raw = localStorage.getItem(PLAN_DAY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDayChoice(day) {
  try {
    localStorage.setItem(PLAN_DAY_KEY, JSON.stringify({ date: todayISO(), day }));
  } catch {
    // ignore (e.g. private browsing with storage disabled)
  }
}

const storedDayChoice = loadDayChoice();
let needsAutoDaySuggestion = !(
  storedDayChoice &&
  storedDayChoice.date === todayISO() &&
  planDays.includes(storedDayChoice.day)
);
let selectedDay = needsAutoDaySuggestion ? planDays[0] : storedDayChoice.day;

function suggestNextDay() {
  if (entries.length === 0) return null;
  const lastDate = entries.reduce((max, e) => (e.date > max ? e.date : max), entries[0].date);
  const lastDayEntries = entries.filter((e) => e.date === lastDate);

  const counts = {};
  planDays.forEach((day) => {
    counts[day] = 0;
  });

  lastDayEntries.forEach((e) => {
    const days = EXERCISE_DAY_INDEX.get(e.exercise.toLowerCase());
    if (days && days.size === 1) {
      const [onlyDay] = days;
      counts[onlyDay]++;
    }
  });

  let bestDay = null;
  let bestCount = 0;
  planDays.forEach((day) => {
    if (counts[day] > bestCount) {
      bestCount = counts[day];
      bestDay = day;
    }
  });

  if (!bestDay) return null;
  const idx = planDays.indexOf(bestDay);
  return planDays[(idx + 1) % planDays.length];
}

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
const repsInput = document.getElementById("repsInput");
const weightInput = document.getElementById("weightInput");
const unitInput = document.getElementById("unitInput");
const dropSetInput = document.getElementById("dropSetInput");
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

const stopwatchEl = document.querySelector(".stopwatch");
const stopwatchDisplay = document.getElementById("stopwatchDisplay");
const stopwatchToggle = document.getElementById("stopwatchToggle");
const stopwatchResetBtn = document.getElementById("stopwatchReset");

const progressSelect = document.getElementById("progressSelect");
const progressContent = document.getElementById("progressContent");
const progressEmpty = document.getElementById("progressEmpty");
const progressBestValue = document.getElementById("progressBestValue");
const progressBestSub = document.getElementById("progressBestSub");
const progressLastValue = document.getElementById("progressLastValue");
const progressLastSub = document.getElementById("progressLastSub");
const progressChartWrap = document.getElementById("progressChartWrap");
const progressChart = document.getElementById("progressChart");
const progressTooltip = document.getElementById("progressTooltip");
const progressViewHistoryBtn = document.getElementById("progressViewHistoryBtn");

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

// --- Stopwatch ---
// Tracks a start timestamp rather than just incrementing a counter, so the
// elapsed time stays correct across page reloads/backgrounding (common on a
// phone mid-workout), and persists per-device in localStorage.

const STOPWATCH_KEY = "workout-log-stopwatch";
let stopwatchIntervalId = null;

function loadStopwatchState() {
  try {
    const raw = localStorage.getItem(STOPWATCH_KEY);
    if (!raw) return { startedAt: null, elapsedMs: 0 };
    const parsed = JSON.parse(raw);
    return {
      startedAt: typeof parsed.startedAt === "number" ? parsed.startedAt : null,
      elapsedMs: typeof parsed.elapsedMs === "number" ? parsed.elapsedMs : 0,
    };
  } catch {
    return { startedAt: null, elapsedMs: 0 };
  }
}

function saveStopwatchState() {
  try {
    localStorage.setItem(STOPWATCH_KEY, JSON.stringify(stopwatchState));
  } catch {
    // ignore (e.g. private browsing with storage disabled)
  }
}

let stopwatchState = loadStopwatchState();

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

function currentStopwatchElapsedMs() {
  if (stopwatchState.startedAt) {
    return stopwatchState.elapsedMs + (Date.now() - stopwatchState.startedAt);
  }
  return stopwatchState.elapsedMs;
}

function renderStopwatch() {
  stopwatchDisplay.textContent = formatElapsed(currentStopwatchElapsedMs());
  const running = !!stopwatchState.startedAt;
  stopwatchEl.classList.toggle("running", running);
  stopwatchToggle.textContent = running ? "Pause" : "Start";
}

function startStopwatchTicking() {
  if (stopwatchIntervalId) return;
  stopwatchIntervalId = setInterval(renderStopwatch, 250);
}

function stopStopwatchTicking() {
  if (stopwatchIntervalId) {
    clearInterval(stopwatchIntervalId);
    stopwatchIntervalId = null;
  }
}

stopwatchToggle.addEventListener("click", () => {
  if (stopwatchState.startedAt) {
    stopwatchState.elapsedMs = currentStopwatchElapsedMs();
    stopwatchState.startedAt = null;
    stopStopwatchTicking();
  } else {
    stopwatchState.startedAt = Date.now();
    startStopwatchTicking();
  }
  saveStopwatchState();
  renderStopwatch();
});

stopwatchResetBtn.addEventListener("click", () => {
  stopwatchState = { startedAt: null, elapsedMs: 0 };
  stopStopwatchTicking();
  saveStopwatchState();
  renderStopwatch();
});

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

// --- Exercise progress chart ---
// Session-indexed (one point per day you logged the exercise, evenly
// spaced) rather than true calendar time, so rest days/gaps between
// sessions don't stretch the trend line out of proportion.

function formatWeightValue(weight, unit) {
  return weight ? `${weight}${unit}` : "bodyweight";
}

function dailyBestSeriesFor(exerciseName) {
  const matches = entries.filter((e) => e.exercise.toLowerCase() === exerciseName.toLowerCase());
  const byDate = new Map();
  matches.forEach((e) => {
    const existing = byDate.get(e.date);
    if (!existing || e.weight > existing.weight) {
      byDate.set(e.date, e);
    }
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function renderProgressSelect() {
  const current = progressSelect.value;
  progressSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select an exercise…";
  progressSelect.appendChild(placeholder);

  uniqueExerciseNames().forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    progressSelect.appendChild(opt);
  });

  if (current && uniqueExerciseNames().includes(current)) {
    progressSelect.value = current;
  }
}

function renderProgress() {
  const name = progressSelect.value;
  if (!name) {
    progressContent.hidden = true;
    progressEmpty.hidden = false;
    progressEmpty.textContent = "Select an exercise to see your progress.";
    return;
  }

  const series = dailyBestSeriesFor(name);
  if (series.length === 0) {
    progressContent.hidden = true;
    progressEmpty.hidden = false;
    progressEmpty.textContent = "No sets logged yet for this exercise.";
    return;
  }

  progressEmpty.hidden = true;
  progressContent.hidden = false;

  const best = series.reduce((max, s) => (s.weight > max.weight ? s : max), series[0]);
  progressBestValue.textContent = formatWeightValue(best.weight, best.unit);
  progressBestSub.textContent = `${best.reps} reps · ${formatDateLabel(best.date)}`;

  const last = series[series.length - 1];
  progressLastValue.textContent = formatWeightValue(last.weight, last.unit);
  progressLastSub.textContent = `${last.reps} reps · ${formatDateLabel(last.date)}`;

  drawProgressChart(series);
}

function drawProgressChart(series) {
  const width = progressChartWrap.clientWidth || 300;
  const height = 180;
  const padLeft = 34;
  const padRight = 14;
  const padTop = 20;
  const padBottom = 24;
  const innerWidth = Math.max(width - padLeft - padRight, 10);
  const innerHeight = height - padTop - padBottom;

  const weights = series.map((s) => s.weight);
  let minW = Math.min(...weights);
  let maxW = Math.max(...weights);
  if (minW === maxW) {
    minW -= 1;
    maxW += 1;
  } else {
    const pad = (maxW - minW) * 0.15;
    minW -= pad;
    maxW += pad;
  }
  minW = Math.max(minW, 0);

  const xFor = (i) => (series.length === 1 ? padLeft + innerWidth / 2 : padLeft + (i / (series.length - 1)) * innerWidth);
  const yFor = (w) => padTop + innerHeight - ((w - minW) / (maxW - minW)) * innerHeight;

  const points = series.map((s, i) => ({ x: xFor(i), y: yFor(s.weight), data: s }));

  const svgNs = "http://www.w3.org/2000/svg";
  progressChart.setAttribute("viewBox", `0 0 ${width} ${height}`);
  progressChart.innerHTML = "";

  function makeEl(tag, attrs) {
    const el = document.createElementNS(svgNs, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  // Gridlines + y-axis labels (min/max only — recessive, not every tick)
  [minW, maxW].forEach((w) => {
    const y = yFor(w);
    progressChart.appendChild(
      makeEl("line", { class: "progress-chart-grid", x1: padLeft, x2: width - padRight, y1: y, y2: y })
    );
    const label = makeEl("text", { class: "progress-chart-axis-label", x: 4, y: y + 3 });
    label.textContent = Math.round(w * 10) / 10;
    progressChart.appendChild(label);
  });

  // X-axis: first/last date only (selective labels, not every point)
  const firstLabel = makeEl("text", {
    class: "progress-chart-axis-label",
    x: padLeft,
    y: height - 6,
    "text-anchor": "start",
  });
  firstLabel.textContent = formatDateLabel(series[0].date);
  progressChart.appendChild(firstLabel);

  if (series.length > 1) {
    const lastLabel = makeEl("text", {
      class: "progress-chart-axis-label",
      x: width - padRight,
      y: height - 6,
      "text-anchor": "end",
    });
    lastLabel.textContent = formatDateLabel(series[series.length - 1].date);
    progressChart.appendChild(lastLabel);
  }

  if (points.length > 1) {
    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    const areaPath = `${linePath} L${points[points.length - 1].x},${padTop + innerHeight} L${points[0].x},${padTop + innerHeight} Z`;
    progressChart.appendChild(makeEl("path", { class: "progress-chart-area", d: areaPath }));
    progressChart.appendChild(makeEl("path", { class: "progress-chart-line", d: linePath }));
  }

  const dots = points.map((p) =>
    makeEl("circle", { class: "progress-chart-dot", cx: p.x, cy: p.y, r: 4, "data-index": points.indexOf(p) })
  );
  dots.forEach((dot) => progressChart.appendChild(dot));

  const endPoint = points[points.length - 1];
  const endLabel = makeEl("text", {
    class: "progress-chart-endlabel",
    x: Math.min(endPoint.x + 8, width - 4),
    y: Math.max(endPoint.y - 10, 12),
    "text-anchor": endPoint.x + 8 > width - 40 ? "end" : "start",
  });
  endLabel.textContent = formatWeightValue(endPoint.data.weight, endPoint.data.unit);
  progressChart.appendChild(endLabel);

  const crosshair = makeEl("line", {
    class: "progress-chart-crosshair",
    x1: 0,
    x2: 0,
    y1: padTop,
    y2: padTop + innerHeight,
  });
  crosshair.style.display = "none";
  progressChart.appendChild(crosshair);

  const hitArea = makeEl("rect", {
    x: padLeft,
    y: 0,
    width: innerWidth,
    height,
    fill: "transparent",
  });
  progressChart.appendChild(hitArea);

  function showTooltipAt(index) {
    const p = points[index];
    dots.forEach((dot, i) => dot.classList.toggle("hovered", i === index));
    crosshair.setAttribute("x1", p.x);
    crosshair.setAttribute("x2", p.x);
    crosshair.style.display = "";

    progressTooltip.innerHTML = "";
    const strong = document.createElement("strong");
    strong.textContent = formatWeightValue(p.data.weight, p.data.unit);
    const sub = document.createElement("div");
    sub.className = "progress-tooltip-sub";
    sub.textContent = `${p.data.reps} reps · ${formatDateLabel(p.data.date)}`;
    progressTooltip.appendChild(strong);
    progressTooltip.appendChild(sub);

    const wrapRect = progressChartWrap.getBoundingClientRect();
    progressTooltip.style.left = `${(p.x / width) * wrapRect.width}px`;
    progressTooltip.style.top = `${(p.y / height) * wrapRect.height - 8}px`;
    progressTooltip.hidden = false;
  }

  function hideTooltip() {
    dots.forEach((dot) => dot.classList.remove("hovered"));
    crosshair.style.display = "none";
    progressTooltip.hidden = true;
  }

  function nearestIndexFor(clientX) {
    const rect = progressChart.getBoundingClientRect();
    const localX = ((clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - localX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    return nearest;
  }

  hitArea.addEventListener("pointermove", (ev) => showTooltipAt(nearestIndexFor(ev.clientX)));
  hitArea.addEventListener("pointerdown", (ev) => showTooltipAt(nearestIndexFor(ev.clientX)));
  hitArea.addEventListener("pointerleave", hideTooltip);
  dots.forEach((dot, i) => {
    dot.addEventListener("pointerenter", () => showTooltipAt(i));
  });
}

let progressResizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(progressResizeTimer);
  progressResizeTimer = setTimeout(() => {
    if (progressSelect.value) renderProgress();
  }, 200);
});

progressSelect.addEventListener("change", renderProgress);

progressViewHistoryBtn.addEventListener("click", () => {
  filterInput.value = progressSelect.value;
  filterText = progressSelect.value;
  renderHistory();
  document.getElementById("historySection").scrollIntoView({ behavior: "smooth" });
});

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
  lastEntryHint.textContent = `Last set: ${last.reps} reps @ ${weightStr} (${formatDateLabel(last.date)})`;
}

function groupByDate(list) {
  const groups = new Map();
  list.forEach((e) => {
    if (!groups.has(e.date)) groups.set(e.date, []);
    groups.get(e.date).push(e);
  });
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function groupByExercise(dayEntries) {
  const groups = new Map();
  dayEntries.forEach((e) => {
    if (!groups.has(e.exercise)) groups.set(e.exercise, []);
    groups.get(e.exercise).push(e);
  });
  return [...groups.entries()]
    .map(([name, list]) => [name, list.slice().sort((a, b) => a.createdAt - b.createdAt)])
    .sort((a, b) => {
      const aLast = a[1][a[1].length - 1].createdAt;
      const bLast = b[1][b[1].length - 1].createdAt;
      return bLast - aLast;
    });
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

    groupByExercise(dayEntries).forEach(([exerciseName, setEntries]) => {
      group.appendChild(renderExerciseGroup(exerciseName, setEntries));
    });

    historyList.appendChild(group);
  });
}

function renderExerciseGroup(exerciseName, setEntries) {
  const wrap = document.createElement("div");
  wrap.className = "exercise-group";

  const header = document.createElement("div");
  header.className = "exercise-group-header";
  header.textContent = `${exerciseName} — ${setEntries.length} set${setEntries.length === 1 ? "" : "s"}`;
  wrap.appendChild(header);

  setEntries.forEach((entry, i) => {
    wrap.appendChild(renderSetRow(entry, i + 1));
  });

  return wrap;
}

function renderSetRow(entry, setNumber) {
  const el = document.createElement("div");
  el.className = "entry";

  const main = document.createElement("div");
  main.className = "entry-main";

  const detail = document.createElement("div");
  detail.className = "entry-detail";
  const weightStr = entry.weight ? `${entry.weight}${entry.unit}` : "bodyweight";
  const setLabel = document.createElement("span");
  setLabel.className = "set-label";
  setLabel.textContent = `Set ${setNumber}`;
  detail.appendChild(setLabel);
  detail.appendChild(document.createTextNode(`${entry.reps} reps @ ${weightStr}`));
  if (entry.dropSet) {
    const badge = document.createElement("span");
    badge.className = "drop-set-badge";
    badge.textContent = "Drop set";
    detail.appendChild(badge);
  }
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

function todaysSetsFor(exerciseName) {
  const today = todayISO();
  return entries
    .filter((e) => e.date === today && e.exercise.toLowerCase() === exerciseName.toLowerCase())
    .sort((a, b) => a.createdAt - b.createdAt);
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
      saveDayChoice(day);
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
    const todaysSets = todaysSetsFor(planEx.name);
    const done = todaysSets.length > 0;

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
      doneInfo.textContent = todaysSets
        .map((s, i) => {
          const weightStr = s.weight ? `${s.weight}${s.unit}` : "bodyweight";
          return `Set ${i + 1}: ${weightStr} × ${s.reps}${s.dropSet ? " · drop set" : ""}`;
        })
        .join("   ");
      main.appendChild(doneInfo);
    }

    item.appendChild(main);

    const logBtn = document.createElement("button");
    logBtn.type = "button";
    logBtn.className = "plan-log-btn";
    logBtn.textContent = `Log set ${todaysSets.length + 1}`;
    logBtn.addEventListener("click", () => quickFillFromPlan(planEx, todaysSets));
    item.appendChild(logBtn);

    planList.appendChild(item);
  });
}

function quickFillFromPlan(planEx, todaysSets) {
  editingId = null;
  submitBtn.textContent = "Log set";
  exerciseInput.value = planEx.name;
  repsInput.value = parseRepsLow(planEx.reps);
  dateInput.value = todayISO();
  notesInput.value = "";
  dropSetInput.checked = false;

  const lastToday = todaysSets && todaysSets.length ? todaysSets[todaysSets.length - 1] : null;
  const lastEver = entries
    .filter((e) => e.exercise.toLowerCase() === planEx.name.toLowerCase())
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)[0];
  const last = lastToday || lastEver;
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
  repsInput.value = entry.reps;
  weightInput.value = entry.weight || "";
  unitInput.value = entry.unit;
  dateInput.value = entry.date;
  notesInput.value = entry.notes || "";
  dropSetInput.checked = !!entry.dropSet;
  submitBtn.textContent = "Save changes";
  exerciseInput.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  logForm.reset();
  dateInput.value = todayISO();
  repsInput.value = 10;
  submitBtn.textContent = "Log set";
  lastEntryHint.textContent = "";
}

// After logging a set, the next one is almost always the same exercise --
// keep exercise/reps/weight/unit/date as-is and just clear the per-set
// fields, so the form is immediately ready for "log the next set" without
// scrolling back up to the plan card.
function prepareNextSet() {
  editingId = null;
  submitBtn.textContent = "Log set";
  notesInput.value = "";
  dropSetInput.checked = false;
  updateLastEntryHint();
  weightInput.focus();
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
      if (needsAutoDaySuggestion) {
        needsAutoDaySuggestion = false;
        const suggested = suggestNextDay();
        if (suggested) {
          selectedDay = suggested;
          saveDayChoice(selectedDay);
          renderDayTabs();
        }
      }
      renderExerciseDatalist();
      renderHistory();
      renderPlanList();
      renderProgressSelect();
      renderProgress();
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
    reps: Number(repsInput.value),
    weight: weightInput.value ? Number(weightInput.value) : 0,
    unit: unitInput.value,
    date: dateInput.value || todayISO(),
    notes: notesInput.value.trim(),
    dropSet: dropSetInput.checked,
  };

  submitBtn.disabled = true;
  try {
    if (editingId) {
      await updateEntry(editingId, data);
      resetForm();
    } else {
      await addEntry(data);
      prepareNextSet();
    }
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
          reps: Number(item.reps) || 1,
          weight: Number(item.weight) || 0,
          unit: item.unit === "lb" ? "lb" : "kg",
          date: item.date,
          notes: item.notes || "",
          dropSet: !!item.dropSet,
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

renderStopwatch();
if (stopwatchState.startedAt) startStopwatchTicking();

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
