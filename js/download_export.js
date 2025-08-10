// js/download_export.js
// Adds a "Download Inventory JSON" button handler that:
// - Reads pantry + fridge + lockers from Realtime DB
// - Tags items with expired / expiringSoon
// - Computes a simple priority score & label
// - Downloads a single JSON file

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js';

// ---- Reuse your project's Firebase config (same as the app)
const firebaseConfig = {
  apiKey: "AIzaSyADqsTz-IHi5JvXLh1pqqFFTZT8RxfBlps",
  authDomain: "food-inventory-data-3c5cb.firebaseapp.com",
  databaseURL: "https://food-inventory-data-3c5cb-default-rtdb.firebaseio.com",
  projectId: "food-inventory-data-3c5cb",
  storageBucket: "food-inventory-data-3c5cb.appspot.com",
  messagingSenderId: "731050960925",
  appId: "1:731050960925:web:29241f709b5c94aedd3ef4"
};

// Avoid double-initting if the page already initialized Firebase
if (!getApps().length) {
  initializeApp(firebaseConfig);
}
const db = getDatabase();

// ---------- Date helpers (handle YYYY-MM, YYYY-MM-DD, MM-DD-YY, MM-DD-YYYY) ----------
function endOfMonthISO(y, m) {
  const last = new Date(y, Number(m), 0).getDate();
  return `${y}-${m}-${String(last).padStart(2, '0')}`;
}
function toComparableDate(iso) {
  if (!iso) return null;                 // null if unknown
  if (iso.length === 7 && iso.includes('-')) {
    const [y, m] = iso.split('-');       // YYYY-MM → end of that month
    return endOfMonthISO(y, m);
  }
  if (iso.length === 10 && iso.includes('-')) return iso; // YYYY-MM-DD
  return null;
}
function parseDisplayToISO(input) {
  if (!input) return '';
  const s = String(input);
  const digits = s.replace(/[^\d]/g, '');

  // MM-YY (or MMYY) → YYYY-MM  (assume 20YY)
  if (digits.length === 4 && s.indexOf('-') !== -1) {
    const mm = digits.slice(0,2), yy = digits.slice(2,4);
    return `20${yy}-${mm}`;
  }
  if (digits.length === 4 && s.indexOf('-') === -1) {
    const mm = digits.slice(0,2), yy = digits.slice(2,4);
    return `20${yy}-${mm}`;
  }

  // MM-DD-YY / MMDDYY → YYYY-MM-DD
  if (digits.length === 6) {
    const mm = digits.slice(0,2), dd = digits.slice(2,4), yy = digits.slice(4,6);
    return `20${yy}-${mm}-${dd}`;
  }

  // MM-DD-YYYY / MMDDYYYY → YYYY-MM-DD
  if (digits.length === 8) {
    const mm = digits.slice(0,2), dd = digits.slice(2,4), yyyy = digits.slice(4,8);
    return `${yyyy}-${mm}-${dd}`;
  }

  // Already YYYY-MM or YYYY-MM-DD? Return as-is if plausible
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  return '';
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
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`; // YYYY-MM-DD
}
function isExpired(iso, graceDays = 0) {
  const c = toComparableDate(iso);
  return c ? (addDaysISO(c, graceDays) < todayISO()) : false;
}
function isExpiringSoon(iso, windowDays = 7) {
  const c = toComparableDate(iso);
  if (!c) return false;
  const t = todayISO();
  const inN = addDaysISO(t, windowDays);
  return (c >= t && c <= inN);
}

// ---------- Priority tagging ----------
function scoreItem(it) {
  // Higher = more urgent to use
  let s = 0;

  // Expiry pressure
  const iso = parseDisplayToISO(it.expires || '');
  if (isExpired(iso, 2)) s += 100;           // past + 2-day grace
  else if (isExpiringSoon(iso, 7)) s += 40;

  // Level signal
  if ((it.level || '').toLowerCase() === 'empty') s += 30;
  else if ((it.level || '').toLowerCase() === 'half') s += 15;

  // Low vs par
  const qty = Number(it.quantity || 0);
  const par = Number(it.par_min || 0);
  if (par && qty < par) s += 20;

  // Perishability nudge (fridge)
  if (it._location === 'fridge') s += 5;

  return s;
}
function labelFromScore(s) {
  if (s >= 80) return 'high';
  if (s >= 30) return 'medium';
  return 'low';
}

// ---------- Download helper ----------
function download(filename, dataObj) {
  const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Main export function ----------
export async function downloadInventoryJSON() {
  const root = (await get(ref(db))).val() || {};
  const sections = ['pantry', 'fridge', 'lockers'];

  // Clone + tag data (don’t mutate your DB shape)
  const result = {
    pantry:  root.pantry  || {},
    fridge:  root.fridge  || {},
    lockers: root.lockers || {},
    settings: root.settings || {}
  };

  sections.forEach(sec => {
    const tree = result[sec] || {};
    Object.keys(tree).forEach(folder => {
      tree[folder] = (tree[folder] || []).map(item => {
        const iso = parseDisplayToISO(item.expires || '');
        const expired = isExpired(iso, 2);
        const expSoon = !expired && isExpiringSoon(iso, 7);
        const scored = scoreItem({ ...item, _location: sec });
        const priority = labelFromScore(scored);
        return {
          ...item,
          expires_iso: iso || null,
          expired,
          expiringSoon: expSoon,
          priorityScore: scored,
          priority
        };
      });
    });
  });

  const ts = new Date().toISOString().slice(0,10);
  download(`inventory-${ts}.json`, result);
}

// ---------- Wire up the button if present ----------
window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('download-inventory');
  if (btn) {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Preparing…';
      try {
        await downloadInventoryJSON();
      } catch (e) {
        alert('Download failed. Check console.');
        console.error(e);
      } finally {
        btn.disabled = false;
        btn.textContent = '⬇️ Download Inventory JSON';
      }
    });
  }
});
