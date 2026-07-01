(function () {
  if (window.GlintPostLoaderInitialized) return;
  window.GlintPostLoaderInitialized = true;

  var scriptTag =
    document.currentScript ||
    document.querySelector('script[src*="widget.js"][data-api-key]');
  var apiKey = scriptTag ? scriptTag.getAttribute("data-api-key") : null;

  if (!apiKey) {
    console.error(
      "GlintPost: Missing data-api-key attribute on the script tag."
    );
    return;
  }

  var appUrl = scriptTag.src.replace(/\/widget\.js(\?.*)?$/, "");

  var WIDGET_SCRIPTS = {
    changelog: "changelog-widget.js",
    roadmap: "roadmap-widget.js",
    feedback: "feedback-widget.js",
    announcements: "announcement-widget.js",
  };

  var MODE_WIDGETS = { changelog: true, feedback: true };

  function loadWidget(name) {
    var src = WIDGET_SCRIPTS[name];
    if (!src) return;

    if (document.querySelector('script[src*="' + src + '"]')) return;

    var s = document.createElement("script");
    s.src = appUrl + "/" + src;
    s.setAttribute("data-api-key", apiKey);
    s.defer = true;

    if (name === "feedback" && scriptTag.getAttribute("data-form-id")) {
      s.setAttribute("data-form-id", scriptTag.getAttribute("data-form-id"));
    }
    var mode = scriptTag.getAttribute("data-mode");
    if (mode && MODE_WIDGETS[name]) {
      s.setAttribute("data-mode", mode);
    }

    document.head.appendChild(s);
  }

  if (!window.GlintPost) window.GlintPost = {};
  window.GlintPost.destroyLoader = function () {
    window.GlintPostLoaderInitialized = false;
  };

  var configUrl = appUrl + "/api/widgets";

  var xhr = new XMLHttpRequest();
  xhr.open("GET", configUrl, true);
  xhr.setRequestHeader("x-api-key", apiKey);
  xhr.onerror = function () {
    console.error("GlintPost: Network error loading widget config");
  };
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    if (xhr.status !== 200) {
      console.error("GlintPost: Failed to load widget config", xhr.status);
      return;
    }
    try {
      var config = JSON.parse(xhr.responseText);
      var widgets = config.widgets || [];
      for (var i = 0; i < widgets.length; i++) {
        loadWidget(widgets[i]);
      }
    } catch (e) {
      console.error("GlintPost: Failed to parse widget config", e);
    }
  };
  xhr.send();
})();
