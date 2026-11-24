// Tema personalizado para Canvas (se ejecuta en document_start para evitar parpadeo).
(() => {
  if (window.__cptThemeLoaded) return;
  window.__cptThemeLoaded = true;

  let styleEl = null;

  function buildCss(t) {
    const font = CPT_FONTS[t.fontFamily] ? CPT_FONTS[t.fontFamily].stack : "";
    const ff = font ? `font-family: ${font} !important;` : "";
    const line = `color-mix(in srgb, ${t.text} 16%, transparent)`;
    const soft = `color-mix(in srgb, ${t.text} 70%, ${t.bg})`;

    return `
:root {
  --cpt-accent: ${t.accent};
  --cpt-ui-bg: ${t.card};
  --cpt-ui-text: ${t.text};
}

/* Fondo y texto general */
html, body, #application, #wrapper, #main, #not_right_side,
.ic-Layout-wrapper, .ic-Layout-columns, .ic-Layout-contentWrapper, .ic-Layout-contentMain,
#content-wrapper, #content, #right-side-wrapper, #right-side, #left-side,
.ic-app-main-content, .ic-app-nav-toggle-and-crumbs, .ic-app-course-menu,
#dashboard, .ic-Dashboard-header, .ic-Dashboard-header__layout, .ic-app-footer,
#footer, .ic-app-main-content__secondary, #course_home_content {
  background-color: ${t.bg} !important;
  color: ${t.text} !important;
}

#content :is(h1, h2, h3, h4, h5, h6, p, li, dt, dd, td, th, label, small, strong, em, b, i:not([class*="icon"]), legend, caption, .ellipsis),
#right-side :is(h1, h2, h3, h4, h5, h6, p, li, span:not([class*="icon"])),
.ic-Dashboard-header__title, .ic-app-crumbs, .ic-app-crumbs span,
.ic-DashboardCard__header-subtitle, .ic-DashboardCard__header-term,
#section-tabs a:not(.active) {
  color: ${t.text} !important;
}
#content .muted, #content .text-muted, #content .screenreader-only + span, .ic-DashboardCard__header-term {
  color: ${soft} !important;
}

/* Enlaces / acento */
#content a:not([class*="Button"]):not(.btn):not(.ic-DashboardCard__link):not(.cpt-item):not(.cpt-ann),
#right-side a:not([class*="Button"]):not(.btn),
#left-side a, .ic-app-crumbs a, .ic-DashboardCard__header-title {
  color: ${t.accent} !important;
}
#section-tabs a.active {
  border-left-color: ${t.accent} !important;
  color: ${t.text} !important;
}
.Button--primary, .btn-primary, button[type="submit"].Button {
  background-color: ${t.accent} !important;
  border-color: ${t.accent} !important;
}

/* Tarjetas, listas y tablas */
.ic-DashboardCard, .ic-DashboardCard__header_content, .ic-DashboardCard__action-container,
.ig-header, .ig-row, .ig-list, .ic-item-row, .item-group-condensed, .item-group-container,
.context_module, .context_module_item, .context_module .header, .ic-Table, table.table, .table,
.discussion-entries, .entry-content, .discussion-section, .announcement,
#syllabus, .user_content, .ui-dialog, .ui-dialog-content, .ui-dialog-titlebar,
.card, .course-list-table-row, .Grid, .assignment-group, .assignment,
.ic-notification, .alert, .ui-menu, .al-options {
  background-color: ${t.card} !important;
  color: ${t.text} !important;
  border-color: ${line} !important;
}
#content :is(input:not([type="checkbox"]):not([type="radio"]):not([type="color"]), select, textarea) {
  background-color: ${t.card} !important;
  color: ${t.text} !important;
  border-color: ${line} !important;
}
#content hr, .ic-app-nav-toggle-and-crumbs { border-color: ${line} !important; }

/* Barra lateral global */
.ic-app-header, .ic-app-header__main-navigation, .ic-app-header__secondary-navigation,
.ic-app-header__logomark-container {
  background-color: ${t.nav} !important;
}
.ic-app-header :is(.ic-app-header__menu-list-link, .menu-item__text, .ic-icon-svg) {
  color: ${t.navText} !important;
  fill: ${t.navText} !important;
}
.ic-app-header .ic-app-header__menu-list-link svg { fill: ${t.navText} !important; }
.ic-app-header__menu-list-item--active .ic-app-header__menu-list-link {
  background-color: ${t.bg} !important;
}
.ic-app-header__menu-list-item--active :is(.menu-item__text, .ic-icon-svg, svg) {
  color: ${t.accent} !important;
  fill: ${t.accent} !important;
}

/* Tipografía */
#content, #right-side, #left-side, .ic-app-nav-toggle-and-crumbs {
  font-size: ${t.fontSize}% !important;
}
${ff ? `body, #content :is(h1, h2, h3, h4, h5, h6, p, li, td, th, label, a, button, input, select, textarea, span:not([class*="icon"]), div),
#right-side :is(p, li, a, span:not([class*="icon"]), div), .ic-app-header .menu-item__text { ${ff} }` : ""}
`;
  }

  function apply(settings) {
    const t = settings.theme;
    if (!t || !t.enabled) {
      if (styleEl) styleEl.remove();
      styleEl = null;
      return;
    }
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "cpt-theme";
    }
    styleEl.textContent = buildCss(cptSanitizeTheme(t));
    (document.head || document.documentElement).append(styleEl);
  }

  cptGetSettings().then(apply);

  // Re-colocar al final del <head> para ganar a las hojas de estilo de Canvas
  document.addEventListener("DOMContentLoaded", () => {
    if (styleEl && document.head) document.head.append(styleEl);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.settings) cptGetSettings().then(apply);
  });
})();
