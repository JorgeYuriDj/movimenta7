# ADR-0003 — Leaflet 1.9.4 + tiles CARTO raster + GeoJSON IPEDF

**Status:** ACEITO pelo dono em 23/08/2026

**Decisão:**
- **Leaflet 1.9.4** via unpkg com hash SRI da página oficial (2.0 ainda é alpha — revalidar em
  leafletjs.com/download.html antes de qualquer upgrade). Sem plugin de cluster (<200 pins;
  markercluster está sem manutenção desde 2021).
- **Tiles CARTO Voyager** (raster, grátis, sem API key), atribuição visível
  "© OpenStreetMap contributors © CARTO"; `tile.openstreetmap.org` como fallback (uso leve
  permitido: Referer válido, cache ≥7 dias, atribuição).
- **GeoJSON das RAs**: camada Limite_RA_2019 do IPEDF (catalogo.ipe.df.gov.br) /
  GeoPortal SEDUH, simplificado no mapshaper antes de embutir; conferir RAs pós-2019
  (Arapoanga, Água Quente) e citar a fonte no rodapé (licença não declarada nos metadados).
- **Geocodificação**: clique no mapa na moderação (`map.on('click')`) como método principal;
  Nominatim público só como auxílio pontual (1 req/s, User-Agent identificado).
- Mobile: `fitBounds` no bounds do próprio GeoJSON, `maxBounds` + `maxBoundsViscosity: 1.0`,
  carregamento sob demanda (padrão facade — Leaflet é o maior script de terceiro da página).

**Fonte:** pesquisa salva `PESQUISAS/2026-08-23_leaflet-tiles-geojson-df_movimenta7.md`
(URLs oficiais: leafletjs.com, operations.osmfoundation.org/policies/tiles e /nominatim,
docs.carto.com/faqs/carto-basemaps, catalogo.ipe.df.gov.br).

**Consequências:** zero custo e zero chave de API; dependência de política de terceiros
mitigada com fallback de 1 linha no config.
