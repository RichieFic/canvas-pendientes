// Canvas Pendientes Tec — panel flotante con todas tus entregas pendientes.
// Usa la API de Canvas con tu sesión actual (mismo origen), sin tokens.
(() => {
  if (window.__cptLoaded) return;
  window.__cptLoaded = true;

  const DAYS_BACK = 21;   // cuántos días atrás buscar tareas atrasadas
  const DAYS_AHEAD = 60;  // cuántos días adelante buscar pendientes
  const TYPES = {
    assignment: "Tarea",
    quiz: "Quiz",
    discussion_topic: "Foro",
    wiki_page: "Página",
    calendar_event: "Evento",
    planner_note: "Nota",
  };

  let cache = null;

  // ---------- API ----------
  function nextLink(header) {
    if (!header) return null;
    const part = header.split(",").find((p) => p.includes('rel="next"'));
    const m = part && part.match(/<([^>]+)>/);
    return m ? m[1] : null;
  }

  async function fetchAll(url) {
    let out = [];
    let next = url;
    while (next) {
      const r = await fetch(next, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!r.ok) throw new Error(`Canvas respondió ${r.status}`);
      const text = (await r.text()).replace(/^while\(1\);/, "");
      out = out.concat(JSON.parse(text));
      next = nextLink(r.headers.get("Link"));
    }
    return out;
  }

  async function loadItems() {
    const now = Date.now();
    const start = new Date(now - DAYS_BACK * 864e5).toISOString();
    const end = new Date(now + DAYS_AHEAD * 864e5).toISOString();
    const raw = await fetchAll(
      `/api/v1/planner/items?start_date=${start}&end_date=${end}&per_page=100`
    );

    return raw
      .map((it) => {
        const p = it.plannable || {};
        const sub = it.submissions || {};
        const dueStr = p.due_at || p.todo_date || it.plannable_date;
        return {
          title: p.title || p.name || "(sin título)",
          course: it.context_name || "",
          type: TYPES[it.plannable_type] || it.plannable_type,
          url: it.html_url,
          due: dueStr ? new Date(dueStr) : null,
          done:
            !!(sub.submitted || sub.graded || sub.excused) ||
            !!(it.planner_override && it.planner_override.marked_complete),
          missing: !!sub.missing,
          points: p.points_possible,
        };
      })
      .filter((x) => x.due && !x.done && (x.due.getTime() >= now || x.missing))
      .sort((a, b) => a.due - b.due);
  }

  // ---------- Formato ----------
  const dateFmt = new Intl.DateTimeFormat("es-MX", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });

  function relative(d) {
    const diff = d.getTime() - Date.now();
    const h = Math.round(Math.abs(diff) / 36e5);
    const days = Math.round(Math.abs(diff) / 864e5);
    const txt = h < 24 ? `${h} h` : `${days} día${days === 1 ? "" : "s"}`;
    return diff < 0 ? `hace ${txt}` : `en ${txt}`;
  }

  function bucket(d) {
    const now = new Date();
    if (d < now) return "Atrasadas";
    const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const dayDiff = Math.round((startOfDay(d) - startOfDay(now)) / 864e5);
    if (dayDiff === 0) return "Hoy";
    if (dayDiff === 1) return "Mañana";
    if (dayDiff <= 7) return "Esta semana";
    return "Después";
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------- UI ----------
  const btn = el("button", "cpt-btn");
  btn.type = "button";
  btn.title = "Pendientes de Canvas";
  btn.append(el("span", null, "📋"), el("span", "cpt-badge"));

  const panel = el("div", "cpt-panel");
  panel.hidden = true;
  const header = el("div", "cpt-header");
  const title = el("strong", null, "Pendientes");
  const refresh = el("button", "cpt-icon", "⟳");
  refresh.title = "Actualizar";
  const close = el("button", "cpt-icon", "✕");
  close.title = "Cerrar";
  header.append(title, refresh, close);
  const body = el("div", "cpt-body");
  panel.append(header, body);
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
      body.append(el("p", "cpt-empty", "🎉 No tienes pendientes. Disfruta."));
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

  async function refreshData() {
    body.replaceChildren(el("p", "cpt-empty", "Cargando…"));
    try {
      cache = await loadItems();
      render(cache);
      setBadge(cache);
    } catch (e) {
      body.replaceChildren(el("p", "cpt-empty", `No se pudo cargar: ${e.message}. ¿Tienes sesión iniciada?`));
    }
  }

  btn.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden && !cache) refreshData();
  });
  close.addEventListener("click", () => (panel.hidden = true));
  refresh.addEventListener("click", refreshData);

  // Carga silenciosa para mostrar el contador sin abrir el panel
  loadItems().then((items) => { cache = items; setBadge(items); }).catch(() => {});
})();
