(function () {
  if (window.GlintPostChangelogInitialized) return;
  window.GlintPostChangelogInitialized = true;

  var scriptTag =
    document.currentScript ||
    document.querySelector('script[src*="changelog-widget.js"]');
  var apiKey = scriptTag ? scriptTag.getAttribute("data-api-key") : null;
  var embedMode = scriptTag ? scriptTag.getAttribute("data-mode") : null;

  if (!apiKey) {
    console.error(
      "GlintPost Changelog Widget: Missing data-api-key attribute on the script tag."
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

  var BASE_URL = new URL(scriptTag.src).origin;
  var iframeUrl = BASE_URL + "/changelog?" + queryParams.toString();

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

  // --- Unread tracking ---
  var LAST_SEEN_KEY = "glintpost_changelog_last_seen";
  var unreadCount = 0;

  var style = document.createElement("style");

  if (isTabMode) {
    style.innerHTML =
      ".glintpost-changelog-tab {" +
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
      ".glintpost-changelog-tab:hover {" +
      "  width: 42px;" +
      "  box-shadow: -4px 2px 12px rgba(0, 0, 0, 0.2);" +
      "}" +
      ".glintpost-changelog-unread {" +
      "  position: absolute;" +
      "  top: -4px;" +
      "  left: -4px;" +
      "  min-width: 18px;" +
      "  height: 18px;" +
      "  background: #ef4444;" +
      "  color: white;" +
      "  font-size: 11px;" +
      "  font-weight: 700;" +
      "  border-radius: 9px;" +
      "  display: flex;" +
      "  align-items: center;" +
      "  justify-content: center;" +
      "  padding: 0 4px;" +
      "  writing-mode: horizontal-tb;" +
      "  text-orientation: initial;" +
      "  line-height: 1;" +
      "}" +
      ".glintpost-changelog-container {" +
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
      ".glintpost-changelog-container.open {" +
      "  transform: translateX(0);" +
      "}" +
      ".glintpost-changelog-iframe {" +
      "  width: 100%;" +
      "  height: 100%;" +
      "  border: none;" +
      "}" +
      "@media (max-width: 480px) {" +
      "  .glintpost-changelog-container {" +
      "    width: 100vw;" +
      "  }" +
      "}";
    window.__glintpost_tabs.push("changelog");
  } else {
    style.innerHTML =
      ".glintpost-changelog-badge {" +
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
      ".glintpost-changelog-badge:hover {" +
      "  transform: scale(1.05);" +
      "  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);" +
      "}" +
      ".glintpost-changelog-badge svg {" +
      "  width: 26px;" +
      "  height: 26px;" +
      "  fill: none;" +
      "  stroke: white;" +
      "  stroke-width: 2;" +
      "  stroke-linecap: round;" +
      "  stroke-linejoin: round;" +
      "}" +
      ".glintpost-changelog-unread {" +
      "  position: absolute;" +
      "  top: -2px;" +
      "  right: -2px;" +
      "  min-width: 20px;" +
      "  height: 20px;" +
      "  background: #ef4444;" +
      "  color: white;" +
      "  font-size: 11px;" +
      "  font-weight: 700;" +
      "  border-radius: 10px;" +
      "  display: flex;" +
      "  align-items: center;" +
      "  justify-content: center;" +
      "  padding: 0 5px;" +
      "  line-height: 1;" +
      "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;" +
      "}" +
      ".glintpost-changelog-container {" +
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
      ".glintpost-changelog-container.open {" +
      "  transform: translateX(0);" +
      "}" +
      ".glintpost-changelog-iframe {" +
      "  width: 100%;" +
      "  height: 100%;" +
      "  border: none;" +
      "}" +
      "@media (max-width: 480px) {" +
      "  .glintpost-changelog-container {" +
      "    width: 100vw;" +
      "  }" +
      "}";
    window.__glintpost_badges.push("changelog");
  }

  document.head.appendChild(style);

  var trigger;
  if (isTabMode) {
    trigger = document.createElement("div");
    trigger.className = "glintpost-changelog-tab";
    trigger.textContent = "Changelog";
  } else {
    trigger = document.createElement("div");
    trigger.className = "glintpost-changelog-badge";
    trigger.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
      '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/>' +
      '<path d="M14 2v5a1 1 0 0 0 1 1h5"/>' +
      '<path d="M10 9H8"/>' +
      '<path d="M16 13H8"/>' +
      '<path d="M16 17H8"/>' +
      "</svg>";
  }

  var unreadDot = document.createElement("span");
  unreadDot.className = "glintpost-changelog-unread";
  unreadDot.style.display = "none";
  trigger.style.position = trigger.style.position || "fixed";
  trigger.appendChild(unreadDot);

  var container = document.createElement("div");
  container.className = "glintpost-changelog-container";

  var iframe = document.createElement("iframe");
  iframe.className = "glintpost-changelog-iframe";
  iframe.src = "about:blank";
  container.appendChild(iframe);

  document.body.appendChild(trigger);
  document.body.appendChild(container);

  function updateUnreadBadge(count) {
    unreadCount = count;
    if (count > 0) {
      unreadDot.textContent = count > 9 ? "9+" : String(count);
      unreadDot.style.display = "flex";
    } else {
      unreadDot.style.display = "none";
    }
  }

  function markAsSeen() {
    try {
      localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
    } catch (e) {}
    updateUnreadBadge(0);
  }

  // Fetch account config and check for unread posts
  fetch(BASE_URL + "/api/config?apiKey=" + encodeURIComponent(apiKey))
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
        iframeUrl = BASE_URL + "/changelog?" + queryParams.toString();
      }
    })
    .catch(function () {});

  // Check for unread posts
  fetch(BASE_URL + "/api/changelog/posts", {
    headers: { "x-api-key": apiKey }
  })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (posts) {
      if (!posts || !posts.length) return;
      var lastSeen;
      try {
        lastSeen = localStorage.getItem(LAST_SEEN_KEY);
      } catch (e) {}
      if (!lastSeen) {
        // First visit — don't show a dot, just set the timestamp
        markAsSeen();
        return;
      }
      var lastSeenDate = new Date(lastSeen);
      var newPosts = posts.filter(function (p) {
        return new Date(p.createdAt) > lastSeenDate;
      });
      if (newPosts.length > 0) {
        updateUnreadBadge(newPosts.length);
      }
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
      iframe.contentWindow.postMessage({ type: "GLINTPOST_CHANGELOG_OPENED" }, BASE_URL);
    }
  }

  iframe.addEventListener("load", function () {
    if (isOpen) notifyOpened();
  });

  trigger.addEventListener("click", function () {
    if (!consentGranted) return;
    loadIframeOnce();
    isOpen = !isOpen;
    if (isOpen) {
      // Defer class addition by two frames so the browser paints the initial
      // translateX(100%) state before transitioning to translateX(0).
      // Without this, setting iframe.src and adding .open in the same sync
      // block causes the browser to batch both into one paint, skipping the
      // slide-in animation entirely.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          container.classList.add("open");
          notifyOpened();
          markAsSeen();
        });
      });
    } else {
      container.classList.remove("open");
    }
  });

  window.addEventListener("message", function (event) {
    if (event.origin !== BASE_URL) return;
    if (event.data && event.data.type === "GLINTPOST_CHANGELOG_CLOSE") {
      isOpen = false;
      container.classList.remove("open");
    }
    if (event.data && event.data.type === "GLINTPOST_CHANGELOG_CONFIG" && event.data.primaryColor) {
      trigger.style.backgroundColor = event.data.primaryColor;
    }
  });

  // --- Public API ---
  if (!window.GlintPost) window.GlintPost = {};

  window.GlintPost.consent = function (granted) {
    consentGranted = !!granted;
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
    } catch (e) {}
    // Remove DOM elements
    if (trigger.parentNode) trigger.parentNode.removeChild(trigger);
    if (container.parentNode) container.parentNode.removeChild(container);
    consentGranted = false;
  };
})();
