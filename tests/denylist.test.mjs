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
    "orientacao_profissional", "lat", "lon", "posicao", "atualizado_em",
  ]) {
    assert.equal(isPrivateKey(k), false, `"${k}" e publico e nao pode ser barrado`);
  }
});

// Every key the publication step writes has to be on the allowlist, or the
// gate downstream refuses the snapshot the pipeline just produced.
test("a allowlist cobre exatamente os campos que o site publica", () => {
  for (const k of [
    "grupo", "organizacao", "regiao", "modalidades", "dias", "horario", "local",
    "custo", "publico", "orientacao_profissional", "rede_social", "mapa", "lat", "lon", "posicao",
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
  assert.equal(looksLikePhone("local", "61/99999/0000"), true);
  assert.equal(looksLikePhone("grupo", "Corrida - chame no 61 99999-0000"), true);
  assert.equal(looksLikePhone("local", "Parque da Cidade, portao 3"), false);
  assert.equal(looksLikePhone("horario", "06h30"), false);
});

/* Maps coordinates need an exemption from the generic digit regex. Social
   links still get a stricter profile-level check in linkRedeSocial(), so a
   phone-shaped handle cannot use that exemption to become public. */
test("os campos de link ficam fora das checagens de digitos, com rede de seguranca", () => {
  const mapaReal = "https://www.google.com/maps/place/Parque/@-15.7942287,-47.8821658,17z";
  assert.equal(looksLikePhone("mapa", mapaReal), false, "coordenada nao e telefone");
  assert.equal(looksLikeDocument("mapa", mapaReal), false);
  assert.equal(looksLikePhone("rede_social", "https://www.instagram.com/61999990000"), false,
    "a regex generica nao deve confundir coordenadas; o normalizador faz a barreira social");

  // A rede: o que segura esses campos e a lista de destinos, nao o regex.
  assert.equal(linkNaoPermitido("mapa", mapaReal), false);
  assert.equal(linkNaoPermitido("rede_social", "https://www.instagram.com/61999990000"), true,
    "perfil com identificador de telefone e recusado antes do snapshot");
  assert.equal(linkNaoPermitido("rede_social", "https://wa.me/5561999990000"), true,
    "WhatsApp saiu da lista: o numero E a URL");
  assert.equal(linkNaoPermitido("mapa", "https://drive.google.com/file/d/1"), true);
  assert.equal(linkNaoPermitido("rede_social", ""), false, "vazio nao reprova nada");
  assert.equal(linkNaoPermitido("local", "https://qualquer.example"), false,
    "so olha os dois campos de link");
});

test("a excecao de coordenadas nao vira excecao de PII dentro do link de mapa", () => {
  const coordenadaPrecisa = "https://www.google.com/maps/@-15.79422870,-47.88216580,17z";
  assert.equal(looksLikePhone("mapa", coordenadaPrecisa), false);
  assert.equal(looksLikeDocument("mapa", coordenadaPrecisa), false);

  assert.equal(looksLikePhone("mapa", "https://maps.google.com/?q=61%2099999-0000"), true);
  assert.equal(looksLikeEmail("mapa", "https://maps.google.com/?q=joao%40exemplo.org"), true);
  assert.equal(looksLikeDocument("mapa", "https://maps.google.com/?q=529.982.247-25"), true);
  assert.equal(looksLikeDocument("mapa", "https://maps.google.com/?q=052998224725"), true,
    "um digito extra nao pode esconder um CPF valido");
  assert.equal(looksLikeDocument("mapa", "https://maps.google.com/?q=11.222.333%2F0001-81"), true);
});

test("o gate exige a forma canonica que a ingestao grava", () => {
  assert.equal(linkNaoPermitido("mapa", "https://maps.app.goo.gl/abc?g_st=ic"), true);
  assert.equal(linkNaoPermitido("mapa", "https://maps.app.goo.gl/abc"), false);
  assert.equal(linkNaoPermitido("mapa", "https://share.google/FfiPZmaScAgrNXWab"), false,
    "a entrada curta e validada pela resolucao assincrona antes do snapshot");
  assert.equal(linkNaoPermitido("mapa", "https://share.google/FfiPZmaScAgrNXWab?tracker=x"), true);
  assert.equal(linkNaoPermitido("rede_social", "http://instagram.com/grupo?utm_source=x"), true);
  assert.equal(linkNaoPermitido("rede_social", "https://instagram.com/grupo"), false);
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
