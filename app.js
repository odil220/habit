/* =========================================================
   ORDINARY — app logic
   ========================================================= */
(function () {
  "use strict";

  const STORE_KEY = "ordinary.v1";
  const DEMO = new URLSearchParams(location.search).has("demo");

  /* ---------- Date helpers ---------- */
  const dateKey = (d = new Date()) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  };
  const TODAY = dateKey();
  const LONG = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
  const LONG_YEAR = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const fmtDate = (k) => LONG.format(new Date(k + "T00:00:00"));
  const fmtDateY = (k) => LONG_YEAR.format(new Date(k + "T00:00:00"));
  const dayDiff = (a, b) => Math.round((new Date(a + "T00:00:00") - new Date(b + "T00:00:00")) / 86400000);
  const relDay = (k) => {
    const d = dayDiff(TODAY, k);
    if (d === 0) return "Today";
    if (d === 1) return "Yesterday";
    if (d > 1 && d < 7) return `${d} days ago`;
    return fmtDate(k);
  };

  /* ---------- State ---------- */
  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        s.habits = s.habits || [];
        s.days = s.days || {};
        s.theme = s.theme || "light";
        s.accent = s.accent || "warm";
        return s;
      }
    } catch (e) {}
    const fresh = { habits: [], days: {}, theme: prefersDark() ? "dark" : "light", accent: "warm" };
    if (DEMO) seed(fresh);
    return fresh;
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function prefersDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function seed(s) {
    const names = ["Drink water", "Read 20 pages", "Exercise", "Study programming", "Meditate"];
    s.habits = names.map((n, i) => ({ id: "h" + (i + 1), name: n }));
    const mk = (k, doneIdx, note) => {
      const done = {};
      doneIdx.forEach((i) => { const h = s.habits[i]; if (h) done[h.id] = true; });
      s.days[k] = { done, note: note || "" };
    };
    mk(TODAY, [0, 2, 4], "Quiet morning. Finished the book I started last week — felt good to follow through.");
    const d1 = dateKey(new Date(Date.now() - 86400000));
    mk(d1, [0, 1, 2, 3], "Busy day but kept the routine. Skipped meditation, will do it tomorrow.");
    const d2 = dateKey(new Date(Date.now() - 2 * 86400000));
    mk(d2, [0, 1, 2, 3, 4], "Everything done. Felt in control.");
    const d3 = dateKey(new Date(Date.now() - 3 * 86400000));
    mk(d3, [0, 3], "Travel day, low energy. Water and studying only.");
    const d4 = dateKey(new Date(Date.now() - 4 * 86400000));
    mk(d4, [0, 1, 2], "");
  }

  /* ---------- DOM refs ---------- */
  const $ = (id) => document.getElementById(id);
  const app = document.querySelector(".app");
  const views = { habits: $("view-habits"), note: $("view-note"), history: $("view-history") };
  const navItems = Array.from(document.querySelectorAll(".nav__item"));
  const navIndicator = $("navIndicator");
  const veil = document.querySelector(".veil");

  let currentView = "habits";

  /* =========================================================
     THEME / ACCENT
     ========================================================= */
  function applyThemeChrome() {
    document.documentElement.setAttribute("data-theme", state.theme);
    document.documentElement.setAttribute("data-accent", state.accent);
    document.querySelector('meta[name="theme-color"]').setAttribute("content", state.theme === "dark" ? "#14110f" : "#faf8f5");
    document.querySelectorAll(".seg__dot").forEach((d) => d.classList.toggle("is-active", d.dataset.setAccent === state.accent));
  }
  applyThemeChrome();

  function setTheme(next) {
    veil.classList.add("is-active");
    setTimeout(() => {
      state.theme = next;
      applyThemeChrome();
      save();
      veil.classList.remove("is-active");
    }, 200);
    document.getElementById("themeToggle").setAttribute("aria-label", next === "dark" ? "Switch to light theme" : "Switch to dark theme");
  }

  $("themeToggle").addEventListener("click", () => {
    setTheme(state.theme === "dark" ? "light" : "dark");
  });

  document.querySelectorAll(".seg__dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      state.accent = dot.dataset.setAccent;
      applyThemeChrome();
      save();
      positionIndicator();
    });
  });

  /* =========================================================
     HABITS
     ========================================================= */
  const habitList = $("habitList");
  const addHabitBtn = $("addHabitBtn");
  const addForm = $("addForm");
  const addInput = $("addInput");
  const addCancel = $("addCancel");

  function dayRec(k = TODAY) {
    if (!state.days[k]) state.days[k] = { done: {}, note: "" };
    return state.days[k];
  }
  function isDone(id, k = TODAY) {
    const r = state.days[k];
    return !!(r && r.done[id]);
  }

  function renderHabits() {
    const habits = state.habits;
    if (!habits.length) {
      habitList.innerHTML = `
        <div class="empty">
          <p class="empty__title">Nothing planned yet</p>
          <p class="empty__text">Add your first habit to start tracking today. Keep it small — a few things done well.</p>
          <button class="btn btn--primary empty__btn" id="emptyAdd">Add habit</button>
        </div>`;
      const ea = $("emptyAdd");
      if (ea) ea.addEventListener("click", openAddForm);
      renderProgress();
      return;
    }
    habitList.innerHTML = habits.map((h) => rowHTML(h)).join("");
    renderProgress();
  }

  function rowHTML(h, entering) {
    const done = isDone(h.id);
    return `
      <div class="row ${done ? "is-done" : ""} ${entering ? "is-entering" : ""}" data-id="${h.id}">
        <button class="check" role="checkbox" aria-checked="${done}" aria-label="Toggle ${escapeHtml(h.name)}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle class="ring" cx="12" cy="12" r="10.5"/>
            <path class="tick" d="M7 12.4 L10.4 16 L17 8.6"/>
          </svg>
        </button>
        <span class="row__name">${escapeHtml(h.name)}</span>
        <span class="row__state">Completed</span>
        <button class="row__del" aria-label="Delete ${escapeHtml(h.name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 7h14M10 7V5h4v2M6.5 7l.7 12h9.6l.7-12"/></svg>
        </button>
      </div>`;
  }

  function renderProgress() {
    const total = state.habits.length;
    const done = state.habits.filter((h) => isDone(h.id)).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    $("doneCount").textContent = done;
    $("totalCount").textContent = total;
    $("pct").textContent = pct + "%";
    $("progFill").style.width = pct + "%";
    const track = $("progTrack");
    track.setAttribute("aria-valuenow", String(pct));
    track.parentElement.classList.add("is-animating");
    clearTimeout(renderProgress._t);
    renderProgress._t = setTimeout(() => track.parentElement.classList.remove("is-animating"), 1000);
  }

  /* toggle completion */
  habitList.addEventListener("click", (e) => {
    const check = e.target.closest(".check");
    const del = e.target.closest(".row__del");
    const row = e.target.closest(".row");
    if (!row) return;
    const id = row.dataset.id;
    if (del) { deleteHabit(id, row); return; }
    if (check) {
      const r = dayRec();
      const nowDone = !r.done[id];
      if (nowDone) r.done[id] = true; else delete r.done[id];
      row.classList.toggle("is-done", nowDone);
      check.setAttribute("aria-checked", String(nowDone));
      renderProgress();
      save();
    }
  });

  /* add habit */
  function openAddForm() {
    addHabitBtn.hidden = true;
    addForm.hidden = false;
    addHabitBtn.setAttribute("aria-expanded", "true");
    addInput.value = "";
    addInput.focus();
  }
  function closeAddForm() {
    addForm.hidden = true;
    addHabitBtn.hidden = false;
    addHabitBtn.setAttribute("aria-expanded", "false");
  }
  addHabitBtn.addEventListener("click", openAddForm);
  addCancel.addEventListener("click", closeAddForm);
  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = addInput.value.trim();
    if (!name) { addInput.focus(); return; }
    const id = "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    state.habits.push({ id, name });
    save();
    closeAddForm();
    renderHabits();
    const rows = habitList.querySelectorAll(".row");
    const newRow = rows[rows.length - 1];
    if (newRow) newRow.classList.add("is-entering");
  });
  addInput.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAddForm(); });

  /* delete + undo */
  let undoTimer = null;
  let pendingDelete = null;

  function deleteHabit(id, row) {
    const idx = state.habits.findIndex((h) => h.id === id);
    if (idx < 0) return;
    const habit = state.habits[idx];
    const wasDone = isDone(id);
    pendingDelete = { habit, idx, wasDone };
    row.classList.add("is-leaving");
    const finish = () => {
      state.habits.splice(idx, 1);
      const r = state.days[TODAY];
      if (r) delete r.done[id];
      save();
      renderHabits();
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) finish(); else setTimeout(finish, 340);
    showToast("Habit deleted", "Undo", () => {
      if (!pendingDelete) return;
      const { habit: h, idx: i, wasDone: w } = pendingDelete;
      state.habits.splice(Math.min(i, state.habits.length), 0, h);
      if (w) dayRec().done[h.id] = true;
      pendingDelete = null;
      save();
      renderHabits();
    });
  }

  /* =========================================================
     NOTE
     ========================================================= */
  const editor = $("noteEditor");
  const noteStatus = $("noteStatus");
  const noteStatusText = noteStatus.querySelector(".note__statustext");
  let saveTimer = null;

  function loadNote() {
    const note = dayRec().note || "";
    editor.textContent = note;
    if (note.trim()) setNoteStatus("saved");
    else noteStatus.classList.remove("is-visible", "is-saving", "is-saved");
  }
  function setNoteStatus(mode) {
    noteStatus.classList.add("is-visible");
    noteStatus.classList.toggle("is-saving", mode === "saving");
    noteStatus.classList.toggle("is-saved", mode === "saved");
    noteStatusText.textContent = mode === "saving" ? "Saving…" : "Saved";
  }
  editor.addEventListener("input", () => {
    if (!editor.textContent.trim()) editor.innerHTML = "";
    setNoteStatus("saving");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      dayRec().note = editor.textContent;
      save();
      setNoteStatus("saved");
    }, 550);
  });
  editor.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.activeElement === editor) editor.blur();
  });
  editor.addEventListener("focus", () => document.body.classList.add("is-typing"));
  editor.addEventListener("blur", () => document.body.classList.remove("is-typing"));

  /* =========================================================
     HISTORY
     ========================================================= */
  const historyList = $("historyList");

  function renderHistory() {
    const keys = Object.keys(state.days).filter((k) => k !== TODAY).sort((a, b) => (a < b ? 1 : -1));
    if (!keys.length) {
      historyList.innerHTML = `<div class="history__empty">No past days yet. Your completed days will appear here.</div>`;
      return;
    }
    historyList.innerHTML = keys.map((k) => {
      const r = state.days[k];
      const total = state.habits.length;
      const done = state.habits.filter((h) => r.done && r.done[h.id]).length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      const circ = 2 * Math.PI * 19;
      const off = circ * (1 - pct / 100);
      const hasNote = r.note && r.note.trim();
      return `
        <button class="hcard" data-key="${k}">
          <div class="hcard__main">
            <div class="hcard__date">${escapeHtml(relDay(k))}</div>
            <div class="hcard__sub">
              <span>${done} of ${total} completed</span>
              ${hasNote ? `<span class="hcard__note">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19h14M6.5 16.5l9.6-9.6a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L9.9 19.9H6.5z"/></svg>
                Note</span>` : ""}
            </div>
          </div>
          <div class="hcard__meter">
            <svg class="hcard__ring" viewBox="0 0 46 46">
              <circle class="bg" cx="23" cy="23" r="19"></circle>
              <circle class="fg" cx="23" cy="23" r="19" stroke-dasharray="${circ}" stroke-dashoffset="${off}"></circle>
            </svg>
            <span class="hcard__pct">${pct}%</span>
          </div>
          <span class="hcard__chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg></span>
        </button>`;
    }).join("");
  }

  historyList.addEventListener("click", (e) => {
    const card = e.target.closest(".hcard");
    if (!card) return;
    openSheet(card.dataset.key);
  });

  /* ---------- History sheet ---------- */
  const sheet = $("sheet");
  const sheetDate = $("sheetDate");
  const sheetTitle = $("sheetTitle");
  const sheetBody = $("sheetBody");

  function openSheet(k) {
    const r = state.days[k] || { done: {}, note: "" };
    const total = state.habits.length;
    const done = state.habits.filter((h) => r.done && r.done[h.id]).length;
    sheetDate.textContent = fmtDateY(k);
    sheetTitle.textContent = `${done} of ${total} completed`;
    const habitsHTML = state.habits.length
      ? `<div class="sheet__habits">${state.habits.map((h) => {
          const ok = !!(r.done && r.done[h.id]);
          return `<div class="sheet__habit ${ok ? "done" : "todo"}">
            <span class="dot">${ok ? '<svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17 L19 7"/></svg>' : ""}</span>
            <span class="hname">${escapeHtml(h.name)}</span>
          </div>`;
        }).join("")}</div>`
      : `<p class="sheet__note is-empty">No habits were being tracked yet.</p>`;
    const noteHTML = r.note && r.note.trim()
      ? `<div class="sheet__note">${escapeHtml(r.note)}</div>`
      : `<div class="sheet__note is-empty">No note written for this day.</div>`;
    sheetBody.innerHTML = `
      <div class="sheet__section">
        <div class="sheet__label">Habits</div>
        ${habitsHTML}
      </div>
      <div class="sheet__section">
        <div class="sheet__label">Note</div>
        ${noteHTML}
      </div>`;
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add("is-open"));
    const closeBtn = document.querySelector('[data-close-sheet]');
    closeBtn && closeBtn.focus();
  }
  function closeSheet() {
    sheet.classList.remove("is-open");
    setTimeout(() => { sheet.hidden = true; }, 340);
  }
  sheet.addEventListener("click", (e) => { if (e.target.closest("[data-close-sheet]")) closeSheet(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) closeSheet(); });

  /* =========================================================
     TOAST
     ========================================================= */
  const toast = $("toast");
  const toastText = $("toastText");
  const toastUndo = $("toastUndo");
  let toastTimer = null;
  let toastAction = null;

  function showToast(text, actionLabel, action) {
    clearTimeout(toastTimer);
    toastText.textContent = text;
    toastUndo.textContent = actionLabel || "Undo";
    toastAction = action || null;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    toastTimer = setTimeout(hideToast, 6000);
  }
  function hideToast() {
    toast.classList.remove("is-visible");
    setTimeout(() => { toast.hidden = true; toastAction = null; }, 340);
    clearTimeout(toastTimer);
  }
  toastUndo.addEventListener("click", () => {
    if (toastAction) toastAction();
    hideToast();
  });

  /* =========================================================
     NAVIGATION
     ========================================================= */
  function setHeader(view) {
    const map = {
      habits: { eyebrow: fmtDate(TODAY), title: "Today's Habits" },
      note: { eyebrow: fmtDate(TODAY), title: "Today's Note" },
      history: { eyebrow: "Your journey", title: "History" },
    };
    const m = map[view];
    $("eyebrow").textContent = m.eyebrow;
    $("title").textContent = m.title;
  }

  function showView(view) {
    if (view === currentView) return;
    if (currentView === "note") { document.body.classList.remove("is-typing"); editor.blur(); }
    currentView = view;
    Object.keys(views).forEach((v) => {
      const el = views[v];
      if (v === view) { el.hidden = false; el.classList.add("is-active"); el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; }
      else { el.hidden = true; el.classList.remove("is-active"); }
    });
    navItems.forEach((n) => {
      const active = n.dataset.view === view;
      n.classList.toggle("is-active", active);
      if (active) n.setAttribute("aria-current", "page"); else n.removeAttribute("aria-current");
    });
    setHeader(view);
    if (view === "note") loadNote();
    if (view === "history") renderHistory();
    if (view === "habits") renderHabits();
    positionIndicator();
  }

  navItems.forEach((n) => n.addEventListener("click", () => showView(n.dataset.view)));

  function positionIndicator() {
    const active = navItems.find((n) => n.classList.contains("is-active"));
    if (!active) return;
    navIndicator.style.width = active.offsetWidth + "px";
    navIndicator.style.transform = `translateX(${active.offsetLeft}px)`;
  }
  window.addEventListener("resize", positionIndicator);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(positionIndicator);

  /* =========================================================
     KEYBOARD SHORTCUTS
     ========================================================= */
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, [contenteditable]")) return;
    if (e.key === "1") showView("habits");
    else if (e.key === "2") showView("note");
    else if (e.key === "3") showView("history");
    else if (e.key === "n" || e.key === "N") { showView("note"); setTimeout(() => editor.focus(), 60); }
  });

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    const params = new URLSearchParams(location.search);
    if (params.get("theme") === "dark" || params.get("theme") === "light") state.theme = params.get("theme");
    if (params.get("accent") === "warm" || params.get("accent") === "cool") state.accent = params.get("accent");
    applyThemeChrome();
    const v = params.get("view");
    if (v === "note" || v === "history" || v === "habits") currentView = v === "habits" ? "habits" : v;
    setHeader(currentView);
    renderHabits();
    loadNote();
    if (currentView === "history") renderHistory();
    if (currentView === "note") loadNote();
    navItems.forEach((n) => {
      const active = n.dataset.view === currentView;
      n.classList.toggle("is-active", active);
      if (active) n.setAttribute("aria-current", "page");
    });
    positionIndicator();
    requestAnimationFrame(positionIndicator);
    setTimeout(positionIndicator, 300);
  }
  init();

  /* ---------- utils ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
