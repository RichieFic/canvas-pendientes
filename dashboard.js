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
    if (!s.enabled || (!s.announcements && !s.upcoming)) return;

    widget = el("section", "cpt-dash");
    widget.setAttribute("aria-label", "Resumen de Canvas Pendientes");

    if (s.announcements) {
      const { col, list } = column("📢 Últimos anuncios");
      widget.append(col);
      fillAnnouncements(list, Math.min(20, Math.max(1, s.annCount)));
    }
    if (s.upcoming) {
      const all = el("button", "cpt-link");
      all.type = "button";
      all.hidden = true;
      all.addEventListener("click", () => CPT.openPanel && CPT.openPanel());
      const { col, list } = column("⏰ Próximas entregas", all);
      widget.append(col);
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
