/**
 * movimenta7 — WCAG 2.x contrast gate (D9: token values must be validated by
 * formula at build time, never guessed). Exits 1 if any pair is below target.
 * Run: node scripts/valida_contraste.mjs
 */
function srgbChannel(v) {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b);
}
function ratio(fg, bg) {
  const [a, c] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (c + 0.05);
}

// Pairs mirror css/style.css tokens. Keep in sync when editing the palette.
const PAIRS = [
  // [label, fg, bg, minimum]
  ["light: texto/fundo", "#1B1B18", "#FAFAF7", 4.5],
  ["light: texto-2/fundo", "#57554E", "#FAFAF7", 4.5],
  ["light: texto-3/fundo (meta, so texto grande/secundario)", "#757268", "#FAFAF7", 3.0],
  ["light: verde-movimento como texto/fundo", "#15803D", "#FAFAF7", 4.5],
  ["light: verde-movimento como texto/surface", "#15803D", "#FFFFFF", 4.5],
  ["light: CTA texto branco/verde-movimento", "#FFFFFF", "#15803D", 4.5],
  ["dark: texto/fundo", "#ECEAE4", "#101311", 4.5],
  ["dark: texto-2/fundo", "#A9ADA6", "#101311", 4.5],
  ["dark: verde-movimento claro como texto/fundo", "#5BC17D", "#101311", 4.5],
  ["dark: verde claro como texto/surface", "#5BC17D", "#161A17", 4.5],
  ["dark: CTA texto escuro/verde claro", "#0C1410", "#5BC17D", 4.5],
];

let fail = 0;
for (const [label, fg, bg, min] of PAIRS) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${r.toFixed(2)}:1 (min ${min})  ${label}  ${fg} sobre ${bg}`);
}
if (fail) {
  console.error(`\n${fail} par(es) abaixo do minimo — ajuste os tokens em css/style.css.`);
  process.exit(1);
}
console.log("\nTodos os pares passaram.");
