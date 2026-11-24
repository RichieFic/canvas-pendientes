// Service worker: conexión OAuth con Google / Microsoft y sincronización de
// las entregas de Canvas a un calendario dedicado "Canvas Pendientes".
importScripts("config.js", "settings.js", "canvas-api.js");

const PROVIDERS = ["google", "microsoft"];
const CAL_NAME = "Canvas Pendientes";
const SYNC_THROTTLE_MS = 10 * 60 * 1000;
const ALARM = "cpt-sync";

// ---------------------------------------------------------------------------
// Utilidades de almacenamiento
// ---------------------------------------------------------------------------
const local = chrome.storage.local;

async function getLocal(key, fallback) {
  const r = await local.get(key);
  return r[key] === undefined ? fallback : r[key];
}

async function getStatus(p) {
  return getLocal(`status_${p}`, { connected: false });
}

async function setStatus(p, patch) {
  const cur = await getStatus(p);
  await local.set({ [`status_${p}`]: { ...cur, ...patch } });
}

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

class CalError extends Error {
  constructor(message, { status = 0, reconnect = false } = {}) {
    super(message);
    this.status = status;
    this.reconnect = reconnect;
  }
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------
const AUTH = {
  google: {
    label: "Google",
    configKey: "GOOGLE_CLIENT_ID",
    devKey: "googleClientId",
    url({ clientId, redirect, state, interactive, hint }) {
      const q = new URLSearchParams({
        client_id: clientId,
        response_type: "token",
        redirect_uri: redirect,
        scope: "email https://www.googleapis.com/auth/calendar.app.created",
        include_granted_scopes: "true",
        state,
      });
      if (!interactive) q.set("prompt", "none");
      else q.set("prompt", "select_account consent");
      if (hint) q.set("login_hint", hint);
      return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
    },
    async email(token) {
      const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.ok ? (await r.json()).email || "" : "";
    },
    async revoke(token) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }).catch(() => {});
    },
  },
  microsoft: {
    label: "Microsoft",
    configKey: "MICROSOFT_CLIENT_ID",
    devKey: "microsoftClientId",
    url({ clientId, redirect, state, interactive, hint }) {
      const q = new URLSearchParams({
        client_id: clientId,
        response_type: "token",
        redirect_uri: redirect,
        response_mode: "fragment",
        scope: "https://graph.microsoft.com/User.Read https://graph.microsoft.com/Calendars.ReadWrite",
        state,
      });
      q.set("prompt", interactive ? "select_account" : "none");
      if (hint) q.set("login_hint", hint);
      return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${q}`;
    },
    async email(token) {
      const r = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return "";
      const j = await r.json();
      return j.mail || j.userPrincipalName || "";
    },
    async revoke() { /* Microsoft no ofrece revocación de tokens implícitos */ },
  },
};

async function getClientId(p) {
  const dev = await getLocal("devConfig", {});
  return (dev[AUTH[p].devKey] || CPT_CONFIG[AUTH[p].configKey] || "").trim();
}

async function getToken(p, { interactive = false } = {}) {
  const key = `auth_${p}`;
  const auth = await getLocal(key, null);
  if (!interactive && auth && auth.token && auth.expiresAt > Date.now() + 60_000) return auth.token;

  const clientId = await getClientId(p);
  if (!clientId) {
    throw new CalError(
      `Falta configurar el Client ID de ${AUTH[p].label} (config.js o Opciones → Avanzado).`
    );
  }
  const status = await getStatus(p);
  const state = crypto.randomUUID();
  const url = AUTH[p].url({
    clientId,
    redirect: chrome.identity.getRedirectURL(p),
    state,
    interactive,
    hint: status.email || "",
  });

  let redirect;
  try {
    redirect = await chrome.identity.launchWebAuthFlow({ url, interactive });
  } catch (e) {
    throw new CalError(
      interactive
        ? `No se completó el inicio de sesión con ${AUTH[p].label}.`
        : `La sesión de ${AUTH[p].label} expiró. Vuelve a conectar.`,
      { reconnect: !interactive }
    );
  }
  if (!redirect) throw new CalError("Inicio de sesión cancelado.");

  const params = new URLSearchParams(new URL(redirect).hash.slice(1) || new URL(redirect).search.slice(1));
  if (params.get("state") !== state) throw new CalError("Respuesta de inicio de sesión no válida (state).");
  if (params.get("error")) {
    const desc = params.get("error_description") || params.get("error");
    throw new CalError(`${AUTH[p].label}: ${desc}`, { reconnect: !interactive });
  }
  const token = params.get("access_token");
  if (!token) throw new CalError(`${AUTH[p].label} no devolvió un token.`);
  const expiresIn = Number(params.get("expires_in")) || 3600;
  await local.set({ [key]: { token, expiresAt: Date.now() + expiresIn * 1000 } });
  return token;
}

// ---------------------------------------------------------------------------
// Llamadas a las APIs de calendario
// ---------------------------------------------------------------------------
const API_BASE = {
  google: "https://www.googleapis.com/calendar/v3",
  microsoft: "https://graph.microsoft.com/v1.0",
};

async function api(p, method, path, body, retry = true) {
  const token = await getToken(p);
  const r = await fetch(API_BASE[p] + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401 && retry) {
    await local.remove(`auth_${p}`);
    return api(p, method, path, body, false);
  }
  if (r.status === 204) return null;
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* no JSON */ }
  if (!r.ok) {
    const msg = (data && data.error && (data.error.message || data.error)) || text.slice(0, 160) || r.statusText;
    throw new CalError(`${AUTH[p].label} ${r.status}: ${msg}`, { status: r.status, reconnect: r.status === 401 });
  }
  return data;
}

const enc = encodeURIComponent;
const calendarPath = (p, id) => (p === "google" ? `/calendars/${enc(id)}` : `/me/calendars/${enc(id)}`);
const eventsPath = (p, id) => `${calendarPath(p, id)}/events`;

async function getCalState(p) {
  return getLocal(`cal_${p}`, { calendarId: null, map: {} });
}

async function saveCalState(p, st) {
  await local.set({ [`cal_${p}`]: st });
}

async function ensureCalendar(p) {
  const st = await getCalState(p);
  if (st.calendarId) {
    try {
      await api(p, "GET", calendarPath(p, st.calendarId));
      return st;
    } catch (e) {
      if (![404, 410].includes(e.status)) throw e;
    }
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const cal =
    p === "google"
      ? await api(p, "POST", "/calendars", {
          summary: CAL_NAME,
          description: "Entregas de Canvas sincronizadas por la extensión Canvas Pendientes Tec.",
          timeZone: tz,
        })
      : await api(p, "POST", "/me/calendars", { name: CAL_NAME, color: "auto" });
  const fresh = { calendarId: cal.id, map: {} };
  await saveCalState(p, fresh);
  return fresh;
}

function buildEvent(p, it, cal) {
  const due = new Date(it.due);
  const dur = Math.min(240, Math.max(5, Number(cal.eventMinutes) || 30));
  const start = new Date(due.getTime() - dur * 60_000);
  // Los recordatorios son relativos al INICIO del evento: se ajustan para que
  // queden relativos a la fecha límite.
  const reminders = [...new Set((cal.reminders || []).map((m) => Math.max(0, Number(m) - dur)))]
    .filter((m) => Number.isFinite(m) && m <= 40320)
    .sort((a, b) => b - a);
  const summary = `${it.missing ? "⚠ " : ""}${it.type}: ${it.title}`;
  const isHttp = /^https?:\/\//.test(it.url || "");

  if (p === "google") {
    const lines = [`Curso: ${it.course}`];
    if (it.points) lines.push(`Puntos: ${it.points}`);
    if (it.missing) lines.push("Estado: atrasada / faltante");
    if (isHttp) lines.push("", `Abrir en Canvas: ${it.url}`);
    return {
      summary,
      description: lines.join("\n"),
      start: { dateTime: start.toISOString() },
      end: { dateTime: due.toISOString() },
      transparency: "transparent",
      reminders: {
        useDefault: false,
        overrides: reminders.slice(0, 5).map((minutes) => ({ method: "popup", minutes })),
      },
      ...(isHttp ? { source: { title: "Canvas", url: it.url } } : {}),
      ...(it.missing ? { colorId: "11" } : {}),
    };
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  let html = `<p><b>Curso:</b> ${esc(it.course)}</p>`;
  if (it.points) html += `<p><b>Puntos:</b> ${esc(it.points)}</p>`;
  if (it.missing) html += `<p><b>Estado:</b> atrasada / faltante</p>`;
  if (isHttp) html += `<p><a href="${esc(it.url)}">Abrir en Canvas</a></p>`;
  return {
    subject: summary,
    body: { contentType: "HTML", content: html },
    start: { dateTime: start.toISOString().slice(0, 19), timeZone: "UTC" },
    end: { dateTime: due.toISOString().slice(0, 19), timeZone: "UTC" },
    showAs: "free",
    importance: it.missing ? "high" : "normal",
    // Outlook solo admite un recordatorio: se usa el más anticipado.
    isReminderOn: reminders.length > 0,
    reminderMinutesBeforeStart: reminders.length ? reminders[0] : 0,
  };
}

// ---------------------------------------------------------------------------
// Avisos cada hora el día de la entrega
// ---------------------------------------------------------------------------
// Horas en punto del día de la entrega, desde `fromHour`, antes de la hora límite.
function hourlyTimes(dueIso, fromHour) {
  const due = new Date(dueIso);
  const from = Math.min(23, Math.max(0, Math.round(Number(fromHour))));
  const out = [];
  for (let h = Number.isFinite(from) ? from : 13; h <= 23; h++) {
    const t = new Date(due);
    t.setHours(h, 0, 0, 0);
    if (t < due) out.push(t);
  }
  return out;
}

// Google permite máx. 5 avisos por evento y Outlook solo 1, así que los avisos
// se reparten en eventos cortos "⏰": cada uno se ubica en la última hora de
// su grupo y avisa 0, 60, 120… minutos antes.
function buildHourlyEvent(p, it, at, group) {
  const end = new Date(at.getTime() + 15 * 60_000);
  const time = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(new Date(it.due));
  const summary = `⏰ Hoy vence a las ${time}: ${it.title}`;
  const isHttp = /^https?:\/\//.test(it.url || "");

  if (p === "google") {
    const lines = ["Aviso de cada hora de Canvas Pendientes.", `Curso: ${it.course}`];
    if (isHttp) lines.push("", `Abrir en Canvas: ${it.url}`);
    return {
      summary,
      description: lines.join("\n"),
      start: { dateTime: at.toISOString() },
      end: { dateTime: end.toISOString() },
      transparency: "transparent",
      reminders: {
        useDefault: false,
        overrides: group.map((t) => ({ method: "popup", minutes: Math.round((at - t) / 60_000) })),
      },
      ...(isHttp ? { source: { title: "Canvas", url: it.url } } : {}),
    };
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return {
    subject: summary,
    body: {
      contentType: "HTML",
      content: `<p><b>Curso:</b> ${esc(it.course)}</p>${isHttp ? `<p><a href="${esc(it.url)}">Abrir en Canvas</a></p>` : ""}`,
    },
    start: { dateTime: at.toISOString().slice(0, 19), timeZone: "UTC" },
    end: { dateTime: end.toISOString().slice(0, 19), timeZone: "UTC" },
    showAs: "free",
    isReminderOn: true,
    reminderMinutesBeforeStart: 0,
  };
}

// Evento principal + eventos de aviso por hora. Las claves de los avisos
// derivan de la entrega, así que se borran junto con ella al completarla.
function buildEvents(p, it, cal) {
  const out = [{ key: it.key, ev: buildEvent(p, it, cal) }];
  const hourly = cal.hourly || {};
  if (!hourly.enabled) return out;
  const times = hourlyTimes(it.due, hourly.fromHour);
  const size = p === "google" ? 5 : 1;
  for (let i = 0; i < times.length; i += size) {
    const group = times.slice(i, i + size);
    const at = group[group.length - 1];
    out.push({ key: `${it.key}#h${at.getHours()}`, ev: buildHourlyEvent(p, it, at, group) });
  }
  return out;
}

async function syncProvider(p, items, settings) {
  const st = await ensureCalendar(p);
  const map = st.map || (st.map = {});
  const path = eventsPath(p, st.calendarId);
  const seen = new Set();
  const result = { created: 0, updated: 0, deleted: 0, total: items.length };

  try {
    for (const it of items) {
      for (const { key, ev } of buildEvents(p, it, settings.calendar)) {
        seen.add(key);
        const h = hash(JSON.stringify(ev));
        const cur = map[key];
        if (cur && cur.h === h) continue;

        if (cur) {
          try {
            await api(p, "PATCH", `${path}/${enc(cur.id)}`, ev);
            map[key] = { id: cur.id, h, due: it.due };
            result.updated++;
            continue;
          } catch (e) {
            if (![404, 410].includes(e.status)) throw e;
          }
        }
        const created = await api(p, "POST", path, ev);
        map[key] = { id: created.id, h, due: it.due };
        result.created++;
      }
    }

    // Lo que ya no está pendiente: si la fecha aún no pasa, se completó → borrar.
    const now = Date.now();
    for (const [key, cur] of Object.entries(map)) {
      if (seen.has(key)) continue;
      if (new Date(cur.due).getTime() > now) {
        try {
          await api(p, "DELETE", `${path}/${enc(cur.id)}`);
          result.deleted++;
        } catch (e) {
          if (![404, 410].includes(e.status)) throw e;
        }
      }
      delete map[key];
    }
  } finally {
    await saveCalState(p, st);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Orquestación
// ---------------------------------------------------------------------------
let running = null;

function runSync(opts) {
  if (!running) running = doSync(opts).finally(() => { running = null; });
  return running;
}

async function doSync({ only } = {}) {
  const settings = await cptGetSettings();
  const last = await getLocal("lastItems", null);
  if (!last || !Array.isArray(last.items)) return { ok: false, error: "Abre Canvas para cargar tus entregas." };

  const out = {};
  for (const p of only ? [only] : PROVIDERS) {
    const status = await getStatus(p);
    if (!status.connected) continue;
    try {
      const r = await syncProvider(p, last.items, settings);
      await setStatus(p, { lastSync: Date.now(), lastError: null, needsReconnect: false, lastResult: r });
      out[p] = { ok: true, ...r };
    } catch (e) {
      await setStatus(p, { lastError: e.message, needsReconnect: !!e.reconnect });
      out[p] = { ok: false, error: e.message };
    }
  }
  await local.set({ lastSyncAt: Date.now(), lastSyncHash: last.hash });
  return { ok: true, results: out };
}

async function anyConnected() {
  for (const p of PROVIDERS) if ((await getStatus(p)).connected) return true;
  return false;
}

async function onItems(msg) {
  const items = Array.isArray(msg.items) ? msg.items : [];
  const h = hash(JSON.stringify(items));
  await local.set({ lastItems: { items, hash: h, at: Date.now() }, canvasOrigin: msg.origin });

  const settings = await cptGetSettings();
  if (!settings.calendar.autoSync || !(await anyConnected())) return;
  const { lastSyncAt = 0, lastSyncHash } = await local.get(["lastSyncAt", "lastSyncHash"]);
  if (h !== lastSyncHash || Date.now() - lastSyncAt > SYNC_THROTTLE_MS) runSync();
}

async function connect(p) {
  await getToken(p, { interactive: true });
  const token = await getToken(p);
  const email = await AUTH[p].email(token).catch(() => "");
  await setStatus(p, { connected: true, email, lastError: null, needsReconnect: false });
  return runSync({ only: p });
}

async function disconnect(p) {
  const auth = await getLocal(`auth_${p}`, null);
  if (auth && auth.token) await AUTH[p].revoke(auth.token);
  await local.remove([`auth_${p}`]);
  await setStatus(p, { connected: false, lastError: null, needsReconnect: false });
}

async function refreshFromCanvas() {
  const origin = await getLocal("canvasOrigin", null);
  if (!origin) return;
  try {
    const items = await CPT.loadItems(origin);
    await onItems({ origin, items: CPT.serializeItems(items) });
  } catch {
    // Sin sesión de Canvas en el navegador: se sincroniza la próxima vez que lo abras.
  }
}

// ---------------------------------------------------------------------------
// Eventos de Chrome
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !msg || typeof msg.type !== "string") return false;
  const reply = (promise) => {
    promise
      .then((r) => sendResponse(r || { ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  };
  const p = PROVIDERS.includes(msg.provider) ? msg.provider : null;

  switch (msg.type) {
    case "items":
      return reply(onItems(msg));
    case "connect":
      return p ? reply(connect(p)) : false;
    case "disconnect":
      return p ? reply(disconnect(p)) : false;
    case "syncNow":
      return reply(runSync());
    case "openOptions":
      chrome.runtime.openOptionsPage();
      return false;
    default:
      return false;
  }
});

let settingsTimer = null;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes.settings) return;
  const before = JSON.stringify((changes.settings.oldValue || {}).calendar);
  const after = JSON.stringify((changes.settings.newValue || {}).calendar);
  if (before === after) return;
  clearTimeout(settingsTimer);
  settingsTimer = setTimeout(async () => {
    if (await anyConnected()) runSync();
  }, 3000);
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

function ensureAlarm() {
  chrome.alarms.create(ALARM, { periodInMinutes: 60, delayInMinutes: 5 });
}
chrome.runtime.onInstalled.addListener((details) => {
  ensureAlarm();
  if (details.reason === "install") chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(ensureAlarm);

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM || !(await anyConnected())) return;
  await refreshFromCanvas();
});
