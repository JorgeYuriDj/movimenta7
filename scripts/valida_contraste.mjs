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
  ["light: texto/fundo", "#12140F", "#F7F7F4", 4.5],
  ["light: texto/surface-2 (chips, aviso)", "#12140F", "#EEEFE9", 4.5],
  ["light: texto-2/fundo", "#55584E", "#F7F7F4", 4.5],
  ["light: texto-2/surface-2 (corpo do aviso de privacidade)", "#55584E", "#EEEFE9", 4.5],
  ["light: texto-3/fundo (meta, so texto grande/secundario)", "#74776C", "#F7F7F4", 3.0],
  ["light: verde-marca como texto/fundo", "#0E7A3C", "#F7F7F4", 4.5],
  ["light: verde-marca como texto/surface", "#0E7A3C", "#FFFFFF", 4.5],
  ["light: CTA tinta/lima", "#10240F", "#BEF264", 4.5],
  ["light: CTA tinta/lima-forte (hover)", "#10240F", "#A3E635", 4.5],
  ["dark: texto/fundo", "#ECEFE6", "#0C0F0B", 4.5],
  ["dark: texto-2/fundo", "#A7ADA0", "#0C0F0B", 4.5],
  ["dark: texto-2/surface-2", "#A7ADA0", "#1A1F17", 4.5],
  ["dark: texto-3/fundo (meta)", "#878D80", "#0C0F0B", 3.0],
  ["dark: verde-marca claro como texto/fundo", "#5FD98B", "#0C0F0B", 4.5],
  ["dark: verde claro como texto/surface", "#5FD98B", "#131711", 4.5],
  ["dark: CTA tinta/lima (o lima nao muda no escuro)", "#10240F", "#BEF264", 4.5],
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
