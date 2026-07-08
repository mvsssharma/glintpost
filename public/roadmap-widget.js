(function () {
  if (window.GlintPostRoadmapInitialized) return;
  window.GlintPostRoadmapInitialized = true;

  var scriptTag =
    document.currentScript ||
    document.querySelector('script[src*="roadmap-widget.js"]');
  var apiKey = scriptTag ? scriptTag.getAttribute("data-api-key") : null;

  if (!apiKey) {
    console.error(
      "GlintPost Roadmap Widget: Missing data-api-key attribute on the script tag."
    );
    return;
  }

  // --- Shared badge registry for stacking ---
  if (!window.__glintpost_badges) window.__glintpost_badges = [];

  var clientConfig = window.GlintPostConfig || {};
  var consentGranted = clientConfig.consent !== false; // default: true

  var queryParams = new URLSearchParams({
    apiKey: apiKey,
    visitorId: clientConfig.visitorId || "",
  });

  var BASE_URL = new URL(scriptTag.src).origin;
  var iframeUrl = BASE_URL + "/board?" + queryParams.toString();

  // --- Stacking logic ---
  var BADGE_SIZE = 56;
  var BADGE_GAP = 10;
  var BADGE_MARGIN = 24;
  var badgeIndex = window.__glintpost_badges.length;
  var badgeBottom = BADGE_MARGIN + badgeIndex * (BADGE_SIZE + BADGE_GAP);

  window.__glintpost_badges.push("roadmap");

  var style = document.createElement("style");
  style.innerHTML =
    ".glintpost-roadmap-badge {" +
    "  position: fixed;" +
    "  bottom: " + badgeBottom + "px;" +
    "  right: 24px;" +
    "  width: 56px;" +
    "  height: 56px;" +
    "  background-color: hsl(152, 69%, 41%);" +
    "  border-radius: 50%;" +
    "  cursor: pointer;" +
    "  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);" +
    "  z-index: 2147483647;" +
    "  display: flex;" +
    "  align-items: center;" +
    "  justify-content: center;" +
    "  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s;" +
    "}" +
    ".glintpost-roadmap-badge:hover {" +
    "  transform: scale(1.05);" +
    "  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);" +
    "}" +
    ".glintpost-roadmap-badge svg {" +
    "  width: 28px;" +
    "  height: 28px;" +
    "  fill: white;" +
    "}" +
    ".glintpost-roadmap-container {" +
    "  position: fixed;" +
    "  top: 0;" +
    "  right: 0;" +
    "  width: 400px;" +
    "  height: 100vh;" +
    "  max-width: 100vw;" +
    "  background: transparent;" +
    "  z-index: 2147483646;" +
    "  transform: translateX(100%);" +
    "  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);" +
    "  box-shadow: -4px 0 24px rgba(0,0,0,0.1);" +
    "}" +
    ".glintpost-roadmap-container.open {" +
    "  transform: translateX(0);" +
    "}" +
    ".glintpost-roadmap-iframe {" +
    "  width: 100%;" +
    "  height: 100%;" +
    "  border: none;" +
    "}" +
    "@media (max-width: 480px) {" +
    "  .glintpost-roadmap-container {" +
    "    width: 100vw;" +
    "  }" +
    "}";
  document.head.appendChild(style);

  var badge = document.createElement("div");
  badge.className = "glintpost-roadmap-badge";
  // Lightbulb icon for roadmap/ideas
  badge.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
    '<path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 0 1 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/>' +
    "</svg>";

  var container = document.createElement("div");
  container.className = "glintpost-roadmap-container";

  var iframe = document.createElement("iframe");
  iframe.className = "glintpost-roadmap-iframe";
  iframe.src = "about:blank";
  container.appendChild(iframe);

  document.body.appendChild(badge);
  document.body.appendChild(container);

  // Fetch account config immediately to apply the correct badge color and theme
  fetch(BASE_URL + "/api/config", { headers: { "x-api-key": apiKey } })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (config) {
      if (config) {
        if (config.primaryColor) {
          badge.style.backgroundColor = config.primaryColor;
          queryParams.set("primaryColor", config.primaryColor);
        }
        if (config.widgetTheme) {
          queryParams.set("theme", config.widgetTheme);
          iframe.style.background = config.widgetTheme === "dark" ? "hsl(224 71% 4%)" : "hsl(220 10% 98%)";
        }
        iframeUrl = BASE_URL + "/board?" + queryParams.toString();
      }
      // Preload iframe after config so it's ready before user clicks
      loadIframeOnce();
    })
    .catch(function () {});

  var isOpen = false;
  var iframeLoaded = false;

  function loadIframeOnce() {
    if (iframeLoaded) return;
    iframeLoaded = true;
    iframe.src = iframeUrl;
  }

  function notifyOpened() {
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: "GLINTPOST_ROADMAP_OPENED" }, BASE_URL);
    }
  }

  iframe.addEventListener("load", function () {
    if (isOpen) notifyOpened();
  });

  badge.addEventListener("click", function () {
    if (!consentGranted) return;
    loadIframeOnce();
    isOpen = !isOpen;
    if (isOpen) {
      // Defer class addition by two frames so the browser paints the initial
      // translateX(100%) state before transitioning to translateX(0).
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          container.classList.add("open");
          notifyOpened();
        });
      });
    } else {
      container.classList.remove("open");
    }
  });

  window.addEventListener("message", function (event) {
    if (event.origin !== BASE_URL) return;
    if (event.data && event.data.type === "GLINTPOST_ROADMAP_CLOSE") {
      isOpen = false;
      container.classList.remove("open");
    }
    if (event.data && event.data.type === "GLINTPOST_ROADMAP_CONFIG" && event.data.primaryColor) {
      badge.style.backgroundColor = event.data.primaryColor;
    }
  });

  // --- Public API ---
  if (!window.GlintPost) window.GlintPost = {};

  var existingConsent = window.GlintPost.consent;
  window.GlintPost.consent = function (granted) {
    consentGranted = !!granted;
    if (typeof existingConsent === "function") existingConsent(granted);
  };

  window.GlintPost.destroy = function () {
    try {
      localStorage.removeItem("glintpost_visitor_id");
      localStorage.removeItem("glintpost_changelog_last_seen");
      localStorage.removeItem("glintpost_interactions");
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (key && key.indexOf("glintpost_feedback_") === 0) {
          localStorage.removeItem(key);
        }
      }
    } catch {}
    if (badge.parentNode) badge.parentNode.removeChild(badge);
    if (container.parentNode) container.parentNode.removeChild(container);
    consentGranted = false;
  };
})();
