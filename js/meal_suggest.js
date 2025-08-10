// js/meal_suggest.js
// Shared utilities to gather inventory across Pantry/Fridge/Lockers,
// score ingredients, and generate a simple daily meal plan.
// (Front-end only for now; later we'll call this from a serverless function for SMS.)

import { getDatabase, ref, get, child } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js';

// --- Reuse your date helpers (copy from inventory.js so this file is standalone) ---
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
  // higher score = higher priority to use
  // factors: expiringSoon, expired, level, low quantity
  let s = 0;
  if (isExpired(it.expires)) s += 100;
  else if (isExpiringSoon(it.expires)) s += 40;

  if (it.level === 'empty') s += 30;
  else if (it.level === 'half') s += 15;

  const qty = Number(it.quantity || 0);
  const par = Number(it.par_min || 0);
  if (par && qty < par) s += 20;

  // tiny nudge for fridge (usually more perishable)
  if (it._location === 'fridge') s += 5;

  return s;
}

export function indexInventory(items) {
  // Enrich each item with status and score
  return items.map(it => ({
    ...it,
    _expired: isExpired(it.expires),
    _expiringSoon: !isExpired(it.expires) && isExpiringSoon(it.expires),
    _score: scoreItem(it),
  }));
}

// --- Step C: simple pantry categories to help meal rules ---
function classify(itemName = '') {
  const n = itemName.toLowerCase();

  // proteins (very rough starter list; expand later)
  if (/\b(chicken|beef|pork|turkey|tofu|tempeh|egg|eggs|salmon|tuna|shrimp|beans|lentil|sausage)\b/.test(n))
    return 'protein';

  // vegetables
  if (/\b(spinach|lettuce|broccoli|carrot|pepper|onion|tomato|zucchini|cucumber|kale|greens|asparagus|mushroom|celery)\b/.test(n))
    return 'vegetable';

  // carbs / grains
  if (/\b(rice|pasta|noodle|bread|tortilla|quinoa|potato|roll|bun)\b/.test(n))
    return 'carb';

  // condiments / sauces
  if (/\b(salsa|sauce|ketchup|mustard|mayo|aioli|soy|tamari|sriracha|dressing|vinaigrette)\b/.test(n))
    return 'condiment';

  // dairy
  if (/\b(milk|cheese|yogurt|butter|cream)\b/.test(n))
    return 'dairy';

  return 'other';
}

// --- Step D: meal suggestion engine (v1 rules) ---
export function generateDailyMealPlan(items) {
  // Items already indexed (with _score) work best, but raw is fine too
  const pool = indexInventory(items)
    .filter(it => Number(it.quantity || 0) > 0 || it.level !== 'empty'); // available-ish

  // Sort by priority: expiring/low first
  pool.sort((a,b) => b._score - a._score);

  // helper to pick first match by category (prefer higher score)
  const pick = (cat) => pool.find(it => classify(it.name) === cat);

  // Breakfast: prioritize eggs/dairy + carb or fruit if present
  const breakfast = [];
  const egg = pool.find(it => /\begg(s)?\b/i.test(it.name));
  if (egg) breakfast.push(egg);
