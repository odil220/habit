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
  const fmtDate = (k) => LONG.format(new Date(k + "T00:00:00"));

  /* ---------- State ---------- */
  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        s.habits = s.habits || [];
        s.days = s.days || {};
        s.theme = s.theme || (prefersDark() ? "dark" : "light");
        s.accent = s.accent || "warm";
        s.avatar = s.avatar || "";
        s.music = s.music || [];
        s.collections = s.collections || [];
        s.recentlyPlayed = s.recentlyPlayed || [];
        s.positions = s.positions || {};
        s.shuffle = !!s.shuffle;
        s.repeat = !!s.repeat;
        s.volume = typeof s.volume === "number" ? s.volume : 1;
        return s;
      }
    } catch (e) {}
    const fresh = {
      habits: [], days: {}, theme: prefersDark() ? "dark" : "light", accent: "warm",
      avatar: "", music: [], collections: [], recentlyPlayed: [], positions: {},
      shuffle: false, repeat: false, volume: 1,
    };
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
    mk(dateKey(new Date(Date.now() - 86400000)), [0, 1, 2, 3], "Busy day but kept the routine.");
    mk(dateKey(new Date(Date.now() - 2 * 86400000)), [0, 1, 2, 3, 4], "Everything done. Felt in control.");

    s.collections = [
      { id: "c1", name: "Classic" },
      { id: "c2", name: "Focus" },
      { id: "c3", name: "Workout" },
    ];
    s.music = [
      { id: "m1", name: "Morning Prelude", file: "morning-prelude.mp3", duration: 214, collections: ["c1"] },
      { id: "m2", name: "Nocturne in C", file: "nocturne-c.mp3", duration: 198, collections: ["c1"] },
      { id: "m3", name: "Deep Focus", file: "deep-focus.mp3", duration: 305, collections: ["c2"] },
      { id: "m4", name: "Study Loop", file: "study-loop.mp3", duration: 172, collections: ["c2"] },
      { id: "m5", name: "Run the Mile", file: "run-the-mile.mp3", duration: 241, collections: ["c3"] },
      { id: "m6", name: "Lift Heavy", file: "lift-heavy.mp3", duration: 188, collections: ["c3"] },
      { id: "m7", name: "Sunset Drive", file: "sunset-drive.mp3", duration: 222, collections: [] },
    ];
    s.recentlyPlayed = ["m3", "m1", "m5"];
  }

  /* ---------- DOM refs ---------- */
  const $ = (id) => document.getElementById(id);
  const views = { habits: $("view-habits"), note: $("view-note"), music: $("view-music") };
  const navItems = Array.from(document.querySelectorAll(".nav__item"));
  const navIndicator = $("navIndicator");
  const veil = document.querySelector(".veil");

  let currentView = "habits";

  /* =========================================================
     THEME
     ========================================================= */
  function applyThemeChrome() {
    document.documentElement.setAttribute("data-theme", state.theme);
    document.documentElement.setAttribute("data-accent", state.accent);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", state.theme === "dark" ? "#000000" : "#ffffff");
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
  }
  $("themeToggle").addEventListener("click", () => setTheme(state.theme === "dark" ? "light" : "dark"));

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
     AVATAR
     ========================================================= */
  const avatarBtn = $("avatarBtn");
  const avatarImg = $("avatarImg");
  const avmenu = $("avmenu");
  const avChoose = $("avChoose");
  const avRemove = $("avRemove");
  const avatarInput = $("avatarInput");

  function updateAvatar() {
    if (state.avatar) {
      avatarImg.src = state.avatar;
      avatarImg.hidden = false;
      avatarBtn.classList.add("has-img");
      avRemove.hidden = false;
    } else {
      avatarImg.removeAttribute("src");
      avatarImg.hidden = true;
      avatarBtn.classList.remove("has-img");
      avRemove.hidden = true;
    }
  }
  function closeAvMenu() { avmenu.classList.remove("is-open"); avmenu.hidden = true; avatarBtn.setAttribute("aria-expanded", "false"); }
  avatarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (avmenu.classList.contains("is-open")) { closeAvMenu(); return; }
    avmenu.hidden = false;
    requestAnimationFrame(() => avmenu.classList.add("is-open"));
    avatarBtn.setAttribute("aria-expanded", "true");
  });
  document.addEventListener("click", (e) => { if (!avmenu.contains(e.target) && e.target !== avatarBtn) closeAvMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAvMenu(); });
  avChoose.addEventListener("click", () => { avatarInput.click(); closeAvMenu(); });
  avRemove.addEventListener("click", () => { state.avatar = ""; save(); updateAvatar(); closeAvMenu(); });

  avatarInput.addEventListener("change", async () => {
    const file = avatarInput.files && avatarInput.files[0];
    avatarInput.value = "";
    if (!file) return;
    try {
      const dataUrl = await downscaleImage(file, 320);
      state.avatar = dataUrl;
      save();
      updateAvatar();
    } catch (err) {
      showToast("Couldn't load that image", "OK", () => {});
    }
  });

  function downscaleImage(file, max) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, max / Math.max(img.width, img.height));
        const cw = Math.max(1, Math.round(img.width * ratio));
        const ch = Math.max(1, Math.round(img.height * ratio));
        const c = document.createElement("canvas");
        c.width = cw; c.height = ch;
        c.getContext("2d").drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        try { res(c.toDataURL("image/jpeg", 0.86)); } catch (e) { rej(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("bad image")); };
      img.src = url;
    });
  }

  function setGreeting() {
    const h = new Date().getHours();
    const g = h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    $("greet").textContent = g;
    $("heroDate").textContent = fmtDate(TODAY);
  }

  /* =========================================================
     MUSIC — IndexedDB store for audio blobs
     ========================================================= */
  const viewMusic = $("view-music");
  const musicLibrary = $("musicLibrary");
  const musicCollection = $("musicCollection");
  const ORIGINAL_LIBRARY = musicLibrary.innerHTML;
  const collectionCards = $("collectionCards");
  const recentSec = $("recentSec");
  const recentList = $("recentList");
  const allList = $("allList");
  const colEyebrow = $("colEyebrow");
  const colTitle = $("colTitle");
  const colSub = $("colSub");
  const colList = $("colList");
  const addMusicBtn = $("addMusicBtn");
  const addToCollectionBtn = $("addToCollectionBtn");
  const musicFileInput = $("musicFileInput");
  const musicFolderInput = $("musicFolderInput");
  const artworkInput = $("artworkInput");

  const miniArtImg = $("miniArt").querySelector(".mini__artimg");
  const miniArtIcon = $("miniArt").querySelector(".mini__articon");
  const fullArtImg = $("fullArt").querySelector(".full__artimg");
  const fullArtIcon = $("fullArt").querySelector(".full__articon");

  const audio = new Audio();
  audio.volume = state.volume;

  const urls = {};     // id -> objectURL
  const blobs = {};    // id -> Blob (for reliable undo)
  let currentId = null;
  let isPlaying = false;
  let currentColId = null;
  let pendingDeleteTrack = null;
  let pendingFiles = [];
  let sheetMode = "files";
  let sheetTrackId = null;

  /* --- tiny IndexedDB wrapper --- */
  let _db = null;
  function idb() {
    return new Promise((res, rej) => {
      if (!("indexedDB" in window)) return rej(new Error("no idb"));
      if (_db) return res(_db);
      const r = indexedDB.open("ordinary", 1);
      r.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("tracks")) db.createObjectStore("tracks", { keyPath: "id" });
      };
      r.onsuccess = () => { _db = r.result; res(_db); };
      r.onerror = () => rej(r.error);
    });
  }
  async function idbPut(rec) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction("tracks", "readwrite");
      tx.objectStore("tracks").put(rec);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
  }
  async function idbGet(id) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction("tracks", "readonly");
      const rq = tx.objectStore("tracks").get(id);
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    });
  }
  async function idbDel(id) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction("tracks", "readwrite");
      tx.objectStore("tracks").delete(id);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
  }

  async function loadMusic() {
    for (const t of state.music) {
      try {
        const rec = await idbGet(t.id);
        if (rec && rec.blob) { urls[t.id] = URL.createObjectURL(rec.blob); blobs[t.id] = rec.blob; }
      } catch (e) {}
    }
  }

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ":" + String(sec).padStart(2, "0");
  }
  function getDuration(url) {
    return new Promise((res) => {
      const a = new Audio(); a.preload = "metadata"; a.src = url;
      a.onloadedmetadata = () => res(a.duration || 0);
      a.onerror = () => res(0);
    });
  }
  function cleanName(f) {
    let n = (f || "").replace(/\.[^.]+$/, "");
    n = n.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
    return n || f || "Untitled";
  }
  function isAudio(file) {
    if (file.type && file.type.startsWith("audio/")) return true;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    return ["mp3", "wav", "m4a", "ogg", "aac", "flac", "webm", "oga"].includes(ext);
  }

  function trackRowHTML(t) {
    const hasArt = !!(t.artwork);
    return `
      <div class="track ${t.id === currentId ? "is-active" : ""}" data-id="${t.id}">
        <button class="track__play" aria-label="Play ${escapeHtml(t.name)}">
          ${t.id === currentId && isPlaying
            ? '<span class="eq" aria-hidden="true"><span></span><span></span><span></span></span>'
            : '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>'}
        </button>
        ${hasArt
          ? '<span class="track__art" aria-hidden="true"><img src="' + escapeHtml(t.artwork) + '" alt="" loading="lazy" /><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M9 17V5l10-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/></svg></span>'
          : '<span class="track__art" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M9 17V5l10-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/></svg></span>'}
        <div class="track__info">
          <div class="track__title">${escapeHtml(t.name)}</div>
          <div class="track__sub">${escapeHtml(t.file)}${t.duration ? " · " + fmtTime(t.duration) : ""}</div>
        </div>
        <span class="track__dur">${t.duration ? fmtTime(t.duration) : ""}</span>
        <button class="track__more" aria-label="More options for ${escapeHtml(t.name)}">
          <svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/></svg>
        </button>
      </div>`;
  }

  function renderLibrary() {
    if (state.music.length === 0) {
      musicLibrary.innerHTML = `
        <div class="page-head">
          <div>
            <p class="eyebrow">Your sounds</p>
            <h1 class="page-title">Music</h1>
          </div>
        </div>
        <div class="empty" style="margin-top:var(--sp-7)">
          <p class="empty__title">Your library is empty</p>
          <p class="empty__text">Add your first song and start building your collection.</p>
          <button class="btn btn--primary empty__btn" id="emptyAddMusic2">Add music</button>
        </div>`;
      const b = $("emptyAddMusic2");
      if (b) b.addEventListener("click", () => { addContext = "library"; openAddChoice(addMusicBtn); });
      return;
    }
    if (!$("collectionCards")) musicLibrary.innerHTML = ORIGINAL_LIBRARY;

    collectionCards.innerHTML = state.collections.map((c) => {
      const n = state.music.filter((t) => t.collections.includes(c.id)).length;
      return `<button class="card" data-col="${c.id}">
        <div class="card__art"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 17V5l10-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/></svg></div>
        <div class="card__name">${escapeHtml(c.name)}</div>
        <div class="card__meta">${n} ${n === 1 ? "song" : "songs"}</div>
      </button>`;
    }).join("") || `<div class="card__meta" style="padding:var(--sp-2)">No collections yet — add music to create one.</div>`;

    const recent = state.recentlyPlayed.map((id) => state.music.find((t) => t.id === id)).filter(Boolean).slice(0, 8);
    if (recent.length) { recentSec.style.display = ""; recentList.innerHTML = recent.map(trackRowHTML).join(""); }
    else recentSec.style.display = "none";

    allList.innerHTML = state.music.map(trackRowHTML).join("");
  }

  function openCollection(id) {
    const c = state.collections.find((x) => x.id === id);
    if (!c) { showLibrary(); return; }
    currentColId = id;
    musicLibrary.hidden = true;
    musicCollection.hidden = false;
    colEyebrow.textContent = "Collection";
    colTitle.textContent = c.name;
    const tracks = state.music.filter((t) => t.collections.includes(id));
    colSub.textContent = tracks.length + " " + (tracks.length === 1 ? "song" : "songs");
    if (tracks.length) colList.innerHTML = tracks.map(trackRowHTML).join("");
    else colList.innerHTML = `<div class="card__meta" style="padding:var(--sp-4)">No songs in this collection yet. Use “Add music” above.</div>`;
  }
  function showLibrary() {
    currentColId = null;
    musicCollection.hidden = true;
    musicLibrary.hidden = false;
    renderLibrary();
  }

  /* ---- view interactions ---- */
  $("musicBack").addEventListener("click", showLibrary);
  viewMusic.addEventListener("click", (e) => {
    const more = e.target.closest(".track__more");
    const track = e.target.closest(".track");
    const card = e.target.closest(".card");
    if (more && track) { e.stopPropagation(); openTrackMenu(track.dataset.id, more); return; }
    if (track) { const id = track.dataset.id; if (id === currentId) togglePlay(); else playTrack(id); return; }
    if (card) { openCollection(card.dataset.col); }
  });

  /* ---- add music flow ---- */
  let addContext = "library"; // "library" or a collection id

  function openAddChoice(anchor) {
    const items = [
      { label: "Choose files", icon: '<svg viewBox="0 0 24 24"><path d="M4 16l4.5-4.5 3.5 3.5L16 9l4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>', onSelect: () => musicFileInput.click() },
    ];
    if ("webkitdirectory" in musicFolderInput) {
      items.push({ label: "Choose folder", icon: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>', onSelect: () => musicFolderInput.click() });
    }
    openPop(anchor, items);
  }
  addMusicBtn.addEventListener("click", () => { addContext = "library"; openAddChoice(addMusicBtn); });
  addToCollectionBtn.addEventListener("click", () => { addContext = currentColId; openAddChoice(addToCollectionBtn); });

  musicFileInput.addEventListener("change", () => { handleSelectedFiles(musicFileInput.files); musicFileInput.value = ""; });
  musicFolderInput.addEventListener("change", () => { handleSelectedFiles(musicFolderInput.files); musicFolderInput.value = ""; });

  let trackArtTarget = null;
  artworkInput.addEventListener("change", async () => {
    const file = artworkInput.files && artworkInput.files[0];
    artworkInput.value = "";
    if (!file) return;
    try {
      const dataUrl = await downscaleImage(file, 320);
      if (trackArtTarget) {
        trackArtTarget.artwork = dataUrl;
        save(); updateArtDisplay(trackArtTarget); updatePlayerArt();
        showToast("Artwork updated", "OK", () => {});
        trackArtTarget = null;
      } else {
        const i = parseInt(artworkInput.dataset.idx, 10);
        if (pendingFiles[i]) {
          pendingFiles[i].artwork = dataUrl;
          const row = sheetDetailsList.querySelector(".drow[data-i='" + i + "']");
          if (row) {
            const img = row.querySelector(".drow__artimg");
            const icon = row.querySelector(".drow__articon");
            if (img && icon) { img.src = dataUrl; img.hidden = false; icon.style.display = "none"; row.querySelector(".drow__art").classList.add("has-art"); }
          }
        }
      }
    } catch (err) {
      showToast("Couldn't load that image", "OK", () => {});
    }
  });

  function handleSelectedFiles(fileList) {
    const files = Array.from(fileList || []).filter(isAudio);
    if (!files.length) { showToast("No audio files found", "OK", () => {}); return; }
    openAddSheet("files", files);
  }

  async function createTrack(file, colId, artwork, name) {
    const id = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const url = URL.createObjectURL(file);
    urls[id] = url; blobs[id] = file;
    const duration = await getDuration(url);
    const track = { id, name: name || cleanName(file.name), file: file.name, duration, collections: colId ? [colId] : [], artwork: artwork || "" };
    state.music.push(track);
    try { await idbPut({ id, name: file.name, type: file.type, blob: file, artwork: artwork || "" }); } catch (e) {}
    return track;
  }

  function openAddSheet(mode, files, trackId) {
    const sheet = $("addSheet");
    sheetMode = mode;
    sheetTrackId = trackId;
    if (mode === "files" && files && files.length) {
      pendingFiles = files.map((f) => ({ file: f, name: cleanName(f.name), artwork: "" }));
      renderDetailsStep();
    } else {
      pendingFiles = [];
      showTargets();
    }
    $("newColInput").value = "";
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add("is-open"));
  }

  function renderDetailsStep() {
    sheetDetails.hidden = false;
    sheetTargets.hidden = true;
    sheetNewCol.hidden = true;
    sheetTitle.textContent = "Add music";
    sheetConfirm.textContent = "Next";
    sheetConfirm.onclick = () => {
      if (addContext === "library") { showTargets(); }
      else { closeSheet($("addSheet")); applyTarget("files"); }
    };
    sheetBack.textContent = "Cancel";
    sheetBack.onclick = () => closeSheet($("addSheet"));

    sheetDetailsList.innerHTML = pendingFiles.map((pf, i) => `
      <div class="drow" data-i="${i}">
        <div class="drow__name" title="${escapeHtml(pf.file.name)}">${escapeHtml(pf.file.name)}</div>
        <input class="drow__rename" type="text" value="${escapeHtml(pf.name)}" maxlength="60" placeholder="Track name" autocomplete="off" />
        <button class="drow__art ic" type="button" aria-label="Add artwork for ${escapeHtml(pf.name)}" data-i="${i}">
          <img class="drow__artimg" alt="" hidden />
          <svg class="drow__articon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16l4.5-4.5 3.5 3.5L16 9l4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><circle cx="9" cy="8" r="1.6"/></svg>
        </button>
      </div>`).join("");

    sheetDetailsList.querySelectorAll(".drow__rename").forEach((inp) => {
      inp.addEventListener("input", () => {
        const i = parseInt(inp.closest(".drow").dataset.i, 10);
        const nm = inp.value.trim();
        pendingFiles[i].name = nm || cleanName(pendingFiles[i].file.name);
      });
    });
    sheetDetailsList.querySelectorAll(".drow__art").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const i = parseInt(btn.dataset.i, 10);
        artworkInput.dataset.idx = i;
        artworkInput.click();
      });
    });
  }

  function showTargets() {
    sheetDetails.hidden = true;
    sheetTargets.hidden = false;
    sheetNewCol.hidden = true;
    sheetTitle.textContent = "Add to collection";
    sheetConfirm.textContent = "Done";
    sheetConfirm.onclick = () => {
      if (sheetMode === "files") { closeSheet($("addSheet")); applyTarget("files", null, null, null); }
      else { closeSheet($("addSheet")); }
    };
    sheetBack.textContent = "Back";
    sheetBack.onclick = () => { if (sheetMode === "files") renderDetailsStep(); else closeSheet($("addSheet")); };

    const targetList = [{ id: null, name: "Library" }].concat(state.collections);
    sheetTargets.innerHTML = targetList.map((c) => `
      <button class="target" data-col="${c.id === null ? "" : c.id}">
        <span class="target__dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 17V5l10-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/></svg></span>
        <span>${c.id === null ? "Library" : escapeHtml(c.name)}</span>
        ${c.id === null ? "" : '<span class="target__meta">' + state.music.filter((t) => t.collections.includes(c.id)).length + "</span>"}
      </button>`).join("") +
      `<button class="target target--new" data-new="1">
        <span class="target__dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span>
        <span>Create new collection</span>
      </button>`;

    sheetTargets.querySelectorAll(".target").forEach((b) => {
      b.addEventListener("click", () => {
        if (b.dataset.new) { sheetNewCol.hidden = false; sheetTargets.hidden = true; $("newColInput").focus(); return; }
        const colId = b.dataset.col || null;
        applyTarget(sheetMode, null, sheetTrackId, colId);
        closeSheet($("addSheet"));
      });
    });
    $("newColCreate").onclick = () => {
      const name = $("newColInput").value.trim();
      if (!name) { $("newColInput").focus(); return; }
      const col = { id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name };
      state.collections.push(col);
      save();
      applyTarget(sheetMode, null, sheetTrackId, col.id);
      closeSheet($("addSheet"));
    };
    $("newColCancel").onclick = () => { sheetNewCol.hidden = true; sheetTargets.hidden = false; };
  }

  function applyTarget(mode, files, trackId, colId) {
    if (mode === "files") {
      Promise.all(pendingFiles.map((pf) => createTrack(pf.file, colId, pf.artwork, pf.name))).then(() => {
        save(); afterMusicChange();
        showToast(pendingFiles.length + (pendingFiles.length === 1 ? " song" : " songs") + " added", "OK", () => {});
      });
    } else if (mode === "track" && trackId) {
      const t = state.music.find((x) => x.id === trackId);
      if (t && colId && !t.collections.includes(colId)) t.collections.push(colId);
      save(); afterMusicChange();
      showToast("Added to collection", "OK", () => {});
    }
  }

  function afterMusicChange() {
    if (currentColId && !musicCollection.hidden) openCollection(currentColId);
    else renderLibrary();
  }

  function closeSheet(sheet) {
    sheet.classList.remove("is-open");
    setTimeout(() => { sheet.hidden = true; }, 340);
  }
  document.querySelectorAll("[data-close-sheet]").forEach((el) => el.addEventListener("click", () => closeSheet($("addSheet"))));

  /* ---- track menu ---- */
  function openTrackMenu(id, anchor) {
    const t = state.music.find((x) => x.id === id);
    const items = [
      { label: id === currentId && isPlaying ? "Pause" : "Play", icon: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>', onSelect: () => { if (id === currentId) togglePlay(); else playTrack(id); } },
      { label: t && t.artwork ? "Change artwork" : "Set artwork", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16l4.5-4.5 3.5 3.5L16 9l4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><circle cx="9" cy="8" r="1.6"/></svg>', onSelect: () => { if (t) { trackArtTarget = t; artworkInput.click(); } } },
      { label: "Add to collection", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>', onSelect: () => openAddSheet("track", null, id) },
      { label: "Remove", danger: true, icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 7h14M10 7V5h4v2M6.5 7l.7 12h9.6l.7-12"/></svg>', onSelect: () => removeTrack(id) },
    ];
    openPop(anchor, items);
  }

  /* ---- collection menu ---- */
  $("colMore").addEventListener("click", (e) => {
    e.stopPropagation();
    if (!currentColId) return;
    const items = [
      { label: "Rename", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18 10l-4-4L4 16z"/><path d="M13 5l4 4"/></svg>', onSelect: () => renameCollection(currentColId) },
      { label: "Delete", danger: true, icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 7h14M10 7V5h4v2M6.5 7l.7 12h9.6l.7-12"/></svg>', onSelect: () => confirmDeleteCollection(currentColId) },
    ];
    openPop($("colMore"), items);
  });
  function renameCollection(id) {
    const c = state.collections.find((x) => x.id === id);
    if (!c) return;
    const v = window.prompt("Collection name", c.name);
    if (v && v.trim()) { c.name = v.trim(); save(); openCollection(id); }
  }
  function confirmDeleteCollection(id) {
    const c = state.collections.find((x) => x.id === id);
    if (!c) return;
    openConfirm('Delete “' + c.name + '”? The songs stay in your library.', () => {
      state.collections = state.collections.filter((x) => x.id !== id);
      state.music.forEach((t) => { t.collections = t.collections.filter((cid) => cid !== id); });
      save(); showLibrary();
    });
  }

  /* =========================================================
     PLAYER
     ========================================================= */
  const mini = $("mini");
  const miniBarFill = $("miniBarFill");
  const miniTitle = $("miniTitle");
  const miniSub = $("miniSub");
  const miniPlayIcon = $("miniPlayIcon");
  const full = $("full");
  const fullArt = $("fullArt");
  const fullTitle = $("fullTitle");
  const fullSub = $("fullSub");
  const fullFill = $("fullFill");
  const fullKnob = $("fullKnob");
  const fullCur = $("fullCur");
  const fullDur = $("fullDur");
  const fullPlayIcon = $("fullPlayIcon");

  const sheetTitle = $("addSheetTitle");
  const sheetDetails = $("addDetails");
  const sheetDetailsList = $("addDetailsList");
  const sheetTargets = $("addTargets");
  const sheetNewCol = $("newColWrap");
  const sheetConfirm = $("addSheetConfirm");
  const sheetBack = $("addSheetBack");

  let pendingSeekId = null, pendingSeekTime = 0;

  function playTrack(id) {
    const url = urls[id];
    if (!url) { showToast("This track can't be played", "OK", () => {}); return; }
    currentId = id;
    audio.src = url;
    pendingSeekId = id;
    pendingSeekTime = state.positions[id] || 0;
    audio.play().then(() => {
      isPlaying = true;
      pushRecent(id);
      updateUI();
    }).catch(() => { isPlaying = false; updateUI(); });
  }
  function togglePlay() {
    if (!currentId) { if (state.music.length) playTrack(state.music[0].id); return; }
    if (audio.paused) audio.play().then(() => { isPlaying = true; updateUI(); }).catch(() => {});
    else audio.pause();
  }
  function step(dir) {
    if (!state.music.length) return;
    let idx = state.music.findIndex((t) => t.id === currentId);
    if (state.shuffle && dir > 0) {
      if (state.music.length === 1) { playTrack(state.music[0].id); return; }
      let n; do { n = Math.floor(Math.random() * state.music.length); } while (n === idx);
      playTrack(state.music[n].id); return;
    }
    if (idx < 0) idx = 0; else idx = (idx + dir + state.music.length) % state.music.length;
    playTrack(state.music[idx].id);
  }
  function pushRecent(id) {
    state.recentlyPlayed = [id].concat(state.recentlyPlayed.filter((x) => x !== id)).slice(0, 12);
    save();
  }

  /* player control wiring */
  $("miniPlay").addEventListener("click", togglePlay);
  $("miniPrev").addEventListener("click", () => { if (audio.currentTime > 3) { audio.currentTime = 0; } else step(-1); });
  $("miniNext").addEventListener("click", () => step(1));
  $("miniArt").addEventListener("click", openFull);
  mini.querySelector(".mini__info").addEventListener("click", openFull);
  mini.addEventListener("click", (e) => { if (e.target.closest(".mini__btn")) return; openFull(); });

  $("fullPlay").addEventListener("click", togglePlay);
  $("fullPrev").addEventListener("click", () => { if (audio.currentTime > 3) { audio.currentTime = 0; } else step(-1); });
  $("fullNext").addEventListener("click", () => step(1));
  $("fullShuffle").addEventListener("click", () => { state.shuffle = !state.shuffle; $("fullShuffle").classList.toggle("is-on", state.shuffle); save(); });
  $("fullRepeat").addEventListener("click", () => { state.repeat = !state.repeat; $("fullRepeat").classList.toggle("is-on", state.repeat); save(); });
  $("fullMin").addEventListener("click", closeFull);
  $("fullClose").addEventListener("click", closeFull);
  $("fullVol").addEventListener("input", () => {
    audio.volume = parseFloat($("fullVol").value); audio.muted = false; state.volume = audio.volume; save();
  });

  function openFull() {
    if (!currentId) return;
    full.hidden = false;
    requestAnimationFrame(() => full.classList.add("is-open"));
    $("fullShuffle").classList.toggle("is-on", state.shuffle);
    $("fullRepeat").classList.toggle("is-on", state.repeat);
    updatePlayerArt();
  }
  function closeFull() {
    full.classList.remove("is-open");
    setTimeout(() => { if (!full.classList.contains("is-open")) full.hidden = true; }, 340);
  }

  /* seeking */
  function seekFromEvent(bar, clientX) {
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    if (isFinite(audio.duration) && audio.duration) audio.currentTime = ratio * audio.duration;
    fullFill.style.width = (ratio * 100) + "%";
  }
  let seeking = false;
  const fullBar = $("fullBar");
  fullBar.addEventListener("pointerdown", (e) => { seeking = true; fullBar.setPointerCapture(e.pointerId); seekFromEvent(fullBar, e.clientX); });
  fullBar.addEventListener("pointermove", (e) => { if (seeking) seekFromEvent(fullBar, e.clientX); });
  fullBar.addEventListener("pointerup", () => { seeking = false; });
  fullBar.addEventListener("keydown", (e) => {
    if (!isFinite(audio.duration)) return;
    if (e.key === "ArrowRight") { audio.currentTime = Math.min(audio.duration, audio.currentTime + 5); e.preventDefault(); }
    if (e.key === "ArrowLeft") { audio.currentTime = Math.max(0, audio.currentTime - 5); e.preventDefault(); }
  });

  /* audio events */
  audio.addEventListener("timeupdate", () => {
    if (seeking) return;
    const d = audio.duration || 0;
    const ratio = d ? (audio.currentTime / d) : 0;
    fullFill.style.width = (ratio * 100) + "%";
    fullKnob.style.left = (ratio * 100) + "%";
    miniBarFill.style.width = (ratio * 100) + "%";
    fullCur.textContent = fmtTime(audio.currentTime);
    fullBar.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
  });
  audio.addEventListener("loadedmetadata", () => {
    fullDur.textContent = fmtTime(audio.duration);
    if (pendingSeekId && pendingSeekId === currentId && pendingSeekTime > 2 && pendingSeekTime < (audio.duration || 0) - 2) {
      audio.currentTime = pendingSeekTime;
    }
    pendingSeekId = null; pendingSeekTime = 0;
  });
  audio.addEventListener("play", () => { isPlaying = true; updateUI(); });
  audio.addEventListener("pause", () => { isPlaying = false; if (currentId) state.positions[currentId] = audio.currentTime; save(); updateUI(); });
  audio.addEventListener("ended", () => {
    if (state.repeat) { audio.currentTime = 0; audio.play().catch(() => {}); return; }
    const idx = state.music.findIndex((t) => t.id === currentId);
    if (state.shuffle) { step(1); return; }
    if (idx === state.music.length - 1) { audio.pause(); audio.currentTime = 0; updateUI(); return; }
    step(1);
  });

  function trackSub(t) {
    if (!t) return "Nothing playing";
    const cols = (t.collections || []).map((cid) => state.collections.find((c) => c.id === cid)).filter(Boolean);
    return cols.length ? cols.map((c) => c.name).join(", ") : (t.file || "Unknown artist");
  }
  function updateUI() {
    const t = state.music.find((x) => x.id === currentId);
    const sub = trackSub(t);
    miniTitle.textContent = t ? t.name : "—";
    miniSub.textContent = sub;
    fullTitle.textContent = t ? t.name : "—";
    fullSub.textContent = sub;
    setIcon(miniPlayIcon, isPlaying);
    setIcon(fullPlayIcon, isPlaying);
    updateTrackStates();
    updatePlayerArt();
    updateMiniVisibility();
  }
  function updatePlayerArt() {
    const t = state.music.find((x) => x.id === currentId);
    const has = !!(t && t.artwork);
    if (miniArtImg) { miniArtImg.src = has ? t.artwork : ""; miniArtImg.hidden = !has; miniArtIcon.style.display = has ? "none" : ""; }
    if (fullArtImg) { fullArtImg.src = has ? t.artwork : ""; fullArtImg.hidden = !has; fullArtIcon.style.display = has ? "none" : ""; }
  }
  function updateArtDisplay(t) {
    if (!t) return;
    const rows = viewMusic.querySelectorAll(".track[data-id='" + t.id + "']");
    rows.forEach((row) => {
      const img = row.querySelector(".track__artimg");
      const svg = row.querySelector(".track__art svg");
      if (img && svg) {
        if (t.artwork) { img.src = t.artwork; img.hidden = false; svg.style.display = "none"; }
        else { img.hidden = true; svg.style.display = ""; }
      }
    });
  }
  function setIcon(el, playing) {
    el.innerHTML = playing
      ? '<path d="M8 5.5h3v13H8zM13 5.5h3v13h-3z"/>'
      : '<path d="M8 5.5v13l11-6.5z"/>';
    (el.closest("button") || el).setAttribute("aria-label", playing ? "Pause" : "Play");
  }
  function updateTrackStates() {
    viewMusic.querySelectorAll(".track").forEach((row) => {
      const id = row.dataset.id;
      row.classList.toggle("is-active", id === currentId);
      const pb = row.querySelector(".track__play");
      if (pb) pb.innerHTML = (id === currentId && isPlaying)
        ? '<span class="eq" aria-hidden="true"><span></span><span></span><span></span></span>'
        : '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>';
    });
  }
  function updateMiniVisibility() {
    if (currentId) { mini.hidden = false; requestAnimationFrame(() => mini.classList.remove("is-hidden")); }
    else { mini.classList.add("is-hidden"); setTimeout(() => { if (mini.classList.contains("is-hidden")) mini.hidden = true; }, 320); }
  }

  function removeTrack(id) {
    const idx = state.music.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const meta = state.music[idx];
    const blob = blobs[id] || null;
    pendingDeleteTrack = { meta, idx, blob };
    const row = viewMusic.querySelector(`.track[data-id="${id}"]`);
    if (row) row.classList.add("is-leaving");
    const finish = () => {
      const i = state.music.findIndex((t) => t.id === id);
      if (i >= 0) state.music.splice(i, 1);
      state.music.forEach((t) => { t.collections = t.collections.filter((cid) => cid !== id); });
      state.recentlyPlayed = state.recentlyPlayed.filter((x) => x !== id);
      if (currentId === id) { audio.pause(); audio.removeAttribute("src"); currentId = null; isPlaying = false; }
      try { idbDel(id); } catch (e) {}
      if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; }
      delete blobs[id];
      save();
      afterMusicChange();
      updateUI();
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) finish(); else setTimeout(finish, 340);
    showToast("Track removed", "Undo", () => {
      if (!pendingDeleteTrack) return;
      const { meta: m, idx: i, blob: b } = pendingDeleteTrack;
      state.music.splice(Math.min(i, state.music.length), 0, m);
      if (b) { blobs[m.id] = b; urls[m.id] = URL.createObjectURL(b); try { idbPut({ id: m.id, name: m.file, type: m.type, blob: b }); } catch (e) {} }
      pendingDeleteTrack = null;
      save(); afterMusicChange(); updateUI();
    });
  }

  /* =========================================================
     POPOVER
     ========================================================= */
  let popEl = null, popHandler = null;
  function openPop(anchor, items) {
    closePop();
    popEl = document.createElement("div");
    popEl.className = "pop";
    items.forEach((it) => {
      const b = document.createElement("button");
      b.className = "pop__item" + (it.danger ? " danger" : "");
      b.innerHTML = (it.icon || "") + "<span>" + escapeHtml(it.label) + "</span>";
      b.addEventListener("click", () => { closePop(); it.onSelect && it.onSelect(); });
      popEl.appendChild(b);
    });
    document.body.appendChild(popEl);
    const r = anchor.getBoundingClientRect();
    const pw = 210;
    let left = Math.min(window.innerWidth - pw - 8, r.right - pw);
    if (left < 8) left = 8;
    let top = r.bottom + 6;
    popEl.style.left = left + "px";
    popEl.style.top = top + "px";
    requestAnimationFrame(() => {
      const pr = popEl.getBoundingClientRect();
      if (pr.bottom > window.innerHeight - 8) popEl.style.top = (r.top - pr.height - 6) + "px";
      popEl.classList.add("is-open");
    });
    popHandler = (e) => { if (popEl && !popEl.contains(e.target) && e.target !== anchor) closePop(); };
    setTimeout(() => document.addEventListener("pointerdown", popHandler), 0);
  }
  function closePop() {
    if (popEl) { popEl.remove(); popEl = null; }
    if (popHandler) { document.removeEventListener("pointerdown", popHandler); popHandler = null; }
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closePop();
    if (!full.hidden && full.classList.contains("is-open")) closeFull();
    const d = $("confirm");
    if (!d.hidden && d.classList.contains("is-open")) { d.classList.remove("is-open"); setTimeout(() => { d.hidden = true; }, 320); }
  });

  /* =========================================================
     CONFIRM DIALOG
     ========================================================= */
  function openConfirm(text, onOk) {
    const d = $("confirm");
    $("confirmText").textContent = text;
    d.hidden = false;
    requestAnimationFrame(() => d.classList.add("is-open"));
    const ok = () => { d.classList.remove("is-open"); setTimeout(() => { d.hidden = true; }, 320); onOk && onOk(); };
    const cancel = () => { d.classList.remove("is-open"); setTimeout(() => { d.hidden = true; }, 320); };
    $("confirmOk").onclick = ok;
    $("confirmCancel").onclick = cancel;
    $("confirmScrim").onclick = cancel;
  }

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
  toastUndo.addEventListener("click", () => { if (toastAction) toastAction(); hideToast(); });

  /* =========================================================
     NAVIGATION
     ========================================================= */
  function setHeader(view) {
    const map = {
      habits: { eyebrow: fmtDate(TODAY), title: "Today's Habits" },
      note: { eyebrow: fmtDate(TODAY), title: "Today's Note" },
      music: { eyebrow: "Your sounds", title: "Music" },
    };
    const m = map[view];
    $("eyebrow").textContent = m.eyebrow;
    $("title").textContent = m.title;
  }

  function showView(view) {
    if (view === currentView) return;
    if (currentView === "note") { document.body.classList.remove("is-typing"); editor.blur(); }
    if (currentView === "music") showLibrary();
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
    if (view === "music") { if (currentColId) showLibrary(); else renderLibrary(); }
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
    else if (e.key === "3") showView("music");
    else if (e.key === "n" || e.key === "N") { showView("note"); setTimeout(() => editor.focus(), 60); }
    else if (e.key === "m" || e.key === "M") showView("music");
  });

  /* =========================================================
     INIT
     ========================================================= */
  async function init() {
    const params = new URLSearchParams(location.search);
    if (params.get("theme") === "dark" || params.get("theme") === "light") state.theme = params.get("theme");
    if (params.get("accent") === "warm" || params.get("accent") === "cool") state.accent = params.get("accent");
    if (params.get("view") === "note" || params.get("view") === "music" || params.get("view") === "habits") currentView = params.get("view");

    applyThemeChrome();
    setHeader(currentView);
    setGreeting();
    updateAvatar();
    renderHabits();
    loadNote();

    try { await loadMusic(); } catch (e) {}

    if (currentView === "music") renderLibrary();
    updateUI();

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
