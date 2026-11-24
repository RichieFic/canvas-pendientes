// Página de configuración: guarda en chrome.storage.sync ("settings").
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const PROVIDERS = ["google", "microsoft"];
  let settings;
  let saveTimer = null;

  // ---------- Guardado ----------
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      await chrome.storage.sync.set({ settings });
      const s = $("#saved");
      s.textContent = "✓ Guardado";
      s.classList.add("show");
      setTimeout(() => s.classList.remove("show"), 1200);
    }, 250);
  }

  // ---------- Apariencia ----------
  function fillSelect(sel, entries) {
    sel.replaceChildren(
      ...entries.map(([value, label]) => {
        const o = document.createElement("option");
        o.value = value;
        o.textContent = label;
        return o;
      })
    );
  }

  // Ajustes guardados por versiones anteriores usaban preset "custom".
  const basePreset = () => (CPT_PRESETS[settings.theme.preset] ? settings.theme.preset : "tec");

  function presetColors(key) {
    const { label, ...colors } = CPT_PRESETS[key];
    return colors;
  }

  // Se calcula comparando con el tema base (no depende de un flag guardado,
  // así también funciona con ajustes de versiones anteriores).
  function isCustomized() {
    const orig = presetColors(basePreset());
    return Object.keys(orig).some((k) => String(settings.theme[k]).toLowerCase() !== orig[k].toLowerCase());
  }

  // Ajustes viejos sin tema base: elegir el preset más parecido.
  function guessPreset() {
    if (CPT_PRESETS[settings.theme.preset]) return;
    let best = "tec";
    let bestScore = -1;
    for (const key of Object.keys(CPT_PRESETS)) {
      const orig = presetColors(key);
      const score = Object.keys(orig).filter((k) => String(settings.theme[k]).toLowerCase() === orig[k].toLowerCase()).length;
      if (score > bestScore) { best = key; bestScore = score; }
    }
    settings.theme.preset = best;
  }

  function renderTheme() {
    const t = settings.theme;
    const base = basePreset();
    t.customized = isCustomized();
    $("#theme-enabled").checked = t.enabled;
    $("#theme-body").classList.toggle("disabled", !t.enabled);
    // El selector muestra el tema base; si se editó, lo indica.
    for (const o of $("#preset").options) {
      const p = CPT_PRESETS[o.value];
      o.textContent = p.label + (o.value === base && t.customized ? " (modificado)" : "");
    }
    $("#preset").value = base;
    const resetBtn = $("#theme-reset-preset");
    resetBtn.textContent = `Restablecer colores de “${CPT_PRESETS[base].label}”`;
    resetBtn.disabled = !t.customized;
    $("#preset-note").textContent = t.customized
      ? `Cambiaste colores del tema “${CPT_PRESETS[base].label}”. El botón regresa a sus colores originales (la letra no cambia).`
      : "";
    for (const inp of $$("[data-color]")) inp.value = t[inp.dataset.color];
    $("#font-size").value = t.fontSize;
    $("#font-size-out").textContent = `${t.fontSize}%`;
    $("#font-family").value = t.fontFamily;
    renderPreview();
  }

  function renderPreview() {
    const t = cptSanitizeTheme(settings.theme);
    const pv = $("#preview");
    for (const k of ["bg", "text", "accent", "card", "nav", "navText"]) pv.style.setProperty(`--pv-${k}`, t[k]);
    pv.style.setProperty("--pv-scale", String(t.fontSize / 100));
    const font = CPT_FONTS[t.fontFamily];
    pv.style.setProperty("--pv-font", font && font.stack ? font.stack : "inherit");
  }

  function initTheme() {
    fillSelect($("#preset"), Object.entries(CPT_PRESETS).map(([k, p]) => [k, p.label]));
    fillSelect($("#font-family"), Object.entries(CPT_FONTS).map(([k, f]) => [k, f.label]));

    $("#theme-enabled").addEventListener("change", (e) => {
      settings.theme.enabled = e.target.checked;
      renderTheme();
      save();
    });
    $("#preset").addEventListener("change", (e) => {
      if (!CPT_PRESETS[e.target.value]) return;
      settings.theme.preset = e.target.value;
      settings.theme.customized = false;
      Object.assign(settings.theme, presetColors(e.target.value));
      renderTheme();
      save();
    });
    for (const inp of $$("[data-color]")) {
      inp.addEventListener("input", () => {
        settings.theme[inp.dataset.color] = inp.value;
        settings.theme.preset = basePreset();
        renderTheme();
        save();
      });
    }
    $("#theme-reset-preset").addEventListener("click", () => {
      settings.theme.preset = basePreset();
      Object.assign(settings.theme, presetColors(settings.theme.preset));
      settings.theme.customized = false;
      renderTheme();
      save();
    });
    $("#font-size").addEventListener("input", (e) => {
      settings.theme.fontSize = Number(e.target.value);
      $("#font-size-out").textContent = `${e.target.value}%`;
      renderPreview();
      save();
    });
    $("#font-family").addEventListener("change", (e) => {
      settings.theme.fontFamily = e.target.value;
      renderPreview();
      save();
    });
    $("#theme-reset").addEventListener("click", () => {
      settings.theme = { ...CPT_DEFAULTS.theme, enabled: settings.theme.enabled };
      renderTheme();
      save();
    });
  }

  // ---------- Pantalla principal ----------
  function renderDash() {
    const d = settings.dashboard;
    $("#dash-enabled").checked = d.enabled;
    $("#dash-body").classList.toggle("disabled", !d.enabled);
    $("#dash-progress").checked = d.progress;
    for (const cb of $$("#hide-widgets input")) cb.checked = d.hideWidgets.includes(cb.value);
    $("#dash-ann").checked = d.announcements;
    $("#dash-ann-count").value = d.annCount;
    $("#dash-up").checked = d.upcoming;
    $("#dash-up-days").value = d.upcomingDays;
  }

  function initDash() {
    const bind = (sel, key, read) =>
      $(sel).addEventListener("change", (e) => {
        settings.dashboard[key] = read(e.target);
        renderDash();
        save();
      });
    const num = (min, max) => (t) => Math.min(max, Math.max(min, Math.round(Number(t.value)) || min));
    bind("#dash-enabled", "enabled", (t) => t.checked);
    bind("#dash-progress", "progress", (t) => t.checked);

    const box = $("#hide-widgets");
    for (const w of CPT_CANVAS_WIDGETS) {
      const label = document.createElement("label");
      label.className = "check";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = w.id;
      cb.addEventListener("change", () => {
        settings.dashboard.hideWidgets = $$("#hide-widgets input:checked").map((x) => x.value);
        save();
      });
      label.append(cb, document.createTextNode(` ${w.label}`));
      box.append(label);
    }
    bind("#dash-ann", "announcements", (t) => t.checked);
    bind("#dash-up", "upcoming", (t) => t.checked);
    bind("#dash-ann-count", "annCount", num(1, 20));
    bind("#dash-up-days", "upcomingDays", num(1, 60));
  }

  // ---------- Calendario ----------
  function initCalendar() {
    const box = $("#reminders");
    for (const r of CPT_REMINDER_OPTIONS) {
      const label = document.createElement("label");
      label.className = "check";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = String(r.minutes);
      cb.addEventListener("change", () => {
        settings.calendar.reminders = $$("#reminders input:checked").map((x) => Number(x.value));
        save();
      });
      label.append(cb, document.createTextNode(` ${r.label}`));
      box.append(label);
    }
    $("#event-min").addEventListener("change", (e) => {
      settings.calendar.eventMinutes = Number(e.target.value);
      save();
    });
    $("#auto-sync").addEventListener("change", (e) => {
      settings.calendar.autoSync = e.target.checked;
      save();
    });

    for (const card of $$(".provider")) {
      const p = card.dataset.provider;
      card.querySelector('[data-act="connect"]').addEventListener("click", (e) => act(e.target, { type: "connect", provider: p }));
      card.querySelector('[data-act="disconnect"]').addEventListener("click", (e) => act(e.target, { type: "disconnect", provider: p }));
    }
    $("#sync-now").addEventListener("click", (e) => act(e.target, { type: "syncNow" }));
  }

  function renderCalendar() {
    const c = settings.calendar;
    for (const cb of $$("#reminders input")) cb.checked = c.reminders.includes(Number(cb.value));
    $("#event-min").value = String(c.eventMinutes);
    $("#auto-sync").checked = c.autoSync;
  }

  const timeFmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });

  async function renderStatus() {
    const st = await chrome.storage.local.get(["status_google", "status_microsoft", "lastItems"]);
    for (const p of PROVIDERS) {
      const s = st[`status_${p}`] || {};
      const card = $(`.provider[data-provider="${p}"]`);
      const line = card.querySelector(".pstatus");
      const connectBtn = card.querySelector('[data-act="connect"]');
      const discBtn = card.querySelector('[data-act="disconnect"]');
      card.classList.toggle("on", !!s.connected && !s.lastError);
      line.className = "pstatus";

      if (!s.connected) {
        line.textContent = "No conectado.";
        connectBtn.textContent = "Conectar";
        discBtn.hidden = true;
        continue;
      }
      discBtn.hidden = false;
      connectBtn.textContent = s.needsReconnect ? "Reconectar" : "Cambiar cuenta";
      const who = s.email ? `Conectado como ${s.email}.` : "Conectado.";
      if (s.lastError) {
        line.classList.add("err");
        line.textContent = `${who} ⚠ ${s.lastError}`;
      } else if (s.lastSync) {
        line.classList.add("ok");
        const r = s.lastResult || {};
        line.textContent = `${who} Última sincronización: ${timeFmt.format(new Date(s.lastSync))} · ${r.total ?? 0} entregas.`;
      } else {
        line.textContent = `${who} Abre Canvas para sincronizar tus entregas.`;
      }
    }
    const last = st.lastItems;
    $("#sync-msg").textContent = last
      ? `Entregas leídas de Canvas: ${last.items.length} (${timeFmt.format(new Date(last.at))}).`
      : "Aún no se han leído entregas: abre Canvas una vez.";
  }

  async function act(button, msg) {
    button.disabled = true;
    const original = button.textContent;
    button.textContent = msg.type === "disconnect" ? "Desconectando…" : msg.type === "connect" ? "Conectando…" : "Sincronizando…";
    try {
      const r = await chrome.runtime.sendMessage(msg);
      if (r && r.ok === false && r.error) alert(r.error);
    } catch (e) {
      alert(e.message);
    } finally {
      button.disabled = false;
      button.textContent = original;
      renderStatus();
    }
  }

  // ---------- Avanzado ----------
  async function initAdvanced() {
    $("#ext-id").textContent = chrome.runtime.id;
    $("#redir-google").textContent = chrome.identity.getRedirectURL("google");
    $("#redir-microsoft").textContent = chrome.identity.getRedirectURL("microsoft");
    const { devConfig = {} } = await chrome.storage.local.get("devConfig");
    const map = { "#dev-google": "googleClientId", "#dev-microsoft": "microsoftClientId" };
    for (const [sel, key] of Object.entries(map)) {
      const inp = $(sel);
      inp.value = devConfig[key] || "";
      inp.addEventListener("change", async () => {
        const { devConfig: cur = {} } = await chrome.storage.local.get("devConfig");
        cur[key] = inp.value.trim();
        await chrome.storage.local.set({ devConfig: cur });
      });
    }
    $("#dev-google").placeholder = CPT_CONFIG.GOOGLE_CLIENT_ID ? "(config.js ✓)" : "(falta en config.js)";
    $("#dev-microsoft").placeholder = CPT_CONFIG.MICROSOFT_CLIENT_ID ? "(config.js ✓)" : "(falta en config.js)";
  }

  // ---------- Inicio ----------
  async function init() {
    settings = await cptGetSettings();
    guessPreset();
    initTheme();
    initDash();
    initCalendar();
    renderTheme();
    renderDash();
    renderCalendar();
    renderStatus();
    initAdvanced();

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && (changes.status_google || changes.status_microsoft || changes.lastItems)) renderStatus();
    });
  }

  init();
})();
