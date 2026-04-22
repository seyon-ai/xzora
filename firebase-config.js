// ============================================================
// XZORA — Firebase Config
// Keys read from localStorage — set via /admin-config.html
// ============================================================

import { initializeApp, getApps, getApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getDatabase }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getStorage }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// ── KEY READER ──
export function k(name, fallback) {
  try { return localStorage.getItem('xzk_' + name) || (fallback || ''); }
  catch(e) { return fallback || ''; }
}

// ── IS CONFIGURED? ──
export function isFirebaseConfigured() {
  return !!(k('fb_apiKey') && k('fb_projectId') && k('fb_appId'));
}

// ── FIREBASE INIT ──
var _app = null;
var _auth = null;
var _db = null;
var _rtdb = null;
var _storage = null;

if (isFirebaseConfigured()) {
  var cfg = {
    apiKey:            k('fb_apiKey'),
    authDomain:        k('fb_authDomain'),
    databaseURL:       k('fb_databaseURL'),
    projectId:         k('fb_projectId'),
    storageBucket:     k('fb_storageBucket'),
    messagingSenderId: k('fb_messagingSenderId'),
    appId:             k('fb_appId'),
  };
  _app     = getApps().length ? getApp() : initializeApp(cfg);
  _auth    = getAuth(_app);
  _db      = getFirestore(_app);
  _rtdb    = getDatabase(_app);
  _storage = getStorage(_app);

  // ── CRITICAL: set LOCAL persistence so user stays logged in across pages ──
  setPersistence(_auth, browserLocalPersistence).catch(function(e) {
    console.warn('Auth persistence error:', e.message);
  });
} else {
  console.warn('%c⚠ XZORA: Not configured — go to /admin-config.html', 'color:#e8d5a3;font-weight:bold');
}

export var auth    = _auth;
export var db      = _db;
export var rtdb    = _rtdb;
export var storage = _storage;

// ── DYNAMIC KEY GETTERS ──
export var GROQ_API_KEY      = function() { return k('groq_key'); };
export var GROQ_MODEL        = function() { return k('groq_model', 'llama-3.3-70b-versatile'); };
export var HF_API_KEY        = function() { return k('hf_key'); };
export var IMGBB_API_KEY     = function() { return k('imgbb_key'); };
export var CLOUDINARY_CLOUD  = function() { return k('cloud_name'); };
export var CLOUDINARY_KEY    = function() { return k('cloud_key'); };
export var CLOUDINARY_SECRET = function() { return k('cloud_secret'); };
export var RAZORPAY_KEY      = function() { return k('razorpay_key'); };
export var STRIPE_KEY        = function() { return k('stripe_key'); };
export var UPI_ID            = function() { return k('upi_id', 'xzora@upi'); };
export var SMS_KEY           = function() { return k('sms_key'); };

// ── CONFIG BANNER ──
export function requireConfig() {
  if (isFirebaseConfigured()) return true;
  if (location.pathname.includes('admin-config')) return false;
  if (document.getElementById('xz-config-banner')) return false;
  var b = document.createElement('div');
  b.id = 'xz-config-banner';
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#1a1a1c;border-bottom:2px solid rgba(232,213,163,.4);padding:12px 24px;display:flex;align-items:center;justify-content:space-between;font-family:DM Sans,sans-serif;font-size:13px;color:#e8d5a3;gap:12px';
  b.innerHTML = '<span>⚙️ <strong>Xzora is not configured.</strong> Enter your API keys to activate the platform.</span><a href="admin-config.html" style="background:#e8d5a3;color:#111;padding:7px 18px;border-radius:7px;text-decoration:none;font-size:11px;font-weight:500;text-transform:uppercase;white-space:nowrap">Open Config →</a>';
  document.body.prepend(b);
  return false;
}
