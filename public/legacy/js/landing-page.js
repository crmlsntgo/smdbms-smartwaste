// Landing Page JavaScript
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const loginForm = document.getElementById('loginForm');
  const togglePinBtn = document.getElementById('togglePin');
  const pinInput = document.getElementById('pin');
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const navMenu = document.querySelector('.landing-nav__menu');
  const socialButtons = document.querySelectorAll('.social-btn');
  const submitBtn = document.querySelector('.landing-submit-btn');

  // Toggle password visibility
  if (togglePinBtn && pinInput) {
    togglePinBtn.addEventListener('click', () => {
      const type = pinInput.getAttribute('type') === 'password' ? 'text' : 'password';
      pinInput.setAttribute('type', type);
      
      const icon = togglePinBtn.querySelector('i');
      icon.classList.toggle('fa-eye');
      icon.classList.toggle('fa-eye-slash');
    });
  }

  // Mobile menu toggle
  if (mobileMenuToggle && navMenu) {
    mobileMenuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      const icon = mobileMenuToggle.querySelector('i');
      icon.classList.toggle('fa-bars');
      icon.classList.toggle('fa-times');
    });
  }

  // Form validation and submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const username = document.getElementById('username').value.trim();
      const pin = document.getElementById('pin').value.trim();

      // Basic validation
      if (!username || !pin) {
        showNotification('Please fill in all fields', 'error');
        return;
      }

      if (pin.length !== 8) {
        showNotification('PIN must be 8 digits', 'error');
        return;
      }

      // Add loading state
      submitBtn.classList.add('loading');
      submitBtn.disabled = true;

      // Simulate API call (replace with actual authentication)
      setTimeout(() => {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
        
        // Redirect to actual login page
        window.location.href = 'auth/login.html';
      }, 1500);
    });
  }

  // Social button animations
  socialButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const provider = btn.classList.contains('social-btn--google') ? 'Google' : 'Facebook';
      
      showNotification(`Redirecting to ${provider} authentication...`, 'info');
      
      // Add animation
      btn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        btn.style.transform = '';
      }, 200);

      // Simulate redirect (replace with actual OAuth flow)
      setTimeout(() => {
        if (provider === 'Google') {
          window.location.href = 'auth/google-setup.html';
        } else if (provider === 'Facebook') {
          showNotification(`${provider} authentication coming soon`, 'info');
        }
      }, 1000);
    });
  });

  // Smooth scroll for navigation links
  document.querySelectorAll('.landing-nav__link').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href.startsWith('#')) {
        e.preventDefault();
        const targetId = href.substring(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // Input animations
  const formInputs = document.querySelectorAll('.form-input');
  formInputs.forEach(input => {
    input.addEventListener('focus', () => {
      input.parentElement.style.transform = 'scale(1.02)';
    });
    
    input.addEventListener('blur', () => {
      input.parentElement.style.transform = '';
    });
  });

  // Parallax effect for background shapes
  let ticking = false;
  document.addEventListener('mousemove', (e) => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const shapes = document.querySelectorAll('.bg-shape');
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;
        
        shapes.forEach((shape, index) => {
          const speed = (index + 1) * 20;
          const x = (mouseX - 0.5) * speed;
          const y = (mouseY - 0.5) * speed;
          shape.style.transform = `translate(${x}px, ${y}px)`;
        });
        
        ticking = false;
      });
      ticking = true;
    }
  });

  // Scroll header effect
  let lastScrollY = 0;
  const header = document.querySelector('.landing-nav');
  
  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    
    if (currentScrollY > 50) {
      header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1)';
      header.style.background = 'rgba(255, 255, 255, 0.98)';
    } else {
      header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.05)';
      header.style.background = 'rgba(255, 255, 255, 0.95)';
    }
    
    lastScrollY = currentScrollY;
  });

  // PIN input - only allow numbers
  if (pinInput) {
    pinInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
  }

  // Add entrance animations on load
  const animateElements = document.querySelectorAll('.landing-form-section, .landing-social-section, .impact-stat-card, .solution-feature, .feature-card, .mission-card, .vision-card');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  animateElements.forEach(el => {
    observer.observe(el);
  });

  // Counter animation for impact stats
  const animateCounter = (element, target, duration = 2000) => {
    let current = 0;
    const increment = target / (duration / 16);
    const suffix = element.textContent.replace(/[0-9]/g, '');
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        element.textContent = target + suffix;
        clearInterval(timer);
      } else {
        element.textContent = Math.floor(current) + suffix;
      }
    }, 16);
  };

  // Observe impact stats for counter animation
  const statNumbers = document.querySelectorAll('.impact-stat-number');
  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.animated) {
        const text = entry.target.textContent;
        const number = parseInt(text.replace(/\D/g, ''));
        if (number) {
          entry.target.dataset.animated = 'true';
          animateCounter(entry.target, number);
        }
      }
    });
  }, { threshold: 0.5 });

  statNumbers.forEach(stat => {
    statsObserver.observe(stat);
  });

  // Add hover effects to cards
  const cards = document.querySelectorAll('.impact-stat-card, .feature-card, .solution-feature');
  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    });
  });
});

// Notification system
function showNotification(message, type = 'info') {
  // Remove existing notification
  const existing = document.querySelector('.notification');
  if (existing) {
    existing.remove();
  }

  // Create notification
  const notification = document.createElement('div');
  notification.className = `notification notification--${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    </div>
  `;

  // Add styles
  Object.assign(notification.style, {
    position: 'fixed',
    top: '90px',
    right: '20px',
    background: type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6',
    color: 'white',
    padding: '16px 24px',
    borderRadius: '12px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
    zIndex: '10000',
    animation: 'slideInRight 0.3s ease-out',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontFamily: 'Montserrat, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    maxWidth: '400px'
  });

  document.body.appendChild(notification);

  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + Enter to submit form
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    const form = document.getElementById('loginForm');
    if (form) {
      form.dispatchEvent(new Event('submit'));
    }
  }
});

// Prevent form resubmission on page refresh
if (window.history.replaceState) {
  window.history.replaceState(null, null, window.location.href);
}