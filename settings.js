// Ajustes compartidos (content scripts, service worker y página de opciones).
/* eslint-disable no-unused-vars */

const CPT_PRESETS = {
  tec:    { label: "Tec (claro)", bg: "#ffffff", text: "#1f2328", accent: "#0039a6", card: "#ffffff", nav: "#0039a6", navText: "#ffffff" },
  oscuro: { label: "Oscuro",      bg: "#121418", text: "#e6e8eb", accent: "#6ea8ff", card: "#1c1f26", nav: "#0b0d10", navText: "#e6e8eb" },
  sepia:  { label: "Sepia",       bg: "#f4ecd8", text: "#3b2f1e", accent: "#8a4b08", card: "#fbf6ea", nav: "#5b4636", navText: "#f4ecd8" },
  bosque: { label: "Bosque",      bg: "#eef4ef", text: "#1d2b22", accent: "#1f7a4d", card: "#ffffff", nav: "#1f4d35", navText: "#ffffff" },
  // Fondo gris, texto blanco, detalles cian y barra lateral blanca
  contraste: { label: "Contraste", bg: "#2f343b", text: "#ffffff", accent: "#00e5ff", card: "#3b4149", nav: "#ffffff", navText: "#000000" },
};

const CPT_FONTS = {
  "":        { label: "La de Canvas", stack: "" },
  system:    { label: "Sistema",      stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  arial:     { label: "Arial",        stack: "Arial, Helvetica, sans-serif" },
  verdana:   { label: "Verdana",      stack: "Verdana, Geneva, sans-serif" },
  trebuchet: { label: "Trebuchet",    stack: '"Trebuchet MS", Tahoma, sans-serif' },
  georgia:   { label: "Georgia",      stack: 'Georgia, "Times New Roman", serif' },
  mono:      { label: "Monoespaciada", stack: 'Consolas, "Courier New", monospace' },
};

// Widgets del tablero nuevo de Canvas (data-testid="widget-container-<id>")
const CPT_CANVAS_WIDGETS = [
  { id: "course-work-combined-widget", label: "Trabajo del curso" },
  { id: "course-grades-widget",        label: "Calificaciones del curso" },
  { id: "announcements-widget",        label: "Anuncios" },
  { id: "people-widget",               label: "Personas" },
];

// Minutos antes de la fecha límite
const CPT_REMINDER_OPTIONS = [
  { minutes: 10080, label: "1 semana antes" },
  { minutes: 2880,  label: "2 días antes" },
  { minutes: 1440,  label: "1 día antes" },
  { minutes: 180,   label: "3 horas antes" },
  { minutes: 60,    label: "1 hora antes" },
  { minutes: 15,    label: "15 minutos antes" },
];

const CPT_DEFAULTS = {
  // preset = tema base elegido; customized = el usuario cambió algún color a mano
  theme: { enabled: false, preset: "tec", customized: false, ...stripLabel(CPT_PRESETS.tec), fontSize: 100, fontFamily: "" },
  dashboard: {
    enabled: true, progress: true, announcements: true, upcoming: true, annCount: 5, upcomingDays: 7,
    hideWidgets: ["people-widget"],
    // Colores de la gráfica y la barra de progreso
    chartColors: { done: "#1f9d55", pending: "#3d8bfd", late: "#e5484d" },
  },
  calendar: { reminders: [1440, 60], eventMinutes: 30, autoSync: true },
};

function stripLabel(p) {
  const { label, ...rest } = p;
  return rest;
}

function cptMerge(def, val) {
  if (Array.isArray(def)) return Array.isArray(val) ? val.slice() : def.slice();
  if (def && typeof def === "object") {
    const out = {};
    const v = val && typeof val === "object" && !Array.isArray(val) ? val : {};
    for (const k of Object.keys(def)) out[k] = cptMerge(def[k], v[k]);
    return out;
  }
  return val === undefined || val === null || typeof val !== typeof def ? def : val;
}

async function cptGetSettings() {
  try {
    const { settings } = await chrome.storage.sync.get("settings");
    return cptMerge(CPT_DEFAULTS, settings);
  } catch {
    return cptMerge(CPT_DEFAULTS, {});
  }
}

const CPT_HEX = /^#[0-9a-f]{6}$/i;
function cptSanitizeTheme(t) {
  const d = CPT_DEFAULTS.theme;
  const out = { ...t };
  for (const k of ["bg", "text", "accent", "card", "nav", "navText"]) {
    if (!CPT_HEX.test(out[k] || "")) out[k] = d[k];
  }
  const fs = Number(out.fontSize);
  out.fontSize = Number.isFinite(fs) ? Math.min(150, Math.max(80, Math.round(fs))) : 100;
  if (!Object.prototype.hasOwnProperty.call(CPT_FONTS, out.fontFamily)) out.fontFamily = "";
  return out;
}
