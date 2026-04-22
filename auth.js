// ============================================================
// XZORA — Authentication Module
// ============================================================

import { auth, db } from './firebase-config.js';
import { toast, validEmail } from './utils.js';

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function noAuth() {
  toast('Firebase not configured. Go to /admin-config.html', 'error');
  return true;
}

// ── AUTH STATE LISTENER ──
export function onAuth(callback) {
  if (!auth) { callback(null); return function() {}; }
  // onAuthStateChanged fires immediately with cached user — works across pages
  return onAuthStateChanged(auth, callback);
}

export function currentUser() {
  return auth ? auth.currentUser : null;
}

// ── SIGN OUT ──
export async function logout() {
  if (!auth) return;
  try { await signOut(auth); } catch(e) {}
  localStorage.removeItem('xz_cart');
  window.location.href = 'index.html';
}

// ── CREATE USER PROFILE IN FIRESTORE ──
async function createUserProfile(user, extra) {
  if (!db) return;
  extra = extra || {};
  try {
    var ref = doc(db, 'users', user.uid);
    var snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid:         user.uid,
        email:       user.email || '',
        phone:       user.phoneNumber || '',
        displayName: user.displayName || extra.displayName || '',
        photoURL:    user.photoURL || '',
        role:        'customer',
        createdAt:   serverTimestamp(),
        wishlist:    [],
        addresses:   []
      });
    }
  } catch(e) { console.warn('createUserProfile:', e.message); }
}

// ── EMAIL LOGIN ──
export async function loginWithEmail(email, password) {
  if (!auth) { noAuth(); throw new Error('Not configured'); }
  if (!validEmail(email)) throw new Error('Please enter a valid email address.');
  if (!password) throw new Error('Please enter your password.');
  var cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ── EMAIL SIGNUP ──
export async function signupWithEmail(email, password, displayName) {
  if (!auth) { noAuth(); throw new Error('Not configured'); }
  if (!validEmail(email)) throw new Error('Please enter a valid email address.');
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');
  var cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await updateProfile(cred.user, { displayName: displayName });
  await createUserProfile(cred.user, { displayName: displayName });
  return cred.user;
}

// ── GOOGLE LOGIN ──
export async function loginWithGoogle() {
  if (!auth) { noAuth(); throw new Error('Not configured'); }
  var provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  var cred = await signInWithPopup(auth, provider);
  await createUserProfile(cred.user);
  return cred.user;
}

// ── APPLE LOGIN ──
export async function loginWithApple() {
  if (!auth) { noAuth(); throw new Error('Not configured'); }
  var provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  var cred = await signInWithPopup(auth, provider);
  await createUserProfile(cred.user);
  return cred.user;
}

// ── PHONE OTP — SEND ──
export async function sendOTP(phoneNumber) {
  if (!auth) { noAuth(); throw new Error('Not configured'); }
  try {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible', callback: function() {}
      });
      await window.recaptchaVerifier.render();
    }
  } catch(e) { console.warn('reCAPTCHA error:', e.message); }
  var confirmation = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
  window.xzConfirmationResult = confirmation;
  return confirmation;
}

// ── PHONE OTP — VERIFY ──
export async function verifyOTP(otp) {
  if (!window.xzConfirmationResult) throw new Error('No OTP sent. Please request OTP first.');
  var cred = await window.xzConfirmationResult.confirm(otp);
  await createUserProfile(cred.user);
  return cred.user;
}

// ── FORGOT PASSWORD ──
export async function resetPassword(email) {
  if (!auth) { noAuth(); throw new Error('Not configured'); }
  if (!validEmail(email)) throw new Error('Please enter a valid email.');
  await sendPasswordResetEmail(auth, email);
}

// ── GET USER ROLE ──
export async function getUserRole(uid) {
  if (!db) return 'customer';
  try {
    var snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) return snap.data().role || 'customer';
  } catch(e) {}
  return 'customer';
}

// ── REDIRECT AFTER LOGIN ──
export function redirectAfterLogin(role) {
  if (role === 'admin')       window.location.href = 'admin-dashboard.html';
  else if (role === 'seller') window.location.href = 'seller-dashboard.html';
  else                        window.location.href = 'index.html';
}

// ── REQUIRE AUTH — waits for Firebase to restore session ──
export function requireAuth(redirectTo) {
  redirectTo = redirectTo || 'auth.html';
  return new Promise(function(resolve) {
    if (!auth) { window.location.href = redirectTo; return; }
    // Firebase restores session from localStorage automatically
    // onAuthStateChanged fires with user immediately if session exists
    var unsub = onAuthStateChanged(auth, function(user) {
      unsub();
      if (!user) window.location.href = redirectTo;
      else resolve(user);
    });
  });
}

// ── REQUIRE SELLER ──
export async function requireSeller() {
  var user = await requireAuth('seller-login.html');
  var role = await getUserRole(user.uid);
  if (role !== 'seller' && role !== 'admin') {
    window.location.href = 'seller-login.html';
    throw new Error('Not a seller');
  }
  return user;
}

// ── REQUIRE ADMIN ──
export async function requireAdmin() {
  var user = await requireAuth('admin-login.html');
  var role = await getUserRole(user.uid);
  if (role !== 'admin') {
    window.location.href = 'admin-login.html';
    throw new Error('Not admin');
  }
  return user;
}

// ── MERGE LOCAL CART TO FIREBASE ──
export async function mergeLocalCartToFirebase(uid) {
  if (!db) return;
  try {
    var local = JSON.parse(localStorage.getItem('xz_cart') || '[]');
    if (!local.length) return;
    var ref = doc(db, 'carts', uid);
    var snap = await getDoc(ref);
    var items = snap.exists() ? (snap.data().items || []) : [];
    local.forEach(function(li) {
      var idx = items.findIndex(function(x) { return x.id === li.id; });
      if (idx >= 0) items[idx].qty = (items[idx].qty || 1) + li.qty;
      else items.push(li);
    });
    await setDoc(ref, { items: items, updatedAt: Date.now() });
    localStorage.removeItem('xz_cart');
  } catch(e) { console.warn('Cart merge:', e.message); }
}
