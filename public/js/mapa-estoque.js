import { ensureAuthenticatedContext, makeUnitScopedKey, signOutAndRedirect } from "./auth-context.js";

const AUTH_CTX = await ensureAuthenticatedContext({ loginPath: "login.html", requireUnit: true });
if (!AUTH_CTX) throw new Error("Sessao invalida.");

const ACTIVE_UNIT = AUTH_CTX.unitSlug;
const supabase = AUTH_CTX.supabase;

const STORAGE_KEYS = {
  filters: makeUnitScopedKey("avantrax.estoque.filters.v1", ACTIVE_UNIT),
  layout: makeUnitScopedKey("avantrax.estoque.layout.v1", ACTIVE_UNIT),
};
const ROTATION_OPTIONS_SECONDS = [15, 20, 30, 40];
const DEFAULT_ROTATION_SECONDS = 15;

const SELLABLE_AREAS = {
  "0KM": new Set(["T1", "T2", "T3", "T4", "TC", "RC"]),
  GMB: new Set(["G1", "G2", "G3", "G4", "G5", "RP", "BC", "BR"]),
  FZD: new Set(["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8"]),
};

const els = {
  unitPill: document.getElementById("unit-pill"),
  lastUpdate: document.getElementById("last-update"),
  currentTime: document.getElementById("current-time"),
  currentDate: document.getElementById("current-date"),
  refreshBtn: document.getElementById("refresh-btn"),
  refreshBtnSide: document.getElementById("refresh-btn-side"),
  logoutBtn: document.getElementById("logout-btn"),
  realtimeStatus: document.getElementById("realtime-status"),
  donut: document.getElementById("occ-donut"),
  occPct: document.getElementById("occ-pct"),
  totalVagas: document.getElementById("kpi-total-vagas"),
  totalVagasInline: document.getElementById("kpi-total-vagas-inline"),
  disponiveis: document.getElementById("kpi-disponiveis"),
  disponiveisInline: document.getElementById("kpi-disponiveis-inline"),
  bloqueadas: document.getElementById("kpi-bloqueadas"),
  totalVeiculos: document.getElementById("kpi-total-veiculos"),
  blocos: document.getElementById("kpi-blocos"),
  deptCurrentCount: document.getElementById("dept-current-count"),
  deptCurrentLabel: document.getElementById("dept-current-label"),
  deptDots: document.getElementById("dept-dots"),
  depRail: document.getElementById("dep-rail"),
  ownerList: document.getElementById("owner-list"),
  blocksGrid: document.getElementById("blocks-grid"),
  searchInput: document.getElementById("quick-search"),
  searchList: document.getElementById("search-list"),
  fileMeta: document.getElementById("file-meta"),

  filtersHotspot: document.getElementById("filters-hotspot"),
  filtersPanel: document.getElementById("filters-panel"),
  filtersClose: document.getElementById("filters-close"),
  filterMontadora: document.getElementById("filter-montadora"),
  filterProprietario: document.getElementById("filter-proprietario"),
  filtersApply: document.getElementById("filters-apply"),
  filtersClear: document.getElementById("filters-clear"),
  layoutEditOpen: document.getElementById("layout-edit-open"),

  layoutModal: document.getElementById("layout-edit-modal"),
  layoutClose: document.getElementById("layout-edit-close"),
  layoutList: document.getElementById("layout-edit-list"),
  layoutReset: document.getElementById("layout-edit-reset"),
  toggleHideNonSellable: document.getElementById("toggle-hide-non-sellable"),
  rotateSeconds: document.getElementById("layout-rotate-seconds"),
};

if (els.unitPill) {
  els.unitPill.textContent = `Unidade: ${String(ACTIVE_UNIT || "--").toUpperCase()}`;
}

const state = {
  rawRows: [],
  filteredRows: [],
  vehicleRows: [],
  blocks: [],
  owners: [],
  meta: null,
  keys: {},
  options: { montadoras: [], proprietarios: [] },
  areaCatalog: [],
  filters: { montadora: "", proprietario: "" },
  layoutPrefs: { hideNonSellable: true, overrides: {}, rotateSeconds: DEFAULT_ROTATION_SECONDS },
  depOrder: [],
  currentDepIndex: 0,
};

let depRotateTimer = 0;
function getRotationMs() {
  const sec = Number(state.layoutPrefs?.rotateSeconds || DEFAULT_ROTATION_SECONDS);
  const safe = ROTATION_OPTIONS_SECONDS.includes(sec) ? sec : DEFAULT_ROTATION_SECONDS;
  return safe * 1000;
}

function formatDateTime(v) {
  if (!v) return "--";
  try { return new Date(v).toLocaleString("pt-BR"); } catch (_) { return "--"; }
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeText(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function normalizeHeader(value, index) {
  const normalized = normalizeText(value)
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || `COL_${index + 1}`;
}

function toNumber(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const normalized = String(v ?? "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]+/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function isSellableByDefault(deposito, area) {
  const dep = normalizeText(deposito);
  const ar = normalizeText(area);
  const allowed = SELLABLE_AREAS[dep];
  if (!allowed) return true;
  return allowed.has(ar);
}

function areaKey(deposito, area) {
  return `${normalizeText(deposito)}||${normalizeText(area)}`;
}

function isAreaVisible(deposito, area) {
  const key = areaKey(deposito, area);
  if (Object.prototype.hasOwnProperty.call(state.layoutPrefs.overrides, key)) {
    return !!state.layoutPrefs.overrides[key];
  }
  if (state.layoutPrefs.hideNonSellable) {
    return isSellableByDefault(deposito, area);
  }
  return true;
}

function makeUniqueHeader(base, used) {
  if (!used.has(base)) {
    used.set(base, 1);
    return base;
  }
  const count = (used.get(base) || 1) + 1;
  used.set(base, count);
  return `${base}_${count}`;
}

function parseExcelBlob(blob) {
  const XLSXLib = window.XLSX;
  if (!XLSXLib || !XLSXLib.read) throw new Error("Biblioteca XLSX indisponivel.");

  const bufferPromise = blob.arrayBuffer ? blob.arrayBuffer() : new Response(blob).arrayBuffer();
  return bufferPromise.then((buffer) => {
    const wb = XLSXLib.read(new Uint8Array(buffer), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSXLib.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
    const headersRaw = Array.isArray(matrix[0]) ? matrix[0] : [];
    const body = matrix.slice(1);
    const cols = Math.max(headersRaw.length, ...body.map((r) => (Array.isArray(r) ? r.length : 0)), 0);

    const used = new Map();
    const headers = [];
    for (let i = 0; i < cols; i++) {
      const base = normalizeHeader(headersRaw[i], i);
      headers.push(makeUniqueHeader(base, used));
    }

    const rows = body.map((row) => {
      const out = {};
      for (let i = 0; i < cols; i++) {
        out[headers[i]] = Array.isArray(row) ? (row[i] ?? "") : "";
      }
      return out;
    });
    return { rows, headers };
  });
}

function findBestKey(rows, preferred = [], tokens = []) {
  if (!rows?.length) return "";
  const keys = Object.keys(rows[0] || {});
  for (const p of preferred) {
    const normalized = normalizeHeader(p, 0);
    const exact = keys.find((k) => normalizeHeader(k, 0) === normalized);
    if (exact) return exact;
  }
  let best = "";
  let bestScore = -1;
  for (const k of keys) {
    const nk = normalizeHeader(k, 0);
    let score = 0;
    for (const t of tokens) {
      const nt = normalizeHeader(t, 0);
      if (nk.includes(nt)) score += nt.length;
    }
    if (score > bestScore) {
      best = k;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : "";
}

function detectKeys(rows) {
  return {
    keyDepos: findBestKey(rows, ["DEPOSITO", "DEP"], ["DEPOSITO", "DEP"]),
    keyArea: findBestKey(rows, ["AREA", "SETOR", "QUADRA", "BLOCO"], ["AREA", "SETOR", "QUADRA", "BLOCO"]),
    keyOwner: findBestKey(rows, ["PROPRIETARIO", "OWNER", "CLIENTE"], ["PROPRIET", "OWNER", "CLIENT"]),
    keyMontadora: findBestKey(rows, ["MONTADORA", "SITE", "MARCA"], ["MONTAD", "SITE", "MARCA"]),
    keyStatus: findBestKey(rows, ["STATUS", "STATUS_OCUPACAO", "SITUACAO"], ["STATUS", "SITUAC"]),
    keyStatusVaga: findBestKey(rows, ["STATUS_VAGA", "BLOQUEIO", "SITUACAO_VAGA"], ["STATUS_VAGA", "BLOQUEIO", "VAGA"]),
    keyChassi: findBestKey(rows, ["CHASSI"], ["CHASSI"]),
    keyPlaca: findBestKey(rows, ["PLACA"], ["PLAC"]),
    keyModelo: findBestKey(rows, ["MODELO", "DESCRICAO_MODELO"], ["MODEL"]),
  };
}

function classifyStatus(value) {
  const t = normalizeHeader(value, 0);
  if (!t) return "";
  if (/(LIVRE|DISPONIVEL|VAZIO)/.test(t)) return "free";
  if (/(OCUPADO|LOTADO|ALOCADO|INDISPONIVEL)/.test(t)) return "occupied";
  return "";
}

function isBlockedStatusVaga(value) {
  const t = normalizeHeader(value, 0);
  if (!t) return false;
  if (/(NAO_BLOQUEADO|N_BLOQUEADO|DESBLOQUEADO)/.test(t)) return false;
  return /BLOQUEADO/.test(t);
}

function readFilters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.filters);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.filters = {
      montadora: String(parsed?.montadora || ""),
      proprietario: String(parsed?.proprietario || ""),
    };
  } catch (_) {}
}

function saveFilters() {
  try {
    localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify(state.filters));
  } catch (_) {}
}

function readLayoutPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.layout);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const hideNonSellable = parsed?.hideNonSellable !== false;
    const overrides = parsed?.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {};
    const rotateCandidate = Number(parsed?.rotateSeconds);
    const rotateSeconds = ROTATION_OPTIONS_SECONDS.includes(rotateCandidate)
      ? rotateCandidate
      : DEFAULT_ROTATION_SECONDS;
    state.layoutPrefs = { hideNonSellable, overrides, rotateSeconds };
  } catch (_) {}
}

function saveLayoutPrefs() {
  try {
    localStorage.setItem(STORAGE_KEYS.layout, JSON.stringify(state.layoutPrefs));
  } catch (_) {}
}

function buildFilterOptions(rows, keys) {
  const mont = new Set();
  const prop = new Set();
  for (const r of rows) {
    const m = keys.keyMontadora ? String(r[keys.keyMontadora] ?? "").trim() : "";
    const p = keys.keyOwner ? String(r[keys.keyOwner] ?? "").trim() : "";
    if (m) mont.add(m);
    if (p) prop.add(p);
  }
  state.options = {
    montadoras: Array.from(mont).sort((a, b) => a.localeCompare(b, "pt-BR")),
    proprietarios: Array.from(prop).sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

function applyDataFilters(rows, keys) {
  const filterMont = normalizeText(state.filters.montadora);
  const filterProp = normalizeText(state.filters.proprietario);
  return rows.filter((r) => {
    const m = keys.keyMontadora ? normalizeText(r[keys.keyMontadora]) : "";
    const p = keys.keyOwner ? normalizeText(r[keys.keyOwner]) : "";
    if (filterMont && m !== filterMont) return false;
    if (filterProp && p !== filterProp) return false;
    return true;
  });
}

function buildAreaCatalog(rows, keys) {
  const map = new Map();
  for (const r of rows) {
    const dep = keys.keyDepos ? String(r[keys.keyDepos] ?? "").trim() : "Sem Deposito";
    const area = keys.keyArea ? String(r[keys.keyArea] ?? "").trim() : "Sem Area";
    const key = areaKey(dep, area);
    if (map.has(key)) continue;
    map.set(key, {
      key,
      deposito: dep || "Sem Deposito",
      area: area || "Sem Area",
      defaultSellable: isSellableByDefault(dep, area),
    });
  }
  state.areaCatalog = Array.from(map.values()).sort((a, b) =>
    a.deposito.localeCompare(b.deposito, "pt-BR") || a.area.localeCompare(b.area, "pt-BR")
  );
}

function inferAndBuild(filteredRows, keys, baseRows) {
  const groups = new Map();
  const ownerMap = new Map();
  const vehicleRows = [];

  let totalVehicleCount = 0;
  let totalCapacity = 0;
  let totalBlocked = 0;

  // 1) Base de capacidade por area (nao depende do filtro de proprietario/montadora)
  for (const row of baseRows) {
    const deposito = keys.keyDepos ? String(row[keys.keyDepos] ?? "").trim() : "Sem Deposito";
    const area = keys.keyArea ? String(row[keys.keyArea] ?? "").trim() : "Sem Area";
    if (!isAreaVisible(deposito, area)) continue;

    const groupKey = areaKey(deposito, area);
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        deposito: deposito || "Sem Deposito",
        area: area || "Sem Area",
        occupied: 0,
        free: 0,
        blocked: 0,
      });
    }
    const g = groups.get(groupKey);
    const statusType = keys.keyStatus ? classifyStatus(row[keys.keyStatus]) : "";
    const blockedByVaga = keys.keyStatusVaga ? isBlockedStatusVaga(row[keys.keyStatusVaga]) : false;

    if (blockedByVaga) {
      g.blocked += 1;
    } else if (statusType === "occupied") {
      g.occupied += 1;
    } else if (statusType === "free") {
      g.free += 1;
    } else {
      const hasVehicleSignal = [keys.keyChassi, keys.keyPlaca, keys.keyModelo]
        .filter(Boolean)
        .some((k) => String(row[k] ?? "").trim() !== "");
      if (hasVehicleSignal) {
        g.occupied += 1;
      } else {
        g.free += 1;
      }
    }
  }

  // 2) Ocupacao filtrada (ex.: somente GM) sem mexer no total de vagas da area
  const occupiedFilteredByArea = new Map();
  for (const row of filteredRows) {
    const deposito = keys.keyDepos ? String(row[keys.keyDepos] ?? "").trim() : "Sem Deposito";
    const area = keys.keyArea ? String(row[keys.keyArea] ?? "").trim() : "Sem Area";
    if (!isAreaVisible(deposito, area)) continue;

    const groupKey = areaKey(deposito, area);
    if (!occupiedFilteredByArea.has(groupKey)) occupiedFilteredByArea.set(groupKey, 0);
    const statusType = keys.keyStatus ? classifyStatus(row[keys.keyStatus]) : "";
    const blockedByVaga = keys.keyStatusVaga ? isBlockedStatusVaga(row[keys.keyStatusVaga]) : false;
    if (blockedByVaga) continue;

    if (statusType === "occupied") {
      occupiedFilteredByArea.set(groupKey, occupiedFilteredByArea.get(groupKey) + 1);
      totalVehicleCount += 1;
      vehicleRows.push(row);
    } else if (!statusType) {
      const hasVehicleSignal = [keys.keyChassi, keys.keyPlaca, keys.keyModelo]
        .filter(Boolean)
        .some((k) => String(row[k] ?? "").trim() !== "");
      if (hasVehicleSignal) {
        occupiedFilteredByArea.set(groupKey, occupiedFilteredByArea.get(groupKey) + 1);
        totalVehicleCount += 1;
        vehicleRows.push(row);
      }
    }

    const owner = keys.keyOwner ? String(row[keys.keyOwner] ?? "").trim() : "";
    if (owner) ownerMap.set(owner, (ownerMap.get(owner) || 0) + 1);
  }

  const blocks = Array.from(groups.values())
    .map((g) => {
      const groupKey = areaKey(g.deposito, g.area);
      const occupiedFiltered = Number(occupiedFilteredByArea.get(groupKey) || 0);
      const capacity = g.occupied + g.free + g.blocked;
      const pct = capacity > 0 ? Math.round(((occupiedFiltered + g.blocked) / capacity) * 100) : 0;
      totalCapacity += capacity;
      totalBlocked += g.blocked;
      return { ...g, occupied: occupiedFiltered, capacity, pct };
    })
    .sort((a, b) => a.deposito.localeCompare(b.deposito, "pt-BR") || a.area.localeCompare(b.area, "pt-BR"));

  const owners = Array.from(ownerMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const available = Math.max(totalCapacity - totalVehicleCount - totalBlocked, 0);
  const occPct = totalCapacity > 0 ? Math.round(((totalVehicleCount + totalBlocked) / totalCapacity) * 100) : 0;

  return {
    blocks,
    owners,
    vehicleRows,
    totalVehicleCount,
    totalCapacity,
    available,
    totalBlocked,
    occPct,
  };
}

function occupancyTone(pct) {
  if (pct < 50) return "green";
  if (pct <= 85) return "yellow";
  return "red";
}

function renderDashboard(model) {
  state.vehicleRows = model.vehicleRows;
  state.blocks = model.blocks;
  state.owners = model.owners;

  if (els.occPct) els.occPct.textContent = `${model.occPct}%`;
  if (els.donut) {
    const deg = Math.max(0, Math.min(360, Math.round((model.occPct / 100) * 360)));
    els.donut.style.background = `conic-gradient(var(--blue) ${deg}deg, #23324a ${deg}deg)`;
  }
  if (els.totalVagas) els.totalVagas.textContent = model.totalCapacity.toLocaleString("pt-BR");
  if (els.totalVagasInline) els.totalVagasInline.textContent = model.totalCapacity.toLocaleString("pt-BR");
  if (els.disponiveis) els.disponiveis.textContent = model.available.toLocaleString("pt-BR");
  if (els.disponiveisInline) els.disponiveisInline.textContent = model.available.toLocaleString("pt-BR");
  if (els.bloqueadas) els.bloqueadas.textContent = Number(model.totalBlocked || 0).toLocaleString("pt-BR");
  if (els.totalVeiculos) els.totalVeiculos.textContent = model.totalVehicleCount.toLocaleString("pt-BR");
  if (els.blocos) els.blocos.textContent = model.blocks.length.toLocaleString("pt-BR");

  if (els.ownerList) {
    if (!model.owners.length) {
      els.ownerList.innerHTML = `<div class="empty">Sem dados de proprietario.</div>`;
    } else {
      els.ownerList.innerHTML = model.owners
        .map((o) => `<div class="owner-row"><span>${escapeHtml(o.name)}</span><strong>${o.count.toLocaleString("pt-BR")}</strong></div>`)
        .join("");
    }
  }

  renderDepartmentPanels(model);
}

function restartDepRotation() {
  if (depRotateTimer) {
    clearInterval(depRotateTimer);
    depRotateTimer = 0;
  }
  if (state.depOrder.length <= 1) return;
  depRotateTimer = window.setInterval(() => {
    state.currentDepIndex = (state.currentDepIndex + 1) % state.depOrder.length;
    renderCurrentDepartment();
  }, getRotationMs());
}

function renderDepartmentPanels(model) {
  const byDep = new Map();
  for (const b of model.blocks) {
    if (!byDep.has(b.deposito)) byDep.set(b.deposito, []);
    byDep.get(b.deposito).push(b);
  }
  const hasActiveOwnerFilter = !!normalizeText(state.filters.proprietario);
  const hasActiveMontadoraFilter = !!normalizeText(state.filters.montadora);

  let depOrder = Array.from(byDep.keys()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (hasActiveOwnerFilter || hasActiveMontadoraFilter) {
    depOrder = depOrder.filter((dep) => {
      const areas = byDep.get(dep) || [];
      const filteredVehiclesInDep = areas.reduce((sum, a) => sum + Number(a.occupied || 0), 0);
      return filteredVehiclesInDep > 0;
    });
  }
  state.depOrder = depOrder;
  if (state.currentDepIndex >= depOrder.length) state.currentDepIndex = 0;

  if (els.depRail) {
    if (!depOrder.length) {
      els.depRail.innerHTML = `<div class="empty">Sem departamentos.</div>`;
    } else {
      const rail = depOrder.map((dep) => {
        const areas = byDep.get(dep) || [];
        const occupied = areas.reduce((s, a) => s + a.occupied, 0);
        const blocked = areas.reduce((s, a) => s + a.blocked, 0);
        const free = areas.reduce((s, a) => s + a.free, 0);
        const cap = areas.reduce((s, a) => s + a.capacity, 0);
        const occPct = cap > 0 ? (occupied / cap) * 100 : 0;
        const blkPct = cap > 0 ? (blocked / cap) * 100 : 0;
        const freePct = cap > 0 ? (free / cap) * 100 : 0;
        return { dep, occupied, blocked, free, cap, occPct, blkPct, freePct };
      }).sort((a, b) => (b.occupied + b.blocked) - (a.occupied + a.blocked));

      els.depRail.innerHTML = `
        <div class="dep-legend">
          <span><i class="occ"></i> Ocupado</span>
          <span><i class="blk"></i> Bloqueado</span>
          <span><i class="free"></i> Livre</span>
        </div>
        ${rail.map((r) => `
        <div class="dep-line">
          <div class="dep-head">
            <strong>${escapeHtml(r.dep)}</strong>
            <span>${r.cap.toLocaleString("pt-BR")} vagas</span>
          </div>
          <div class="dep-track">
            <span class="dep-seg occ" style="width:${Math.max(0, Math.min(100, r.occPct))}%"></span>
            <span class="dep-seg blk" style="width:${Math.max(0, Math.min(100, r.blkPct))}%"></span>
            <span class="dep-seg free" style="width:${Math.max(0, Math.min(100, r.freePct))}%"></span>
          </div>
          <div class="dep-meta">
            <span>${r.occupied.toLocaleString("pt-BR")} ocup.</span>
            <span>${r.blocked.toLocaleString("pt-BR")} bloq.</span>
            <span>${r.free.toLocaleString("pt-BR")} livres</span>
          </div>
        </div>
      `).join("")}
      `;
    }
  }

  if (els.deptDots) {
    els.deptDots.innerHTML = depOrder.map((_, i) => `<button class="dept-dot${i === state.currentDepIndex ? " active" : ""}" data-dep-idx="${i}" type="button"></button>`).join("");
    els.deptDots.querySelectorAll(".dept-dot").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const idx = Number(e.currentTarget.getAttribute("data-dep-idx"));
        if (Number.isFinite(idx)) state.currentDepIndex = idx;
        renderCurrentDepartment();
        restartDepRotation();
      });
    });
  }

  renderCurrentDepartment(byDep);
  restartDepRotation();
}

function renderCurrentDepartment(byDepInput = null) {
  const byDep = byDepInput || state.blocks.reduce((acc, b) => {
    if (!acc.has(b.deposito)) acc.set(b.deposito, []);
    acc.get(b.deposito).push(b);
    return acc;
  }, new Map());

  const depOrder = state.depOrder || [];
  if (!els.blocksGrid) return;
  if (!depOrder.length) {
    els.blocksGrid.innerHTML = `<div class="empty">Sem areas visiveis para os filtros atuais.</div>`;
    if (els.deptCurrentLabel) els.deptCurrentLabel.textContent = "--";
    if (els.deptCurrentCount) els.deptCurrentCount.textContent = "--";
    return;
  }
  const dep = depOrder[state.currentDepIndex] || depOrder[0];
  const areas = byDep.get(dep) || [];
  const depTotal = areas.reduce((s, a) => s + a.occupied + a.blocked, 0);
  if (els.deptCurrentLabel) els.deptCurrentLabel.textContent = dep;
  if (els.deptCurrentCount) els.deptCurrentCount.textContent = depTotal.toLocaleString("pt-BR");

  els.blocksGrid.classList.add("is-switching");
  els.blocksGrid.innerHTML = `<section class="dep-areas">${
    areas.map((b, index) => {
      const forcedBlocked = b.blocked > 0 && b.occupied === 0 && b.free === 0;
      const tone = forcedBlocked ? "red" : occupancyTone(b.pct);
      const label = forcedBlocked ? "BLOQUEADO" : (tone === "green" ? "LIVRE" : tone === "yellow" ? "ATENCAO" : "LOTADO");
      const criticalClass = tone === "red" ? " is-critical" : "";
      return `
      <article class="block-card tone-${tone} is-enter${criticalClass}" style="--stagger:${index}">
        <div class="block-top">
          <div class="block-name">${escapeHtml(b.area)}</div>
          <div class="tag ${tone}">${label}</div>
        </div>
        <div class="pct">${b.pct}%</div>
        <div class="bar"><span class="${tone}" style="width:${Math.max(0, Math.min(100, b.pct))}%"></span></div>
        <div class="mini">
          <span>${b.occupied.toLocaleString("pt-BR")} ocup.</span>
          <span>${b.free.toLocaleString("pt-BR")} livres</span>
          <span>${b.blocked.toLocaleString("pt-BR")} bloq.</span>
        </div>
        <div class="mini mini-total"><span>Total</span><span>${b.capacity.toLocaleString("pt-BR")} vagas</span></div>
      </article>`;
    }).join("")
  }</section>`;

  window.requestAnimationFrame(() => {
    const cards = els.blocksGrid.querySelectorAll(".block-card.is-enter");
    cards.forEach((card) => card.classList.add("is-visible"));
    els.blocksGrid.classList.remove("is-switching");
  });
}

function renderSearch(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!els.searchList) return;
  if (!q) {
    els.searchList.innerHTML = `<div class="empty">Digite para buscar</div>`;
    return;
  }
  const keys = state.keys;
  const filtered = state.vehicleRows.filter((r) => {
    const text = [
      keys.keyChassi ? r[keys.keyChassi] : "",
      keys.keyPlaca ? r[keys.keyPlaca] : "",
      keys.keyModelo ? r[keys.keyModelo] : "",
      keys.keyDepos ? r[keys.keyDepos] : "",
      keys.keyArea ? r[keys.keyArea] : "",
      keys.keyOwner ? r[keys.keyOwner] : "",
    ].map((v) => String(v ?? "").toLowerCase()).join(" ");
    return text.includes(q);
  }).slice(0, 40);

  if (!filtered.length) {
    els.searchList.innerHTML = `<div class="empty">Nenhum resultado para "${escapeHtml(q)}".</div>`;
    return;
  }
  els.searchList.innerHTML = filtered.map((r) => {
    const primary = String((state.keys.keyChassi && r[state.keys.keyChassi]) || (state.keys.keyPlaca && r[state.keys.keyPlaca]) || "Registro").trim();
    const meta = [
      state.keys.keyModelo ? r[state.keys.keyModelo] : "",
      state.keys.keyOwner ? r[state.keys.keyOwner] : "",
      state.keys.keyDepos ? r[state.keys.keyDepos] : "",
      state.keys.keyArea ? r[state.keys.keyArea] : "",
    ].map((v) => String(v || "").trim()).filter(Boolean).join(" • ");
    return `<div class="search-item"><strong>${escapeHtml(primary)}</strong><span>${escapeHtml(meta || "Sem detalhes")}</span></div>`;
  }).join("");
}

function fillSelect(selectEl, values, selected) {
  if (!selectEl) return;
  const opts = [`<option value="">Todos</option>`]
    .concat(values.map((v) => `<option value="${escapeHtml(v)}"${v === selected ? " selected" : ""}>${escapeHtml(v)}</option>`));
  selectEl.innerHTML = opts.join("");
}

function openFilters() {
  if (!els.filtersPanel) return;
  fillSelect(els.filterMontadora, state.options.montadoras, state.filters.montadora);
  fillSelect(els.filterProprietario, state.options.proprietarios, state.filters.proprietario);
  els.filtersPanel.classList.add("open");
  els.filtersPanel.setAttribute("aria-hidden", "false");
}

function closeFilters() {
  if (!els.filtersPanel) return;
  els.filtersPanel.classList.remove("open");
  els.filtersPanel.setAttribute("aria-hidden", "true");
}

function toggleFilters() {
  if (!els.filtersPanel) return;
  els.filtersPanel.classList.contains("open") ? closeFilters() : openFilters();
}

function renderLayoutEditor() {
  if (!els.layoutList) return;
  if (els.toggleHideNonSellable) {
    els.toggleHideNonSellable.checked = !!state.layoutPrefs.hideNonSellable;
  }
  if (els.rotateSeconds) {
    const sec = Number(state.layoutPrefs?.rotateSeconds || DEFAULT_ROTATION_SECONDS);
    const safe = ROTATION_OPTIONS_SECONDS.includes(sec) ? sec : DEFAULT_ROTATION_SECONDS;
    els.rotateSeconds.value = String(safe);
  }

  const byDep = new Map();
  for (const item of state.areaCatalog) {
    if (!byDep.has(item.deposito)) byDep.set(item.deposito, []);
    byDep.get(item.deposito).push(item);
  }

  els.layoutList.innerHTML = Array.from(byDep.entries()).map(([dep, areas]) => {
    const items = areas.map((a) => {
      const visible = isAreaVisible(a.deposito, a.area);
      const tag = a.defaultSellable ? "Vendavel" : "Nao vendavel";
      return `
        <label class="lem-item">
          <span>${escapeHtml(a.area)} <small>${escapeHtml(tag)}</small></span>
          <input type="checkbox" data-area-key="${escapeHtml(a.key)}" ${visible ? "checked" : ""} />
        </label>
      `;
    }).join("");
    return `<div class="lem-dep"><h5>${escapeHtml(dep)}</h5><div class="lem-areas">${items}</div></div>`;
  }).join("");

  const checkboxes = els.layoutList.querySelectorAll("input[type=checkbox][data-area-key]");
  checkboxes.forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const key = String(e.target.getAttribute("data-area-key") || "");
      const checked = !!e.target.checked;
      state.layoutPrefs.overrides[key] = checked;
      saveLayoutPrefs();
      recomputeAndRender();
    });
  });
}

function openLayoutEditor() {
  if (!els.layoutModal) return;
  renderLayoutEditor();
  els.layoutModal.classList.add("open");
  els.layoutModal.setAttribute("aria-hidden", "false");
}

function closeLayoutEditor() {
  if (!els.layoutModal) return;
  els.layoutModal.classList.remove("open");
  els.layoutModal.setAttribute("aria-hidden", "true");
}

function wireShortcuts() {
  window.addEventListener("keydown", (e) => {
    const key = String(e.key || "").toLowerCase();
    if (e.ctrlKey && e.shiftKey && key === "l") {
      e.preventDefault();
      signOutAndRedirect("login.html");
      return;
    }
    if (e.ctrlKey && e.shiftKey && key === "f") {
      e.preventDefault();
      toggleFilters();
      return;
    }
    if (e.ctrlKey && e.shiftKey && key === "e") {
      e.preventDefault();
      if (els.layoutModal?.classList.contains("open")) closeLayoutEditor();
      else openLayoutEditor();
      return;
    }
    if (key === "escape") {
      if (els.layoutModal?.classList.contains("open")) {
        e.preventDefault();
        closeLayoutEditor();
        return;
      }
      if (els.filtersPanel?.classList.contains("open")) {
        e.preventDefault();
        closeFilters();
      }
    }
  });
}

function startClock() {
  const tick = () => {
    const now = new Date();
    if (els.currentTime) els.currentTime.textContent = now.toLocaleTimeString("pt-BR");
    if (els.currentDate) {
      els.currentDate.textContent = now
        .toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
        .toUpperCase();
    }
  };
  tick();
  window.setInterval(tick, 1000);
}

function wireUi() {
  if (els.logoutBtn) els.logoutBtn.addEventListener("click", () => signOutAndRedirect("login.html"));
  if (els.refreshBtn) els.refreshBtn.addEventListener("click", () => refreshAll("manual"));
  if (els.refreshBtnSide) els.refreshBtnSide.addEventListener("click", () => refreshAll("manual"));
  if (els.searchInput) els.searchInput.addEventListener("input", (e) => renderSearch(e.target.value));

  if (els.filtersHotspot) els.filtersHotspot.addEventListener("click", toggleFilters);
  if (els.filtersClose) els.filtersClose.addEventListener("click", closeFilters);
  if (els.filtersApply) {
    els.filtersApply.addEventListener("click", () => {
      state.filters.montadora = String(els.filterMontadora?.value || "");
      state.filters.proprietario = String(els.filterProprietario?.value || "");
      saveFilters();
      closeFilters();
      recomputeAndRender();
    });
  }
  if (els.filtersClear) {
    els.filtersClear.addEventListener("click", () => {
      state.filters = { montadora: "", proprietario: "" };
      saveFilters();
      closeFilters();
      recomputeAndRender();
    });
  }

  if (els.layoutEditOpen) els.layoutEditOpen.addEventListener("click", openLayoutEditor);
  if (els.layoutClose) els.layoutClose.addEventListener("click", closeLayoutEditor);
  if (els.layoutModal) {
    els.layoutModal.addEventListener("click", (e) => {
      if (e.target === els.layoutModal) closeLayoutEditor();
    });
  }
  if (els.toggleHideNonSellable) {
    els.toggleHideNonSellable.addEventListener("change", (e) => {
      state.layoutPrefs.hideNonSellable = !!e.target.checked;
      saveLayoutPrefs();
      recomputeAndRender();
      renderLayoutEditor();
    });
  }
  if (els.layoutReset) {
    els.layoutReset.addEventListener("click", () => {
      state.layoutPrefs.overrides = {};
      saveLayoutPrefs();
      recomputeAndRender();
      renderLayoutEditor();
    });
  }
  if (els.rotateSeconds) {
    els.rotateSeconds.addEventListener("change", (e) => {
      const candidate = Number(e.target.value);
      state.layoutPrefs.rotateSeconds = ROTATION_OPTIONS_SECONDS.includes(candidate)
        ? candidate
        : DEFAULT_ROTATION_SECONDS;
      saveLayoutPrefs();
      restartDepRotation();
      renderLayoutEditor();
    });
  }
}

function setUpdatedBadge(meta) {
  if (!els.lastUpdate) return;
  const fromFile = meta?.created_at ? formatDateTime(meta.created_at) : "--";
  els.lastUpdate.textContent = `Atualizado: ${fromFile}`;
}

function setMetaPanel(meta, rowsCount = 0) {
  if (!els.fileMeta) return;
  if (!meta) {
    els.fileMeta.textContent = "Sem upload encontrado para esta unidade.";
    return;
  }
  const sizeKb = Number(meta.file_size || 0) / 1024;
  els.fileMeta.innerHTML = [
    `<strong>${escapeHtml(meta.file_name || "mapa_de_patio.xlsx")}</strong>`,
    `Criado em: ${escapeHtml(formatDateTime(meta.created_at))}`,
    `Tamanho: ${Number.isFinite(sizeKb) && sizeKb > 0 ? `${sizeKb.toFixed(1)} KB` : "--"}`,
    `Linhas lidas: ${Number(rowsCount || 0).toLocaleString("pt-BR")}`,
  ].join("<br>");
}

function recomputeAndRender() {
  if (!state.rawRows.length || !state.keys) {
    renderDashboard({ blocks: [], owners: [], vehicleRows: [], totalVehicleCount: 0, totalCapacity: 0, available: 0, occPct: 0 });
    return;
  }
  const baseRowsVisible = state.rawRows.filter((row) => {
    const deposito = state.keys.keyDepos ? String(row[state.keys.keyDepos] ?? "").trim() : "Sem Deposito";
    const area = state.keys.keyArea ? String(row[state.keys.keyArea] ?? "").trim() : "Sem Area";
    return isAreaVisible(deposito, area);
  });
  state.filteredRows = applyDataFilters(baseRowsVisible, state.keys);
  const model = inferAndBuild(state.filteredRows, state.keys, baseRowsVisible);
  renderDashboard(model);
  renderSearch(els.searchInput?.value || "");
  if (els.layoutModal?.classList.contains("open")) renderLayoutEditor();
}

async function getLatestMapaPatioUpload() {
  const { data, error } = await supabase
    .from("mapa_patio_uploads")
    .select("file_name, storage_path, created_at, file_size, mime_type, unit_slug, unit_id")
    .eq("unit_slug", ACTIVE_UNIT)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function downloadStorageFile(meta) {
  if (!meta?.storage_path) return null;
  const { data: signedData, error: signedErr } = await supabase.storage
    .from("avantrax-files")
    .createSignedUrl(meta.storage_path, 60, { download: meta.file_name || "mapa_de_patio.xlsx" });

  if (signedErr || !signedData?.signedUrl) {
    const { data, error } = await supabase.storage.from("avantrax-files").download(meta.storage_path);
    if (error) throw error;
    return data;
  }

  const sep = signedData.signedUrl.includes("?") ? "&" : "?";
  const res = await fetch(`${signedData.signedUrl}${sep}v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Falha ao baixar arquivo (${res.status})`);
  return await res.blob();
}

let refreshLock = false;
let refreshQueued = false;

async function refreshAll(reason = "manual") {
  if (refreshLock) {
    refreshQueued = true;
    return;
  }
  refreshLock = true;
  try {
    const meta = await getLatestMapaPatioUpload();
    state.meta = meta;
    setUpdatedBadge(meta);

    if (!meta) {
      state.rawRows = [];
      state.filteredRows = [];
      state.keys = {};
      setMetaPanel(null, 0);
      renderDashboard({ blocks: [], owners: [], vehicleRows: [], totalVehicleCount: 0, totalCapacity: 0, available: 0, occPct: 0 });
      if (els.blocksGrid) {
        els.blocksGrid.innerHTML = `<div class="empty">Nao ha upload em <strong>mapa_patio_uploads</strong> para esta unidade.</div>`;
      }
      return;
    }

    const blob = await downloadStorageFile(meta);
    const parsed = await parseExcelBlob(blob);
    state.rawRows = parsed.rows;
    state.keys = detectKeys(parsed.rows);
    buildFilterOptions(parsed.rows, state.keys);
    buildAreaCatalog(parsed.rows, state.keys);
    recomputeAndRender();
    setMetaPanel(meta, parsed.rows.length);
  } catch (err) {
    console.error("[mapa-estoque] falha ao atualizar", err);
    if (els.blocksGrid) {
      els.blocksGrid.innerHTML = `<div class="empty">Falha ao carregar mapa de estoque: ${escapeHtml(err?.message || String(err))}</div>`;
    }
    if (els.fileMeta) {
      els.fileMeta.textContent = `Erro: ${String(err?.message || err)}`;
    }
  } finally {
    if (els.realtimeStatus && reason === "manual") {
      els.realtimeStatus.textContent = "Realtime: conectado";
    }
    refreshLock = false;
    if (refreshQueued) {
      refreshQueued = false;
      window.setTimeout(() => refreshAll("queued"), 120);
    }
  }
}

function initRealtime() {
  if (els.realtimeStatus) els.realtimeStatus.textContent = "Realtime: conectando...";
  const channel = supabase
    .channel(`avantrax-estoque-updates-${Date.now()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "dashboard_updates" }, (payload) => {
      const unit = String(payload?.new?.unit_slug || "").trim().toLowerCase();
      if (unit && unit !== ACTIVE_UNIT) return;
      refreshAll("realtime");
    })
    .subscribe((status) => {
      if (!els.realtimeStatus) return;
      if (status === "SUBSCRIBED") els.realtimeStatus.textContent = "Realtime: conectado";
      else if (status === "CHANNEL_ERROR") els.realtimeStatus.textContent = "Realtime: erro no canal";
      else if (status === "TIMED_OUT") els.realtimeStatus.textContent = "Realtime: timeout";
      else els.realtimeStatus.textContent = `Realtime: ${String(status || "conectando").toLowerCase()}`;
    });
  window.addEventListener("beforeunload", () => {
    try { supabase.removeChannel(channel); } catch (_) {}
  });
}

readFilters();
readLayoutPrefs();
wireUi();
wireShortcuts();
startClock();
initRealtime();
refreshAll("startup");
