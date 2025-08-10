// js/meal_suggest.js
// Shared utilities to gather inventory across Pantry/Fridge/Lockers,
// score ingredients, and generate a simple daily meal plan.
// (Front-end only for now; later we'll call this from a serverless function for SMS.)

import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js';

// --- Reuse your date helpers (standalone) ---
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function endOfMonthISO(y, m) {
  const last = new Date(y, Number(m), 0).getDate();
  return `${y}-${m}-${String(last).padStart(2, '0')}`;
}
function toComparableDate(iso) {
  if (!iso) return null;
  if (iso.length === 7) { // YYYY-MM
    const [y, m] = iso.split('-');
    return endOfMonthISO(y, m);
  }
  if (iso.length === 10) return iso; // YYYY-MM-DD
  return null;
}
function addDaysISO(isoYYYYMMDD, days) {
  const [y, m, d] = isoYYYYMMDD.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
function isExpired(iso) {
  const c = toComparableDate(iso);
  return c ? (c < todayISO()) : false;
}
function isExpiringSoon(iso) {
  const c = toComparableDate(iso);
  if (!c) return false;
  const today = todayISO();
  const in7   = addDaysISO(today, 7);
  return (c >= today && c <= in7);
}

// --- Step A: fetch everything from pantry/fridge/lockers ---
export async function fetchAllInventory(db) {
  // DB shape: { pantry: {folder: [items]}, fridge: {...}, lockers: {...} }
  const snapshot = await get(ref(db));
  const root = snapshot.val() || {};
  const sources = ['pantry', 'fridge', 'lockers'];

  const all = [];
  for (const src of sources) {
    const tree = root[src] || {};
    for (const [folder, items] of Object.entries(tree)) {
      (items || []).forEach((it, idx) => {
        all.push({
          ...it,
          _location: src,      // pantry | fridge | lockers
          _folder: folder,
          _index: idx
        });
      });
    }
  }
  return all;
}

// --- Step B: compute status & a priority score ---
function scoreItem(it) {
  let s = 0;
  if (isExpired(it.expires)) s += 100;
  else if (isExpiringSoon(it.expires)) s += 40;

  if (it.level === 'empty') s += 30;
  else if (it.level === 'half') s += 15;

  const qty = Number(it.quantity || 0);
  const par = Number(it.par_min || 0);
  if (par && qty < par) s += 20;

  if (it._location === 'fridge') s += 5; // perishable nudge
  return s;
}

export function indexInventory(items) {
  return items.map(it => ({
    ...it,
    _expired: isExpired(it.expires),
    _expiringSoon: !isExpired(it.expires) && isExpiringSoon(it.expires),
    _score: scoreItem(it),
  }));
}

// --- Step C: rough classifier to help meal rules ---
function classify(itemName = '') {
  const n = itemName.toLowerCase();

  if (/\b(chicken|beef|pork|turkey|tofu|tempeh|egg|eggs|salmon|tuna|shrimp|beans|lentil|sausage)\b/.test(n))
    return 'protein';

  if (/\b(spinach|lettuce|broccoli|carrot|pepper|onion|tomato|zucchini|cucumber|kale|greens|asparagus|mushroom|celery)\b/.test(n))
    return 'vegetable';

  if (/\b(rice|pasta|noodle|bread|tortilla|quinoa|potato|roll|bun)\b/.test(n))
    return 'carb';

  if (/\b(salsa|sauce|ketchup|mustard|mayo|aioli|soy|tamari|sriracha|dressing|vinaigrette)\b/.test(n))
    return 'condiment';

  if (/\b(milk|cheese|yogurt|butter|cream)\b/.test(n))
    return 'dairy';

  return 'other';
}

// --- Step D: meal suggestion engine (v1 rules) ---
export function generateDailyMealPlan(items) {
  const pool = indexInventory(items)
    .filter(it => Number(it.quantity || 0) > 0 || it.level !== 'empty');

  pool.sort((a,b) => b._score - a._score);

  const pick = (cat) => pool.find(it => classify(it.name) === cat);

  // Breakfast
  const breakfast = [];
  const egg = pool.find(it => /\begg(s)?\b/i.test(it.name));
  if (egg) breakfast.push(egg);
  const dairy = pool.find(it => classify(it.name) === 'dairy');
  if (!egg && dairy) breakfast.push(dairy);
  const carbB = pool.find(it => classify(it.name) === 'carb');
  if (carbB) breakfast.push(carbB);

  // Lunch
  const lunch = [];
  const pL = pick('protein');
  const vL = pick('vegetable');
  if (pL && vL) { lunch.push(pL, vL); }
  else if (pL && !vL) {
    lunch.push(pL);
    const carbL = pick('carb');
    if (carbL) lunch.push(carbL);
  } else {
    const carbL = pick('carb');
    const cond = pick('condiment');
    if (carbL) lunch.push(carbL);
    if (cond) lunch.push(cond);
  }

  // Dinner (must have protein + vegetable)
  const dinner = [];
  const pD = pick('protein');
  const vD = pick('vegetable');

  let buySuggestion = null;
  if (pD && vD) {
    dinner.push(pD, vD);
  } else if (!pD && vD) {
    dinner.push(vD);
    buySuggestion = 'protein';
  } else if (pD && !vD) {
    dinner.push(pD);
    buySuggestion = 'vegetable';
  } else {
    dinner.push(...pool.slice(0, 2));
    buySuggestion = 'protein & vegetable';
  }

  const fmt = (arr) => arr.filter(Boolean).map(x => `${x.name} (${x._location}/${x._folder})`).join(', ');
  const missing = buySuggestion ? `\nMissing: ${buySuggestion} → add to list.` : '';

  const text =
`Good morning! Here are today’s ideas based on what you have:

• Breakfast: ${fmt(breakfast) || '—'}
• Lunch: ${fmt(lunch) || '—'}
• Dinner: ${fmt(dinner) || '—'}${missing}

Expiring soon:
${pool.filter(x => x._expiringSoon).slice(0, 10).map(x => `- ${x.name} (${x._location}/${x._folder})`).join('\n') || 'None'}

Reply with "ORDER" to receive a suggested order list.`;

  return { breakfast, lunch, dinner, buySuggestion, text };
}
