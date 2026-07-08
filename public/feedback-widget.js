(function () {
  if (window.GlintPostFeedbackInitialized) return;
  window.GlintPostFeedbackInitialized = true;

  var scriptTag =
    document.currentScript ||
    document.querySelector('script[src*="feedback-widget.js"]');
  var apiKey = scriptTag ? scriptTag.getAttribute("data-api-key") : null;
  var formId = scriptTag ? scriptTag.getAttribute("data-form-id") : null;
  var embedMode = scriptTag ? scriptTag.getAttribute("data-mode") : null;

  if (!apiKey) {
    console.error(
      "GlintPost Feedback Widget: Missing data-api-key attribute on the script tag."
    );
    return;
  }

  // --- Shared badge registry for stacking ---
  if (!window.__glintpost_badges) window.__glintpost_badges = [];
  if (!window.__glintpost_tabs) window.__glintpost_tabs = [];

  var isTabMode = embedMode === "tab";

  var clientConfig = window.GlintPostConfig || {};
  var consentGranted = clientConfig.consent !== false; // default: true

  var queryParams = new URLSearchParams({
    apiKey: apiKey,
    visitorId: clientConfig.visitorId || "",
    datalayer: clientConfig.datalayer
      ? JSON.stringify(clientConfig.datalayer)
      : "",
  });
  if (formId) {
    queryParams.set("formId", formId);
  }

  var BASE_URL = new URL(scriptTag.src).origin;
  var iframeUrl = BASE_URL + "/survey?" + queryParams.toString();

  // --- Stacking logic ---
  var BADGE_SIZE = 56;
  var BADGE_GAP = 10;
  var BADGE_MARGIN = 24;
  var badgeIndex = window.__glintpost_badges.length;
  var badgeBottom = BADGE_MARGIN + badgeIndex * (BADGE_SIZE + BADGE_GAP);

  // --- Tab stacking ---
  var TAB_HEIGHT = 120;
  var TAB_GAP = 8;
  var TAB_TOP_START = 200;
  var tabIndex = window.__glintpost_tabs.length;
  var tabTop = TAB_TOP_START + tabIndex * (TAB_HEIGHT + TAB_GAP);

  var style = document.createElement("style");

  if (isTabMode) {
    style.innerHTML =
      ".glintpost-feedback-tab {" +
      "  position: fixed;" +
      "  top: " + tabTop + "px;" +
      "  right: 0;" +
      "  width: 36px;" +
      "  padding: 12px 0;" +
      "  background-color: hsl(152, 69%, 41%);" +
      "  border-radius: 8px 0 0 8px;" +
      "  cursor: pointer;" +
      "  box-shadow: -2px 2px 8px rgba(0, 0, 0, 0.15);" +
      "  z-index: 2147483647;" +
      "  display: flex;" +
      "  align-items: center;" +
      "  justify-content: center;" +
      "  writing-mode: vertical-rl;" +
      "  text-orientation: mixed;" +
      "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;" +
      "  font-size: 12px;" +
      "  font-weight: 600;" +
      "  color: white;" +
      "  letter-spacing: 0.5px;" +
      "  transition: width 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s;" +
      "  user-select: none;" +
      "}" +
      ".glintpost-feedback-tab:hover {" +
      "  width: 42px;" +
      "  box-shadow: -4px 2px 12px rgba(0, 0, 0, 0.2);" +
      "}" +
      ".glintpost-feedback-container {" +
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
      ".glintpost-feedback-container.open {" +
      "  transform: translateX(0);" +
      "}" +
      ".glintpost-feedback-iframe {" +
      "  width: 100%;" +
      "  height: 100%;" +
      "  border: none;" +
      "}" +
      "@media (max-width: 480px) {" +
      "  .glintpost-feedback-container {" +
      "    width: 100vw;" +
      "  }" +
      "}";
    window.__glintpost_tabs.push("feedback");
  } else {
    style.innerHTML =
      ".glintpost-feedback-badge {" +
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
      ".glintpost-feedback-badge:hover {" +
      "  transform: scale(1.05);" +
      "  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);" +
      "}" +
      ".glintpost-feedback-badge svg {" +
      "  width: 26px;" +
      "  height: 26px;" +
      "  fill: none;" +
      "  stroke: white;" +
      "  stroke-width: 2;" +
      "  stroke-linecap: round;" +
      "  stroke-linejoin: round;" +
      "}" +
      ".glintpost-feedback-container {" +
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
      ".glintpost-feedback-container.open {" +
      "  transform: translateX(0);" +
      "}" +
      ".glintpost-feedback-iframe {" +
      "  width: 100%;" +
      "  height: 100%;" +
      "  border: none;" +
      "}" +
      "@media (max-width: 480px) {" +
      "  .glintpost-feedback-container {" +
      "    width: 100vw;" +
      "  }" +
      "}";
    window.__glintpost_badges.push("feedback");
  }

  document.head.appendChild(style);

  var trigger;
  if (isTabMode) {
    trigger = document.createElement("div");
    trigger.className = "glintpost-feedback-tab";
    trigger.textContent = "Feedback";
  } else {
    trigger = document.createElement("div");
    trigger.className = "glintpost-feedback-badge";
    // MessageSquare icon (matches sidebar)
    trigger.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
      '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>' +
      "</svg>";
  }

  var container = document.createElement("div");
  container.className = "glintpost-feedback-container";

  var iframe = document.createElement("iframe");
  iframe.className = "glintpost-feedback-iframe";
  iframe.src = "about:blank";
  container.appendChild(iframe);

  document.body.appendChild(trigger);
  document.body.appendChild(container);

  // Fetch config for badge color and theme
  fetch(BASE_URL + "/api/config", { headers: { "x-api-key": apiKey } })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (config) {
      if (config) {
        if (config.primaryColor) {
          trigger.style.backgroundColor = config.primaryColor;
          queryParams.set("primaryColor", config.primaryColor);
        }
        if (config.widgetTheme) {
          queryParams.set("theme", config.widgetTheme);
          iframe.style.background = config.widgetTheme === "dark" ? "hsl(224 71% 4%)" : "hsl(220 10% 98%)";
        }
        iframeUrl = BASE_URL + "/survey?" + queryParams.toString();
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

  trigger.addEventListener("click", function () {
    if (!consentGranted) return;
    loadIframeOnce();
    isOpen = !isOpen;
    if (isOpen) {
      // Defer class addition by two frames so the browser paints the initial
      // translateX(100%) state before transitioning to translateX(0).
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          container.classList.add("open");
        });
      });
    } else {
      container.classList.remove("open");
    }
  });

  window.addEventListener("message", function (event) {
    if (event.origin !== BASE_URL) return;
    if (event.data && event.data.type === "GLINTPOST_FEEDBACK_CLOSE") {
      isOpen = false;
      container.classList.remove("open");
    }
    if (event.data && event.data.type === "GLINTPOST_FEEDBACK_CONFIG" && event.data.primaryColor) {
      trigger.style.backgroundColor = event.data.primaryColor;
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
    if (trigger.parentNode) trigger.parentNode.removeChild(trigger);
    if (container.parentNode) container.parentNode.removeChild(container);
    consentGranted = false;
  };
})();
