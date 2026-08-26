/* movimenta7 — mapa, busca e cadastro integrado.
   Regra de segurança: todo texto de cadastro chega ao DOM por textContent.
   Popups do Leaflet recebem Elements; links comunitários já vêm da allowlist. */
import { safeUrl, parseSnapshot, descreveIdade, snapshotAtrasado, pinModalidade } from "./util.js";

const CFG = window.MOV7_CONFIG || {};
const URLS = { form: safeUrl(CFG.FORM_URL), repo: safeUrl(CFG.REPO_URL) };
const POLL_NORMAL = 60_000;
const POLL_CADASTRO = 20_000;
const LEAFLET = {
  css: { id: "mov7-leaflet-css", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", integrity: "sha256-p4NxAoJBhIIN+hmNHrzRCF9tD/miZyoHS5obTRR9BMY=" },
  js: { id: "mov7-leaflet-js", src: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", integrity: "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" },
};
const EMOJI = { corrida: "🏃", caminhada: "🚶", ciclismo: "🚴", volei: "🏐", futebol: "⚽", funcional: "💪", trilhas: "⛰️", natacao: "🏊", outra: "🤸" };

const $ = (sel) => document.querySelector(sel);
const criar = (tag, classe, texto) => {
  const node = document.createElement(tag);
  if (classe) node.className = classe;
  if (texto != null) node.textContent = texto;
  return node;
};

let RECORDS = [];
let FILTRADOS = [];
let ATUALIZADO_EM = "";
let ESTADO_DADOS = "carregando";
let JA_CARREGOU = false;
let CARGA_EM_CURSO = null;
let TIMER_ATUALIZACAO = null;
let MAP = null;
let LREF = null;
let RA_LAYER = null;
let TILE_LAYER = null;
let MARKER_LAYER = null;
let MAP_PROMISE = null;
const MARKERS = new Map();

function temaEscuro() {
  const tema = document.documentElement.getAttribute("data-theme");
  return tema === "dark" || (!tema && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

function atualizarBotaoTema() {
  const btn = $("#botao-tema");
  if (!btn) return;
  const dark = temaEscuro();
  btn.setAttribute("aria-pressed", String(dark));
  btn.setAttribute("aria-label", dark ? "Mudar para tema claro" : "Mudar para tema escuro");
  const icone = btn.querySelector(".icone-tema");
  if (icone) icone.textContent = dark ? "☀" : "◐";
}

function initTheme() {
  const btn = $("#botao-tema");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const next = temaEscuro() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("mov7-tema", next); } catch (e) { /* modo privado */ }
    atualizarBotaoTema();
    trocarTiles();
  });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", () => {
      if (!document.documentElement.getAttribute("data-theme")) {
        atualizarBotaoTema();
        trocarTiles();
      }
    });
  }
  atualizarBotaoTema();
}

function urlFormEmbutido() {
  if (!URLS.form) return "";
  try {
    const p = new URL(URLS.form);
    if (p.protocol !== "https:" || p.hostname !== "docs.google.com" || !p.pathname.startsWith("/forms/")) return "";
    p.searchParams.set("embedded", "true");
    return p.href;
  } catch (e) { return ""; }
}

function fecharCadastro() {
  const dialog = $("#cadastro-dialog");
  if (dialog && dialog.open) dialog.close();
}

function abrirCadastro(event) {
  const dialog = $("#cadastro-dialog");
  const frame = $("#cadastro-frame");
  const embutido = urlFormEmbutido();
  if (!dialog || !frame || !embutido || typeof dialog.showModal !== "function") return;
  if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
  if (event) event.preventDefault();
  if (!frame.hasAttribute("src")) frame.src = embutido;
  if (!dialog.open) dialog.showModal();
  document.body.classList.add("dialog-aberto");
  agendarAtualizacao(POLL_CADASTRO);
}

function wireCtas() {
  const ctas = [...document.querySelectorAll("[data-cadastro]")];
  for (const a of ctas) {
    if (!URLS.form) continue;
    a.href = URLS.form;
    a.classList.remove("oculto");
    a.addEventListener("click", abrirCadastro);
  }
  const aviso = $("#aviso-form");
  if (aviso && URLS.form) aviso.classList.add("oculto");
  const fixo = $("#cta-fixo");
  if (fixo && URLS.form) fixo.classList.remove("oculto");

  for (const sel of ["#link-remocao", "#link-denuncia"]) {
    const a = $(sel);
    if (!a) continue;
    if (URLS.form) {
      a.href = URLS.form;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    } else {
      a.replaceWith(document.createTextNode(a.textContent));
    }
  }
  const externo = $("#cadastro-externo");
  if (externo && URLS.form) externo.href = URLS.form;
  const repo = $("#link-repo");
  if (repo && URLS.repo) repo.href = URLS.repo;

  $("#cadastro-fechar")?.addEventListener("click", fecharCadastro);
  $("#cadastro-voltar")?.addEventListener("click", fecharCadastro);
  const dialog = $("#cadastro-dialog");
  dialog?.addEventListener("close", () => {
    document.body.classList.remove("dialog-aberto");
    loadSnapshot({ silencioso: true });
    agendarAtualizacao();
  });
}

function setEstadoDados(estado, mensagem = "") {
  ESTADO_DADOS = estado;
  const caixa = $("#dados-status");
  const texto = $("#dados-status-texto");
  const retry = $("#dados-tentar");
  if (!caixa || !texto || !retry) return;
  caixa.dataset.estado = estado;
  retry.classList.toggle("oculto", estado !== "erro");
  if (estado === "carregando") texto.textContent = "Buscando as atividades mais recentes…";
  else if (estado === "erro") texto.textContent = mensagem || "Não foi possível carregar as atividades agora.";
  else if (estado === "vazio") texto.textContent = "O mapa está pronto para receber os primeiros grupos.";
  else if (mensagem) texto.textContent = mensagem;
  else caixa.classList.add("oculto");
  if (estado !== "pronto" || mensagem) caixa.classList.remove("oculto");
  const mapa = $("#mapa");
  if (mapa) mapa.setAttribute("aria-busy", String(estado === "carregando"));
}

function urlSnapshot() {
  const url = new URL("data/snapshot.json", document.baseURI);
  // One shared URL per minute lets GitHub's CDN serve every visitor from the
  // same cache bucket while still making a new publication visible promptly.
  url.searchParams.set("v", String(Math.floor(Date.now() / POLL_NORMAL)));
  return url.href;
}

async function carregarSnapshot({ silencioso = false } = {}) {
  if (!silencioso && !JA_CARREGOU) setEstadoDados("carregando");
  try {
    const resp = await fetch(urlSnapshot(), { headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error("snapshot " + resp.status);
    const bruto = await resp.json();
    const novos = parseSnapshot(bruto);
    RECORDS = novos;
    ATUALIZADO_EM = bruto && typeof bruto.atualizado_em === "string" ? bruto.atualizado_em : "";
    JA_CARREGOU = true;
    setEstadoDados(novos.length ? "pronto" : "vazio");
    sincronizarOpcoes();
    aplicarFiltros();
    atualizarSelo();
  } catch (e) {
    console.warn("Snapshot indisponível:", e);
    const mensagem = JA_CARREGOU
      ? "Não conseguimos conferir novidades agora. A última lista carregada continua visível."
      : "As atividades estão temporariamente indisponíveis. O cadastro continua funcionando.";
    setEstadoDados("erro", mensagem);
    if (!JA_CARREGOU) {
      RECORDS = [];
      aplicarFiltros();
    }
  }
}

function loadSnapshot(opcoes) {
  if (CARGA_EM_CURSO) return CARGA_EM_CURSO;
  CARGA_EM_CURSO = carregarSnapshot(opcoes).finally(() => { CARGA_EM_CURSO = null; });
  return CARGA_EM_CURSO;
}

function atualizarSelo() {
  const el = $("#atualizado");
  if (!el) return;
  const idade = descreveIdade(ATUALIZADO_EM);
  if (!idade) {
    delete el.dataset.estado;
    el.textContent = "";
    el.classList.add("oculto");
    return;
  }
  const atrasado = snapshotAtrasado(ATUALIZADO_EM);
  el.dataset.estado = atrasado ? "atrasado" : "atual";
  el.textContent = atrasado
    ? "Atualização atrasada — última lista gerada " + idade + ". Estamos tentando sincronizar."
    : "Lista atualizada " + idade + ". O mapa confere novidades automaticamente.";
  el.classList.remove("oculto");
}

function normalizarBusca(valor) {
  return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function preencherSelect(select, valores) {
  if (!select) return;
  const atual = select.value;
  while (select.options.length > 1) select.remove(1);
  for (const valor of valores) {
    const option = document.createElement("option");
    option.value = valor;
    option.textContent = valor;
    select.appendChild(option);
  }
  if (valores.includes(atual)) select.value = atual;
}

function sincronizarOpcoes() {
  const modalidades = [...new Set(RECORDS.flatMap((r) => r.modalidades).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const regioes = [...new Set(RECORDS.map((r) => r.regiao).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  preencherSelect($("#filtro-modalidade"), modalidades);
  preencherSelect($("#filtro-regiao"), regioes);
  for (const campo of document.querySelectorAll("#filtros input, #filtros select")) campo.disabled = !RECORDS.length;
}

function filtrosAtivos() {
  return Boolean($("#busca")?.value || $("#filtro-modalidade")?.value || $("#filtro-regiao")?.value);
}

function aplicarFiltros({ ajustarMapa = false } = {}) {
  const termo = normalizarBusca($("#busca")?.value);
  const modalidade = $("#filtro-modalidade")?.value || "";
  const regiao = $("#filtro-regiao")?.value || "";
  FILTRADOS = RECORDS.map((rec, index) => ({ rec, index })).filter(({ rec }) => {
    const palheiro = normalizarBusca([rec.grupo, rec.organizacao, rec.regiao, rec.local, ...rec.modalidades].join(" "));
    return (!termo || palheiro.includes(termo)) &&
      (!modalidade || rec.modalidades.includes(modalidade)) &&
      (!regiao || rec.regiao === regiao);
  });
  $("#limpar-filtros")?.classList.toggle("oculto", !filtrosAtivos());
  renderizarLista();
  atualizarContadores();
  desenharPins();
  if (ajustarMapa) enquadrarFiltrados();
}

function atualizarContadores() {
  const total = RECORDS.length;
  const n = FILTRADOS.length;
  const resumo = $("#resultado-resumo");
  const contador = $("#contador");
  if (resumo) {
    if (ESTADO_DADOS === "erro" && !JA_CARREGOU) resumo.textContent = "Dados indisponíveis";
    else if (filtrosAtivos()) resumo.textContent = `${n} de ${total} ${total === 1 ? "grupo" : "grupos"}`;
    else resumo.textContent = total === 1 ? "1 grupo publicado" : `${total} grupos publicados`;
  }
  if (!contador) return;
  const regioes = new Set(RECORDS.map((r) => r.regiao).filter(Boolean)).size;
  if (ESTADO_DADOS === "erro" && !JA_CARREGOU) contador.textContent = "Não foi possível consultar o mapa agora";
  else if (total === 0) contador.textContent = "Seja o primeiro grupo no mapa";
  else contador.textContent = `${total} ${total === 1 ? "grupo" : "grupos"} em ${regioes} ${regioes === 1 ? "região" : "regiões"} do DF`;
}

function linhaInfo(icone, texto) {
  if (!texto) return null;
  const p = criar("p");
  p.appendChild(criar("span", "", icone));
  p.appendChild(criar("span", "", texto));
  return p;
}

function linkAcao(url, texto, classe = "") {
  const a = criar("a", "acao-card " + classe, texto);
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer nofollow";
  return a;
}

function renderizarLista() {
  const lista = $("#lista-grupos");
  const vazia = $("#lista-vazia");
  if (!lista || !vazia) return;
  lista.replaceChildren();
  const semResultado = FILTRADOS.length === 0;
  vazia.classList.toggle("oculto", !semResultado);
  lista.classList.toggle("oculto", semResultado);
  if (semResultado) {
    const titulo = vazia.querySelector("strong");
    const texto = vazia.querySelector("p");
    if (ESTADO_DADOS === "erro" && !JA_CARREGOU) {
      if (titulo) titulo.textContent = "Atividades indisponíveis";
      if (texto) texto.textContent = "Tente novamente em instantes. O formulário de cadastro segue disponível.";
    } else if (!RECORDS.length) {
      if (titulo) titulo.textContent = "O mapa está começando";
      if (texto) texto.textContent = "Adicione o primeiro grupo e ajude sua região a se movimentar.";
    } else {
      if (titulo) titulo.textContent = "Nenhuma atividade encontrada";
      if (texto) texto.textContent = "Tente retirar um filtro ou pesquisar outro termo.";
    }
    $("#faixa-nascendo")?.classList.toggle("oculto", RECORDS.length !== 0 || ESTADO_DADOS === "erro");
    return;
  }
  $("#faixa-nascendo")?.classList.add("oculto");

  const frag = document.createDocumentFragment();
  for (const { rec, index } of FILTRADOS) {
    const li = criar("li", "grupo-card");
    const topo = criar("div", "grupo-card-topo");
    const slug = pinModalidade(rec.modalidades);
    topo.appendChild(criar("span", "grupo-card-icone", EMOJI[slug] || EMOJI.outra));
    const titulo = criar("div", "grupo-card-titulo");
    titulo.appendChild(criar("h4", "", rec.grupo));
    titulo.appendChild(criar("p", "grupo-card-modalidade", rec.modalidades.join(" · ") || "Atividade física"));
    topo.appendChild(titulo);
    li.appendChild(topo);

    const info = criar("div", "grupo-card-info");
    const quando = [rec.dias.join(", "), rec.horario].filter(Boolean).join(" · ");
    const onde = [rec.local, rec.regiao].filter(Boolean).join(" · ");
    for (const linha of [linhaInfo("◷", quando), linhaInfo("⌖", onde), linhaInfo("◎", rec.organizacao)]) {
      if (linha) info.appendChild(linha);
    }
    if (info.childElementCount) li.appendChild(info);
    li.appendChild(criar("p", "precisao", rec.posicao === "exata" ? "Ponto exato do link" : "Posição aproximada na região"));

    const acoes = criar("div", "grupo-card-acoes");
    if (rec.mapaUrl) acoes.appendChild(linkAcao(rec.mapaUrl, "Como chegar ↗", "acao-card--rota"));
    if (rec.redeUrl) acoes.appendChild(linkAcao(rec.redeUrl, rec.redeRotulo || "Rede social"));
    if (rec.lat != null && rec.lon != null) {
      const ver = criar("button", "acao-card", "Ver no mapa");
      ver.type = "button";
      ver.addEventListener("click", () => abrirNoMapa(index));
      acoes.appendChild(ver);
    }
    if (acoes.childElementCount) li.appendChild(acoes);
    frag.appendChild(li);
  }
  lista.appendChild(frag);
}

function initFiltros() {
  let buscaTimer;
  $("#busca")?.addEventListener("input", () => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(() => aplicarFiltros(), 120);
  });
  $("#filtro-modalidade")?.addEventListener("change", () => aplicarFiltros({ ajustarMapa: true }));
  $("#filtro-regiao")?.addEventListener("change", () => aplicarFiltros({ ajustarMapa: true }));
  $("#filtros")?.addEventListener("submit", (e) => e.preventDefault());
  $("#limpar-filtros")?.addEventListener("click", () => {
    const busca = $("#busca"), modalidade = $("#filtro-modalidade"), regiao = $("#filtro-regiao");
    if (busca) busca.value = "";
    if (modalidade) modalidade.value = "";
    if (regiao) regiao.value = "";
    aplicarFiltros({ ajustarMapa: true });
    busca?.focus();
  });
  $("#dados-tentar")?.addEventListener("click", () => loadSnapshot());
}

function loadAsset(tag, attrs) {
  const existente = document.getElementById(attrs.id);
  if (existente && (existente.dataset.loaded === "true" || (tag === "link" && existente.sheet))) return Promise.resolve();
  if (existente) existente.remove();
  return new Promise((resolve, reject) => {
    const el = document.createElement(tag);
    Object.assign(el, attrs);
    el.crossOrigin = "anonymous";
    el.onload = () => { el.dataset.loaded = "true"; resolve(); };
    el.onerror = () => { el.remove(); reject(new Error("falha ao carregar " + (attrs.href || attrs.src))); };
    document.head.appendChild(el);
  });
}

function tileConfig() {
  return temaEscuro()
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
}

function trocarTiles() {
  if (!MAP || !LREF) return;
  if (TILE_LAYER) MAP.removeLayer(TILE_LAYER);
  let erros = 0;
  const camada = LREF.tileLayer(tileConfig(), {
    subdomains: "abcd", maxZoom: 19, attribution: "© OpenStreetMap contributors © CARTO",
  }).addTo(MAP);
  TILE_LAYER = camada;
  camada.on("tileerror", () => {
    erros++;
    if (erros !== 4 || !MAP || camada !== MAP._mov7TileLayer) return;
    MAP.removeLayer(camada);
    TILE_LAYER = LREF.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "© OpenStreetMap contributors",
    }).addTo(MAP);
    MAP._mov7TileLayer = TILE_LAYER;
  });
  MAP._mov7TileLayer = camada;
}

function setEstadoMapa(estado, mensagem = "") {
  const caixa = $("#mapa-status");
  const texto = $("#mapa-status-texto");
  const retry = $("#mapa-tentar");
  if (!caixa || !texto || !retry) return;
  caixa.classList.toggle("pronto", estado === "pronto");
  retry.classList.toggle("oculto", estado !== "erro");
  texto.textContent = mensagem || (estado === "carregando" ? "Preparando o mapa…" : "");
  $("#mapa")?.setAttribute("aria-busy", String(estado === "carregando"));
}

async function startMap() {
  if (MAP) return MAP;
  if (MAP_PROMISE) return MAP_PROMISE;
  setEstadoMapa("carregando");
  MAP_PROMISE = (async () => {
    try {
      await Promise.all([
        loadAsset("link", { rel: "stylesheet", ...LEAFLET.css }),
        loadAsset("script", LEAFLET.js),
      ]);
      const resp = await fetch("data/ra_df.geojson", { cache: "force-cache" });
      if (!resp.ok) throw new Error("geojson " + resp.status);
      const geo = await resp.json();
      LREF = window.L;
      if (!LREF) throw new Error("Leaflet indisponível");
      MAP = LREF.map("mapa", { scrollWheelZoom: false, maxBoundsViscosity: 1, zoomControl: true });
      RA_LAYER = LREF.geoJSON(geo, { style: { color: "#15803D", weight: 1, opacity: .5, fillOpacity: .035 } }).addTo(MAP);
      MAP.fitBounds(RA_LAYER.getBounds(), { padding: [12, 12] });
      MAP.setMaxBounds(RA_LAYER.getBounds().pad(.15));
      MARKER_LAYER = LREF.layerGroup().addTo(MAP);
      trocarTiles();
      desenharPins();
      MAP.on("popupopen", (e) => {
        document.body.classList.add("popup-aberto");
        e.popup._source?.getElement()?.setAttribute("aria-expanded", "true");
      });
      MAP.on("popupclose", (e) => {
        document.body.classList.remove("popup-aberto");
        e.popup._source?.getElement()?.setAttribute("aria-expanded", "false");
      });
      setEstadoMapa("pronto");
      setTimeout(() => MAP?.invalidateSize(), 0);
      return MAP;
    } catch (e) {
      console.warn("Mapa não carregou:", e);
      if (MAP) { MAP.remove(); MAP = null; }
      LREF = null;
      setEstadoMapa("erro", "Não foi possível carregar o mapa. A lista de atividades e os links continuam disponíveis.");
      throw e;
    } finally {
      MAP_PROMISE = null;
    }
  })();
  return MAP_PROMISE;
}

function popupCampo(dl, rotulo, valor) {
  if (!valor) return;
  dl.appendChild(criar("dt", "", rotulo));
  dl.appendChild(criar("dd", "", valor));
}

function popupFor(rec) {
  const box = criar("div", "popup-grupo");
  box.appendChild(criar("strong", "popup-titulo", rec.grupo));
  box.appendChild(criar("div", "popup-modalidade", rec.modalidades.join(" · ") || "Atividade física"));
  const dl = criar("dl", "popup-campos");
  popupCampo(dl, "Quando", [rec.dias.join(", "), rec.horario].filter(Boolean).join(" · "));
  popupCampo(dl, "Local", rec.local);
  popupCampo(dl, "Região", rec.regiao);
  popupCampo(dl, "Grupo", rec.organizacao);
  popupCampo(dl, "Custo", rec.custo);
  popupCampo(dl, "Aberto", rec.publico.join(" · "));
  if (dl.childElementCount) box.appendChild(dl);
  box.appendChild(criar("p", "popup-precisao", rec.posicao === "exata" ? "Ponto extraído do link do mapa." : "Posição aproximada — centro da região."));
  const links = criar("div", "popup-links");
  const anexar = (url, texto, classe = "") => {
    if (!url) return;
    const a = criar("a", classe, texto);
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer nofollow";
    links.appendChild(a);
  };
  anexar(rec.mapaUrl, "Como chegar ↗", "popup-rota");
  anexar(rec.redeUrl, rec.redeRotulo || "Rede social");
  if (links.childElementCount) box.appendChild(links);
  return box;
}

function rotuloPin(rec) {
  const precisao = rec.posicao === "exata" ? "posição exata" : "posição aproximada";
  return ["Abrir detalhes de " + rec.grupo, rec.modalidades.join(", "), rec.regiao, precisao].filter(Boolean).join(" — ");
}

function posicoesVisuais(entradas) {
  const grupos = new Map();
  for (const entrada of entradas) {
    const { rec } = entrada;
    if (rec.lat == null || rec.lon == null) continue;
    const chave = `${rec.lat.toFixed(6)},${rec.lon.toFixed(6)}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(entrada);
  }
  const saida = new Map();
  for (const grupo of grupos.values()) {
    if (grupo.length === 1) {
      saida.set(grupo[0].index, [grupo[0].rec.lat, grupo[0].rec.lon]);
      continue;
    }
    const raio = Math.min(.00032, .00012 + grupo.length * .000018);
    grupo.forEach((entrada, ordem) => {
      const angulo = (Math.PI * 2 * ordem) / grupo.length;
      const lat = entrada.rec.lat + Math.cos(angulo) * raio;
      const fatorLon = Math.max(.25, Math.cos(entrada.rec.lat * Math.PI / 180));
      const lon = entrada.rec.lon + Math.sin(angulo) * raio / fatorLon;
      saida.set(entrada.index, [lat, lon]);
    });
  }
  return saida;
}

function desenharPins() {
  if (!MAP || !LREF || !MARKER_LAYER) return;
  MARKER_LAYER.clearLayers();
  MARKERS.clear();
  const posicoes = posicoesVisuais(FILTRADOS);
  for (const { rec, index } of FILTRADOS) {
    const posicao = posicoes.get(index);
    if (!posicao) continue;
    const classePrecisao = rec.posicao === "exata" ? "" : " pin-mov--aproximado";
    const icone = LREF.divIcon({
      className: "pin-mov pin-mov--" + pinModalidade(rec.modalidades) + classePrecisao,
      iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -19],
    });
    const marcador = LREF.marker(posicao, { icon: icone, title: rec.grupo, riseOnHover: true, keyboard: true })
      .addTo(MARKER_LAYER).bindPopup(popupFor(rec));
    MARKERS.set(index, marcador);
    const preparar = () => {
      const el = marcador.getElement();
      if (!el) return;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", rotuloPin(rec));
      el.setAttribute("aria-expanded", "false");
    };
    marcador.on("add", preparar);
    preparar();
  }
}

function enquadrarFiltrados() {
  if (!MAP || !LREF) return;
  const pontos = FILTRADOS.map(({ index }) => MARKERS.get(index)?.getLatLng()).filter(Boolean);
  if (!pontos.length) {
    if (RA_LAYER) MAP.fitBounds(RA_LAYER.getBounds(), { padding: [12, 12] });
  } else if (pontos.length === 1) {
    MAP.flyTo(pontos[0], 13, { duration: .5 });
  } else {
    MAP.fitBounds(LREF.latLngBounds(pontos), { padding: [42, 42], maxZoom: 13 });
  }
}

async function abrirNoMapa(index) {
  try { await startMap(); } catch (e) { return; }
  const marcador = MARKERS.get(index);
  if (!marcador || !MAP) return;
  const rec = RECORDS[index];
  MAP.flyTo(marcador.getLatLng(), rec?.posicao === "exata" ? 15 : 12, { duration: .55 });
  marcador.openPopup();
  $("#mapa")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function initMapFacade() {
  $("#mapa-tentar")?.addEventListener("click", () => startMap().catch(() => {}));
  const alvo = $("#secao-mapa");
  if (!alvo || !("IntersectionObserver" in window)) { startMap().catch(() => {}); return; }
  const obs = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      obs.disconnect();
      startMap().catch(() => {});
    }
  }, { rootMargin: "500px 0px" });
  obs.observe(alvo);
}

function agendarAtualizacao(atraso) {
  clearTimeout(TIMER_ATUALIZACAO);
  const dialogAberto = $("#cadastro-dialog")?.open;
  const ms = atraso || (dialogAberto ? POLL_CADASTRO : POLL_NORMAL);
  TIMER_ATUALIZACAO = setTimeout(async () => {
    if (!document.hidden) await loadSnapshot({ silencioso: true });
    agendarAtualizacao();
  }, ms);
}

function initAtualizacaoAutomatica() {
  const conferir = () => {
    if (!document.hidden) loadSnapshot({ silencioso: true });
    atualizarSelo();
    agendarAtualizacao();
  };
  window.addEventListener("focus", conferir);
  window.addEventListener("online", conferir);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) conferir(); });
  agendarAtualizacao();
  setInterval(atualizarSelo, 60_000);
}

initTheme();
wireCtas();
initFiltros();
initMapFacade();
loadSnapshot().finally(initAtualizacaoAutomatica);
