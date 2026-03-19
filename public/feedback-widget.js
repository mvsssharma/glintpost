(function () {
  if (window.GlintPostFeedbackInitialized) return;
  window.GlintPostFeedbackInitialized = true;

  var scriptTag =
    document.currentScript ||
    document.querySelector('script[src*="feedback-widget.js"]');
  var apiKey = scriptTag ? scriptTag.getAttribute("data-api-key") : null;

  if (!apiKey) {
    console.error(
      "GlintPost Feedback Widget: Missing data-api-key attribute on the script tag."
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
  var iframeUrl = BASE_URL + "/survey?" + queryParams.toString();

  var style = document.createElement("style");
  style.innerHTML =
    ".glintpost-feedback-badge {" +
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
    ".glintpost-feedback-badge:hover {" +
    "  transform: scale(1.05);" +
    "  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);" +
    "}" +
    ".glintpost-feedback-badge svg {" +
    "  width: 26px;" +
    "  height: 26px;" +
    "  fill: white;" +
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
  document.head.appendChild(style);

  var badge = document.createElement("div");
  badge.className = "glintpost-feedback-badge";
  // Message square icon
  badge.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
    "</svg>";

  var container = document.createElement("div");
  container.className = "glintpost-feedback-container";

  var iframe = document.createElement("iframe");
  iframe.className = "glintpost-feedback-iframe";
  iframe.src = "about:blank";
  container.appendChild(iframe);

  document.body.appendChild(badge);
  document.body.appendChild(container);

  // Fetch config for badge color and theme
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
        iframeUrl = BASE_URL + "/survey?" + queryParams.toString();
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

  badge.addEventListener("click", function () {
    loadIframeOnce();
    isOpen = !isOpen;
    if (isOpen) {
      container.classList.add("open");
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
      badge.style.backgroundColor = event.data.primaryColor;
    }
  });
})();
