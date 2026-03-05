(function () {
  if (window.GlintPostInitialized) return;
  window.GlintPostInitialized = true;

  var scriptTag =
    document.currentScript ||
    document.querySelector('script[src*="widget.js"]');
  var apiKey = scriptTag ? scriptTag.getAttribute("data-api-key") : null;

  if (!apiKey) {
    console.error(
      "GlintPost Widget: Missing data-api-key attribute on the script tag."
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
  var iframeUrl = BASE_URL + "/widget?" + queryParams.toString();

  var style = document.createElement("style");
  style.innerHTML =
    ".glintpost-badge {" +
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
    ".glintpost-badge:hover {" +
    "  transform: scale(1.05);" +
    "  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);" +
    "}" +
    ".glintpost-badge svg {" +
    "  width: 28px;" +
    "  height: 28px;" +
    "  fill: white;" +
    "}" +
    ".glintpost-iframe-container {" +
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
    ".glintpost-iframe-container.open {" +
    "  transform: translateX(0);" +
    "}" +
    ".glintpost-iframe {" +
    "  width: 100%;" +
    "  height: 100%;" +
    "  border: none;" +
    "  background: white;" +
    "}" +
    "@media (max-width: 480px) {" +
    "  .glintpost-iframe-container {" +
    "    width: 100vw;" +
    "  }" +
    "}";
  document.head.appendChild(style);

  var badge = document.createElement("div");
  badge.className = "glintpost-badge";
  badge.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
    '<path d="M12 2C6.48 2 2 5.92 2 10.75c0 2.29 1.05 4.39 2.76 5.98-.31 1.76-1.39 3.52-1.42 3.58-.09.15-.09.33.01.48.1.15.28.22.46.18 2.65-.63 4.54-1.93 5.56-2.7C10.22 18.15 11.09 18.25 12 18.25c5.52 0 10-3.92 10-8.75S17.52 2 12 2z"/>' +
    "</svg>";

  var container = document.createElement("div");
  container.className = "glintpost-iframe-container";

  var iframe = document.createElement("iframe");
  iframe.className = "glintpost-iframe";
  iframe.src = "about:blank";
  container.appendChild(iframe);

  document.body.appendChild(badge);
  document.body.appendChild(container);

  var isOpen = false;
  var iframeLoaded = false;

  function loadIframeOnce() {
    if (iframeLoaded) return;
    iframeLoaded = true;
    iframe.src = iframeUrl;
  }

  function notifyOpened() {
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: "GLINTPOST_WIDGET_OPENED" }, "*");
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
    if (event.data && event.data.type === "GLINTPOST_WIDGET_CLOSE") {
      isOpen = false;
      container.classList.remove("open");
    }
    if (event.data && event.data.type === "GLINTPOST_WIDGET_CONFIG" && event.data.primaryColor) {
      badge.style.backgroundColor = event.data.primaryColor;
    }
  });
})();
