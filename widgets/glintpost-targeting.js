// SOURCE for public/glintpost-targeting.js — bundled by scripts/build-widgets.mjs.
// Standalone build of the audience-targeting matcher for headless API consumers
// who render their own UI. Imported from lib/attributes.ts (single source of
// truth) so it can't drift from the server resolver or the embed widgets.
import { matchesTargeting as matchTargeting } from "../lib/attributes";

(function () {
  // Chain onto any GlintPost object the widget scripts may have created —
  // never clobber existing methods (consent/destroy/etc.).
  if (!window.GlintPost) window.GlintPost = {};

  // null targeting = shown to everyone; a targeted item with no datalayer is hidden.
  window.GlintPost.matchesTargeting = function (targeting, datalayer) {
    return matchTargeting(targeting || null, datalayer || null);
  };

  // Falls back to window.GlintPostConfig.datalayer when no datalayer is passed.
  window.GlintPost.filterVisible = function (items, datalayer) {
    var dl =
      datalayer ||
      (window.GlintPostConfig && window.GlintPostConfig.datalayer) ||
      null;
    if (!Array.isArray(items)) return [];
    return items.filter(function (item) {
      return matchTargeting(item && item.targeting ? item.targeting : null, dl);
    });
  };
})();
