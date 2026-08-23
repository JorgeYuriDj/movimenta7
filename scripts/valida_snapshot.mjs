/**
 * movimenta7 — snapshot denylist gate (D5/ADR-0004).
 * Fails the build (exit 1) if data/snapshot.json contains forbidden keys
 * (private fields must never reach the public snapshot) or phone-like values
 * outside the explicitly-public "contato" field.
 * Run: node scripts/valida_snapshot.mjs
 */
import { readFileSync } from "node:fs";

const PATH = new URL("../data/snapshot.json", import.meta.url);
const FORBIDDEN_KEYS = /(telefone|celular|whatsapp_pessoal|e?-?mail|nome_pessoal|responsavel|cpf|rg|nascimento|endereco_res)/i;
// 61 99999-0000 · (61)99999-0000 · +55 61 9 9999 0000 …
const PHONE_LIKE = /(\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\s?\d{4}[\s.-]?\d{4}/;

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
    if (FORBIDDEN_KEYS.test(k)) {
      erros.push(`registro ${i}: chave proibida "${k}" (dado privado no snapshot publico)`);
    }
    // "contato" is the one field the organizer explicitly marked as public
    if (k !== "contato" && typeof v === "string" && PHONE_LIKE.test(v)) {
      erros.push(`registro ${i}: valor com cara de telefone no campo "${k}"`);
    }
  }
});

if (erros.length) {
  console.error("SNAPSHOT REPROVADO:\n- " + erros.join("\n- "));
  process.exit(1);
}
console.log(`Snapshot aprovado: ${registros.length} registro(s), nenhum dado privado detectado.`);
