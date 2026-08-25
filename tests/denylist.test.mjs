import test from "node:test";
import assert from "node:assert/strict";
import {
  isPrivateKey, looksLikePhone, looksLikeEmail, looksLikeDocument,
  looksLikeUrlOutsideLinkFields, linkNaoPermitido, keyTokens, CAMPOS_PUBLICOS,
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
    "local", "rede_social", "mapa", "custo", "publico",
    "orientacao_profissional", "lat", "lon", "atualizado_em",
  ]) {
    assert.equal(isPrivateKey(k), false, `"${k}" e publico e nao pode ser barrado`);
  }
});

// Every key the publication step writes has to be on the allowlist, or the
// gate downstream refuses the snapshot the pipeline just produced.
test("a allowlist cobre exatamente os campos que o site publica", () => {
  for (const k of [
    "grupo", "organizacao", "regiao", "modalidades", "dias", "horario", "local",
    "custo", "publico", "orientacao_profissional", "rede_social", "mapa", "lat", "lon",
  ]) {
    assert.equal(CAMPOS_PUBLICOS.has(k), true, `"${k}" precisa estar em CAMPOS_PUBLICOS`);
  }
  // "contato" aceitava qualquer destino http(s) e saiu com o WhatsApp (ADR-0006).
  assert.equal(CAMPOS_PUBLICOS.has("contato"), false);
});

test("keyTokens splits snake_case and camelCase without accents", () => {
  assert.deepEqual(keyTokens("whatsapp_pessoal"), ["whatsapp", "pessoal"]);
  assert.deepEqual(keyTokens("telefonePessoal"), ["telefone", "pessoal"]);
  assert.deepEqual(keyTokens("organizacao"), ["organizacao"]);
  assert.deepEqual(keyTokens("região"), ["regiao"]);
});

test("phone-like values are caught in every free-text field", () => {
  assert.equal(looksLikePhone("local", "61 99999-0000"), true);
  assert.equal(looksLikePhone("local", "(61)99999-0000"), true);
  assert.equal(looksLikePhone("local", "+55 61 9 9999 0000"), true);
  assert.equal(looksLikePhone("grupo", "Corrida - chame no 61 99999-0000"), true);
  assert.equal(looksLikePhone("local", "Parque da Cidade, portao 3"), false);
  assert.equal(looksLikePhone("horario", "06h30"), false);
});

/* The link fields are exempt from the digit checks, and the reason is not the
   old "contato is special" — it is that they are never free text. The ingest
   rewrites them to an allowlisted URL or drops them, so a phone cannot survive
   in there, while digit soup that merely looks like one certainly can. */
test("os campos de link ficam fora das checagens de digitos, com rede de seguranca", () => {
  const mapaReal = "https://www.google.com/maps/place/Parque/@-15.7942287,-47.8821658,17z";
  assert.equal(looksLikePhone("mapa", mapaReal), false, "coordenada nao e telefone");
  assert.equal(looksLikeDocument("mapa", mapaReal), false);
  assert.equal(looksLikePhone("rede_social", "https://www.instagram.com/61999990000"), false,
    "um @ pode ser so digitos e continua sendo um perfil publico");

  // A rede: o que segura esses campos e a lista de destinos, nao o regex.
  assert.equal(linkNaoPermitido("mapa", mapaReal), false);
  assert.equal(linkNaoPermitido("rede_social", "https://www.instagram.com/61999990000"), false);
  assert.equal(linkNaoPermitido("rede_social", "https://wa.me/5561999990000"), true,
    "WhatsApp saiu da lista: o numero E a URL");
  assert.equal(linkNaoPermitido("mapa", "https://drive.google.com/file/d/1"), true);
  assert.equal(linkNaoPermitido("rede_social", ""), false, "vazio nao reprova nada");
  assert.equal(linkNaoPermitido("local", "https://qualquer.example"), false,
    "so olha os dois campos de link");
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

  // Com publicacao automatica, este e o que impede um link nao vistoriado de
  // entrar escondido no NOME do grupo, onde nenhuma allowlist olha.
  assert.equal(looksLikeUrlOutsideLinkFields("grupo", "Caminhada https://premio-falso.example"), true);
  assert.equal(looksLikeUrlOutsideLinkFields("local", "Parque, veja www.exemplo.com"), true);
  assert.equal(looksLikeUrlOutsideLinkFields("rede_social", "https://instagram.com/grupo"), false,
    "rede_social e mapa sao links por natureza");
  assert.equal(looksLikeUrlOutsideLinkFields("mapa", "https://maps.app.goo.gl/x"), false);
});
