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
const gymInput = document.getElementById("gymInput");
const gymList = document.getElementById("gymList");
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
const historyMoreBtn = document.getElementById("historyMoreBtn");
const editActions = document.getElementById("editActions");
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
const progressTable = document.getElementById("progressTable");
const progressGymSelect = document.getElementById("progressGymSelect");
const progressDataWrap = document.getElementById("progressDataWrap");
const progressGymEmpty = document.getElementById("progressGymEmpty");
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

function uniqueGymNames() {
  const names = new Set();
  entries.forEach((e) => {
    if (e.gym) names.add(e.gym);
  });
  return [...names].sort((a, b) => a.localeCompare(b));
}

function renderGymDatalist() {
  gymList.innerHTML = "";
  uniqueGymNames().forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    gymList.appendChild(opt);
  });
}

const LAST_GYM_KEY = "workout-log-last-gym";

function loadLastGym() {
  try {
    return localStorage.getItem(LAST_GYM_KEY) || "";
  } catch {
    return "";
  }
}

function saveLastGym(gym) {
  try {
    if (gym) localStorage.setItem(LAST_GYM_KEY, gym);
  } catch {
    // ignore (e.g. private browsing with storage disabled)
  }
}

// --- Exercise progress chart ---
// Session-indexed (one point per day you logged the exercise, evenly
// spaced) rather than true calendar time, so rest days/gaps between
// sessions don't stretch the trend line out of proportion.

function formatWeightValue(weight, unit) {
  return weight ? `${weight}${unit}` : "bodyweight";
}

function dailyBestSeriesFor(exerciseName, gymFilter) {
  const matches = entries.filter(
    (e) => e.exercise.toLowerCase() === exerciseName.toLowerCase() && (!gymFilter || e.gym === gymFilter)
  );
  const byDate = new Map();
  matches.forEach((e) => {
    const existing = byDate.get(e.date);
    if (!existing || e.weight > existing.weight) {
      byDate.set(e.date, e);
    }
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// One row per session (date), one column per set -- same shape as a typical
// workout spreadsheet, so weight across sessions is easy to compare at a glance.
function sessionsGroupedByDateFor(exerciseName, gymFilter) {
  const matches = entries.filter(
    (e) => e.exercise.toLowerCase() === exerciseName.toLowerCase() && (!gymFilter || e.gym === gymFilter)
  );
  const byDate = new Map();
  matches.forEach((e) => {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  });
  return [...byDate.entries()]
    .map(([date, sets]) => ({ date, sets: sets.slice().sort((a, b) => a.createdAt - b.createdAt) }))
    .sort((a, b) => b.date.localeCompare(a.date));
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

// Keeps Exercise Progress in sync with whatever exercise is in the log
// form, so switching exercises there shows that exercise's history
// immediately without a separate pick from the Progress dropdown.
function syncProgressToExercise(name) {
  if (!name) return;
  const exact = uniqueExerciseNames().find((n) => n.toLowerCase() === name.trim().toLowerCase());
  if (exact && progressSelect.value !== exact) {
    progressSelect.value = exact;
    renderProgress();
  }
}

// Machine/cable exercises aren't comparable between gyms (different
// equipment, pulley ratios, etc.); free weights are. Looked up from the
// plan's `machine` flag -- custom exercises outside the plan default to
// comparable-everywhere ("All gyms"), same as free weights.
function isMachineExercise(name) {
  const lower = name.toLowerCase();
  for (const day of planDays) {
    const match = WORKOUT_PLAN[day].find((ex) => ex.name.toLowerCase() === lower);
    if (match) return !!match.machine;
  }
  return false;
}

function gymsUsedForExercise(name) {
  const gyms = new Set();
  entries.forEach((e) => {
    if (e.exercise.toLowerCase() === name.toLowerCase() && e.gym) gyms.add(e.gym);
  });
  return [...gyms].sort((a, b) => a.localeCompare(b));
}

function mostRecentGymForExercise(name) {
  const matches = entries
    .filter((e) => e.exercise.toLowerCase() === name.toLowerCase() && e.gym)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  return matches.length ? matches[0].gym : "";
}

let lastGymFilterExercise = null;

// Rebuilds the gym filter's options for the selected exercise. Only resets
// the selected value when the exercise itself changed (not on every data
// refresh), and only then applies the smart default: machine exercises
// default to the current/most-recent gym, everything else to "All gyms".
function renderProgressGymFilter(name) {
  const exerciseChanged = name !== lastGymFilterExercise;
  const previousValue = progressGymSelect.value;
  const gyms = gymsUsedForExercise(name);

  progressGymSelect.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "All gyms";
  progressGymSelect.appendChild(allOpt);
  gyms.forEach((gym) => {
    const opt = document.createElement("option");
    opt.value = gym;
    opt.textContent = gym;
    progressGymSelect.appendChild(opt);
  });

  if (exerciseChanged) {
    let defaultGym = "";
    if (isMachineExercise(name)) {
      const currentGym = gymInput.value.trim();
      defaultGym = currentGym && gyms.includes(currentGym) ? currentGym : mostRecentGymForExercise(name);
    }
    progressGymSelect.value = gyms.includes(defaultGym) ? defaultGym : "";
    lastGymFilterExercise = name;
  } else {
    progressGymSelect.value = gyms.includes(previousValue) ? previousValue : "";
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

  const allSeries = dailyBestSeriesFor(name, "");
  if (allSeries.length === 0) {
    progressContent.hidden = true;
    progressEmpty.hidden = false;
    progressEmpty.textContent = "No sets logged yet for this exercise.";
    return;
  }

  progressEmpty.hidden = true;
  progressContent.hidden = false;

  renderProgressGymFilter(name);
  const gymFilter = progressGymSelect.value;
  const series = dailyBestSeriesFor(name, gymFilter);

  if (series.length === 0) {
    progressDataWrap.hidden = true;
    progressGymEmpty.hidden = false;
    progressGymEmpty.textContent = `No sets logged for this exercise at ${gymFilter}.`;
    return;
  }

  progressDataWrap.hidden = false;
  progressGymEmpty.hidden = true;

  const best = series.reduce((max, s) => (s.weight > max.weight ? s : max), series[0]);
  progressBestValue.textContent = formatWeightValue(best.weight, best.unit);
  progressBestSub.textContent = `${best.reps} reps · ${formatDateLabel(best.date)}`;

  const last = series[series.length - 1];
  progressLastValue.textContent = formatWeightValue(last.weight, last.unit);
  progressLastSub.textContent = `${last.reps} reps · ${formatDateLabel(last.date)}`;

  drawProgressChart(series);
  renderProgressTable(sessionsGroupedByDateFor(name, gymFilter), best.id, !gymFilter);
}

function renderProgressTable(sessions, bestEntryId, showGym) {
  const maxSets = sessions.reduce((max, s) => Math.max(max, s.sets.length), 0);

  progressTable.innerHTML = "";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const dateHeader = document.createElement("th");
  dateHeader.textContent = "Date";
  headRow.appendChild(dateHeader);
  if (showGym) {
    const gymHeader = document.createElement("th");
    gymHeader.textContent = "Gym";
    headRow.appendChild(gymHeader);
  }
  for (let i = 0; i < maxSets; i++) {
    const th = document.createElement("th");
    th.textContent = `Set ${i + 1}`;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  progressTable.appendChild(thead);

  const tbody = document.createElement("tbody");
  sessions.forEach((session) => {
    const row = document.createElement("tr");

    const dateCell = document.createElement("td");
    dateCell.className = "progress-table-date";
    dateCell.textContent = formatDateLabel(session.date);
    row.appendChild(dateCell);

    if (showGym) {
      const gymCell = document.createElement("td");
      const gym = session.sets.find((s) => s.gym)?.gym;
      gymCell.className = gym ? "" : "cell-empty";
      gymCell.textContent = gym || "–";
      row.appendChild(gymCell);
    }

    for (let i = 0; i < maxSets; i++) {
      const cell = document.createElement("td");
      const set = session.sets[i];
      if (!set) {
        cell.className = "cell-empty";
        cell.textContent = "–";
      } else {
        const weightStr = set.weight ? `${set.weight}${set.unit}` : "bw";
        cell.textContent = `${weightStr}×${set.reps}${set.dropSet ? " DS" : ""}`;
        if (set.id === bestEntryId) {
          cell.classList.add("cell-best");
        } else if (set.dropSet) {
          cell.classList.add("cell-dropset");
        }
      }
      row.appendChild(cell);
    }

    tbody.appendChild(row);
  });
  progressTable.appendChild(tbody);
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
progressGymSelect.addEventListener("change", renderProgress);

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

// --- History: one row per workout day, opening into a set-by-set table ---

const HISTORY_PAGE = 10;
let historyShown = HISTORY_PAGE;
const historyOpened = new Set();
const historyClosed = new Set();

function historyDayTypes(dayEntries) {
  const votes = new Set();
  dayEntries.forEach((e) => {
    const days = EXERCISE_DAY_INDEX.get(e.exercise.toLowerCase());
    if (days && days.size === 1) votes.add([...days][0]);
  });
  return planDays.filter((d) => votes.has(d));
}

function topSet(sets) {
  return sets.reduce(
    (best, s) => (s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps) ? s : best),
    sets[0]
  );
}

// Each exercise's sessions (one per date), oldest first, for comparing a
// session with the one before it.
function buildSessionIndex() {
  const byExercise = new Map();
  entries.forEach((e) => {
    const key = e.exercise.toLowerCase();
    if (!byExercise.has(key)) byExercise.set(key, new Map());
    const dates = byExercise.get(key);
    if (!dates.has(e.date)) dates.set(e.date, []);
    dates.get(e.date).push(e);
  });
  const index = new Map();
  byExercise.forEach((dates, key) => {
    index.set(
      key,
      [...dates.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, sets]) => ({ date, top: topSet(sets), gym: sets.find((s) => s.gym)?.gym || "" }))
    );
  });
  return index;
}

// Machine exercises only compare against the same gym (weight stacks differ
// between gyms); free weights compare against any gym.
function previousSession(index, exercise, date, gym) {
  const sessions = index.get(exercise.toLowerCase()) || [];
  const machine = isMachineExercise(exercise);
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i];
    if (s.date >= date) continue;
    if (machine && gym && s.gym && s.gym !== gym) continue;
    return s;
  }
  return null;
}

function compareSets(top, prev) {
  if (!prev) return "new";
  if (top.weight !== prev.weight) return top.weight > prev.weight ? "up" : "down";
  if (top.reps !== prev.reps) return top.reps > prev.reps ? "up" : "down";
  return "same";
}

function formatShortDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const opts = { day: "numeric", month: "short" };
  if (y !== new Date().getFullYear()) opts.year = "2-digit";
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
}

function formatSet(set) {
  return `${set.weight ? `${set.weight}${set.unit}` : "BW"}×${set.reps}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderHistory() {
  const q = filterText.toLowerCase();
  const filtered = q ? entries.filter((e) => e.exercise.toLowerCase().includes(q)) : entries;

  historyList.innerHTML = "";
  emptyState.hidden = entries.length !== 0;

  if (filtered.length === 0) {
    historyList.hidden = true;
    historyMoreBtn.hidden = true;
    if (entries.length > 0) {
      emptyState.hidden = false;
      emptyState.textContent = "No entries match your filter.";
    }
    return;
  }

  historyList.hidden = false;
  const days = groupByDate(filtered);
  const index = buildSessionIndex();
  days.slice(0, historyShown).forEach(([date, dayEntries], i) => {
    historyList.appendChild(renderHistoryDay(date, dayEntries, index, i === 0));
  });
  historyMoreBtn.hidden = days.length <= historyShown;
}

function renderHistoryDay(date, dayEntries, index, isNewest) {
  const byExercise = new Map();
  dayEntries
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((e) => {
      if (!byExercise.has(e.exercise)) byExercise.set(e.exercise, []);
      byExercise.get(e.exercise).push(e);
    });

  const rows = [...byExercise.entries()].map(([name, sets]) => {
    const gym = sets.find((s) => s.gym)?.gym || "";
    const top = topSet(sets);
    const prev = previousSession(index, name, date, gym);
    return { name, sets, prev, cmp: compareSets(top, prev && prev.top) };
  });

  const details = el("details", "history-day");
  details.open = historyOpened.has(date) || (isNewest && !historyClosed.has(date));
  const summary = el("summary");
  // Remember only the user's own taps ("toggle" also fires when the page
  // sets `open` while rendering, which would pin every default-open day).
  summary.addEventListener("click", () => {
    if (details.open) {
      historyClosed.add(date);
      historyOpened.delete(date);
    } else {
      historyOpened.add(date);
      historyClosed.delete(date);
    }
  });
  summary.appendChild(el("span", "history-date", formatDateLabel(date)));

  const tally = el("span", "history-tally");
  [["up", "▲"], ["down", "▼"], ["same", "="]].forEach(([kind, symbol]) => {
    const n = rows.filter((r) => r.cmp === kind).length;
    if (n) tally.appendChild(el("span", kind, `${symbol}${n}`));
  });
  tally.appendChild(el("span", "history-chev", "›"));
  summary.appendChild(tally);

  const meta = el("span", "history-meta");
  const types = historyDayTypes(dayEntries);
  meta.appendChild(el("span", "history-types", types.length ? types.join(" + ") : "Workout"));
  const gyms = [...new Set(dayEntries.map((e) => e.gym).filter(Boolean))];
  meta.appendChild(
    document.createTextNode(` · ${gyms.join(", ") || "No gym"} · ${rows.length} exercise${rows.length === 1 ? "" : "s"}`)
  );
  summary.appendChild(meta);
  details.appendChild(summary);

  const maxSets = Math.max(...rows.map((r) => r.sets.length));
  const table = el("table", "history-table");
  const head = el("tr");
  head.appendChild(el("th", "ex", "Exercise"));
  head.appendChild(el("th", null, "vs last"));
  for (let i = 1; i <= maxSets; i++) head.appendChild(el("th", null, `Set ${i}`));
  const thead = el("thead");
  thead.appendChild(head);
  table.appendChild(thead);

  const tbody = el("tbody");
  rows.forEach((row) => {
    const tr = el("tr");
    const exCell = el("td", "ex", row.name);
    const notes = [...new Set(row.sets.map((s) => s.notes).filter(Boolean))];
    if (notes.length) exCell.appendChild(el("span", "history-ex-notes", notes.join(" · ")));
    tr.appendChild(exCell);

    const cmpCell = el("td", "cmp-cell");
    cmpCell.appendChild(el("span", `cmp ${row.cmp}`, { up: "▲", down: "▼", same: "=", new: "NEW" }[row.cmp]));
    if (row.prev) {
      cmpCell.appendChild(el("span", "cmp-prev", formatSet(row.prev.top)));
      cmpCell.appendChild(el("span", "cmp-prev", formatShortDate(row.prev.date)));
    }
    tr.appendChild(cmpCell);

    for (let i = 0; i < maxSets; i++) {
      const set = row.sets[i];
      if (!set) {
        tr.appendChild(el("td", "empty", "–"));
        continue;
      }
      const td = el("td");
      const btn = el("button", "set-cell", formatSet(set));
      btn.type = "button";
      btn.title = "Edit this set";
      if (set.dropSet) btn.appendChild(el("span", "ds", "DS"));
      btn.addEventListener("click", () => startEdit(set.id));
      td.appendChild(btn);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  const wrap = el("div", "history-table-wrap");
  wrap.appendChild(table);
  details.appendChild(wrap);
  return details;
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
  syncProgressToExercise(planEx.name);
  document.getElementById("logSection").scrollIntoView({ behavior: "smooth" });
  weightInput.focus();
}

function startEdit(id) {
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  editingId = id;
  exerciseInput.value = entry.exercise;
  gymInput.value = entry.gym || "";
  repsInput.value = entry.reps;
  weightInput.value = entry.weight || "";
  unitInput.value = entry.unit;
  dateInput.value = entry.date;
  notesInput.value = entry.notes || "";
  dropSetInput.checked = !!entry.dropSet;
  submitBtn.textContent = "Save changes";
  editActions.hidden = false;
  syncProgressToExercise(entry.exercise);
  document.getElementById("logSection").scrollIntoView({ behavior: "smooth" });
  exerciseInput.focus({ preventScroll: true });
}

function resetForm() {
  editingId = null;
  logForm.reset();
  dateInput.value = todayISO();
  repsInput.value = 10;
  gymInput.value = loadLastGym();
  submitBtn.textContent = "Log set";
  editActions.hidden = true;
  lastEntryHint.textContent = "";
}

// After logging a set, the next one is almost always the same exercise --
// keep exercise/reps/weight/unit/date as-is and just clear the per-set
// fields, so the form is immediately ready for "log the next set" without
// scrolling back up to the plan card.
function prepareNextSet() {
  editingId = null;
  submitBtn.textContent = "Log set";
  editActions.hidden = true;
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
      renderGymDatalist();
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
    gym: gymInput.value.trim(),
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
      saveLastGym(data.gym);
      prepareNextSet();
    }
  } catch (err) {
    alert("Could not save entry: " + err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

exerciseInput.addEventListener("input", () => {
  updateLastEntryHint();
  syncProgressToExercise(exerciseInput.value);
});

document.getElementById("deleteEditBtn").addEventListener("click", () => {
  if (editingId) deleteEntry(editingId);
});
document.getElementById("cancelEditBtn").addEventListener("click", resetForm);

historyMoreBtn.addEventListener("click", () => {
  historyShown += HISTORY_PAGE;
  renderHistory();
});

filterInput.addEventListener("input", () => {
  historyShown = HISTORY_PAGE;
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

    const items = imported.filter((item) => item && item.exercise && item.date);
    const collection = entriesCollection();
    // Firestore rejects batches over 500 writes, so commit in chunks.
    const CHUNK = 400;
    let added = 0;
    try {
      for (let i = 0; i < items.length; i += CHUNK) {
        const batch = firebase.firestore().batch();
        items.slice(i, i + CHUNK).forEach((item) => {
          batch.set(collection.doc(), {
            exercise: item.exercise,
            gym: item.gym || "",
            reps: Number(item.reps) || 1,
            weight: Number(item.weight) || 0,
            unit: item.unit === "lb" ? "lb" : "kg",
            date: item.date,
            notes: item.notes || "",
            dropSet: !!item.dropSet,
            createdAt: item.createdAt || Date.now(),
            importId: item.importId || "",
          });
        });
        await batch.commit();
        added += Math.min(CHUNK, items.length - i);
      }
    } catch (err) {
      throw new Error(`${err.message} (${added} of ${items.length} entries were saved before this failed)`);
    }
    alert(`Imported ${added} entr${added === 1 ? "y" : "ies"}.`);
  } catch (err) {
    alert("Could not import file: " + err.message);
  } finally {
    ev.target.value = "";
  }
});

// Removes exactly the entries a previous import created, by matching each
// line of the same file -- so sets logged by hand are never touched.
function importKey(item) {
  return [item.importId || "", item.createdAt, item.exercise, item.date, Number(item.weight) || 0, Number(item.reps) || 1].join("|");
}

document.getElementById("removeImportInput").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error("Invalid format");
    const keys = new Set(imported.filter((i) => i && i.exercise && i.date && i.createdAt).map(importKey));
    const matches = entries.filter((e) => keys.has(importKey(e)));
    if (matches.length === 0) {
      alert("No entries from this file were found, so nothing was removed.");
      return;
    }
    if (!confirm(`Remove ${matches.length} entries that came from "${file.name}"? This can't be undone.`)) return;
    const collection = entriesCollection();
    const CHUNK = 400;
    let removed = 0;
    try {
      for (let i = 0; i < matches.length; i += CHUNK) {
        const batch = firebase.firestore().batch();
        matches.slice(i, i + CHUNK).forEach((e) => batch.delete(collection.doc(e.id)));
        await batch.commit();
        removed += Math.min(CHUNK, matches.length - i);
      }
    } catch (err) {
      throw new Error(`${err.message} (${removed} of ${matches.length} entries were removed before this failed)`);
    }
    alert(`Removed ${removed} entr${removed === 1 ? "y" : "ies"}.`);
  } catch (err) {
    alert("Could not remove import: " + err.message);
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
gymInput.value = loadLastGym();
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
