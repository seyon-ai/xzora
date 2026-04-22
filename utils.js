// ============================================================
// XZORA — Shared Utilities
// ============================================================

// ── CURSOR ──
export function initCursor() {
  var cur = document.getElementById('xz-cursor');
  var ring = document.getElementById('xz-ring');
  if (!cur || !ring) return;
  var mx=0, my=0, rx=0, ry=0;
  document.addEventListener('mousemove', function(e) {
    mx = e.clientX; my = e.clientY;
    cur.style.left = mx + 'px'; cur.style.top = my + 'px';
  });
  function animate() {
    rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12;
    ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
    requestAnimationFrame(animate);
  }
  animate();
  document.addEventListener('mouseover', function(e) {
    if (e.target.closest('a,button,input,select,textarea,[data-hover]')) {
      cur.classList.add('hov'); ring.classList.add('hov');
    } else {
      cur.classList.remove('hov'); ring.classList.remove('hov');
    }
  });
}

// ── TOAST ──
var _toastTimer;
export function toast(msg, type) {
  type = type || 'default';
  var el = document.getElementById('xz-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'xz-toast';
    el.style.cssText = [
      'position:fixed;bottom:24px;left:50%;z-index:9000',
      'transform:translateX(-50%) translateY(80px)',
      'background:#222225;border:1px solid rgba(255,255,255,.13)',
      'border-radius:10px;padding:12px 20px',
      'font-size:13px;color:#f0f0f0;white-space:nowrap',
      'transition:transform .3s;pointer-events:none',
      'display:flex;align-items:center;gap:10px',
      'font-family:DM Sans,sans-serif'
    ].join(';');
    document.body.appendChild(el);
  }
  if (type === 'success') el.style.borderColor = 'rgba(82,201,122,.4)';
  else if (type === 'error') el.style.borderColor = 'rgba(224,82,82,.4)';
  else el.style.borderColor = 'rgba(255,255,255,.13)';
  el.innerHTML = '<span>' + (type==='success'?'✓':type==='error'?'✕':'ℹ') + '</span>' + msg;
  el.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function() {
    el.style.transform = 'translateX(-50%) translateY(80px)';
  }, 3200);
}

// ── LOADER ──
export function hideLoader() {
  var loader = document.getElementById('xz-loader');
  if (!loader) return;
  loader.style.opacity = '0';
  loader.style.transition = 'opacity .4s';
  setTimeout(function() { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 400);
}

// ── UPDATE NAV AUTH STATE ──
// Call this on every customer page to update nav sign in / account button
export function initNavAuth(onAuth) {
  onAuth(function(user) {
    var btn = document.getElementById('navAuthBtn');
    if (!btn) return;
    if (user) {
      var name = (user.displayName || user.email || 'Account').split(' ')[0];
      btn.textContent = name;
      btn.href = 'profile.html';
    } else {
      btn.textContent = 'Sign In';
      btn.href = 'auth.html';
    }
  });
}

// ── UPDATE CART BADGE ──
export function updateCartBadge(count) {
  document.querySelectorAll('.cart-count').forEach(function(el) {
    el.textContent = count > 99 ? '99+' : count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

// ── LOCAL CART COUNT ──
export function getLocalCartCount() {
  try {
    var cart = JSON.parse(localStorage.getItem('xz_cart') || '[]');
    return cart.reduce(function(s, i) { return s + (i.qty || 1); }, 0);
  } catch(e) { return 0; }
}

// ── FORMAT PRICE ──
export function formatPrice(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

// ── FORMAT DATE ──
export function formatDate(ts) {
  if (!ts) return '';
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

// ── TRUNCATE ──
export function truncate(str, n) {
  n = n || 60;
  return str && str.length > n ? str.slice(0, n) + '…' : (str || '');
}

// ── GEN ORDER ID ──
export function genOrderId() {
  return 'XZ' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase();
}

// ── DEBOUNCE ──
export function debounce(fn, ms) {
  ms = ms || 300;
  var t;
  return function() {
    var args = arguments;
    clearTimeout(t);
    t = setTimeout(function() { fn.apply(null, args); }, ms);
  };
}

// ── VALIDATE EMAIL ──
export function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
}

// ── VALIDATE PHONE ──
export function validPhone(phone) {
  return /^[6-9]\d{9}$/.test((phone || '').replace(/\s/g, ''));
}

// ── SCROLL REVEAL ──
export function initScrollReveal() {
  if (!window.IntersectionObserver) return;
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        e.target.style.opacity = '1';
        e.target.style.transform = 'none';
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(function(el) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity .6s, transform .6s';
    observer.observe(el);
  });
}
