// Canvas Pendientes Tec — panel flotante con todas tus entregas pendientes.
// Usa la API de Canvas con tu sesión actual (mismo origen), sin tokens.
(() => {
  if (window.__cptLoaded) return;
  window.__cptLoaded = true;

  const { el, dateFmt, relative, bucket } = CPT.ui;
  const PROVIDER_LABEL = { google: "Google Calendar", microsoft: "Outlook" };

  // ---------- Datos compartidos (panel + dashboard) ----------
  // Planner completo (incluye completados): lo usa la barra de progreso.
  let plannerPromise = null;
  CPT.getPlanner = (force = false) => {
    if (force || !plannerPromise) {
      plannerPromise = CPT.loadPlanner().then((all) => {
        sendToBackground(CPT.pendingOnly(all));
        return all;
      });
      plannerPromise.catch(() => { plannerPromise = null; });
    }
    return plannerPromise;
  };
  // Solo pendientes: panel, contador y próximas entregas.
  CPT.getItems = (force = false) => CPT.getPlanner(force).then(CPT.pendingOnly);

  function send(msg) {
    try {
      return chrome.runtime.sendMessage(msg).catch(() => null);
    } catch {
      return Promise.resolve(null); // la extensión se recargó; ignorar
    }
  }

  function sendToBackground(items) {
    send({ type: "items", origin: location.origin, items: CPT.serializeItems(items) });
  }

  // ---------- UI ----------
  const btn = el("button", "cpt-btn");
  btn.type = "button";
  btn.title = "Pendientes de Canvas";
  btn.append(CPT.icon("clipboard", "cpt-ic-btn"), el("span", "cpt-badge"));

  const panel = el("div", "cpt-panel");
  panel.hidden = true;
  const header = el("div", "cpt-header");
  const title = CPT.withIcon("strong", null, "clipboard", "Pendientes");
  const refresh = el("button", "cpt-icon");
  refresh.append(CPT.icon("refresh"));
  refresh.title = "Actualizar";
  const gear = el("button", "cpt-icon");
  gear.append(CPT.icon("sliders"));
  gear.title = "Configuración (colores, calendario…)";
  const close = el("button", "cpt-icon");
  close.append(CPT.icon("close"));
  close.title = "Cerrar";
  for (const b of [refresh, gear, close]) b.type = "button";
  header.append(title, refresh, gear, close);
  const body = el("div", "cpt-body");
  const footer = el("div", "cpt-footer");
  panel.append(header, body, footer);
  document.body.append(btn, panel);

  function setBadge(items) {
    const urgent = items.filter((x) => {
      const b = bucket(x.due);
      return b === "Atrasadas" || b === "Hoy" || b === "Mañana";
    }).length;
    const badge = btn.querySelector(".cpt-badge");
    badge.textContent = urgent ? String(urgent) : "";
    badge.hidden = !urgent;
  }

  function render(items) {
    body.replaceChildren();
    if (!items.length) {
      body.append(CPT.withIcon("p", "cpt-empty", "smile", "No tienes pendientes. Disfruta."));
      return;
    }
    const groups = {};
    for (const it of items) (groups[bucket(it.due)] ||= []).push(it);

    for (const name of ["Atrasadas", "Hoy", "Mañana", "Esta semana", "Después"]) {
      const list = groups[name];
      if (!list) continue;
      const sec = el("section", "cpt-group");
      const h = el("h4", `cpt-gtitle ${name === "Atrasadas" ? "cpt-late" : ""}`, `${name} · ${list.length}`);
      sec.append(h);
      for (const it of list) {
        const a = el("a", "cpt-item");
        a.href = it.url || "#";
        const top = el("div", "cpt-top");
        top.append(el("span", "cpt-type", it.type), el("span", "cpt-course", it.course));
        const t = el("div", "cpt-title", it.title);
        const meta = el("div", "cpt-meta");
        meta.append(
          el("span", null, dateFmt.format(it.due)),
          el("span", `cpt-rel ${it.missing ? "cpt-late" : ""}`, relative(it.due))
        );
        if (it.points) meta.append(el("span", null, `${it.points} pts`));
        a.append(top, t, meta);
        sec.append(a);
      }
      body.append(sec);
    }
  }

  async function renderFooter() {
    let st = {};
    try {
      st = await chrome.storage.local.get(["status_google", "status_microsoft"]);
    } catch { return; }
    const connected = ["google", "microsoft"]
      .map((p) => ({ p, s: st[`status_${p}`] }))
      .filter((x) => x.s && x.s.connected);

    const info = el("span");
    const setInfo = (name, text) => info.replaceChildren(CPT.icon(name), document.createTextNode(text));
    const link = el("button", "cpt-link");
    link.type = "button";
    link.addEventListener("click", openOptions);

    if (!connected.length) {
      setInfo("calendar", "Lleva tus entregas a tu calendario");
      link.textContent = "Conectar";
    } else {
      const bad = connected.find((x) => x.s.lastError);
      if (bad) {
        setInfo("alert", `${PROVIDER_LABEL[bad.p]}: ${bad.s.lastError}`);
        info.className = "cpt-warn";
        info.title = bad.s.lastError;
        link.textContent = "Revisar";
      } else {
        const names = connected.map((x) => PROVIDER_LABEL[x.p]).join(" y ");
        const last = Math.max(...connected.map((x) => x.s.lastSync || 0));
        setInfo("calendar", `${names}${last ? ` · sincronizado ${relative(new Date(last))}` : ""}`);
        link.textContent = "Ajustes";
      }
    }
    footer.replaceChildren(info, link);
  }

  async function refreshData(force = true) {
    body.replaceChildren(el("p", "cpt-empty", "Cargando…"));
    try {
      const items = await CPT.getItems(force);
      render(items);
      setBadge(items);
    } catch (e) {
      body.replaceChildren(el("p", "cpt-empty", `No se pudo cargar: ${e.message}. ¿Tienes sesión iniciada?`));
    }
    renderFooter();
  }

  function openOptions() {
    send({ type: "openOptions" });
  }

  CPT.openPanel = () => {
    panel.hidden = false;
    refreshData(false);
  };

  btn.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) refreshData(false);
  });
  close.addEventListener("click", () => (panel.hidden = true));
  refresh.addEventListener("click", () => refreshData(true));
  gear.addEventListener("click", openOptions);

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && (changes.status_google || changes.status_microsoft) && !panel.hidden) renderFooter();
    });
  } catch { /* contexto invalidado */ }

  // Carga silenciosa para mostrar el contador sin abrir el panel
  CPT.getItems().then(setBadge).catch(() => {});
})();
