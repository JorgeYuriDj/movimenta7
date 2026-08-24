import test from "node:test";
import assert from "node:assert/strict";
import {
  isPrivateKey, looksLikePhone, looksLikeEmail, looksLikeDocument,
  looksLikeUrlOutsideContact, keyTokens, CAMPOS_PUBLICOS,
} from "../scripts/denylist.mjs";

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

test("phone-like values are caught in EVERY field, contato included", () => {
  assert.equal(looksLikePhone("local", "61 99999-0000"), true);
  assert.equal(looksLikePhone("local", "(61)99999-0000"), true);
  assert.equal(looksLikePhone("local", "+55 61 9 9999 0000"), true);
  // This used to be exempt. A personal phone is private data wherever it is
  // written, and "contato" was the one field where publishing it was likely.
  assert.equal(looksLikePhone("contato", "61 99999-0000"), true);
  assert.equal(looksLikePhone("contato", "https://wa.me/5561999990000"), true,
    "wa.me carries the number IN the URL — the exemption published it as a link");
  assert.equal(looksLikePhone("local", "Parque da Cidade, portao 3"), false);
  assert.equal(looksLikePhone("horario", "06h30"), false);
});

test("group-invite links stay publishable: they carry no phone number", () => {
  assert.equal(looksLikePhone("contato", "https://chat.whatsapp.com/BzY7kQ2mN1p"), false);
  assert.equal(looksLikePhone("contato", "https://instagram.com/grupo_caminhada"), false);
  assert.equal(looksLikePhone("contato", "@grupo_caminhada"), false);
});

test("value checks catch e-mail, valid CPF/CNPJ and stray links", () => {
  assert.equal(looksLikeEmail("local", "fale comigo em joao@exemplo.org"), true);
  assert.equal(looksLikeEmail("local", "Igreja Central @ Asa Norte"), false);

  // Real check digits: a hit is a document, not a coincidence.
  assert.equal(looksLikeDocument("grupo", "529.982.247-25"), true);   // valid CPF
  assert.equal(looksLikeDocument("grupo", "11.222.333/0001-81"), true); // valid CNPJ
  assert.equal(looksLikeDocument("grupo", "529.982.247-26"), false);  // wrong DV
  assert.equal(looksLikeDocument("horario", "06h30 as 07h30"), false);
  assert.equal(looksLikeDocument("local", "Quadra 308 conjunto B"), false);

  assert.equal(looksLikeUrlOutsideContact("grupo", "Caminhada https://evil.example"), true);
  assert.equal(looksLikeUrlOutsideContact("contato", "https://instagram.com/grupo"), false,
    "contato is a link by design");
});
