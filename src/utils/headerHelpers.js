import initFirebase from '../firebaseConfig'
import { getAuth, signOut } from 'firebase/auth'

export function createSharedConfirmModal() {
  if (document.getElementById('sb-confirmation-modal-overlay')) return

  const tpl = document.createElement('div')
  tpl.innerHTML = `
    <div class="modal-overlay modal-overlay--toast" id="sb-confirmation-modal-overlay">
      <div class="modal-dialog modal-dialog--toast">
        <div class="modal-icon modal-icon--success"><i class="fas fa-check"></i></div>
        <div style="flex:1;">
          <h2 class="modal-title" id="sb-confirmation-title">Success</h2>
          <p class="modal-subtitle" id="sb-confirmation-body">Operation completed.</p>
        </div>
        <button class="toast-close-btn" id="sb-confirmation-close" aria-label="Close"><i class="fas fa-xmark"></i></button>
      </div>
    </div>
  `
  document.body.appendChild(tpl.firstElementChild)

  const overlay = document.getElementById('sb-confirmation-modal-overlay')
  const closeBtn = overlay.querySelector('#sb-confirmation-close')
  let autoCloseTimer = null

  function close() {
    overlay.classList.remove('active')
    if (autoCloseTimer) clearTimeout(autoCloseTimer)
  }

  closeBtn.addEventListener('click', close)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })

  window.showConfirmModal = function(message, title) {
    try {
      if (autoCloseTimer) clearTimeout(autoCloseTimer)
      const t = document.getElementById('sb-confirmation-title')
      const b = document.getElementById('sb-confirmation-body')
      if (t && title) t.textContent = title
      if (b) b.textContent = message || ''
      overlay.classList.add('active')
      autoCloseTimer = setTimeout(close, 5000)
    } catch (e) { try { alert(message) } catch (_) {} }
  }
}

export function createSharedLogoutModal() {
  if (document.getElementById('logout-modal-overlay')) return

  const tpl = document.createElement('div')
  tpl.innerHTML = `
    <div class="modal-overlay" id="logout-modal-overlay">
      <div class="modal-dialog">
        <div class="modal-icon modal-icon--logout">
          <i class="fas fa-arrow-right-from-bracket"></i>
        </div>
        <h2 class="modal-title">Are you sure you want to logout?</h2>
        <p class="modal-subtitle">We won't bother you anymore.</p>
        <div class="modal-actions">
          <button class="modal-btn modal-btn--confirm" id="modal-logout-confirm">Confirm</button>
          <button class="modal-btn modal-btn--cancel" id="modal-logout-cancel">Cancel</button>
        </div>
      </div>
    </div>
  `
  document.body.appendChild(tpl.firstElementChild)

  const overlay = document.getElementById('logout-modal-overlay')
  const confirmBtn = overlay.querySelector('#modal-logout-confirm')
  const cancelBtn = overlay.querySelector('#modal-logout-cancel')

  function closeLogoutModal() { overlay.classList.remove('active') }

  async function confirmLogout() {
    closeLogoutModal()
    // prefer global handler if present
    if (typeof window.performGlobalSignOut === 'function') {
      try { window.performGlobalSignOut() } catch (e) { console.warn(e) }
      return
    }
    try {
      const app = initFirebase()
      const auth = getAuth(app)
      await signOut(auth)
    } catch (e) { console.warn('logout failed', e) }
    try { window.location.href = 'auth/login.html' } catch (e) {}
  }

  if (confirmBtn) confirmBtn.addEventListener('click', confirmLogout)
  if (cancelBtn) cancelBtn.addEventListener('click', closeLogoutModal)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeLogoutModal() })

  window.showLogoutModal = function() { overlay.classList.add('active') }
}

// Ensure stubs exist so legacy pages can call before modules load
if (typeof window !== 'undefined' && !window.__sb_confirm_stub_installed) {
  window.__sb_confirm_stub_installed = true
  window.showConfirmModal = function(msg, title) { window.__sb_requested_confirm = { msg, title } }
}

if (typeof window !== 'undefined' && !window.__sb_logout_stub_installed) {
  window.__sb_logout_stub_installed = true
  window.showLogoutModal = function () { try { window.__sb_requested_show_logout = true } catch (e) {} }
}

export function initHeaderHelpers() {
  createSharedConfirmModal()
  createSharedLogoutModal()
  if (window.__sb_requested_confirm) {
    const rq = window.__sb_requested_confirm
    try { window.showConfirmModal(rq.msg, rq.title) } catch (e) {}
    window.__sb_requested_confirm = null
  }
  if (window.__sb_requested_show_logout) {
    try { window.showLogoutModal() } catch (e) {}
    window.__sb_requested_show_logout = false
  }
}
