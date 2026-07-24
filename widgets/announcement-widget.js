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
  // Fixed on purpose — the banner's label is not per-announcement configurable.
  // The configured ctaText drives the overlay's CTA button instead.
  var BANNER_LINK_TEXT = "Learn more";
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
    // Separates the card's header and footer from the scrolling center.
    var dividerColor = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";

    // Both rule sets are always emitted: a TOP_BANNER expands into the overlay
    // card on click, so it needs the overlay styles too. The close button is
    // scoped per container because the two variants position it differently.
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
      // Sized as a share of the viewport: ~65% wide, and pinned between 70% and
      // 80% tall so short announcements still read as a substantial modal
      // rather than a small card floating in the middle of the screen.
      // Three bands: a fixed header, a center that grows and scrolls on its own,
      // and a fixed footer. Only the center scrolls, so the title and CTA stay
      // put no matter how long the announcement is.
      ".glintpost-announcement-card {" +
      "  background: " + bgColor + "; color: " + textColor + ";" +
      "  border-radius: 16px; width: 65vw; min-height: 70vh; max-height: 80vh;" +
      "  display: flex; flex-direction: column; overflow: hidden;" +
      "  position: relative; box-shadow: 0 25px 50px rgba(0,0,0,0.25);" +
      "  animation: glintpost-ann-slidein 0.4s cubic-bezier(0.16, 1, 0.3, 1);" +
      "}" +
      ".glintpost-announcement-card .glintpost-announcement-close {" +
      "  position: absolute; top: 12px; right: 12px; width: 32px; height: 32px;" +
      "  border: none; background: rgba(0,0,0,0.08); border-radius: 50%;" +
      "  cursor: pointer; display: flex; align-items: center; justify-content: center;" +
      "  font-size: 18px; color: " + mutedColor + "; z-index: 1;" +
      "  transition: background 0.2s;" +
      "}" +
      ".glintpost-announcement-card .glintpost-announcement-close:hover { background: rgba(0,0,0,0.15); }" +
      ".glintpost-announcement-header {" +
      "  flex: 0 0 auto; padding: 28px 36px 16px 36px; padding-right: 56px;" +
      "  border-bottom: 1px solid " + dividerColor + ";" +
      "}" +
      ".glintpost-announcement-title { font-size: 24px; font-weight: 700; margin: 0; line-height: 1.3; }" +
      // min-height:0 is required for a flex child to be allowed to shrink below
      // its content size — without it the center refuses to scroll and pushes
      // the footer off the card.
      ".glintpost-announcement-body {" +
      "  flex: 1 1 auto; min-height: 0; overflow-y: auto;" +
      "  padding: 24px 36px;" +
      "}" +
      ".glintpost-announcement-content { font-size: 15px; line-height: 1.6; color: " + mutedColor + "; margin: 0; }" +
      ".glintpost-announcement-content p { margin: 0 0 8px; }" +
      // Editor media is inline in `content`. The customer's page has no Quill
      // stylesheet, so size it here — otherwise images render at natural width
      // (clipped by the card) and video iframes fall back to 300x150.
      ".glintpost-announcement-content img { max-width: 100%; height: auto; display: block; border-radius: 8px; margin: 8px 0; }" +
      ".glintpost-announcement-content iframe { width: 100%; aspect-ratio: 16 / 9; height: auto; display: block; border: 0; border-radius: 8px; margin: 8px 0; }" +
      // Footer sits below the scrolling center. CTA is bottom-right on desktop;
      // the mobile block below re-centers it.
      ".glintpost-announcement-footer {" +
      "  flex: 0 0 auto; padding: 16px 36px 24px 36px;" +
      "  border-top: 1px solid " + dividerColor + ";" +
      "  display: flex; justify-content: flex-end; align-items: center;" +
      "}" +
      ".glintpost-announcement-card .glintpost-announcement-cta {" +
      "  display: inline-block;" +
      "  padding: 10px 24px; border-radius: 8px; border: none;" +
      "  background: " + primaryColor + "; color: white; font-size: 15px; font-weight: 600;" +
      "  cursor: pointer; text-decoration: none; transition: opacity 0.2s;" +
      "}" +
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
      // The banner is a teaser for the full announcement — the whole bar is a
      // control that opens the overlay, so make it read as clickable.
      ".glintpost-announcement-banner-expand {" +
      "  cursor: pointer; display: flex; align-items: center; justify-content: center;" +
      "  gap: 16px; flex: 1; min-width: 0; background: none; border: none; padding: 0;" +
      "  color: inherit; font: inherit; text-align: left;" +
      "}" +
      ".glintpost-announcement-banner-expand:hover .glintpost-announcement-banner-text { text-decoration: underline; }" +
      ".glintpost-announcement-banner-expand:focus-visible { outline: 2px solid " + primaryColor + "; outline-offset: 2px; }" +
      // The banner's affordance is a plain link, not a primary button: the
      // banner only opens the overlay, and the real CTA lives in that overlay's
      // footer. Two competing buttons would misrepresent which is the action.
      ".glintpost-announcement-banner-link {" +
      "  font-size: 14px; font-weight: 600; white-space: nowrap; flex-shrink: 0;" +
      "  color: " + primaryColor + "; text-decoration: underline;" +
      "  text-underline-offset: 2px;" +
      "}" +
      ".glintpost-announcement-cta:hover { opacity: 0.9; }" +
      // A viewport-share width collapses to an unreadable column on phones, and
      // a 70vh floor wastes the little height there is. Go near-full-width and
      // let height follow the content instead.
      "@media (max-width: 640px) {" +
      "  .glintpost-announcement-card {" +
      "    width: 92vw; min-height: 0; max-height: 85vh;" +
      "  }" +
      "  .glintpost-announcement-header { padding: 22px 22px 14px 22px; padding-right: 52px; }" +
      "  .glintpost-announcement-body { padding: 18px 22px; }" +
      "  .glintpost-announcement-title { font-size: 20px; }" +
      // Centered, full-width CTA on mobile — a right-aligned button reads as
      // stranded on a narrow card and is harder to reach one-handed.
      "  .glintpost-announcement-footer { padding: 14px 22px 20px 22px; justify-content: center; }" +
      "  .glintpost-announcement-card .glintpost-announcement-cta { width: 100%; text-align: center; }" +
      "}" +
      ".glintpost-announcement-banner .glintpost-announcement-close {" +
      "  position: absolute; top: 50%; right: 12px; transform: translateY(-50%);" +
      "  width: 28px; height: 28px; border: none; background: transparent;" +
      "  cursor: pointer; display: flex; align-items: center; justify-content: center;" +
      "  font-size: 18px; color: " + mutedColor + "; transition: color 0.2s;" +
      "}" +
      ".glintpost-announcement-banner .glintpost-announcement-close:hover { color: " + textColor + "; }";

    document.head.appendChild(style);

    var wrapper;
    // The overlay a TOP_BANNER expands into, while it is open.
    var expandedOverlay = null;
    // Focus to hand back when the dialog closes.
    var previouslyFocused = null;

    var FOCUSABLE =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),' +
      ' textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

    function focusableIn(root) {
      var all = root.querySelectorAll(FOCUSABLE);
      var out = [];
      for (var i = 0; i < all.length; i++) {
        // offsetParent is null for display:none subtrees.
        if (all[i].offsetParent !== null) out.push(all[i]);
      }
      return out;
    }

    // The card is an aria-modal dialog, so focus has to move into it and stay
    // there — otherwise keyboard users tab through the obscured page behind it.
    function activateDialog(overlay) {
      previouslyFocused = document.activeElement;
      var card = overlay.querySelector(".glintpost-announcement-card");
      var first = focusableIn(card)[0];
      (first || card).focus();

      overlay.addEventListener("keydown", function (e) {
        if (e.key !== "Tab") return;
        var items = focusableIn(card);
        if (!items.length) {
          e.preventDefault();
          card.focus();
          return;
        }
        var head = items[0];
        var tail = items[items.length - 1];
        if (e.shiftKey && document.activeElement === head) {
          e.preventDefault();
          tail.focus();
        } else if (!e.shiftKey && document.activeElement === tail) {
          e.preventDefault();
          head.focus();
        }
      });
    }

    function restoreFocus() {
      if (previouslyFocused && typeof previouslyFocused.focus === "function" &&
          document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
      previouslyFocused = null;
    }

    // Builds the full-content overlay. Used directly for OVERLAY announcements,
    // and on demand when a TOP_BANNER is clicked.
    function buildOverlay() {
      var overlay = document.createElement("div");
      overlay.className = "glintpost-announcement-overlay";

      var card = document.createElement("div");
      card.className = "glintpost-announcement-card";
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-modal", "true");
      card.setAttribute("aria-label", announcement.title);
      // Focusable as a fallback target when the card holds no controls.
      card.setAttribute("tabindex", "-1");

      var closeBtn = document.createElement("button");
      closeBtn.className = "glintpost-announcement-close";
      closeBtn.innerHTML = "&#10005;";
      closeBtn.setAttribute("aria-label", "Close");
      card.appendChild(closeBtn);

      var header = document.createElement("div");
      header.className = "glintpost-announcement-header";

      var title = document.createElement("h2");
      title.className = "glintpost-announcement-title";
      title.textContent = announcement.title;
      header.appendChild(title);
      card.appendChild(header);

      var body = document.createElement("div");
      body.className = "glintpost-announcement-body";

      var content = document.createElement("div");
      content.className = "glintpost-announcement-content";
      content.innerHTML = announcement.content;
      body.appendChild(content);
      card.appendChild(body);

      if (announcement.ctaText && announcement.ctaUrl) {
        var footer = document.createElement("div");
        footer.className = "glintpost-announcement-footer";

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
        footer.appendChild(cta);
        card.appendChild(footer);
      }

      overlay.appendChild(card);

      closeBtn.addEventListener("click", function () { dismiss(); });
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) dismiss();
      });

      return overlay;
    }

    if (isOverlay) {
      wrapper = buildOverlay();
    } else {
      wrapper = document.createElement("div");
      wrapper.className = "glintpost-announcement-banner";

      var inner = document.createElement("div");
      inner.className = "glintpost-announcement-banner-inner";

      // The whole bar is one button so it opens by keyboard as well as by click.
      // The close button sits outside it, so closing can't also expand.
      var expand = document.createElement("button");
      expand.type = "button";
      expand.className = "glintpost-announcement-banner-expand";
      expand.setAttribute("aria-label", BANNER_LINK_TEXT + ": " + announcement.title);

      var text = document.createElement("span");
      text.className = "glintpost-announcement-banner-text";
      text.textContent = announcement.title;
      expand.appendChild(text);

      // A fixed link label, not the configured CTA: the banner's only action is
      // to open the overlay, and the configured CTA belongs to that overlay's
      // footer. Styled as a link so it doesn't compete with the real CTA.
      var bannerLink = document.createElement("span");
      bannerLink.className = "glintpost-announcement-banner-link";
      bannerLink.textContent = BANNER_LINK_TEXT;
      expand.appendChild(bannerLink);

      expand.addEventListener("click", function () { openFromBanner(); });
      inner.appendChild(expand);

      var bannerClose = document.createElement("button");
      bannerClose.className = "glintpost-announcement-close";
      bannerClose.innerHTML = "&#10005;";
      bannerClose.setAttribute("aria-label", "Close");
      bannerClose.addEventListener("click", function () { dismiss(); });

      wrapper.appendChild(inner);
      wrapper.appendChild(bannerClose);
    }

    // Expanding the banner is when the content is actually seen, so it is the
    // VIEW. It is deliberately not a CLICK — that metric counts CTA clicks, and
    // conflating the two would make it meaningless.
    function openFromBanner() {
      if (expandedOverlay) return;
      expandedOverlay = buildOverlay();
      document.body.appendChild(expandedOverlay);
      activateDialog(expandedOverlay);
      trackEvent("VIEW", announcement.id);
    }

    document.body.appendChild(wrapper);
    if (isOverlay) activateDialog(wrapper);
    // An overlay showing *is* the content being seen, so it is a VIEW outright.
    // A banner is only a teaser: it records APPEAR, and becomes a VIEW when the
    // visitor opens it.
    trackEvent(isOverlay ? "VIEW" : "APPEAR", announcement.id);

    // Push page content down so the fixed banner doesn't overlap it
    var savedBodyPadding = null;
    if (!isOverlay) {
      savedBodyPadding = document.body.style.paddingTop;
      var bannerHeight = wrapper.offsetHeight || 50;
      document.body.style.paddingTop = bannerHeight + "px";
    }

    // Escape closes whichever surface is showing.
    function onKeydown(e) {
      if (e.key === "Escape" || e.key === "Esc") dismiss();
    }
    document.addEventListener("keydown", onKeydown);

    // Closing the expanded overlay dismisses the whole announcement rather than
    // dropping back to the banner: the user has seen the full content, so
    // leaving the teaser bar behind would just demand a second dismissal.
    function dismiss() {
      markSeen(announcement.id);
      markSessionShown();
      if (savedBodyPadding !== null) {
        document.body.style.paddingTop = savedBodyPadding;
      }
      document.removeEventListener("keydown", onKeydown);
      if (expandedOverlay && expandedOverlay.parentNode) {
        expandedOverlay.parentNode.removeChild(expandedOverlay);
      }
      expandedOverlay = null;
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      if (style.parentNode) style.parentNode.removeChild(style);
      restoreFocus();
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
