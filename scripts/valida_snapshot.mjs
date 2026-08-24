/**
 * movimenta7 — snapshot publication gate (D5/ADR-0004).
 *
 * Fails the build (exit 1) when data/snapshot.json carries anything that must
 * not be public. Three layers, in order of strength:
 *   1. ALLOWLIST — a key outside CAMPOS_PUBLICOS is refused, whatever it is
 *      called. This is the primary control. publicar_snapshot.mjs enforced it
 *      already; this gate did not, so a hand-edited snapshot bypassed it.
 *   2. DENYLIST — the explicitly private key names, kept as a second layer so
 *      that widening the allowlist by accident still fails loudly.
 *   3. VALUE checks — phone, e-mail, CPF/CNPJ (mod-11) and links outside the
 *      contact field. Until now nothing looked at values except PHONE_LIKE.
 *
 * Run: node scripts/valida_snapshot.mjs
 */
import { readFileSync } from "node:fs";
import { CAMPOS_PUBLICOS, CHECAGENS_DE_VALOR, isPrivateKey } from "./denylist.mjs";
import { MAX_RECORDS } from "../js/util.js";

const PATH = new URL("../data/snapshot.json", import.meta.url);

let doc;
try {
  doc = JSON.parse(readFileSync(PATH, "utf8"));
} catch (e) {
  console.error("data/snapshot.json invalido ou ausente:", e.message);
  process.exit(1);
}

const registros = Array.isArray(doc) ? doc : doc.registros || [];
const erros = [];

// The browser stops rendering at MAX_RECORDS. Silently publishing more would
// mean the site shows fewer groups than the counter claims — and the truncation
// would only ever be visible to whoever read js/util.js.
if (registros.length > MAX_RECORDS) {
  erros.push(`o snapshot tem ${registros.length} registros e o site so desenha ${MAX_RECORDS}`);
}

registros.forEach((r, i) => {
  if (r == null || typeof r !== "object") {
    erros.push(`registro ${i}: nao e um objeto`);
    return;
  }
  for (const [k, v] of Object.entries(r)) {
    if (!CAMPOS_PUBLICOS.has(k)) {
      erros.push(`registro ${i}: campo "${k}" nao esta na lista de campos publicos`);
      continue; // an unknown key is already fatal; do not also report its value
    }
    if (isPrivateKey(k)) {
      erros.push(`registro ${i}: chave proibida "${k}" (dado privado no snapshot publico)`);
    }
    // Arrays (modalidades, dias) hold strings too — checking only the top level
    // would leave a phone number inside a list unexamined.
    for (const valor of Array.isArray(v) ? v : [v]) {
      for (const { teste, motivo } of CHECAGENS_DE_VALOR) {
        if (teste(k, valor)) erros.push(`registro ${i}: ${motivo} no campo "${k}"`);
      }
    }
  }
});

if (erros.length) {
  console.error("SNAPSHOT REPROVADO:\n- " + erros.join("\n- "));
  process.exit(1);
}
console.log(`Snapshot aprovado: ${registros.length} registro(s), nenhum dado privado detectado.`);
