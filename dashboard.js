// Widget en la pantalla principal de Canvas: últimos anuncios + próximas entregas.
(() => {
  if (window.__cptDashLoaded) return;
  window.__cptDashLoaded = true;

  const path = location.pathname.replace(/\/+$/, "");
  if (path !== "" && path !== "/dashboard") return;

  const { el, dateFmt, relative, bucket } = CPT.ui;
  const MAX_UPCOMING = 8;
  let widget = null;

  function htmlToText(html) {
    // DOMParser no ejecuta scripts ni carga imágenes: seguro para extraer texto.
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
  }

  function column(titleText, extra) {
    const col = el("div", "cpt-dash-col");
    const head = el("div", "cpt-dash-head");
    head.append(el("h3", null, titleText));
    if (extra) head.append(extra);
    const list = el("div", "cpt-dash-list");
    list.append(el("p", "cpt-empty", "Cargando…"));
    col.append(head, list);
    return { col, list };
  }

  async function fillAnnouncements(list, count) {
    try {
      const anns = await CPT.loadAnnouncements(count);
      list.replaceChildren();
      if (!anns.length) {
        list.append(el("p", "cpt-empty", "No hay anuncios recientes."));
        return;
      }
      for (const a of anns) {
        const link = el("a", "cpt-ann");
        link.href = a.url;
        const top = el("div", "cpt-top");
        top.append(el("span", "cpt-course", `${a.course}${a.author ? ` · ${a.author}` : ""}`));
        const t = el("div", "cpt-ann-title");
        if (a.unread) {
          const dot = el("span", "cpt-dot");
          dot.title = "No leído";
          t.append(dot);
        }
        t.append(el("span", null, a.title));
        const snippet = htmlToText(a.html);
        const meta = el("div", "cpt-meta");
        meta.append(el("span", null, dateFmt.format(a.date)), el("span", null, relative(a.date)));
        link.append(top, t);
        if (snippet) link.append(el("div", "cpt-ann-snippet", snippet.slice(0, 220)));
        link.append(meta);
        list.append(link);
      }
    } catch (e) {
      list.replaceChildren(el("p", "cpt-empty", `No se pudieron cargar los anuncios: ${e.message}`));
    }
  }

  async function fillUpcoming(list, days, countEl) {
    try {
      const items = await CPT.getItems();
      const limit = Date.now() + days * 864e5;
      const shown = items.filter((it) => it.missing || it.due.getTime() <= limit);
      list.replaceChildren();
      countEl.textContent = items.length ? `Ver todas (${items.length})` : "";
      countEl.hidden = !items.length;
      if (!shown.length) {
        list.append(el("p", "cpt-empty", `🎉 Nada pendiente en los próximos ${days} días.`));
        return;
      }
      for (const it of shown.slice(0, MAX_UPCOMING)) {
        const late = bucket(it.due) === "Atrasadas";
        const a = el("a", "cpt-item");
        a.href = it.url || "#";
        const top = el("div", "cpt-top");
        top.append(el("span", "cpt-type", it.type), el("span", "cpt-course", it.course));
        const meta = el("div", "cpt-meta");
        meta.append(
          el("span", null, dateFmt.format(it.due)),
          el("span", `cpt-rel ${late ? "cpt-late" : ""}`, late ? `Atrasada · ${relative(it.due)}` : relative(it.due))
        );
        if (it.points) meta.append(el("span", null, `${it.points} pts`));
        a.append(top, el("div", "cpt-title", it.title), meta);
        list.append(a);
      }
    } catch (e) {
      list.replaceChildren(el("p", "cpt-empty", `No se pudieron cargar las entregas: ${e.message}`));
    }
  }

  // ---------- Progreso de hoy + gráfica de la semana ----------
  // Los eventos de calendario (clases, juntas) no cuentan como tareas.
  const TASK_KINDS = new Set(["assignment", "quiz", "discussion_topic", "wiki_page", "planner_note"]);
  const dayFmt = new Intl.DateTimeFormat("es-MX", { weekday: "short" });
  const timeFmt = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" });
  const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  function todayPanel(todays) {
    const box = el("div", "cpt-prog-today");
    const total = todays.length;
    const done = todays.filter((x) => x.done).length;

    const top = el("div", "cpt-prog-top");
    if (!total) {
      top.append(el("span", "cpt-prog-pct", "🎉"), el("span", "cpt-prog-label", "No tienes entregas para hoy."));
      box.append(top);
      return box;
    }
    const pct = Math.round((done * 100) / total);
    top.append(
      el("span", "cpt-prog-pct", `${pct}%`),
      el("span", "cpt-prog-label", `${done} de ${total} ${total === 1 ? "tarea completada" : "tareas completadas"} hoy`)
    );
    const bar = el("div", "cpt-bar");
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-label", "Tareas de hoy completadas");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", String(pct));
    const fill = el("div", `cpt-bar-fill${pct === 100 ? " cpt-full" : ""}`);
    fill.style.width = `${pct}%`;
    bar.append(fill);

    const list = el("ul", "cpt-today-list");
    for (const it of todays) {
      const li = el("li", it.done ? "cpt-done" : it.due < new Date() ? "cpt-late" : "");
      const a = el("a", null, it.title);
      a.href = it.url || "#";
      li.append(el("span", "cpt-check", it.done ? "✓" : "○"), a, el("span", "cpt-time", timeFmt.format(it.due)));
      list.append(li);
    }
    box.append(top, bar, list);
    return box;
  }

  function weekChart(all) {
    const now = new Date();
    const monday = dayStart(now);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({ date: d, done: 0, pending: 0, late: 0 });
    }
    for (const it of all) {
      // Math.round (no floor) para tolerar cambios de horario de verano
      const i = Math.round((dayStart(it.due) - monday) / 864e5);
      if (!(i >= 0 && i <= 6)) continue;
      if (it.done) days[i].done++;
      else if (it.due < now) days[i].late++;
      else days[i].pending++;
    }
    const totals = days.map((d) => d.done + d.pending + d.late);
    const max = Math.max(1, ...totals);
    const weekDone = days.reduce((s, d) => s + d.done, 0);
    const weekTotal = totals.reduce((s, n) => s + n, 0);

    const box = el("div", "cpt-week");
    const head = el("div", "cpt-week-head");
    head.append(
      el("strong", null, "Esta semana"),
      el("span", null, weekTotal ? `${weekDone} de ${weekTotal} completadas (${Math.round((weekDone * 100) / weekTotal)}%)` : "Sin entregas")
    );

    const chart = el("div", "cpt-chart");
    const today = dayStart(now).getTime();
    days.forEach((d, i) => {
      const col = el("div", `cpt-chart-col${d.date.getTime() === today ? " cpt-today" : ""}`);
      const label = dayFmt.format(d.date).replace(".", "");
      col.title = `${label} ${d.date.getDate()}: ${d.done} completadas, ${d.pending} pendientes, ${d.late} atrasadas`;
      const track = el("div", "cpt-chart-track");
      for (const [cls, n] of [["cpt-seg-done", d.done], ["cpt-seg-pending", d.pending], ["cpt-seg-late", d.late]]) {
        if (!n) continue;
        const seg = el("div", `cpt-seg ${cls}`);
        seg.style.height = `${(n / max) * 100}%`;
        track.append(seg);
      }
      col.append(
        el("span", "cpt-chart-num", totals[i] ? `${d.done}/${totals[i]}` : ""),
        track,
        el("span", "cpt-chart-day", `${label} ${d.date.getDate()}`)
      );
      chart.append(col);
    });

    const legend = el("div", "cpt-legend");
    for (const [cls, txt] of [["cpt-seg-done", "Completadas"], ["cpt-seg-pending", "Pendientes"], ["cpt-seg-late", "Atrasadas"]]) {
      const item = el("span");
      item.append(el("i", `cpt-swatch ${cls}`), document.createTextNode(txt));
      legend.append(item);
    }
    box.append(head, chart, legend);
    return box;
  }

  async function fillProgress(body) {
    try {
      const all = (await CPT.getPlanner()).filter((x) => TASK_KINDS.has(x.kind));
      const start = dayStart(new Date()).getTime();
      const todays = all.filter((x) => x.due.getTime() >= start && x.due.getTime() < start + 864e5);
      body.replaceChildren(todayPanel(todays), weekChart(all));
    } catch (e) {
      body.replaceChildren(el("p", "cpt-empty", `No se pudo calcular el progreso: ${e.message}`));
    }
  }

  function mount() {
    if (!widget || widget.isConnected) return;
    const header = document.querySelector(".ic-Dashboard-header");
    const dash = document.getElementById("dashboard");
    const content = document.getElementById("content");
    if (header && header.parentNode) header.after(widget);
    else if (dash && dash.parentNode) dash.parentNode.insertBefore(widget, dash);
    else if (content) content.prepend(widget);
  }

  async function init() {
    const s = (await cptGetSettings()).dashboard;
    if (!s.enabled || (!s.progress && !s.announcements && !s.upcoming)) return;

    widget = el("section", "cpt-dash");
    widget.setAttribute("aria-label", "Resumen de Canvas Pendientes");

    if (s.progress) {
      const { col, list } = column("✅ Progreso de hoy");
      col.classList.add("cpt-progress");
      list.className = "cpt-prog-body";
      widget.append(col);
      fillProgress(list);
    }

    // Anuncios y entregas van en su propia cuadrícula (si compartieran la de
    // la tarjeta de progreso, esta forzaría columnas vacías).
    const row = el("div", "cpt-dash-row");
    widget.append(row);

    if (s.announcements) {
      const { col, list } = column("📢 Últimos anuncios");
      row.append(col);
      fillAnnouncements(list, Math.min(20, Math.max(1, s.annCount)));
    }
    if (s.upcoming) {
      const all = el("button", "cpt-link");
      all.type = "button";
      all.hidden = true;
      all.addEventListener("click", () => CPT.openPanel && CPT.openPanel());
      const { col, list } = column("⏰ Próximas entregas", all);
      row.append(col);
      fillUpcoming(list, Math.min(60, Math.max(1, s.upcomingDays)), all);
    }

    mount();
    // Canvas (React) puede volver a pintar el dashboard y quitar el widget.
    new MutationObserver(() => {
      if (!widget.isConnected) mount();
    }).observe(document.body, { childList: true, subtree: true });
  }

  init();
})();
