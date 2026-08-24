/**
 * movimenta7 — snapshot denylist gate (D5/ADR-0004).
 * Fails the build (exit 1) if data/snapshot.json contains forbidden keys
 * (private fields must never reach the public snapshot) or phone-like values
 * outside the explicitly-public "contato" field.
 * Run: node scripts/valida_snapshot.mjs
 */
import { readFileSync } from "node:fs";
import { isPrivateKey, looksLikePhone } from "./denylist.mjs";

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

registros.forEach((r, i) => {
  if (r == null || typeof r !== "object") return;
  for (const [k, v] of Object.entries(r)) {
    if (isPrivateKey(k)) {
      erros.push(`registro ${i}: chave proibida "${k}" (dado privado no snapshot publico)`);
    }
    if (looksLikePhone(k, v)) {
      erros.push(`registro ${i}: valor com cara de telefone no campo "${k}"`);
    }
  }
});

if (erros.length) {
  console.error("SNAPSHOT REPROVADO:\n- " + erros.join("\n- "));
  process.exit(1);
}
console.log(`Snapshot aprovado: ${registros.length} registro(s), nenhum dado privado detectado.`);
