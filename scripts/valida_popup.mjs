/**
 * movimenta7 — anti-innerHTML gate for the browser code (ADR-0004 / CVE-2025-69993).
 *
 * The rule "textContent always, innerHTML never" is only worth anything if a
 * future edit cannot quietly break it. Leaflet's bindPopup/bindTooltip parse a
 * STRING argument as HTML, so passing a group name straight in is an injection
 * with community-supplied text — the exact shape of CVE-2025-69993. Passing an
 * Element instead is safe, and that is what js/app.js does today; this gate
 * freezes it.
 *
 * IMPORTANT — why this file has a real scanner instead of a regex: the first
 * CI gate in this project failed legitimate data because it matched inside
 * words. Here the words "innerHTML" and "bindPopup" appear in prose comments
 * (js/app.js:9,187), so a naive grep would fail the build on its own
 * documentation. Comments and string bodies are stripped before matching.
 *
 * Run: node scripts/valida_popup.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const JS_DIR = fileURLToPath(new URL("../js", import.meta.url));

/** Sinks that turn a string argument into parsed HTML. */
const HTML_SINKS = ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write"];
/** Leaflet setters that are safe with an Element and unsafe with a string. */
const LEAFLET_SINKS = ["bindPopup", "bindTooltip", "setContent", "setTooltipContent", "setPopupContent"];

/**
 * Replaces comment bodies and string/template contents with spaces, preserving
 * offsets and line breaks so reported line numbers stay true. Quotes and
 * delimiters are kept, which is what lets us detect "sink( followed by quote".
 */
function blankCommentsAndStrings(src) {
  const out = src.split("");
  let i = 0;
  const keepNewlines = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== "\n") out[k] = " ";
  };
  while (i < src.length) {
    const c = src[i], next = src[i + 1];
    if (c === "/" && next === "/") {
      let j = i + 2;
      while (j < src.length && src[j] !== "\n") j++;
      keepNewlines(i, j);
      i = j;
    } else if (c === "/" && next === "*") {
      let j = i + 2;
      while (j < src.length && !(src[j] === "*" && src[j + 1] === "/")) j++;
      keepNewlines(i, Math.min(j + 2, src.length));
      i = j + 2;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === c) break;
        if (c !== "`" && src[j] === "\n") break; // unterminated: stop at the line
        j++;
      }
      keepNewlines(i + 1, j); // blank the BODY, keep both quotes
      i = j + 1;
    } else {
      i++;
    }
  }
  return out.join("");
}

const lineOf = (src, index) => src.slice(0, index).split("\n").length;

/** Scans one source file. Exported so tests can prove the gate really rejects. */
export function analisar(nome, bruto) {
  const erros = [];
  const codigo = blankCommentsAndStrings(bruto);

  for (const sink of HTML_SINKS) {
    let at = codigo.indexOf(sink);
    while (at !== -1) {
      erros.push(`${nome}:${lineOf(codigo, at)} usa "${sink}" — use textContent / createElement`);
      at = codigo.indexOf(sink, at + 1);
    }
  }

  for (const sink of LEAFLET_SINKS) {
    const re = new RegExp(`\\b${sink}\\s*\\(\\s*(.)`, "g");
    let m;
    while ((m = re.exec(codigo)) !== null) {
      const primeiro = m[1];
      if (primeiro === '"' || primeiro === "'" || primeiro === "`") {
        erros.push(
          `${nome}:${lineOf(codigo, m.index)} passa TEXTO para ${sink}() — ` +
          `o Leaflet interpreta string como HTML. Passe um Element (ver popupFor).`,
        );
      }
    }
  }
  return erros;
}

/** Scans js/ and returns every violation found. */
export function varrerProjeto() {
  const arquivos = readdirSync(JS_DIR).filter((f) => f.endsWith(".js") || f.endsWith(".mjs"));
  // A gate that silently finds nothing to scan is a gate that turned itself off.
  if (arquivos.length === 0) return { arquivos, erros: ["nenhum arquivo .js encontrado em js/"] };
  const erros = arquivos.flatMap((nome) =>
    analisar(`js/${nome}`, readFileSync(join(JS_DIR, nome), "utf8")));
  return { arquivos, erros };
}

// Only act as a gate when run directly, so tests can import the logic.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { arquivos, erros } = varrerProjeto();
  if (erros.length) {
    console.error("GATE DE POPUP REPROVADO:\n- " + erros.join("\n- "));
    process.exit(1);
  }
  console.log(`Gate de popup aprovado: ${arquivos.length} arquivo(s), nenhum caminho de HTML cru.`);
}
