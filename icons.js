// Íconos de línea (24×24, trazo redondeado, sin relleno). Toman su color de
// la variable CSS --cpt-icon (Opciones → Apariencia → Color de los íconos).
(() => {
  if (globalThis.CPT && globalThis.CPT.icon) return;

  const PATHS = {
    clipboard:
      '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h6"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
    sliders:
      '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    progress: '<circle cx="12" cy="12" r="10"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    megaphone: '<path d="m3 11 18-5v12L3 13z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    alert:
      '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    palette:
      '<path d="M12 2a10 10 0 0 0 0 20c1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7h2A5.6 5.6 0 0 0 22 10.6C22 5.9 17.5 2 12 2z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="10.5" cy="6.5" r="1"/><circle cx="15.5" cy="6.5" r="1"/>',
    home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    wrench:
      '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
  };

  const NS = "http://www.w3.org/2000/svg";

  // Devuelve un <svg class="cpt-ic"> (los trazos son constantes de este archivo).
  function icon(name, extraClass) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", `cpt-ic${extraClass ? ` ${extraClass}` : ""}`);
    svg.innerHTML = PATHS[name] || "";
    return svg;
  }

  // Elemento con ícono + texto, p. ej. títulos de tarjetas.
  function withIcon(tag, cls, name, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    e.append(icon(name), document.createTextNode(text));
    return e;
  }

  globalThis.CPT = Object.assign(globalThis.CPT || {}, { icon, withIcon, ICONS: Object.keys(PATHS) });
})();
