// Shared header for every page: logo (home), Team Picker and 2027 Tracker links, and the light/dark toggle.
// The page marks itself with <body data-page="home|picker|tracker"> and has an empty <div id="sitebar"></div>.
// Theme: the visitor's saved choice wins, else the device setting (each page sets it before painting).
// When the theme changes, a "fgt-theme-change" event is sent so pages can redraw charts.
(function () {
  var bar = document.getElementById("sitebar");
  if (!bar) return;
  var page = document.body.getAttribute("data-page") || "";
  bar.className = "sitebar";
  bar.innerHTML =
    '<a class="sb-home" href="./" aria-label="Fantasy Golf Tour home"><img src="logo.png" width="36" height="36" alt=""><span>Fantasy Golf Tour</span></a>' +
    '<div class="sb-right"><nav class="sb-links" aria-label="Site">' +
    '<a class="sb-link" href="team-picker.html" data-p="picker">Team Picker</a>' +
    '<a class="sb-link" href="dashboard.html" data-p="tracker">2027 Tracker</a></nav>' +
    '<button class="sb-theme" type="button" aria-label="Switch between light and dark mode"></button></div>';
  bar.querySelectorAll("a[data-p]").forEach(function (a) { if (a.getAttribute("data-p") === page) a.setAttribute("aria-current", "page"); });
  var rule = document.createElement("hr"); rule.className = "sitebar-rule"; bar.parentNode.insertBefore(rule, bar.nextSibling);

  var btn = bar.querySelector(".sb-theme");
  function cur() { return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"; }
  function paint() { btn.textContent = cur() === "dark" ? "☀ Light" : "☾ Dark"; }
  function set(t, save) {
    document.documentElement.setAttribute("data-theme", t);
    if (save) { try { localStorage.setItem("fgt-theme", t); } catch (e) {} }
    paint();
    window.dispatchEvent(new CustomEvent("fgt-theme-change", { detail: t }));
  }
  btn.onclick = function () { set(cur() === "dark" ? "light" : "dark", true); };
  if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
    var saved = null; try { saved = localStorage.getItem("fgt-theme"); } catch (x) {}
    if (!saved) set(e.matches ? "dark" : "light", false);
  });
  paint();
})();
