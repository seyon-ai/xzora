// ============================================================
// XZORA — Cart Module
// ============================================================

import { db, auth } from './firebase-config.js';
import { toast, updateCartBadge } from './utils.js';
import {
  doc, setDoc, getDoc, updateDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

function cartDocRef(uid) {
  return doc(db, 'carts', uid);
}

// ── LOCAL CART HELPERS ──
function getLocal() {
  try { return JSON.parse(localStorage.getItem('xz_cart') || '[]'); }
  catch(e) { return []; }
}
function saveLocal(items) {
  localStorage.setItem('xz_cart', JSON.stringify(items));
  updateCartBadge(items.reduce(function(s,i){ return s+(i.qty||1); }, 0));
}

// ── LISTEN CART (real-time) ──
export function listenCart(callback) {
  // No Firebase — local only
  if (!auth || !db) {
    var items = getLocal();
    callback(items);
    updateCartBadge(items.reduce(function(s,i){ return s+(i.qty||1); }, 0));
    return function(){};
  }

  var firestoreUnsub = null;

  var authUnsub = onAuthStateChanged(auth, function(user) {
    // Clean up previous Firestore listener
    if (firestoreUnsub) { firestoreUnsub(); firestoreUnsub = null; }

    if (!user) {
      // Guest — use localStorage
      var items = getLocal();
      callback(items);
      updateCartBadge(items.reduce(function(s,i){ return s+(i.qty||1); }, 0));
      return;
    }

    // Logged in — use Firestore
    firestoreUnsub = onSnapshot(cartDocRef(user.uid), function(snap) {
      var items = snap.exists() ? (snap.data().items || []) : [];
      callback(items);
      updateCartBadge(items.reduce(function(s,i){ return s+(i.qty||1); }, 0));
    }, function(err) {
      // Firestore error — fall back to local
      console.warn('Cart snapshot error:', err.message);
      var items = getLocal();
      callback(items);
    });
  });

  return function() {
    authUnsub();
    if (firestoreUnsub) firestoreUnsub();
  };
}

// ── ADD TO CART ──
export async function addToCart(product) {
  var user = auth ? auth.currentUser : null;

  if (!user || !db) {
    var local = getLocal();
    var idx = local.findIndex(function(i){ return i.id === product.id; });
    if (idx >= 0) local[idx].qty = (local[idx].qty||1) + 1;
    else local.push(Object.assign({}, product, { qty: product.qty||1 }));
    saveLocal(local);
    toast((product.name||'Item') + ' added to cart', 'success');
    return;
  }

  try {
    var snap = await getDoc(cartDocRef(user.uid));
    var items = snap.exists() ? (snap.data().items || []) : [];
    var idx2 = items.findIndex(function(i){ return i.id === product.id; });
    if (idx2 >= 0) items[idx2].qty = (items[idx2].qty||1) + 1;
    else items.push(Object.assign({}, product, { qty: product.qty||1, addedAt: Date.now() }));
    await setDoc(cartDocRef(user.uid), { items: items, updatedAt: Date.now() });
    toast((product.name||'Item') + ' added to cart', 'success');
  } catch(e) {
    toast('Could not add to cart: ' + e.message, 'error');
  }
}

// ── REMOVE FROM CART ──
export async function removeFromCart(productId) {
  var user = auth ? auth.currentUser : null;
  if (!user || !db) {
    saveLocal(getLocal().filter(function(i){ return i.id !== productId; }));
    return;
  }
  try {
    var snap = await getDoc(cartDocRef(user.uid));
    if (!snap.exists()) return;
    var items = (snap.data().items || []).filter(function(i){ return i.id !== productId; });
    await updateDoc(cartDocRef(user.uid), { items: items, updatedAt: Date.now() });
    toast('Item removed', 'default');
  } catch(e) { console.warn('removeFromCart:', e.message); }
}

// ── UPDATE QTY ──
export async function updateCartQty(productId, qty) {
  if (qty < 1) { await removeFromCart(productId); return; }
  var user = auth ? auth.currentUser : null;
  if (!user || !db) {
    var items = getLocal();
    var idx = items.findIndex(function(i){ return i.id === productId; });
    if (idx >= 0) { items[idx].qty = qty; saveLocal(items); }
    return;
  }
  try {
    var snap = await getDoc(cartDocRef(user.uid));
    if (!snap.exists()) return;
    var items2 = snap.data().items || [];
    var idx2 = items2.findIndex(function(i){ return i.id === productId; });
    if (idx2 >= 0) items2[idx2].qty = qty;
    await updateDoc(cartDocRef(user.uid), { items: items2, updatedAt: Date.now() });
  } catch(e) { console.warn('updateCartQty:', e.message); }
}

// ── CLEAR CART ──
export async function clearCart() {
  var user = auth ? auth.currentUser : null;
  if (!user || !db) { localStorage.removeItem('xz_cart'); return; }
  try {
    await setDoc(cartDocRef(user.uid), { items: [], updatedAt: Date.now() });
  } catch(e) { console.warn('clearCart:', e.message); }
}

// ── CALC TOTALS ──
export function calcCartTotals(items) {
  var subtotal = items.reduce(function(s,i){ return s + (i.price * i.qty); }, 0);
  var discount = items.reduce(function(s,i){ return s + (((i.originalPrice||i.price) - i.price) * i.qty); }, 0);
  var delivery = subtotal > 499 ? 0 : 49;
  return { subtotal: subtotal, discount: discount, delivery: delivery, total: subtotal + delivery };
}
