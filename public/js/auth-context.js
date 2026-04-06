import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_CLIENT_CACHE_KEY = "__AVANTRAX_SUPABASE_CLIENT__";

function getSupabaseConfig() {
  const viteEnv = (typeof import.meta !== "undefined" && import.meta && import.meta.env) ? import.meta.env : undefined;
  const url = (viteEnv && viteEnv.VITE_SUPABASE_URL) || window.SUPABASE_URL;
  const key = (viteEnv && viteEnv.VITE_SUPABASE_ANON_KEY) || window.SUPABASE_ANON_KEY;
  return { url, key };
}

function sanitizeUnitSlug(value) {
  const raw = String(value || "").trim().toLowerCase();
  return raw.replace(/[^a-z0-9_-]/g, "");
}

function withTimeout(promise, ms, label = "operation") {
  const timeoutMs = Math.max(500, Number(ms) || 0);
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`timeout:${label}:${timeoutMs}ms`));
    }, timeoutMs);
    Promise.resolve(promise)
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}

function buildLoginRedirectUrl(loginPath, reason, nextOverride = "") {
  const next = String(nextOverride || `${window.location.pathname.split("/").pop() || "tv.html"}${window.location.search || ""}`);
  const url = new URL(loginPath || "login.html", window.location.href);
  url.searchParams.set("next", next);
  if (reason) url.searchParams.set("reason", reason);
  return url.toString();
}

function redirectToLogin(loginPath, reason) {
  let nextOverride = "";
  let inFrame = false;
  try { inFrame = Boolean(window.top && window.top !== window); } catch (_) {}
  if (inFrame) {
    const qs = new URLSearchParams(window.location.search || "");
    const unit = sanitizeUnitSlug(qs.get("unit") || "");
    nextOverride = `tv.html${unit ? `?unit=${encodeURIComponent(unit)}` : ""}`;
  }
  const target = buildLoginRedirectUrl(loginPath, reason, nextOverride);
  try {
    if (window.top && window.top !== window) {
      window.top.location.replace(target);
      return;
    }
  } catch (_) {}
  window.location.replace(target);
}

export function getSharedSupabaseClient() {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;
  if (window[SUPABASE_CLIENT_CACHE_KEY]) return window[SUPABASE_CLIENT_CACHE_KEY];
  const client = createClient(url, key);
  window[SUPABASE_CLIENT_CACHE_KEY] = client;
  return client;
}

export function makeUnitScopedKey(baseKey, unitSlug) {
  const unit = sanitizeUnitSlug(unitSlug) || "global";
  return `${String(baseKey || "key")}.${unit}`;
}

export async function signOutAndRedirect(loginPath = "login.html") {
  const supabase = getSharedSupabaseClient();
  if (supabase) {
    try { await supabase.auth.signOut(); } catch (_) {}
  }
  redirectToLogin(loginPath, "logout");
}

export async function ensureAuthenticatedContext(options = {}) {
  const loginPath = String(options.loginPath || "login.html");
  const requireUnit = options.requireUnit !== false;

  const supabase = getSharedSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase nao configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  }

  const qs = new URLSearchParams(window.location.search);
  if (qs.has("at") || qs.has("rt")) {
    try {
      const cleaned = new URL(window.location.href);
      cleaned.searchParams.delete("at");
      cleaned.searchParams.delete("rt");
      window.history.replaceState({}, "", cleaned.toString());
    } catch (_) {}
  }

  let authData = null;
  let authError = null;
  try {
    const authResp = await withTimeout(supabase.auth.getUser(), 7000, "auth.getUser");
    authData = authResp?.data || null;
    authError = authResp?.error || null;
  } catch (err) {
    console.warn("[auth] getUser timeout/falha, tentando getSession", err);
    try {
      const sessResp = await withTimeout(supabase.auth.getSession(), 3500, "auth.getSession");
      authData = { user: sessResp?.data?.session?.user || null };
      authError = sessResp?.error || null;
    } catch (sessErr) {
      authError = sessErr || err;
    }
  }
  const user = authData?.user || null;

  if (authError || !user) {
    redirectToLogin(loginPath, "unauthorized");
    return null;
  }

  const requestedUnit = sanitizeUnitSlug(qs.get("unit") || "");

  if (!requireUnit) {
    return { supabase, user, unitSlug: requestedUnit || "", unitId: "" };
  }

  const unitQuery = supabase
    .from("user_units")
    .select("unit_id, unit_slug, active, is_default")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("is_default", { ascending: false })
    .order("unit_slug", { ascending: true });

  let units = null;
  let unitsError = null;
  try {
    const unitsResp = await withTimeout(unitQuery, 7000, "user_units.select");
    units = unitsResp?.data || null;
    unitsError = unitsResp?.error || null;
  } catch (err) {
    unitsError = err;
  }
  if (unitsError) {
    console.error("[auth] erro ao consultar user_units", unitsError);
    redirectToLogin(loginPath, "unit_access_error");
    return null;
  }

  const unitRows = Array.isArray(units) ? units : [];
  const row = requestedUnit
    ? unitRows.find((u) => sanitizeUnitSlug(u?.unit_slug) === requestedUnit) || unitRows[0] || null
    : unitRows[0] || null;
  if (!row?.unit_slug) {
    redirectToLogin(loginPath, "no_unit_access");
    return null;
  }

  const unitSlug = sanitizeUnitSlug(row.unit_slug);
  const unitId = String(row.unit_id || "");

  try { localStorage.setItem("AVANTRAX_LAST_UNIT", unitSlug); } catch (_) {}

  if (requestedUnit !== unitSlug) {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("unit", unitSlug);
    window.history.replaceState({}, "", nextUrl.toString());
  }

  return { supabase, user, unitSlug, unitId };
}
