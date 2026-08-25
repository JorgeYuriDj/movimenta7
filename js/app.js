/* ============================================================
   movimenta7 — landing (Fase 0)
   Vanilla JS. Flow:
   1) wire CTAs from js/config.js (form), with safe fallbacks
   2) load data/snapshot.json → counter + freshness seal + map pins
   3) Leaflet is loaded ON DEMAND (facade pattern) with SRI hashes —
      it is the page's biggest third-party script (ADR-0003)
   Security (ADR-0004): data-borne text reaches the DOM ONLY via
   textContent; community links pass through the host allowlist in
   util.js, never through safeUrl(). Do not relax this — since
   ADR-0006 no human reads a submission before it is drawn here.
   ============================================================ */

import { safeUrl, parseSnapshot, descreveIdade, pinModalidade } from "./util.js";

const CFG = window.MOV7_CONFIG || {};
const URLS = {
  form: safeUrl(CFG.FORM_URL),
  repo: safeUrl(CFG.REPO_URL),
};

// Computed by scripts/valida_contraste.mjs's sibling check (hashes of the real
// unpkg files, verified at build on 23/08/2026 — see ADR-0003).
const LEAFLET = {
  css: {
    href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    integrity: "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=",
  },
  js: {
    src: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    integrity: "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=",
  },
};

const $ = (sel) => document.querySelector(sel);

// ---------- theme toggle ----------

function initTheme() {
  const btn = $("#botao-tema");
  if (!btn) return;
  const setPressed = () => {
    const dark = document.documentElement.getAttribute("data-theme") === "dark" ||
      (!document.documentElement.getAttribute("data-theme") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    btn.setAttribute("aria-pressed", String(dark));
    btn.setAttribute("aria-label", dark ? "Mudar para tema claro" : "Mudar para tema escuro");
  };
  btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = (cur ? cur === "dark" : sysDark) ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("mov7-tema", next); } catch (e) { /* private mode */ }
    setPressed();
  });
  setPressed();
}

// ---------- CTAs ----------

function wireCtas() {
  const ctas = [$("#cta-hero"), $("#cta-topo"), $("#cta-fixo-link")];
  for (const a of ctas) {
    if (!a) continue;
    if (URLS.form) { a.href = URLS.form; a.classList.remove("oculto"); }
  }
  const avisoForm = $("#aviso-form");
  if (avisoForm && URLS.form) avisoForm.classList.add("oculto");
  const barraFixa = $("#cta-fixo");
  if (barraFixa && URLS.form) barraFixa.classList.remove("oculto");

  // Correction, removal and "this entry is wrong" all route to the registration
  // form itself, which asks up front which of the three it is. One channel is
  // enough and it is the only one that exists now that there is no WhatsApp.
  // Each anchor must survive an empty FORM_URL, so it is replaced by its own
  // text rather than left pointing at "#" — a dead link on the sentence that
  // promises a way to be removed is worse than no link at all.
  for (const sel of ["#link-remocao", "#link-denuncia"]) {
    const a = $(sel);
    if (!a) continue;
    if (URLS.form) a.href = URLS.form;
    else a.replaceWith(document.createTextNode(a.textContent));
  }

  const repo = $("#link-repo");
  if (repo && URLS.repo) repo.href = URLS.repo;
}

// ---------- data ----------

let RECORDS = [];
let ATUALIZADO_EM = "";

async function loadSnapshot() {
  try {
    const resp = await fetch("data/snapshot.json", { cache: "no-store" });
    if (!resp.ok) throw new Error("snapshot " + resp.status);
    const bruto = await resp.json();
    ATUALIZADO_EM = (bruto && bruto.atualizado_em) || "";
    RECORDS = parseSnapshot(bruto);
  } catch (e) {
    console.warn("Snapshot indisponível — seguindo com zero registros.", e);
    RECORDS = [];
    ATUALIZADO_EM = "";
  }
  updateCounter();
  updateSelo();
}

/* Freshness seal. Nobody approves entries any more, so a pipeline that broke
   on Tuesday looks exactly like a quiet week — unless the page says when it
   last refreshed. */
function updateSelo() {
  const el = $("#atualizado");
  if (!el) return;
  const idade = descreveIdade(ATUALIZADO_EM);
  if (!idade) { el.classList.add("oculto"); return; }
  // "até 1 hora", não "~10 minutos": o cron pede 10, mas o GitHub agrupa
  // agendamentos de repositório público. Medido em 25/08/2026, 5 rodadas
  // seguidas: 40, 47, 43 e 55 minutos de intervalo real. Número publicado é
  // sempre o medido — prometer 10 seria criar um defeito que não existe.
  el.textContent = "Lista atualizada " + idade + ". Cadastros novos entram sozinhos, em até 1 hora.";
  el.classList.remove("oculto");
}

function updateCounter() {
  const el = $("#contador");
  if (!el) return;
  const n = RECORDS.length;
  const regioes = new Set(RECORDS.map((r) => r.regiao).filter(Boolean)).size;
  if (n === 0) {
    el.textContent = "O mapa está nascendo — cadastre seu grupo e seja o primeiro pin da sua região.";
  } else if (n === 1) {
    el.textContent = "Já tem 1 grupo no mapa — cadastre o seu e coloque sua região aqui também.";
  } else {
    el.textContent = "Já são " + n + " grupos em " + regioes +
      (regioes === 1 ? " região" : " regiões") + " do DF — cadastre o seu.";
  }
}

// ---------- map (facade: Leaflet only loads when the section approaches) ----------

let mapStarted = false;

function loadAsset(tag, attrs) {
  return new Promise((resolve, reject) => {
    const el = document.createElement(tag);
    Object.assign(el, attrs);
    el.crossOrigin = "anonymous";
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("falha ao carregar " + (attrs.href || attrs.src)));
    document.head.appendChild(el);
  });
}

async function startMap() {
  if (mapStarted) return;
  mapStarted = true;
  const status = $("#mapa-status");
  try {
    await loadAsset("link", { rel: "stylesheet", href: LEAFLET.css.href, integrity: LEAFLET.css.integrity });
    await loadAsset("script", { src: LEAFLET.js.src, integrity: LEAFLET.js.integrity });

    const resp = await fetch("data/ra_df.geojson");
    if (!resp.ok) throw new Error("geojson " + resp.status);
    const geo = await resp.json();

    const L = window.L;
    const map = L.map("mapa", { scrollWheelZoom: false, maxBoundsViscosity: 1.0 });

    const raLayer = L.geoJSON(geo, {
      style: { color: "#15803D", weight: 1, opacity: 0.5, fillOpacity: 0.04 },
    }).addTo(map);
    // Never hardcode coordinates: bounds come from the official IPEDF layer (ADR-0003)
    map.fitBounds(raLayer.getBounds(), { padding: [12, 12] });
    map.setMaxBounds(raLayer.getBounds().pad(0.15));

    // CARTO Voyager (free, no key); OSM as 1-line fallback after repeated tile errors
    let tileErrors = 0;
    const carto = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      { subdomains: "abcd", maxZoom: 19, attribution: "© OpenStreetMap contributors © CARTO" }
    ).addTo(map);
    carto.on("tileerror", () => {
      tileErrors++;
      if (tileErrors === 4) {
        map.removeLayer(carto);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
      }
    });

    drawPins(L, map);
    if (status) status.classList.add("oculto");
    const faixa = $("#faixa-nascendo");
    if (faixa && RECORDS.some((r) => r.lat != null)) faixa.classList.add("oculto");
  } catch (e) {
    console.warn("Mapa não carregou:", e);
    if (status) {
      status.textContent = "Não foi possível carregar o mapa agora. Recarregue a página para tentar de novo — o cadastro funciona normalmente.";
    }
    mapStarted = false; // allow a retry on next intersection/reload
  }
}

// Popup content is built node by node — textContent only, never innerHTML.
function popupFor(rec) {
  const box = document.createElement("div");
  box.className = "popup-grupo";
  const nome = document.createElement("strong");
  nome.textContent = rec.grupo;
  box.appendChild(nome);
  const linhas = [
    [rec.modalidades.join(", "), rec.dias.join(", "), rec.horario].filter(Boolean).join(" · "),
    rec.local,
    rec.organizacao,
    [rec.custo, rec.orientacao_profissional].filter(Boolean).join(" · "),
    rec.publico.join(" · "),
  ];
  for (const l of linhas) {
    if (!l) continue;
    const p = document.createElement("div");
    p.textContent = l;
    box.appendChild(p);
  }

  /* Both destinations already passed the host allowlist in util.js, so the only
     thing left to decide here is the rel. noopener: the destination cannot
     reach back into this tab. noreferrer: it does not learn which page sent the
     visitor. nofollow: a link nobody reviewed never lends us our ranking. */
  const links = document.createElement("div");
  links.className = "popup-links";
  const anexar = (url, texto) => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer nofollow";
    a.textContent = texto;
    links.appendChild(a);
  };
  anexar(rec.redeUrl, rec.redeRotulo || "Rede social do grupo");
  anexar(rec.mapaUrl, "Ver o local no mapa →");
  if (links.childElementCount) box.appendChild(links);

  return box;
}

/* Screen-reader label for a pin. The emoji is decorative — it repeats, in one
   glyph, something the popup already says in words — so what assistive tech
   announces is the sentence, never "runner emoji". */
function rotuloPin(rec) {
  const modal = rec.modalidades.join(", ");
  return [rec.grupo, modal, rec.regiao].filter(Boolean).join(" — ");
}

/* Pins carry the modality as an emoji.
   The glyph is NOT written here: L.divIcon renders its `html` option through
   innerHTML, so passing text — even our own — would open the one door this
   project keeps shut (ADR-0004, and scripts/valida_popup.mjs freezes it). We
   pass a CLASS NAME instead and css/style.css puts the emoji in ::before, which
   the HTML parser never sees. `html` is deliberately left unset: Leaflet's
   default is `false`, which it renders as an empty string.

   A circle centred on the point, not a needle: the coordinate is the centroid
   of the administrative region, not the group's address, so a pin that appears
   to point AT a spot would be claiming a precision the data does not have. */
function drawPins(L, map) {
  for (const rec of RECORDS) {
    if (rec.lat == null || rec.lon == null) continue;
    const icone = L.divIcon({
      className: "pin-mov pin-mov--" + pinModalidade(rec.modalidades),
      iconSize: [38, 38],
      iconAnchor: [19, 19],   // centre of the circle sits on the coordinate
      popupAnchor: [0, -18],  // balloon opens above it, never over it
    });
    const marcador = L.marker([rec.lat, rec.lon], {
      icon: icone,
      title: rec.grupo,     // native hover label; set as a property, not parsed
      riseOnHover: true,    // overlapping pins in one region: the hovered one wins
    }).addTo(map).bindPopup(popupFor(rec));

    // setAttribute takes text, never markup — same guarantee as textContent.
    const el = marcador.getElement();
    if (el) {
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", rotuloPin(rec));
    }
  }
}

function initMapFacade() {
  const alvo = $("#secao-mapa");
  if (!alvo) return;
  if (!("IntersectionObserver" in window)) { startMap(); return; }
  const obs = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      obs.disconnect();
      startMap();
    }
  }, { rootMargin: "400px 0px" });
  obs.observe(alvo);
}

// ---------- boot ----------

initTheme();
wireCtas();
loadSnapshot().then(initMapFacade);
