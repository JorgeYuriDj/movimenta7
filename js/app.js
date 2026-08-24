/* ============================================================
   movimenta7 — landing (Fase 0)
   Vanilla JS. Flow:
   1) wire CTAs from js/config.js (form + WhatsApp), with safe fallbacks
   2) load data/snapshot.json (starts empty) → counter + map pins
   3) Leaflet is loaded ON DEMAND (facade pattern) with SRI hashes —
      it is the page's biggest third-party script (ADR-0003)
   Security (ADR-0004): data-borne text reaches the DOM ONLY via
   textContent; URLs pass through safeUrl(). Do not relax this.
   ============================================================ */

import { safeUrl, parseSnapshot } from "./util.js";

const CFG = window.MOV7_CONFIG || {};
const URLS = {
  form: safeUrl(CFG.FORM_URL),
  whatsapp: safeUrl(CFG.WHATSAPP_URL),
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

  const zap = $("#botao-whatsapp");
  const zapRodape = $("#link-remocao-wa");
  if (URLS.whatsapp) {
    if (zap) { zap.href = URLS.whatsapp; zap.classList.remove("oculto"); }
    if (zapRodape) zapRodape.href = URLS.whatsapp;
  } else {
    const avisoZap = $("#aviso-whatsapp");
    if (avisoZap) avisoZap.classList.remove("oculto");
    if (zapRodape) {
      // no link yet: keep the sentence but drop the dead anchor
      const txt = document.createTextNode(zapRodape.textContent);
      zapRodape.replaceWith(txt);
    }
  }

  const repo = $("#link-repo");
  if (repo && URLS.repo) repo.href = URLS.repo;
}

// ---------- data ----------

let RECORDS = [];

async function loadSnapshot() {
  try {
    const resp = await fetch("data/snapshot.json", { cache: "no-store" });
    if (!resp.ok) throw new Error("snapshot " + resp.status);
    RECORDS = parseSnapshot(await resp.json());
  } catch (e) {
    console.warn("Snapshot indisponível — seguindo com zero registros.", e);
    RECORDS = [];
  }
  updateCounter();
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
  ];
  for (const l of linhas) {
    if (!l) continue;
    const p = document.createElement("div");
    p.textContent = l;
    box.appendChild(p);
  }
  if (rec.contatoUrl) {
    const a = document.createElement("a");
    a.href = rec.contatoUrl;
    a.target = "_blank";
    // noopener: the destination cannot reach back into this tab.
    // noreferrer: it does not learn which page sent the visitor.
    // nofollow: a link submitted by the community never lends us our ranking.
    a.rel = "noopener noreferrer nofollow";
    a.textContent = "Contato do grupo →";
    box.appendChild(a);
  } else if (rec.contatoTexto) {
    const p = document.createElement("div");
    p.textContent = "Contato: " + rec.contatoTexto;
    box.appendChild(p);
  }
  return box;
}

function drawPins(L, map) {
  for (const rec of RECORDS) {
    if (rec.lat == null || rec.lon == null) continue;
    L.circleMarker([rec.lat, rec.lon], {
      radius: 9, weight: 2, color: "#15803D", fillColor: "#15803D", fillOpacity: 0.55,
    }).addTo(map).bindPopup(popupFor(rec));
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
