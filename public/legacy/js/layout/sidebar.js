function getBaseHtmlPath() {
  const pathname = window.location.pathname.replace(/\\/g, "/");
  const parts = pathname.split("/html/");
  if (parts.length > 1) {
    return parts[0] + "/html/";
  }
  const segments = pathname.split("/");
  const idx = segments.lastIndexOf("html");
  if (idx !== -1) {
    return segments.slice(0, idx + 1).join("/") + "/";
  }
  return "/";
}

async function loadGlobalSidebar() {
  const container = document.querySelector("[data-app-sidebar]");
  if (!container) return;

  const baseHtml = getBaseHtmlPath();
  const sidebarUrl = baseHtml + "components/sidebar.html";

  try {
    const res = await fetch(sidebarUrl, { cache: "no-cache" });
    if (!res.ok) throw new Error("Failed to load sidebar: " + res.status);
    const html = await res.text();
    container.innerHTML = html;
    initSidebar(container);
  } catch (err) {
    console.error(err);
  }
}

function initSidebar(root) {
  const links = root.querySelectorAll('.sidebar-nav .nav-item');
  const path = window.location.pathname.replace(/\\/g, '/');
  const file = path.split('/').pop() || 'dashboard.html';
  const current = file.toLowerCase();

  links.forEach(link => {
    const page = (link.getAttribute('data-page') || '').toLowerCase();
    link.classList.remove('active');
    if (page) {
      if (current.indexOf(page) !== -1 || (page === 'dashboard' && current === '')) {
        link.classList.add('active');
      }
    }

    // Keep behavior simple: normal navigation when clicked
    // set title for tooltip when collapsed
    const label = link.querySelector('span');
    if (label) link.setAttribute('title', label.textContent.trim());

    link.addEventListener('click', (e) => {
      // If clicking Profile or Archive, collapse sidebar for compact view
      const targetPage = page;
      if (targetPage === 'profile' || targetPage === 'archive') {
        try { localStorage.setItem('sb:sidebar-collapsed', 'true'); } catch (err) {}
        const sidebarEl = root.querySelector('.sidebar');
        if (sidebarEl) sidebarEl.classList.add('collapsed');
      } else {
        try { localStorage.setItem('sb:sidebar-collapsed', 'false'); } catch (err) {}
        const sidebarEl = root.querySelector('.sidebar');
        if (sidebarEl) sidebarEl.classList.remove('collapsed');
      }
      // allow normal navigation to proceed
    });
  });

  // add a manual toggle button at the bottom for expand/collapse
  const sidebarEl = root.querySelector('.sidebar');
  if (sidebarEl) {
    const toggle = document.createElement('button');
    toggle.id = 'sb-sidebar-toggle';
    toggle.className = 'sb-sidebar-toggle';
    toggle.setAttribute('aria-label', 'Toggle sidebar');
    toggle.innerHTML = '<span class="sb-sidebar-toggle__icon">☰</span>';
    sidebarEl.appendChild(toggle);

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCollapsed = sidebarEl.classList.toggle('collapsed');
      try { localStorage.setItem('sb:sidebar-collapsed', isCollapsed ? 'true' : 'false'); } catch (err) {}
    });

    // apply persisted state
    try {
      const saved = localStorage.getItem('sb:sidebar-collapsed');
      if (saved === 'true') sidebarEl.classList.add('collapsed');
      else sidebarEl.classList.remove('collapsed');
    } catch (err) {}
  }
}

document.addEventListener('DOMContentLoaded', loadGlobalSidebar);