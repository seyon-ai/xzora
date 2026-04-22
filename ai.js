// ============================================================
// XZORA — AI Module (Groq + HuggingFace)
// ============================================================

import { GROQ_API_KEY, GROQ_MODEL, HF_API_KEY } from './firebase-config.js';

var GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
var FALLBACK_MODEL = 'mixtral-8x7b-32768';

async function groqChat(messages, model) {
  var key = GROQ_API_KEY();
  if (!key) throw new Error('Groq API key not set. Add it in /admin-config.html');
  var res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model || GROQ_MODEL(), messages: messages, max_tokens: 1024, temperature: 0.7 })
  });
  if (!res.ok) {
    var err = await res.json().catch(function(){ return {}; });
    throw new Error((err.error && err.error.message) || ('Groq error ' + res.status));
  }
  var data = await res.json();
  return data.choices[0].message.content;
}

async function aiChat(messages) {
  try { return await groqChat(messages, GROQ_MODEL()); }
  catch(e) {
    if (e.message.includes('not set')) throw e;
    try { return await groqChat(messages, FALLBACK_MODEL); }
    catch(e2) { throw new Error('AI unavailable. Check Groq API key in config panel.'); }
  }
}

export async function generateProductDescription(product) {
  return await aiChat([{ role:'user', content:
    'Write a compelling e-commerce product description for:\n' +
    'Name: ' + (product.name||'') + '\nBrand: ' + (product.brand||'') +
    '\nCategory: ' + (product.category||'') + '\nPrice: ₹' + (product.price||'') +
    '\nFeatures: ' + (product.features||'not provided') +
    '\n\nWrite 2-3 short punchy paragraphs. Use power words. No bullet points. Max 120 words.'
  }]);
}

export async function generateProductTags(product) {
  var raw = await aiChat([{ role:'user', content:
    'Generate 10 relevant search tags for this product:\n' +
    'Name: ' + (product.name||'') + ', Brand: ' + (product.brand||'') + ', Category: ' + (product.category||'') +
    '\nReturn ONLY a JSON array of lowercase strings. No explanation, no markdown.'
  }]);
  try { return JSON.parse(raw.replace(/```json|```/g,'').trim()); }
  catch(e) { return raw.split(',').map(function(t){ return t.trim().replace(/["'\[\]]/g,''); }); }
}

export async function supportChat(history, userMessage) {
  var messages = [
    { role:'system', content:'You are Xzora\'s friendly AI support assistant. Xzora is a premium Indian e-commerce platform. Help customers with orders, returns, products, and payments. Be concise and helpful. Keep responses under 80 words. Use ₹ for prices.' }
  ].concat(history).concat([{ role:'user', content: userMessage }]);
  return await aiChat(messages);
}

export async function generateSellerMessage(seller) {
  return await aiChat([{ role:'user', content:
    'Write a short motivating performance message for a seller:\n' +
    'Sales: ₹' + (seller.monthlyRevenue||0) + ', Orders: ' + (seller.orders||0) +
    ', Rating: ' + (seller.rating||0) + '/5, Top product: ' + (seller.topProduct||'N/A') +
    ', Low stock items: ' + (seller.lowStock||0) +
    '\nWrite 2-3 sentences: one positive, one actionable tip, one encouraging close. Friendly and professional.'
  }]);
}

export async function generateMarketingCopy(type, data) {
  var prompts = {
    banner: 'Write a punchy 6-word banner headline for: ' + JSON.stringify(data) + '. Just the headline, no quotes.',
    email:  'Write an email subject line (max 8 words) for: ' + JSON.stringify(data) + '. Just the subject line.',
    push:   'Write a push notification (max 60 chars) for: ' + JSON.stringify(data) + '. Just the notification text.'
  };
  return await aiChat([{ role:'user', content: prompts[type] || prompts.banner }]);
}

export async function classifyProduct(productName) {
  try {
    var key = HF_API_KEY();
    if (!key) throw new Error('HuggingFace token not set');
    var res = await fetch('https://api-inference.huggingface.co/models/facebook/bart-large-mnli', {
      method:'POST',
      headers:{ 'Authorization':'Bearer '+key, 'Content-Type':'application/json' },
      body: JSON.stringify({
        inputs: productName,
        parameters: { candidate_labels: ['Electronics','Fashion','Home & Living','Beauty','Sports','Books','Automotive','Toys','Grocery','Health'] }
      })
    });
    var data = await res.json();
    return (data.labels && data.labels[0]) || 'Electronics';
  } catch(e) { return 'Electronics'; }
}

export async function analyzeSentiment(text) {
  try {
    var key = HF_API_KEY();
    if (!key) return 'neutral';
    var res = await fetch('https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment-latest', {
      method:'POST',
      headers:{ 'Authorization':'Bearer '+key, 'Content-Type':'application/json' },
      body: JSON.stringify({ inputs: text })
    });
    var data = await res.json();
    return (data[0] && data[0][0] && data[0][0].label) || 'neutral';
  } catch(e) { return 'neutral'; }
}
