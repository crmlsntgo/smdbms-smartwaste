export function initSidebar(root) {
  if (!root) root = document.querySelector('[data-app-sidebar]') || document.querySelector('.sidebar')
  if (!root) return

  const links = root.querySelectorAll('.sidebar-nav .nav-item')
  const path = window.location.pathname.replace(/\\/g, '/')
  const file = path.split('/').pop() || 'dashboard.html'
  const current = file.toLowerCase()

  links.forEach(link => {
    const page = (link.getAttribute('data-page') || '').toLowerCase()
    link.classList.remove('active')
    if (page) {
      if (current.indexOf(page) !== -1 || (page === 'dashboard' && current === '')) {
        link.classList.add('active')
      }
    }

    const label = link.querySelector('span')
    if (label) link.setAttribute('title', label.textContent.trim())

    link.addEventListener('click', (e) => {
      // Update active link immediately on click for instant feedback.
      links.forEach(l => l.classList.remove('active'))
      link.classList.add('active')
      // Do NOT change collapsed state on navigation. Collapsed state is
      // controlled only by the toggle button and user's saved preference.
    })
  })

  const sidebarEl = root.querySelector('.sidebar') || root
  if (sidebarEl) {
    // avoid adding toggle twice
    if (!sidebarEl.querySelector('#sb-sidebar-toggle')) {
      const toggle = document.createElement('button')
      toggle.id = 'sb-sidebar-toggle'
      toggle.className = 'sb-sidebar-toggle'
      toggle.setAttribute('aria-label', 'Toggle sidebar')
      toggle.innerHTML = '<span class="sb-sidebar-toggle__icon">☰</span>'
      sidebarEl.appendChild(toggle)

      toggle.addEventListener('click', (e) => {
        e.stopPropagation()
        const isCollapsed = sidebarEl.classList.toggle('collapsed')
        try { localStorage.setItem('sb:sidebar-collapsed', isCollapsed ? 'true' : 'false') } catch (err) {}
        try { window.dispatchEvent(new CustomEvent('sb:sidebar-changed', { detail: { collapsed: !!isCollapsed } })) } catch (err) {}
      })
    }

    try {
      const saved = localStorage.getItem('sb:sidebar-collapsed')
      const collapsed = saved === 'true'
      if (collapsed) sidebarEl.classList.add('collapsed')
      else sidebarEl.classList.remove('collapsed')
      try { window.dispatchEvent(new CustomEvent('sb:sidebar-changed', { detail: { collapsed } })) } catch (err) {}
    } catch (err) {}
  }
}

// Auto-initialize when legacy pages import this module directly
if (typeof document !== 'undefined' && document.readyState === 'complete') {
  try { initSidebar() } catch (e) {}
} else if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => { try { initSidebar() } catch (e) {} })
}
