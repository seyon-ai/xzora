// ============================================================
// XZORA — Products Module
// ============================================================

import { db, IMGBB_API_KEY } from './firebase-config.js';
import {
  collection, doc, getDoc, getDocs, query,
  where, orderBy, limit, addDoc, updateDoc,
  deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── SAFE COLLECTION REF — only call when db exists ──
function productsCol() {
  if (!db) throw new Error('Firebase not configured. Go to /admin-config.html');
  return collection(db, 'products');
}
function reviewsCol() {
  if (!db) throw new Error('Firebase not configured.');
  return collection(db, 'reviews');
}

// ── GET SINGLE PRODUCT ──
export async function getProduct(id) {
  if (!db) return null;
  try {
    var snap = await getDoc(doc(db, 'products', id));
    return snap.exists() ? Object.assign({ id: snap.id }, snap.data()) : null;
  } catch(e) { console.warn('getProduct:', e.message); return null; }
}

// ── GET PRODUCTS ──
export async function getProducts(opts) {
  opts = opts || {};
  var category = opts.category;
  var sortBy = opts.sortBy || 'createdAt';
  var pageSize = opts.pageSize || 12;
  if (!db) return { items: [], lastDoc: null };
  try {
    var col = productsCol();
    var q = query(col, where('status', '==', 'active'), orderBy(sortBy, sortBy === 'price' ? 'asc' : 'desc'), limit(pageSize));
    if (category && category !== 'all') {
      q = query(col, where('status', '==', 'active'), where('category', '==', category), orderBy(sortBy, 'desc'), limit(pageSize));
    }
    var snap = await getDocs(q);
    return {
      items: snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); }),
      lastDoc: snap.docs[snap.docs.length - 1] || null
    };
  } catch(e) { console.warn('getProducts:', e.message); return { items: [], lastDoc: null }; }
}

// ── GET FEATURED ──
export async function getFeaturedProducts(n) {
  n = n || 8;
  if (!db) return [];
  try {
    // Try featured first, fall back to just active products
    var col = productsCol();
    var q = query(col, where('status', '==', 'active'), where('featured', '==', true), limit(n));
    var snap = await getDocs(q);
    if (snap.empty) {
      // Fallback: return any active products
      q = query(col, where('status', '==', 'active'), limit(n));
      snap = await getDocs(q);
    }
    return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  } catch(e) { console.warn('getFeaturedProducts:', e.message); return []; }
}

// ── GET FLASH DEALS ──
export async function getFlashDeals(n) {
  n = n || 5;
  if (!db) return [];
  try {
    var col = productsCol();
    var q = query(col, where('status', '==', 'active'), where('flashDeal', '==', true), limit(n));
    var snap = await getDocs(q);
    return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  } catch(e) { return []; }
}

// ── GET SELLER PRODUCTS ──
export async function getSellerProducts(sellerId) {
  if (!db || !sellerId) return [];
  try {
    var col = productsCol();
    var q = query(col, where('sellerId', '==', sellerId), orderBy('createdAt', 'desc'));
    var snap = await getDocs(q);
    return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  } catch(e) {
    // Firestore needs index — try without orderBy
    try {
      var col2 = productsCol();
      var q2 = query(col2, where('sellerId', '==', sellerId));
      var snap2 = await getDocs(q2);
      return snap2.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    } catch(e2) { console.warn('getSellerProducts:', e2.message); return []; }
  }
}

// ── SEARCH PRODUCTS ──
export async function searchProducts(term) {
  if (!db || !term) return [];
  try {
    var col = productsCol();
    var q = query(col,
      where('keywords', 'array-contains', term.toLowerCase()),
      where('status', '==', 'active'),
      limit(20)
    );
    var snap = await getDocs(q);
    return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  } catch(e) { console.warn('searchProducts:', e.message); return []; }
}

// ── ADD PRODUCT ──
export async function addProduct(data, imageFile) {
  if (!db) throw new Error('Firebase not configured. Go to /admin-config.html');
  var imageUrl = data.imageUrl || '';
  if (imageFile) {
    try { imageUrl = await uploadImage(imageFile); }
    catch(e) { console.warn('Image upload failed, continuing without image:', e.message); }
  }
  var doc_data = {
    name:         data.name || '',
    brand:        data.brand || '',
    category:     data.category || 'electronics',
    price:        Number(data.price) || 0,
    originalPrice:Number(data.originalPrice) || Number(data.price) || 0,
    stock:        Number(data.stock) || 0,
    description:  data.description || '',
    sellerId:     data.sellerId || '',
    sellerName:   data.sellerName || '',
    discount:     data.discount || 0,
    emoji:        data.emoji || '📦',
    imageUrl:     imageUrl,
    status:       'active', // set active directly so seller can see immediately
    featured:     false,
    flashDeal:    false,
    views:        0,
    sales:        0,
    rating:       0,
    reviewCount:  0,
    keywords:     generateKeywords(data.name, data.brand, data.category),
    createdAt:    serverTimestamp(),
    updatedAt:    serverTimestamp(),
  };
  return await addDoc(productsCol(), doc_data);
}

// ── UPDATE PRODUCT ──
export async function updateProduct(id, data, imageFile) {
  if (!db) throw new Error('Firebase not configured.');
  var update = Object.assign({}, data, { updatedAt: serverTimestamp() });
  if (imageFile) {
    try { update.imageUrl = await uploadImage(imageFile); }
    catch(e) { console.warn('Image upload failed:', e.message); }
  }
  if (data.name || data.brand || data.category) {
    update.keywords = generateKeywords(data.name, data.brand, data.category);
  }
  await updateDoc(doc(db, 'products', id), update);
}

// ── DELETE PRODUCT ──
export async function deleteProduct(id) {
  if (!db) throw new Error('Firebase not configured.');
  await deleteDoc(doc(db, 'products', id));
}

// ── UPLOAD IMAGE TO IMGBB ──
export async function uploadImage(file) {
  var key = IMGBB_API_KEY();
  if (!key) throw new Error('ImgBB key not set. Add it in /admin-config.html');
  var formData = new FormData();
  formData.append('image', file);
  var res = await fetch('https://api.imgbb.com/1/upload?key=' + key, {
    method: 'POST', body: formData
  });
  var data = await res.json();
  if (data.success) return data.data.url;
  throw new Error('Image upload failed: ' + (data.error && data.error.message || 'Unknown error'));
}

// ── KEYWORD GENERATOR ──
function generateKeywords(name, brand, category) {
  name = name || ''; brand = brand || ''; category = category || '';
  var text = (name + ' ' + brand + ' ' + category).toLowerCase();
  var words = text.split(/\s+/).filter(function(w) { return w.length > 1; });
  var keys = {};
  words.forEach(function(w) {
    keys[w] = true;
    for (var i = 2; i <= Math.min(w.length, 8); i++) keys[w.slice(0, i)] = true;
  });
  return Object.keys(keys);
}

// ── INCREMENT VIEWS ──
export async function incrementViews(id) {
  if (!db) return;
  try {
    var ref = doc(db, 'products', id);
    var snap = await getDoc(ref);
    if (snap.exists()) await updateDoc(ref, { views: (snap.data().views || 0) + 1 });
  } catch(e) {}
}

// ── GET REVIEWS ──
export async function getReviews(productId) {
  if (!db) return [];
  try {
    var col = reviewsCol();
    var q = query(col, where('productId', '==', productId), orderBy('createdAt', 'desc'));
    var snap = await getDocs(q);
    return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  } catch(e) {
    try {
      var col2 = reviewsCol();
      var q2 = query(col2, where('productId', '==', productId));
      var snap2 = await getDocs(q2);
      return snap2.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    } catch(e2) { return []; }
  }
}

// ── ADD REVIEW ──
export async function addReview(productId, userId, opts) {
  if (!db) throw new Error('Firebase not configured.');
  var rating = opts.rating, comment = opts.comment, userName = opts.userName;
  await addDoc(reviewsCol(), {
    productId: productId, userId: userId,
    rating: rating, comment: comment, userName: userName,
    createdAt: serverTimestamp()
  });
  try {
    var reviews = await getReviews(productId);
    var avg = reviews.reduce(function(s, r) { return s + r.rating; }, 0) / reviews.length;
    await updateDoc(doc(db, 'products', productId), { rating: avg, reviewCount: reviews.length });
  } catch(e) {}
}
