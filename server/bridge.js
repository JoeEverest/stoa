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
  function esc(s) { return String(s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function render(slot, v) {
    var state = v.video_status;
    if (slot.getAttribute("data-learn-state") === state) return;
    slot.setAttribute("data-learn-state", state);
    var w = "/w/" + encodeURIComponent(topic) + "/";
    if (state === "ready") {
      // Without a poster, "#t=0.1" makes the browser show the first frame instead of a black box.
      var poster = v.video_poster ? ' poster="' + w + esc(v.video_poster) + '"' : "";
      var src = w + esc(v.video_file) + (v.video_poster ? "" : "#t=0.1");
      slot.innerHTML =
        '<div class="learn-video">' +
          '<video class="learn-video-player" preload="metadata" playsinline src="' + src + '"' + poster + "></video>" +
          '<button class="learn-video-start" type="button" aria-label="Play the video">' +
            '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>' +
          "</button>" +
        "</div>" +
        '<p class="learn-video-caption">Narrated explainer by Athena<span class="learn-video-length"></span></p>';
      var video = slot.querySelector("video");
      var start = slot.querySelector(".learn-video-start");
      video.addEventListener("loadedmetadata", function () {
        if (!isFinite(video.duration)) return;
        var t = Math.round(video.duration), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, "0");
        slot.querySelector(".learn-video-length").textContent = " · " + mm + ":" + ss;
      });
      start.addEventListener("click", function () {
        slot.querySelector(".learn-video").classList.add("is-started");
        video.controls = true;
        video.play();
        video.focus();
      });
    } else if (state === "failed") {
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
