(function () {
  if (window.GlintPostChangelogInitialized) return;
  window.GlintPostChangelogInitialized = true;

  var scriptTag =
    document.currentScript ||
    document.querySelector('script[src*="changelog-widget.js"]');
  var apiKey = scriptTag ? scriptTag.getAttribute("data-api-key") : null;

  if (!apiKey) {
    console.error(
      "GlintPost Changelog Widget: Missing data-api-key attribute on the script tag."
    );
    return;
  }

  var clientConfig = window.GlintPostConfig || {};
  var queryParams = new URLSearchParams({
    apiKey: apiKey,
    visitorId: clientConfig.visitorId || "",
    datalayer: clientConfig.datalayer
      ? JSON.stringify(clientConfig.datalayer)
      : "",
  });

  var BASE_URL = new URL(scriptTag.src).origin;
  var iframeUrl = BASE_URL + "/changelog?" + queryParams.toString();

  var style = document.createElement("style");
  style.innerHTML =
    ".glintpost-changelog-badge {" +
    "  position: fixed;" +
    "  bottom: 24px;" +
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
  document.head.appendChild(style);

  var badge = document.createElement("div");
  badge.className = "glintpost-changelog-badge";
  badge.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
    '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/>' +
    '<path d="M14 2v5a1 1 0 0 0 1 1h5"/>' +
    '<path d="M10 9H8"/>' +
    '<path d="M16 13H8"/>' +
    '<path d="M16 17H8"/>' +
    "</svg>";

  var container = document.createElement("div");
  container.className = "glintpost-changelog-container";

  var iframe = document.createElement("iframe");
  iframe.className = "glintpost-changelog-iframe";
  iframe.src = "about:blank";
  container.appendChild(iframe);

  document.body.appendChild(badge);
  document.body.appendChild(container);

  // Fetch account config immediately to apply the correct badge color and theme
  fetch(BASE_URL + "/api/config?apiKey=" + encodeURIComponent(apiKey))
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
        iframeUrl = BASE_URL + "/changelog?" + queryParams.toString();
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

  badge.addEventListener("click", function () {
    loadIframeOnce();
    isOpen = !isOpen;
    if (isOpen) {
      container.classList.add("open");
      notifyOpened();
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
      badge.style.backgroundColor = event.data.primaryColor;
    }
  });
})();
