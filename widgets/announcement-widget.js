// SOURCE for public/announcement-widget.js — bundled by scripts/build-widgets.mjs.
// The targeting matcher is imported from lib/attributes.ts (single source of truth).
import { matchesTargeting as matchTargeting } from "../lib/attributes";

(function () {
  if (window.GlintPostAnnouncementInitialized) return;
  window.GlintPostAnnouncementInitialized = true;

  var scriptTag =
    document.currentScript ||
    document.querySelector('script[src*="announcement-widget.js"]');
  var apiKey = scriptTag ? scriptTag.getAttribute("data-api-key") : null;

  if (!apiKey) {
    console.error(
      "GlintPost Announcement Widget: Missing data-api-key attribute on the script tag."
    );
    return;
  }

  var clientConfig = window.GlintPostConfig || {};
  var visitorDatalayer = clientConfig.datalayer || null;
  var previewShowAll = clientConfig.previewShowAll === true; // dashboard preview: show all regardless of targeting
  var visitorId = clientConfig.visitorId || null;
  var consentGranted = clientConfig.consent !== false; // default: true

  var BASE_URL = new URL(scriptTag.src).origin;
  var SESSION_KEY = "glintpost_ann_session";
  var SEEN_KEY = "glintpost_ann_seen";
  var SESSION_TIMEOUT = 30 * 60 * 1000;

  // --- Session check ---
  function isSessionActive() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      var session = JSON.parse(raw);
      return session.shown && (Date.now() - session.timestamp < SESSION_TIMEOUT);
    } catch {
      return false;
    }
  }

  function markSessionShown() {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ timestamp: Date.now(), shown: true }));
    } catch {}
  }

  function getSeenIds() {
    try {
      var raw = localStorage.getItem(SEEN_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function markSeen(id) {
    try {
      var seen = getSeenIds();
      if (seen.indexOf(id) === -1) seen.push(id);
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {}
  }

  // --- Targeting ---
  // previewShowAll is a dashboard-preview override; otherwise defer to the
  // shared matcher (null/empty targeting → shown; targeted w/o datalayer → hidden).
  function matchesTargeting(announcement) {
    if (previewShowAll) return true;
    return matchTargeting(announcement.targeting || null, visitorDatalayer);
  }

  // --- Visitor ID ---
  function getVisitorId() {
    if (visitorId) return visitorId;
    var stored = null;
    try { stored = localStorage.getItem("glintpost_visitor_id"); } catch {}
    if (stored) return stored;
    var id;
    try {
      id = "v_" + crypto.randomUUID();
    } catch {
      id = "v_" + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    }
    try { localStorage.setItem("glintpost_visitor_id", id); } catch {}
    return id;
  }

  // --- Track event ---
  function trackEvent(type, announcementId) {
    var vid = getVisitorId();
    var payload = {
      type: type,
      announcementId: announcementId,
      visitorId: vid,
    };
    if (visitorDatalayer) payload.datalayer = visitorDatalayer;

    fetch(BASE_URL + "/api/announcements/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    }).catch(function () {});
  }

  // --- Fetch and show ---
  var primaryColor = "#10b981";
  var widgetTheme = "light";
  var initialized = false;

  // Nothing (visitor ID creation, tracking, fetching) runs until consent is
  // granted. Mirrors changelog/roadmap/feedback widgets' consent-first design.
  function init() {
    if (initialized || !consentGranted) return;
    initialized = true;

    if (isSessionActive()) return;

    fetch(BASE_URL + "/api/config", { headers: { "x-api-key": apiKey } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (config) {
        if (config) {
          if (config.primaryColor) primaryColor = config.primaryColor;
          if (config.widgetTheme) widgetTheme = config.widgetTheme;
        }
        return fetch(BASE_URL + "/api/announcements/active", {
          headers: { "x-api-key": apiKey },
        });
      })
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(function (announcements) {
        if (!announcements || !announcements.length) return;

        var seenIds = getSeenIds();
        var candidates = announcements
          .filter(matchesTargeting)
          .filter(function (a) { return seenIds.indexOf(a.id) === -1; });

        if (!candidates.length) return;

        // Already sorted by priority desc from API
        var announcement = candidates[0];
        render(announcement);
      })
      .catch(function () {});
  }

  init();

  function render(announcement) {
    var isOverlay = announcement.displayType !== "TOP_BANNER";
    var isDark = widgetTheme === "dark";

    var style = document.createElement("style");
    var bgColor = isDark ? "#1a1a2e" : "#ffffff";
    var textColor = isDark ? "#e2e8f0" : "#1a202c";
    var mutedColor = isDark ? "#94a3b8" : "#64748b";

    if (isOverlay) {
      style.innerHTML =
        ".glintpost-announcement-overlay {" +
        "  position: fixed; top: 0; left: 0; width: 100%; height: 100%;" +
        "  background: rgba(0,0,0,0.6); z-index: 2147483647;" +
        "  display: flex; align-items: center; justify-content: center;" +
        "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;" +
        "  animation: glintpost-ann-fadein 0.3s ease;" +
        "}" +
        "@keyframes glintpost-ann-fadein { from { opacity: 0; } to { opacity: 1; } }" +
        "@keyframes glintpost-ann-slidein { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }" +
        ".glintpost-announcement-card {" +
        "  background: " + bgColor + "; color: " + textColor + ";" +
        "  border-radius: 16px; max-width: 520px; width: 90%; max-height: 85vh;" +
        "  overflow-y: auto; position: relative; box-shadow: 0 25px 50px rgba(0,0,0,0.25);" +
        "  animation: glintpost-ann-slidein 0.4s cubic-bezier(0.16, 1, 0.3, 1);" +
        "}" +
        ".glintpost-announcement-close {" +
        "  position: absolute; top: 12px; right: 12px; width: 32px; height: 32px;" +
        "  border: none; background: rgba(0,0,0,0.08); border-radius: 50%;" +
        "  cursor: pointer; display: flex; align-items: center; justify-content: center;" +
        "  font-size: 18px; color: " + mutedColor + "; z-index: 1;" +
        "  transition: background 0.2s;" +
        "}" +
        ".glintpost-announcement-close:hover { background: rgba(0,0,0,0.15); }" +
        ".glintpost-announcement-media { width: 100%; max-height: 260px; object-fit: cover; border-radius: 16px 16px 0 0; display: block; }" +
        ".glintpost-announcement-video { width: 100%; border-radius: 16px 16px 0 0; display: block; }" +
        ".glintpost-announcement-body { padding: 24px 28px 28px; }" +
        ".glintpost-announcement-title { font-size: 22px; font-weight: 700; margin: 0 0 12px; line-height: 1.3; }" +
        ".glintpost-announcement-content { font-size: 15px; line-height: 1.6; color: " + mutedColor + "; margin: 0 0 20px; }" +
        ".glintpost-announcement-content p { margin: 0 0 8px; }" +
        ".glintpost-announcement-cta {" +
        "  display: inline-block; padding: 10px 24px; border-radius: 8px; border: none;" +
        "  background: " + primaryColor + "; color: white; font-size: 15px; font-weight: 600;" +
        "  cursor: pointer; text-decoration: none; transition: opacity 0.2s;" +
        "}" +
        ".glintpost-announcement-cta:hover { opacity: 0.9; }";
    } else {
      style.innerHTML =
        ".glintpost-announcement-banner {" +
        "  position: fixed; top: 0; left: 0; width: 100%; z-index: 2147483647;" +
        "  background: " + bgColor + "; color: " + textColor + ";" +
        "  box-shadow: 0 2px 8px rgba(0,0,0,0.1);" +
        "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;" +
        "  animation: glintpost-ann-banner-slide 0.4s cubic-bezier(0.16, 1, 0.3, 1);" +
        "}" +
        "@keyframes glintpost-ann-banner-slide { from { transform: translateY(-100%); } to { transform: translateY(0); } }" +
        ".glintpost-announcement-banner-inner {" +
        "  display: flex; align-items: center; justify-content: center; gap: 16px;" +
        "  padding: 14px 48px 14px 24px; max-width: 1200px; margin: 0 auto;" +
        "}" +
        ".glintpost-announcement-banner-text {" +
        "  font-size: 15px; font-weight: 500;" +
        "}" +
        ".glintpost-announcement-cta {" +
        "  display: inline-block; padding: 7px 18px; border-radius: 6px; border: none;" +
        "  background: " + primaryColor + "; color: white; font-size: 14px; font-weight: 600;" +
        "  cursor: pointer; text-decoration: none; white-space: nowrap; transition: opacity 0.2s; flex-shrink: 0;" +
        "}" +
        ".glintpost-announcement-cta:hover { opacity: 0.9; }" +
        ".glintpost-announcement-close {" +
        "  position: absolute; top: 50%; right: 12px; transform: translateY(-50%);" +
        "  width: 28px; height: 28px; border: none; background: transparent;" +
        "  cursor: pointer; display: flex; align-items: center; justify-content: center;" +
        "  font-size: 18px; color: " + mutedColor + "; transition: color 0.2s;" +
        "}" +
        ".glintpost-announcement-close:hover { color: " + textColor + "; }";
    }

    document.head.appendChild(style);

    var wrapper;

    if (isOverlay) {
      wrapper = document.createElement("div");
      wrapper.className = "glintpost-announcement-overlay";

      var card = document.createElement("div");
      card.className = "glintpost-announcement-card";

      if (announcement.videoUrl) {
        var video = document.createElement("video");
        video.className = "glintpost-announcement-video";
        video.src = announcement.videoUrl;
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        card.appendChild(video);
      } else if (announcement.imageUrl) {
        var img = document.createElement("img");
        img.className = "glintpost-announcement-media";
        img.src = announcement.imageUrl;
        img.alt = announcement.title;
        card.appendChild(img);
      }

      var closeBtn = document.createElement("button");
      closeBtn.className = "glintpost-announcement-close";
      closeBtn.innerHTML = "&#10005;";
      closeBtn.setAttribute("aria-label", "Close");
      card.appendChild(closeBtn);

      var body = document.createElement("div");
      body.className = "glintpost-announcement-body";

      var title = document.createElement("h2");
      title.className = "glintpost-announcement-title";
      title.textContent = announcement.title;
      body.appendChild(title);

      var content = document.createElement("div");
      content.className = "glintpost-announcement-content";
      content.innerHTML = announcement.content;
      body.appendChild(content);

      if (announcement.ctaText && announcement.ctaUrl) {
        var cta = document.createElement("a");
        cta.className = "glintpost-announcement-cta";
        cta.textContent = announcement.ctaText;
        cta.href = announcement.ctaUrl;
        cta.addEventListener("click", function (e) {
          e.preventDefault();
          trackEvent("CLICK", announcement.id);
          dismiss();
          window.open(announcement.ctaUrl, "_blank", "noopener");
        });
        body.appendChild(cta);
      }

      card.appendChild(body);
      wrapper.appendChild(card);

      closeBtn.addEventListener("click", function () { dismiss(); });
      wrapper.addEventListener("click", function (e) {
        if (e.target === wrapper) dismiss();
      });
    } else {
      wrapper = document.createElement("div");
      wrapper.className = "glintpost-announcement-banner";

      var inner = document.createElement("div");
      inner.className = "glintpost-announcement-banner-inner";

      var text = document.createElement("span");
      text.className = "glintpost-announcement-banner-text";
      text.textContent = announcement.title;
      inner.appendChild(text);

      if (announcement.ctaText && announcement.ctaUrl) {
        var bannerCta = document.createElement("a");
        bannerCta.className = "glintpost-announcement-cta";
        bannerCta.textContent = announcement.ctaText;
        bannerCta.href = announcement.ctaUrl;
        bannerCta.addEventListener("click", function (e) {
          e.preventDefault();
          trackEvent("CLICK", announcement.id);
          dismiss();
          window.open(announcement.ctaUrl, "_blank", "noopener");
        });
        inner.appendChild(bannerCta);
      }

      var bannerClose = document.createElement("button");
      bannerClose.className = "glintpost-announcement-close";
      bannerClose.innerHTML = "&#10005;";
      bannerClose.setAttribute("aria-label", "Close");
      bannerClose.addEventListener("click", function () { dismiss(); });

      wrapper.appendChild(inner);
      wrapper.appendChild(bannerClose);
    }

    document.body.appendChild(wrapper);
    trackEvent("VIEW", announcement.id);

    // Push page content down so the fixed banner doesn't overlap it
    var savedBodyPadding = null;
    if (!isOverlay) {
      savedBodyPadding = document.body.style.paddingTop;
      var bannerHeight = wrapper.offsetHeight || 50;
      document.body.style.paddingTop = bannerHeight + "px";
    }

    function dismiss() {
      markSeen(announcement.id);
      markSessionShown();
      if (savedBodyPadding !== null) {
        document.body.style.paddingTop = savedBodyPadding;
      }
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      if (style.parentNode) style.parentNode.removeChild(style);
    }
  }

  // --- Public API ---
  if (!window.GlintPost) window.GlintPost = {};

  var existingConsent = window.GlintPost.consent;
  window.GlintPost.consent = function (granted) {
    consentGranted = !!granted;
    if (consentGranted) init();
    if (typeof existingConsent === "function") existingConsent(granted);
  };

  window.GlintPost.destroyAnnouncements = function () {
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SEEN_KEY);
    } catch {}
    var hadBanner = document.querySelector(".glintpost-announcement-banner");
    if (hadBanner) {
      document.body.style.paddingTop = "";
    }
    document.querySelectorAll(
      ".glintpost-announcement-overlay, .glintpost-announcement-banner"
    ).forEach(function (el) { el.remove(); });
    document.querySelectorAll("style").forEach(function (el) {
      if (el.innerHTML.indexOf("glintpost-announcement") !== -1) el.remove();
    });
    consentGranted = false;
  };
})();
