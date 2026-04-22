// ============================================================
// XZORA — Seller Module
// ============================================================

import { db } from './firebase-config.js';
import {
  collection, doc, getDoc, getDocs, updateDoc, setDoc,
  query, where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function checkDB() {
  if (!db) throw new Error('Firebase not configured. Go to /admin-config.html');
}

export async function getSellerProfile(uid) {
  checkDB();
  try {
    var snap = await getDoc(doc(db, 'sellers', uid));
    return snap.exists() ? Object.assign({ id: snap.id }, snap.data()) : null;
  } catch(e) { return null; }
}

export async function updateSellerProfile(uid, data) {
  checkDB();
  await updateDoc(doc(db, 'sellers', uid), Object.assign({}, data, { updatedAt: serverTimestamp() }));
}

export async function getSellerOrders(sellerId) {
  if (!db) return [];
  try {
    // Get all orders then filter by sellerId in items
    var q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(100));
    var snap = await getDocs(q);
    var all = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    return all.filter(function(o) {
      return o.items && o.items.some(function(i) { return i.sellerId === sellerId; });
    });
  } catch(e) {
    // Fallback without orderBy if index missing
    try {
      var q2 = query(collection(db, 'orders'), limit(100));
      var snap2 = await getDocs(q2);
      var all2 = snap2.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      return all2.filter(function(o) {
        return o.items && o.items.some(function(i) { return i.sellerId === sellerId; });
      });
    } catch(e2) { return []; }
  }
}

export async function getSellerStats(sellerId) {
  var orders = await getSellerOrders(sellerId);
  var myItems = [];
  orders.forEach(function(o) {
    if (o.items) {
      o.items.forEach(function(i) {
        if (i.sellerId === sellerId) myItems.push(i);
      });
    }
  });
  var revenue = myItems.reduce(function(s, i) { return s + (i.price * i.qty); }, 0);
  return {
    totalOrders:  orders.length,
    revenue:      revenue,
    commission:   revenue * 0.05,
    itemsSold:    myItems.reduce(function(s, i) { return s + (i.qty || 1); }, 0)
  };
}

export async function updateOrderStatus(orderId, status) {
  if (!db) return;
  try {
    var q = query(collection(db, 'orders'), where('orderId', '==', orderId));
    var snap = await getDocs(q);
    if (!snap.empty) {
      var ref = snap.docs[0].ref;
      var update = { status: status, updatedAt: serverTimestamp() };
      update['timeline_' + status] = new Date().toISOString();
      await updateDoc(ref, update);
    }
  } catch(e) { throw new Error('Update failed: ' + e.message); }
}
