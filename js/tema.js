// Applies the saved theme BEFORE first paint (avoids wrong-theme flash).
// Lives in its own file (not inline) so the CSP can stay "script-src 'self' …".
(function () {
  try {
    var t = localStorage.getItem("mov7-tema");
    if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t);
  } catch (e) { /* localStorage blocked: follow the system theme */ }
})();
