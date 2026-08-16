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
        s.theme = s.theme || (prefersDark() ? "dark" : "light");
        s.accent = s.accent || "cool";
        s.avatar = s.avatar || "";
        s.music = s.music || [];
        s.volume = typeof s.volume === "number" ? s.volume : 1;
        return s;
      }
    } catch (e) {}
    const fresh = {
      habits: [], days: {}, theme: prefersDark() ? "dark" : "light", accent: "cool",
      avatar: "", music: [], volume: 1,
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
  }

  /* ---------- DOM refs ---------- */
  const $ = (id) => document.getElementById(id);
  const views = { habits: $("view-habits"), note: $("view-note"), music: $("view-music") };
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
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", state.theme === "dark" ? "#0e1116" : "#f7f9fc");
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
  }

  $("themeToggle").addEventListener("click", () => setTheme(state.theme === "dark" ? "light" : "dark"));

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
     AVATAR
     ========================================================= */
  const avatarBtn = $("avatarBtn");
  const avatarImg = $("avatarImg");
  const avatarPh = $("avatarPh");
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
    const open = avmenu.classList.contains("is-open");
    if (open) { closeAvMenu(); return; }
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
  const musicList = $("trackList");
  const addMusicBtn = $("addMusicBtn");
  const player = $("player");
  const musicInput = $("musicInput");
  const audio = new Audio();
  audio.volume = state.volume;

  const urls = {};            // id -> objectURL
  const blobs = {};           // id -> Blob (held for reliable undo)
  let currentId = null;
  let isPlaying = false;
  let pendingDeleteTrack = null;

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
        if (rec && rec.blob) urls[t.id] = URL.createObjectURL(rec.blob);
      } catch (e) { /* idb unavailable — track unplayable this session */ }
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

  function renderMusic() {
    const tracks = state.music;
    if (!tracks.length) {
      musicList.innerHTML = `
        <div class="empty">
          <p class="empty__title">Your music</p>
          <p class="empty__text">Add songs from your device to create your personal library.</p>
          <button class="btn btn--primary empty__btn" id="emptyAddMusic">Add music</button>
        </div>`;
      const ea = $("emptyAddMusic");
      if (ea) ea.addEventListener("click", () => musicInput.click());
    } else {
      musicList.innerHTML = tracks.map((t, i) => trackHTML(t, i)).join("");
    }
    updateTrackStates();
    updatePlayerVisibility();
  }

  function trackHTML(t, i) {
    const num = String(i + 1).padStart(2, "0");
    const active = t.id === currentId;
    return `
      <div class="track ${active ? "is-active" : ""}" data-id="${t.id}">
        <button class="track__play" aria-label="Play ${escapeHtml(t.name)}">
          ${active && isPlaying
            ? '<span class="eq" aria-hidden="true"><span></span><span></span><span></span></span>'
            : '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>'}
        </button>
        <div class="track__info">
          <div class="track__title">${escapeHtml(t.name)}</div>
          <div class="track__sub">${escapeHtml(t.file || t.name)}${t.duration ? " · " + fmtTime(t.duration) : ""}</div>
        </div>
        <button class="track__del" aria-label="Remove ${escapeHtml(t.name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 7h14M10 7V5h4v2M6.5 7l.7 12h9.6l.7-12"/></svg>
        </button>
      </div>`;
  }

  function updateTrackStates() {
    musicList.querySelectorAll(".track").forEach((row) => {
      const id = row.dataset.id;
      row.classList.toggle("is-active", id === currentId);
      const playBtn = row.querySelector(".track__play");
      if (playBtn) playBtn.innerHTML = (id === currentId && isPlaying)
        ? '<span class="eq" aria-hidden="true"><span></span><span></span><span></span></span>'
        : '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>';
    });
  }

  function updatePlayerUI() {
    const t = state.music.find((x) => x.id === currentId);
    if (!t) {
      $("playerTitle").textContent = "—";
      $("playerSub").textContent = "Nothing playing";
      $("playerFill").style.width = "0%";
      $("curTime").textContent = "0:00";
      $("durTime").textContent = "0:00";
      setPlayIcon(false);
      return;
    }
    $("playerTitle").textContent = t.name;
    $("playerSub").textContent = t.file || t.name;
    setPlayIcon(isPlaying);
  }

  function setPlayIcon(playing) {
    $("playIcon").innerHTML = playing
      ? '<path d="M8 5.5h3v13H8zM13 5.5h3v13h-3z"/>'
      : '<path d="M8 5.5v13l11-6.5z"/>';
    $("playBtn").setAttribute("aria-label", playing ? "Pause" : "Play");
  }

  function updatePlayerVisibility() {
    const show = currentView === "music" && state.music.length > 0;
    if (show) {
      player.hidden = false;
      requestAnimationFrame(() => player.classList.remove("is-hidden"));
    } else {
      player.classList.add("is-hidden");
      setTimeout(() => { if (player.classList.contains("is-hidden")) player.hidden = true; }, 320);
    }
  }

  async function addMusicFiles(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    for (const file of list) {
      const id = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const url = URL.createObjectURL(file);
      urls[id] = url;
      blobs[id] = file;
      const duration = await getDuration(url);
      const meta = { id, name: file.name.replace(/\.[^.]+$/, ""), file: file.name, duration, type: file.type };
      state.music.push(meta);
      try { await idbPut({ id, name: file.name, type: file.type, blob: file }); } catch (e) { /* persists this session only */ }
      save();
    }
    renderMusic();
  }

  function playTrack(id) {
    const url = urls[id];
    if (!url) { showToast("This track can't be played", "OK", () => {}); return; }
    currentId = id;
    audio.src = url;
    audio.play().then(() => {
      isPlaying = true;
      updateTrackStates();
      updatePlayerUI();
    }).catch(() => {
      isPlaying = false;
      updateTrackStates();
      updatePlayerUI();
    });
  }

  function togglePlay() {
    if (!currentId) {
      if (state.music.length) playTrack(state.music[0].id);
      return;
    }
    if (audio.paused) {
      audio.play().then(() => { isPlaying = true; updateTrackStates(); updatePlayerUI(); })
        .catch(() => {});
    } else {
      audio.pause();
    }
  }

  function step(dir) {
    if (!state.music.length) return;
    let idx = state.music.findIndex((t) => t.id === currentId);
    if (idx < 0) idx = 0; else idx = (idx + dir + state.music.length) % state.music.length;
    playTrack(state.music[idx].id);
  }

  /* music events */
  musicList.addEventListener("click", (e) => {
    const del = e.target.closest(".track__del");
    const row = e.target.closest(".track");
    if (!row) return;
    const id = row.dataset.id;
    if (del) { removeTrack(id, row); return; }
    if (e.target.closest(".track__play") || e.target.closest(".track__info")) {
      if (id === currentId) togglePlay(); else playTrack(id);
    }
  });

  addMusicBtn.addEventListener("click", () => musicInput.click());
  musicInput.addEventListener("change", () => {
    addMusicFiles(musicInput.files);
    musicInput.value = "";
  });

  $("playBtn").addEventListener("click", togglePlay);
  $("nextBtn").addEventListener("click", () => step(1));
  $("prevBtn").addEventListener("click", () => {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    step(-1);
  });
  $("volBtn").addEventListener("click", () => {
    audio.muted = !audio.muted;
    $("volIcon").innerHTML = audio.muted
      ? '<path d="M4 9v6h4l5 4V5L8 9zM16 9l5 5M21 9l-5 5"/>'
      : '<path d="M4 9v6h4l5 4V5L8 9zM16 8.5a4 4 0 0 1 0 7M18.5 6a7 7 0 0 1 0 12"/>';
  });
  $("volRange").addEventListener("input", () => {
    audio.volume = parseFloat($("volRange").value);
    audio.muted = false;
    state.volume = audio.volume;
    save();
  });

  /* seek bar */
  const bar = $("playerBar");
  function seekFromEvent(clientX) {
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    if (isFinite(audio.duration) && audio.duration) audio.currentTime = ratio * audio.duration;
    $("playerFill").style.width = (ratio * 100) + "%";
  }
  let seeking = false;
  bar.addEventListener("pointerdown", (e) => { seeking = true; bar.setPointerCapture(e.pointerId); seekFromEvent(e.clientX); });
  bar.addEventListener("pointermove", (e) => { if (seeking) seekFromEvent(e.clientX); });
  bar.addEventListener("pointerup", () => { seeking = false; });
  bar.addEventListener("keydown", (e) => {
    if (!isFinite(audio.duration)) return;
    if (e.key === "ArrowRight") { audio.currentTime = Math.min(audio.duration, audio.currentTime + 5); e.preventDefault(); }
    if (e.key === "ArrowLeft") { audio.currentTime = Math.max(0, audio.currentTime - 5); e.preventDefault(); }
  });

  /* audio element events */
  audio.addEventListener("timeupdate", () => {
    if (seeking) return;
    const d = audio.duration || 0;
    const ratio = d ? (audio.currentTime / d) : 0;
    $("playerFill").style.width = (ratio * 100) + "%";
    $("curTime").textContent = fmtTime(audio.currentTime);
    bar.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
  });
  audio.addEventListener("loadedmetadata", () => {
    $("durTime").textContent = fmtTime(audio.duration);
  });
  audio.addEventListener("play", () => { isPlaying = true; updateTrackStates(); updatePlayerUI(); });
  audio.addEventListener("pause", () => { isPlaying = false; updateTrackStates(); updatePlayerUI(); });
  audio.addEventListener("ended", () => {
    const idx = state.music.findIndex((t) => t.id === currentId);
    if (idx === state.music.length - 1) { audio.pause(); audio.currentTime = 0; updateTrackStates(); updatePlayerUI(); return; }
    step(1);
  });

  function removeTrack(id, row) {
    const idx = state.music.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const meta = state.music[idx];
    const blob = blobs[id] || null;
    pendingDeleteTrack = { meta, idx, blob };
    row.classList.add("is-leaving");
    const finish = () => {
      const i = state.music.findIndex((t) => t.id === id);
      if (i >= 0) state.music.splice(i, 1);
      if (currentId === id) { audio.pause(); audio.removeAttribute("src"); currentId = null; isPlaying = false; }
      try { idbDel(id); } catch (e) {}
      if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; }
      delete blobs[id];
      save();
      renderMusic();
      updatePlayerUI();
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) finish(); else setTimeout(finish, 340);
    showToast("Track removed", "Undo", () => {
      if (!pendingDeleteTrack) return;
      const { meta: m, idx: i, blob: b } = pendingDeleteTrack;
      state.music.splice(Math.min(i, state.music.length), 0, m);
      if (b) {
        blobs[m.id] = b;
        try { idbPut({ id: m.id, name: m.file, type: m.type, blob: b }); } catch (e) {}
        if (!urls[m.id]) urls[m.id] = URL.createObjectURL(b);
      }
      pendingDeleteTrack = null;
      save();
      renderMusic();
    });
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
    if (view === "music") { renderMusic(); }
    if (view === "habits") renderHabits();
    updatePlayerVisibility();
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

    navItems.forEach((n) => {
      const active = n.dataset.view === currentView;
      n.classList.toggle("is-active", active);
      if (active) n.setAttribute("aria-current", "page");
    });

    if (currentView === "music") renderMusic();
    if (currentView === "note") loadNote();
    updatePlayerUI();
    updatePlayerVisibility();

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
