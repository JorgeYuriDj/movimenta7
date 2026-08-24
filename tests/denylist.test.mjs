import test from "node:test";
import assert from "node:assert/strict";
import { isPrivateKey, looksLikePhone, keyTokens } from "../scripts/denylist.mjs";

test("private field names are rejected", () => {
  for (const k of [
    "telefone", "celular", "whatsapp_pessoal", "whatsapp", "email", "e-mail",
    "nome_pessoal", "responsavel", "cpf", "rg", "nascimento", "endereco_res",
    "telefonePessoal", "Telefone", "contato_pessoal",
  ]) {
    assert.equal(isPrivateKey(k), true, `"${k}" deveria ser privado`);
  }
});

// Regression: a substring denylist matched "rg" inside "organizacao" and
// "mail" inside anything, failing the build on legitimate public records.
test("public field names are NOT rejected", () => {
  for (const k of [
    "grupo", "organizacao", "regiao", "modalidades", "dias", "horario",
    "local", "contato", "lat", "lon", "atualizado_em", "cargo", "energia",
  ]) {
    assert.equal(isPrivateKey(k), false, `"${k}" e publico e nao pode ser barrado`);
  }
});

test("keyTokens splits snake_case and camelCase without accents", () => {
  assert.deepEqual(keyTokens("whatsapp_pessoal"), ["whatsapp", "pessoal"]);
  assert.deepEqual(keyTokens("telefonePessoal"), ["telefone", "pessoal"]);
  assert.deepEqual(keyTokens("organizacao"), ["organizacao"]);
  assert.deepEqual(keyTokens("região"), ["regiao"]);
});

test("phone-like values are caught outside the public contact field", () => {
  assert.equal(looksLikePhone("local", "61 99999-0000"), true);
  assert.equal(looksLikePhone("local", "(61)99999-0000"), true);
  assert.equal(looksLikePhone("local", "+55 61 9 9999 0000"), true);
  // "contato" is the one field the organizer explicitly marked as public
  assert.equal(looksLikePhone("contato", "61 99999-0000"), false);
  assert.equal(looksLikePhone("local", "Parque da Cidade, portao 3"), false);
  assert.equal(looksLikePhone("horario", "06h30"), false);
});
