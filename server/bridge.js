// Injected by the server into every workspace HTML page, after /stoa/lesson.css.
// Contract: docs/ARCHITECTURE.md. Styles for the video area live in shared/lesson.css.
(function () {
  // ---- Theme: follow the app's choice (stored by the app under "stoa-theme"). ----
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function readPref() { try { return localStorage.getItem("stoa-theme") || "light"; } catch (e) { return "light"; } }
  function applyTheme() {
    var pref = readPref();
    var dark = pref === "dark" || (pref === "system" && media && media.matches);
    if (dark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
  }
  applyTheme();
  window.addEventListener("storage", function (e) { if (e.key === "stoa-theme") applyTheme(); });
  if (media && media.addEventListener) media.addEventListener("change", applyTheme);

  // ---- Page identity ----
  var tm = location.pathname.match(/^\/w\/([^/]+)\//);
  var m = location.pathname.match(/^\/w\/([^/]+)\/lessons\/([^/]+)\.html?$/);
  var topic = tm ? decodeURIComponent(tm[1]) : null;
  var lesson = m ? decodeURIComponent(m[2]) : null;
  var inApp = window.parent !== window;
  var base = topic && lesson ? "/api/topics/" + encodeURIComponent(topic) + "/lessons/" + encodeURIComponent(lesson) : null;

  function post(path, body) {
    if (!base) return Promise.reject(new Error("learn: this page is not a lesson"));
    return fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      if (!r.ok) throw new Error("learn: " + r.status);
      return r.json();
    });
  }

  function notifyParent(type, data) {
    try { window.parent.postMessage({ source: "learn", type: type, topic: topic, lesson: lesson, data: data }, location.origin); } catch (e) {}
  }

  window.learn = {
    topic: topic,
    lesson: lesson,
    submit: function (r) {
      if (!r || !r.itemId) return Promise.reject(new Error("learn.submit needs an itemId"));
      return post("/responses", r).then(function (res) { notifyParent("submit", r); return res; });
    },
    complete: function (c) {
      return post("/complete", c).then(function (res) { notifyParent("complete", c); return res; });
    },
    responses: function () {
      if (!base) return Promise.resolve([]);
      return fetch(base + "/responses").then(function (r) { return r.json(); });
    },
  };

  // ---- Keys the app owns: ⌘\ (Ctrl+\ elsewhere) shows or hides the sidebar, also while the lesson has focus. ----
  if (inApp) {
    var mac = /Mac|iPhone|iPad/.test(navigator.platform);
    document.addEventListener("keydown", function (e) {
      if (e.key === "\\" && (mac ? e.metaKey : e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        notifyParent("toggle-sidebar", null);
      }
    });
  }

  // ---- Links: inside the app, a link to another workspace page changes the app's view, so this
  // page stays loaded with the learner's work. External links open in a new tab. ----
  if (inApp && topic) {
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      var url = new URL(a.getAttribute("href"), location.href);
      if (url.origin !== location.origin) {
        if (/^https?:$/.test(url.protocol)) { e.preventDefault(); window.open(url.href, "_blank", "noopener"); }
        return;
      }
      var prefix = "/w/" + encodeURIComponent(topic) + "/";
      if (url.pathname === location.pathname || url.pathname.indexOf(prefix) !== 0) return;
      // Other pages, and the learner's own files (a citation such as uploads/notes.pdf#page=12).
      var isUpload = url.pathname.indexOf(prefix + "uploads/") === 0;
      if (!isUpload && !/\.html?$/.test(url.pathname)) return;
      e.preventDefault();
      notifyParent("navigate", { path: decodeURIComponent(url.pathname.slice(prefix.length)), hash: url.hash });
    });
  }

  // ---- Drafts: keep what the learner typed or picked in any field, across reloads. ----
  if (base) {
    var draftKey = "stoa-draft:" + topic + ":" + lesson;
    var fields = function () { return Array.prototype.slice.call(document.querySelectorAll("input, textarea, select")); };
    var fieldId = function (el, i) {
      if (el.id) return "#" + el.id;
      if (el.name && (el.type === "radio" || el.type === "checkbox")) return "@" + el.name + "=" + el.value;
      if (el.name) return "@" + el.name;
      return "%" + i;
    };
    var readDrafts = function () { try { return JSON.parse(localStorage.getItem(draftKey) || "{}"); } catch (e) { return {}; } };
    var saveDraft = function (e) {
      var el = e.target;
      if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.type === "password" || el.type === "file") return;
      var all = fields(), d = readDrafts();
      d[fieldId(el, all.indexOf(el))] = (el.type === "radio" || el.type === "checkbox") ? { checked: el.checked } : { value: el.value };
      if (el.type === "radio" && el.name) all.forEach(function (o, i) { if (o !== el && o.type === "radio" && o.name === el.name) d[fieldId(o, i)] = { checked: false }; });
      try { localStorage.setItem(draftKey, JSON.stringify(d)); } catch (err) {}
    };
    var restoreDrafts = function () {
      var d = readDrafts();
      fields().forEach(function (el, i) {
        var v = d[fieldId(el, i)];
        if (!v) return;
        if ("checked" in v) el.checked = v.checked;
        else if ("value" in v && !el.value) el.value = v.value;
      });
    };
    document.addEventListener("input", saveDraft, true);
    document.addEventListener("change", saveDraft, true);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", restoreDrafts);
    else restoreDrafts();
  }

  // ---- Video area: <div data-learn-video></div> ----
  // The app's own player. Before the first play: the poster, a play button and the length. Once
  // started, controls lie on the picture (seek, play/pause, time, speed, full screen, ⋯ with speed
  // and "Remake this video…") and rest out of sight while it plays. The same controls work in full
  // screen. While Athena remakes a video the old one stays playable, with a note.
  function esc(s) { return String(s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); }
  var ICON = {
    play: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
    // The big poster button: a softly rounded triangle whose centroid sits on the box's center,
    // so it looks centered in the circle without a nudge.
    playBig: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 6.9v10.2a1.2 1.2 0 0 0 1.8 1l8.7-5.1a1.2 1.2 0 0 0 0-2L10 5.9a1.2 1.2 0 0 0-1.8 1z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>',
    full: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/></svg>',
    more: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="3.5" cy="8" r="1.1" fill="currentColor"/><circle cx="8" cy="8" r="1.1" fill="currentColor"/><circle cx="12.5" cy="8" r="1.1" fill="currentColor"/></svg>',
  };
  var SPEEDS = [0.75, 1, 1.25, 1.5, 2];
  function savedSpeed() { try { var v = parseFloat(localStorage.getItem("stoa-video-speed")); return SPEEDS.indexOf(v) >= 0 ? v : 1; } catch (e) { return 1; } }

  function note(slot, v) {
    var el = slot.querySelector(".learn-video-note");
    if (!el) return;
    var text = v.video_status === "planned" ? "Athena is remaking this video. Keep watching this one; the new video replaces it here when it is ready."
      : v.video_status === "failed" ? "Athena could not make the new video" + (v.video_message ? ": " + v.video_message : ".") + " This is the earlier one."
      : "";
    el.textContent = text;
    el.hidden = !text;
    var remake = slot.querySelector(".learn-video-remake");
    if (remake) { remake.disabled = v.video_status === "planned"; remake.textContent = v.video_status === "planned" ? "Athena is remaking this video" : "Remake this video…"; }
  }

  function buildPlayer(slot, v, bust) {
    var w = "/w/" + encodeURIComponent(topic) + "/";
    var poster = v.video_poster ? ' poster="' + w + esc(v.video_poster) + (bust ? "?v=" + bust : "") + '"' : "";
    // Without a poster, "#t=0.1" makes the browser show the first frame instead of a black box.
    var src = w + esc(v.video_file) + (bust ? "?v=" + bust : "") + (v.video_poster ? "" : "#t=0.1");
    var speed = savedSpeed();
    slot.innerHTML =
      '<div class="learn-video">' +
        '<div class="learn-video-frame">' +
          '<video class="learn-video-player" preload="metadata" playsinline src="' + src + '"' + poster + "></video>" +
          '<button class="learn-video-big" type="button" aria-label="Play the video">' + ICON.playBig + "</button>" +
          '<span class="learn-video-length" aria-hidden="true"></span>' +
          '<div class="learn-video-controls">' +
            '<input class="learn-video-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Position in the video">' +
            '<div class="learn-video-row">' +
              '<button class="learn-video-icon learn-video-play" type="button" aria-label="Play the video">' + ICON.play + "</button>" +
              '<span class="learn-video-time" aria-live="off">0:00</span>' +
              '<span class="learn-video-spacer"></span>' +
              '<button class="learn-video-icon learn-video-speed" type="button" aria-label="Playback speed" title="Playback speed">' + speed + "×</button>" +
              '<button class="learn-video-icon learn-video-full" type="button" aria-label="Full screen" title="Full screen (F)">' + ICON.full + "</button>" +
              '<button class="learn-video-icon learn-video-more" type="button" aria-label="More video options" title="More" aria-haspopup="menu" aria-expanded="false">' + ICON.more + "</button>" +
            "</div>" +
          "</div>" +
        "</div>" +
        '<span class="learn-video-menu" role="menu" hidden>' +
          '<span class="learn-video-menu-label">Playback speed</span>' +
          '<span class="learn-video-speeds" role="group" aria-label="Playback speed">' +
            SPEEDS.map(function (x) { return '<button type="button" data-speed="' + x + '" aria-pressed="' + (x === speed) + '">' + x + "×</button>"; }).join("") +
          "</span>" +
          '<span class="learn-video-menu-sep"></span>' +
          '<button type="button" class="learn-video-menu-item learn-video-remake" role="menuitem">Remake this video…</button>' +
          '<form class="learn-video-remake-form" hidden>' +
            '<label>What should be better? <span>Optional. Athena reads this.</span>' +
            '<textarea rows="3" placeholder="For example: work through it with me step by step, and let me try first"></textarea></label>' +
            '<span class="learn-video-form-actions"><button type="button" class="btn btn-quiet learn-video-cancel">Cancel</button>' +
            '<button type="submit" class="btn btn-primary">Remake video</button></span>' +
          "</form>" +
        "</span>" +
      "</div>" +
      '<p class="learn-video-note" role="status" hidden></p>';

    var box = slot.querySelector(".learn-video"), frame = slot.querySelector(".learn-video-frame"), video = slot.querySelector("video");
    var play = slot.querySelector(".learn-video-play"), big = slot.querySelector(".learn-video-big"), seek = slot.querySelector(".learn-video-seek");
    var time = slot.querySelector(".learn-video-time"), length = slot.querySelector(".learn-video-length");
    var speedBtn = slot.querySelector(".learn-video-speed"), more = slot.querySelector(".learn-video-more");
    var menu = slot.querySelector(".learn-video-menu"), form = slot.querySelector(".learn-video-remake-form");
    video.playbackRate = speed;

    // The controls sit on the picture. While the video plays they fade out after a short rest and
    // come back when the pointer moves or a control has keyboard focus.
    var idleTimer = 0;
    function wake() {
      box.classList.remove("is-idle");
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () { if (!video.paused && menu.hidden && !box.contains(document.activeElement)) box.classList.add("is-idle"); }, 2500);
    }
    frame.addEventListener("pointermove", wake);
    frame.addEventListener("pointerleave", function () { if (!video.paused && menu.hidden) { clearTimeout(idleTimer); box.classList.add("is-idle"); } });
    box.addEventListener("focusin", wake);

    var lastLabel = "";
    function sync() {
      var d = video.duration, t = video.currentTime;
      var ready = isFinite(d) && d > 0;
      seek.value = ready ? String(Math.round((t / d) * 1000)) : "0";
      seek.style.setProperty("--p", ready ? (t / d) * 100 + "%" : "0%");
      time.textContent = ready ? fmt(t) + " / " + fmt(d) : "";
      length.textContent = ready ? fmt(d) : "";
      var playing = !video.paused && !video.ended;
      var label = playing ? "Pause" : "Play";
      if (label !== lastLabel) { // only when it changes, not on every time update
        lastLabel = label;
        play.innerHTML = playing ? ICON.pause : ICON.play;
        play.setAttribute("aria-label", playing ? "Pause the video" : "Play the video");
        play.title = (playing ? "Pause" : "Play") + " (Space)";
      }
      box.classList.toggle("is-started", t > 0 || playing);
      box.classList.toggle("is-playing", playing);
      box.classList.toggle("is-ended", video.ended);
      if (!playing) { clearTimeout(idleTimer); box.classList.remove("is-idle"); }
    }
    function toggle() { if (video.paused || video.ended) video.play(); else video.pause(); }
    function fullscreen() { if (document.fullscreenElement) document.exitFullscreen(); else if (box.requestFullscreen) box.requestFullscreen(); }
    ["loadedmetadata", "timeupdate", "play", "pause", "ended", "seeked"].forEach(function (ev) { video.addEventListener(ev, sync); });
    video.addEventListener("play", wake);
    play.addEventListener("click", toggle);
    big.addEventListener("click", function () { video.play(); play.focus({ preventScroll: true }); });
    video.addEventListener("click", function () { if (closedByClick) { closedByClick = false; return; } toggle(); });
    video.addEventListener("dblclick", fullscreen);
    seek.addEventListener("input", function () {
      if (isFinite(video.duration)) video.currentTime = (Number(seek.value) / 1000) * video.duration;
      sync();
    });
    slot.querySelector(".learn-video-full").addEventListener("click", fullscreen);
    // The speed button steps through the speeds; the ⋯ menu shows them all.
    function setSpeed(x) {
      video.playbackRate = x;
      speedBtn.textContent = x + "×";
      try { localStorage.setItem("stoa-video-speed", String(x)); } catch (e) {}
      slot.querySelectorAll("[data-speed]").forEach(function (o) { o.setAttribute("aria-pressed", String(parseFloat(o.getAttribute("data-speed")) === x)); });
    }
    speedBtn.addEventListener("click", function () { setSpeed(SPEEDS[(SPEEDS.indexOf(video.playbackRate) + 1) % SPEEDS.length] || 1); });
    // Keyboard on the player: space or K plays and pauses, the arrows move five seconds, F is full screen.
    slot.addEventListener("keydown", function (e) {
      if (e.target.closest("textarea, form")) return;
      var onButton = e.target.tagName === "BUTTON";
      if (e.key === "k" || (e.key === " " && !onButton)) { e.preventDefault(); toggle(); wake(); }
      else if (e.key === "f") { e.preventDefault(); fullscreen(); }
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        if (e.target === seek) return; // the range input moves itself
        e.preventDefault(); video.currentTime = Math.max(0, video.currentTime + (e.key === "ArrowRight" ? 5 : -5)); wake();
      }
    });

    function openMenu(open) {
      menu.hidden = !open;
      more.setAttribute("aria-expanded", String(open));
      if (!open) { form.hidden = true; slot.querySelector(".learn-video-remake").hidden = false; }
    }
    more.addEventListener("click", function () { openMenu(menu.hidden); });
    // A click outside the open menu only closes it: it does not also play or pause the video.
    var closedByClick = false;
    document.addEventListener("pointerdown", function (e) {
      if (!menu.hidden && !e.target.closest(".learn-video-menu, .learn-video-more")) { openMenu(false); closedByClick = e.target === video; }
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) { openMenu(false); more.focus(); } });
    slot.querySelectorAll("[data-speed]").forEach(function (b) {
      b.addEventListener("click", function () { setSpeed(parseFloat(b.getAttribute("data-speed"))); });
    });
    slot.querySelector(".learn-video-remake").addEventListener("click", function () {
      this.hidden = true; form.hidden = false; form.querySelector("textarea").focus();
    });
    slot.querySelector(".learn-video-cancel").addEventListener("click", function () { openMenu(false); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      post("/video/remake", { reason: form.querySelector("textarea").value }).then(function () {
        openMenu(false);
        note(slot, { video_status: "planned" });
        slot.setAttribute("data-learn-state", "planned");
        notifyParent("video-remake", null);
        setTimeout(poll, 3000);
      }).catch(function () {
        var n = slot.querySelector(".learn-video-note");
        n.textContent = "Stoa could not ask Athena for a new video. Try again in a moment.";
        n.hidden = false;
      }).finally(function () { submit.disabled = false; });
    });
    sync();
  }

  function render(slot, v) {
    var prev = slot.getAttribute("data-learn-state");
    var state = v.video_status;
    var file = v.video_file || "";
    if (file && (state === "ready" || state === "planned" || state === "failed")) {
      // A remake just finished (same path, new content): rebuild with a fresh URL. Otherwise keep
      // the player that is there, so a video the learner is watching does not restart.
      var remade = prev === "planned" && state === "ready";
      if (remade || slot.getAttribute("data-learn-file") !== file) buildPlayer(slot, v, remade ? Date.now() : 0);
      slot.setAttribute("data-learn-file", file);
      slot.setAttribute("data-learn-state", state);
      note(slot, v);
      return;
    }
    if (prev === state) return;
    slot.setAttribute("data-learn-state", state);
    slot.removeAttribute("data-learn-file");
    if (state === "failed") {
      slot.innerHTML = '<div class="learn-video-wait">Athena could not make the video for this lesson.<small>' + esc(v.video_message) + "</small></div>";
    } else if (state === "planned") {
      slot.innerHTML = '<div class="learn-video-wait" role="status"><span class="bar" aria-hidden="true"></span>' +
        "Athena is making the video for this lesson." +
        "<small>Read the lesson first. The video appears here when it is ready; long videos can take a while to render.</small></div>";
    } else {
      slot.innerHTML = "";
    }
  }

  function poll() {
    var slots = document.querySelectorAll("[data-learn-video]");
    if (!slots.length || !base) return;
    fetch(base).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
      if (!v) return;
      slots.forEach(function (s) { render(s, v); });
      if (v.video_status === "planned") setTimeout(poll, 5000);
    }).catch(function () { setTimeout(poll, 10000); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", poll);
  else poll();
})();
