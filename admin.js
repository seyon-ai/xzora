// ============================================================
// XZORA — Admin Module
// ============================================================

import { db } from './firebase-config.js';
import {
  collection, doc, getDoc, getDocs, updateDoc, deleteDoc,
  query, orderBy, limit, where, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function checkDB() {
  if (!db) throw new Error('Firebase not configured. Go to /admin-config.html');
  return db;
}

async function safeGet(colName, n) {
  checkDB();
  try {
    var q = query(collection(db, colName), orderBy('createdAt', 'desc'), limit(n || 50));
    var snap = await getDocs(q);
    return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  } catch(e) {
    // Fallback without orderBy (missing index)
    try {
      var q2 = query(collection(db, colName), limit(n || 50));
      var snap2 = await getDocs(q2);
      return snap2.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    } catch(e2) { return []; }
  }
}

export async function getAllUsers(n) { return safeGet('users', n || 50); }
export async function getAllSellers(n) { return safeGet('sellers', n || 50); }
export async function getAllOrders(n) { return safeGet('orders', n || 50); }
export async function getAllProducts(n) { return safeGet('products', n || 100); }

export async function updateUserRole(uid, role) {
  checkDB();
  await updateDoc(doc(db, 'users', uid), { role: role });
}

export async function updateProductStatus(id, status) {
  checkDB();
  await updateDoc(doc(db, 'products', id), { status: status, updatedAt: serverTimestamp() });
}

export async function updateSellerStatus(uid, status) {
  checkDB();
  await updateDoc(doc(db, 'sellers', uid), { status: status });
}

export async function deleteUser(uid) {
  checkDB();
  await deleteDoc(doc(db, 'users', uid));
}

export async function getPlatformStats() {
  checkDB();
  try {
    var results = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'sellers')),
      getDocs(collection(db, 'orders')),
      getDocs(collection(db, 'products'))
    ]);
    var revenue = 0;
    results[2].docs.forEach(function(d) { revenue += d.data().total || 0; });
    return {
      users:      results[0].size,
      sellers:    results[1].size,
      orders:     results[2].size,
      products:   results[3].size,
      revenue:    revenue,
      commission: revenue * 0.05
    };
  } catch(e) {
    return { users:0, sellers:0, orders:0, products:0, revenue:0, commission:0 };
  }
}
