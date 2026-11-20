// Shared header for every page: logo (home), Team Picker and 2027 Tracker links, and the light/dark toggle.
// The page marks itself with <body data-page="home|picker|tracker"> and has an empty <div id="sitebar"></div>.
// Theme: the visitor's saved choice wins, else the device setting (each page sets it before painting).
// When the theme changes, a "fgt-theme-change" event is sent so pages can redraw charts.
// ---- Font preview (temporary, for choosing a pairing): add ?font=1..4 to any page; ?font=0 turns it off.
// The choice is remembered in this browser while you click between pages. Players see nothing unless they use the link.
(function () {
  var FONTS = {
    1: { name: "Clubhouse classic: Fraunces + Outfit", css: "family=Fraunces:opsz,wght@9..144,600;9..144,700",
         head: '"Fraunces", Georgia, serif', body: null },
    2: { name: "Scoreboard: Barlow Condensed + Inter", css: "family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600;700",
         head: '"Barlow Condensed", "Arial Narrow", sans-serif', body: '"Inter", system-ui, sans-serif' },
    3: { name: "Augusta elegant: DM Serif Display + DM Sans", css: "family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700",
         head: '"DM Serif Display", Georgia, serif', body: '"DM Sans", system-ui, sans-serif' },
    4: { name: "One sporty family: Archivo Black + Archivo", css: "family=Archivo+Black&family=Archivo:wght@400;500;600;700",
         head: '"Archivo Black", "Arial Black", sans-serif', body: '"Archivo", system-ui, sans-serif' }
  };
  var q = new URLSearchParams(location.search).get("font"), pick = null;
  try {
    if (q === "0") localStorage.removeItem("fgt-font-preview");
    else if (FONTS[q]) localStorage.setItem("fgt-font-preview", q);
    pick = localStorage.getItem("fgt-font-preview");
  } catch (e) { pick = FONTS[q] ? q : null; }
  var f = FONTS[pick];
  if (!f) return;
  var link = document.createElement("link"); link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?" + f.css + "&display=swap";
  document.head.appendChild(link);
  var heads = "h1, h2, h3, h4, h5, .sb-home, .card .team, .card .big, .kc .num, .kc .money, .la .stat .num, .tn, .frac, .ftip .big, .count, .big";
  var css = (f.body ? ":root { --sans: " + f.body + " !important; } body, button, select, input { font-family: " + f.body + " !important; }" : "") +
    heads + " { font-family: " + f.head + " !important; letter-spacing: 0 !important; }" +
    "body { font-variant-numeric: tabular-nums; }";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  function addPicker() {
    var box = document.createElement("div"); box.className = "fontpick";
    box.appendChild(document.createTextNode("Font preview: "));
    [1, 2, 3, 4].forEach(function (n) {
      var a = document.createElement("a"); a.textContent = n; a.href = "?font=" + n; if (String(n) === pick) a.className = "on"; box.appendChild(a);
    });
    var off = document.createElement("a"); off.textContent = "off"; off.href = "?font=0"; box.appendChild(off);
    var nm = document.createElement("div"); nm.className = "fp-name"; nm.textContent = f.name; box.appendChild(nm);
    document.body.appendChild(box);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addPicker); else addPicker();
})();

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
