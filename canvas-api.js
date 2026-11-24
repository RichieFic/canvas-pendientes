// Lectura de datos de Canvas + utilidades de formato.
// Se usa desde los content scripts (mismo origen, con tu sesión) y desde el
// service worker (pasando `origin`, con las cookies de Canvas).
(() => {
  if (globalThis.CPT && globalThis.CPT.loadItems) return;

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

  // ---------- API ----------
  function nextLink(header) {
    if (!header) return null;
    const part = header.split(",").find((p) => p.includes('rel="next"'));
    const m = part && part.match(/<([^>]+)>/);
    return m ? m[1] : null;
  }

  async function fetchPage(url, origin) {
    const r = await fetch(origin && url.startsWith("/") ? origin + url : url, {
      credentials: origin ? "include" : "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`Canvas respondió ${r.status}`);
    const text = (await r.text()).replace(/^while\(1\);/, "");
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Canvas no devolvió datos (¿sesión cerrada?)");
    }
    return { data, next: nextLink(r.headers.get("Link")) };
  }

  async function fetchAll(url, origin) {
    let out = [];
    let next = url;
    let guard = 0;
    while (next && guard++ < 20) {
      const page = await fetchPage(next, origin);
      out = out.concat(page.data);
      next = page.next;
    }
    return out;
  }

  function baseOrigin(origin) {
    if (origin) return origin;
    return typeof location !== "undefined" ? location.origin : "";
  }

  async function loadItems(origin) {
    const now = Date.now();
    const start = new Date(now - DAYS_BACK * 864e5).toISOString();
    const end = new Date(now + DAYS_AHEAD * 864e5).toISOString();
    const raw = await fetchAll(
      `/api/v1/planner/items?start_date=${start}&end_date=${end}&per_page=100`,
      origin
    );
    const base = baseOrigin(origin);

    return raw
      .map((it) => {
        const p = it.plannable || {};
        const sub = it.submissions || {};
        const dueStr = p.due_at || p.todo_date || it.plannable_date;
        let url = it.html_url || "";
        try { if (url && base) url = new URL(url, base).href; } catch { /* deja la URL tal cual */ }
        return {
          key: `${it.plannable_type}_${it.plannable_id || p.id}`,
          title: p.title || p.name || "(sin título)",
          course: it.context_name || "",
          type: TYPES[it.plannable_type] || it.plannable_type,
          url,
          due: dueStr ? new Date(dueStr) : null,
          done:
            !!(sub.submitted || sub.graded || sub.excused) ||
            !!(it.planner_override && it.planner_override.marked_complete),
          missing: !!sub.missing,
          points: p.points_possible,
        };
      })
      .filter((x) => x.due && !isNaN(x.due) && !x.done && (x.due.getTime() >= now || x.missing))
      .sort((a, b) => a.due - b.due);
  }

  async function loadCourses(origin) {
    const list = await fetchAll(`/api/v1/courses?enrollment_state=active&per_page=100`, origin);
    return list.filter((c) => c && c.id && c.name);
  }

  async function loadAnnouncements(limit = 5, origin) {
    const courses = await loadCourses(origin);
    if (!courses.length) return [];
    const names = Object.fromEntries(courses.map((c) => [`course_${c.id}`, c.course_code || c.name]));
    const codes = courses.map((c) => `context_codes[]=course_${c.id}`).join("&");
    const start = new Date(Date.now() - 60 * 864e5).toISOString();
    const endD = new Date(Date.now() + 864e5).toISOString();
    const { data } = await fetchPage(
      `/api/v1/announcements?${codes}&start_date=${start}&end_date=${endD}&active_only=true&per_page=50`,
      origin
    );
    const base = baseOrigin(origin);
    return (Array.isArray(data) ? data : [])
      .map((a) => ({
        id: a.id,
        title: a.title || "(sin título)",
        course: names[a.context_code] || "",
        url: a.html_url ? new URL(a.html_url, base || "https://x.invalid").href : "#",
        date: new Date(a.posted_at || a.delayed_post_at || a.created_at),
        unread: a.read_state === "unread",
        author: (a.author && a.author.display_name) || a.user_name || "",
        html: a.message || "",
      }))
      .filter((a) => !isNaN(a.date))
      .sort((a, b) => b.date - a.date)
      .slice(0, limit);
  }

  function serializeItems(items) {
    return items.map((it) => ({ ...it, due: it.due.toISOString() }));
  }

  // ---------- Formato ----------
  const dateFmt = new Intl.DateTimeFormat("es-MX", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });

  function relative(d) {
    const diff = d.getTime() - Date.now();
    const mins = Math.round(Math.abs(diff) / 6e4);
    const h = Math.round(Math.abs(diff) / 36e5);
    const days = Math.round(Math.abs(diff) / 864e5);
    const txt = mins < 60 ? `${mins} min` : h < 24 ? `${h} h` : `${days} día${days === 1 ? "" : "s"}`;
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

  globalThis.CPT = Object.assign(globalThis.CPT || {}, {
    TYPES,
    fetchAll,
    loadItems,
    loadCourses,
    loadAnnouncements,
    serializeItems,
    ui: { el, dateFmt, relative, bucket },
  });
})();
