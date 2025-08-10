// ─────────────────────────────────────────────────────────────────────────────
// Pantry page with EXP field (MM-YY or MM-DD-YY) + expiry highlighting
// + Fill-level buttons (Empty / Half / Full)
// ─────────────────────────────────────────────────────────────────────────────

// Firebase imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import { getDatabase, ref, onValue, set } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';

// Keep which folders are currently open
const expandedFolders = new Set();

// ─── Firebase config (yours) ───────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyADqsTz-IHi5JvXLh1pqqFFTZT8RxfBlps",
  authDomain: "food-inventory-data-3c5cb.firebaseapp.com",
  databaseURL: "https://food-inventory-data-3c5cb-default-rtdb.firebaseio.com",
  projectId: "food-inventory-data-3c5cb",
  storageBucket: "food-inventory-data-3c5cb.appspot.com",
  messagingSenderId: "731050960925",
  appId: "1:731050960925:web:29241f709b5c94aedd3ef4"
};

// ─── Init Firebase ─────────────────────────────────────────────────────
const app      = initializeApp(firebaseConfig);
const db       = getDatabase(app);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

// ─── Auth UI elements ─────────────────────────────────────────────────
const btnSignIn     = document.getElementById('sign-in');
const btnSignOut    = document.getElementById('sign-out');
const signedInDiv   = document.getElementById('signed-in');
const userEmailSpan = document.getElementById('user-email');

// ─── Expiry helpers (accepts MM-YY or MM-DD-YY) ───────────────────────
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`; // YYYY-MM-DD
}
function endOfMonthISO(y, m) {
  const last = new Date(y, Number(m), 0).getDate();
  return `${y}-${m}-${String(last).padStart(2, '0')}`;
}
function toComparableDate(iso) {
  // iso can be 'YYYY-MM' or 'YYYY-MM-DD'
  if (!iso) return null;
  if (iso.length === 7) { // month only
    const [y, m] = iso.split('-');
    return endOfMonthISO(y, m);
  }
  if (iso.length === 10) return iso;
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
function applyExpiryStyle(rowEl, iso) {
  rowEl.classList.toggle('expired', isExpired(iso));
  rowEl.classList.toggle('expiring-soon', !isExpired(iso) && isExpiringSoon(iso));
}

// Formatting & parsing between display and DB
function formatISOforDisplay(iso) {
  // Show MM-YY for month-only; show MM-DD-YY for full dates
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 2) {
    const [y, m] = parts;
    return `${m}-${y.slice(2)}`;           // MM-YY
  }
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${m}-${d}-${y.slice(2)}`;      // MM-DD-YY
  }
  return '';
}
function parseDisplayToISO(input) {
  // Accept: MM-YY, MMYY, MM-DD-YY, MMDDYY, MM-DD-YYYY, MMDDYYYY
  if (!input) return '';
  const digits = input.replace(/[^\d]/g, '');

  // MMYY -> YYYY-MM
  if (digits.length === 4) {
    const mm = digits.slice(0,2);
    const yy = digits.slice(2,4);
    return `20${yy}-${mm}`;
  }

  // MMDDYY -> YYYY-MM-DD
  if (digits.length === 6) {
    const mm = digits.slice(0,2);
    const dd = digits.slice(2,4);
    const yy = digits.slice(4,6);
    return `20${yy}-${mm}-${dd}`;
  }

  // MMDDYYYY -> YYYY-MM-DD
  if (digits.length === 8) {
    const mm = digits.slice(0,2);
    const dd = digits.slice(2,4);
    const yyyy = digits.slice(4,8);
    return `${yyyy}-${mm}-${dd}`;
  }

  // fallback for YYYYMM or YYYYMMDD (rare)
  if (digits.length === 6) {
    const yyyy = digits.slice(0,4);
    const mm = digits.slice(4,6);
    return `${yyyy}-${mm}`;
  }
  if (digits.length === 8) {
    const yyyy = digits.slice(0,4);
    const mm = digits.slice(4,6);
    const dd = digits.slice(6,8);
    return `${yyyy}-${mm}-${dd}`;
  }

  return '';
}
function maskExpiryInput(raw) {
  // As you type: 2-2-2 or 2-2-4 → MM, MM-DD, MM-DD-YY or MM-DD-YYYY
  const digits = raw.replace(/[^\d]/g, '').slice(0,8);
  if (digits.length <= 2) return digits;                                // M, MM
  if (digits.length <= 4) return digits.slice(0,2) + '-' + digits.slice(2); // MM-D, MM-DD
  if (digits.length <= 6) return digits.slice(0,2) + '-' + digits.slice(2,4) + '-' + digits.slice(4); // MM-DD-YY
  return digits.slice(0,2) + '-' + digits.slice(2,4) + '-' + digits.slice(4,8); // MM-DD-YYYY
}

// ─── Auth observer ────────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  const addFolderBtn = document.getElementById('add-folder');
  const container    = document.getElementById('pantry-container');
  if (user) {
    btnSignIn.style.display    = 'none';
    signedInDiv.style.display  = 'block';
    userEmailSpan.textContent  = user.email;
    addFolderBtn.style.display = 'inline-block';
    container.style.display    = 'block';
    setupPantryListeners();
  } else {
    btnSignIn.style.display    = 'block';
    signedInDiv.style.display  = 'none';
    addFolderBtn.style.display = 'none';
    container.style.display    = 'none';
  }
});

// Sign-in/out
btnSignIn.onclick  = () => signInWithPopup(auth, provider);
btnSignOut.onclick = () => signOut(auth);

// ─── Main setup after auth ────────────────────────────────────────────
function setupPantryListeners() {
  const pantryRef = ref(db, 'pantry');
  let pantryData = {};        // { folderName: [ {name, quantity, expires?, level?} ] }

  // Listen for DB changes
  onValue(pantryRef, snap => {
    pantryData = snap.val() || {};
    renderPantry(pantryData);
  });

  // Add a new folder
  document.getElementById('add-folder').onclick = () => {
    const name = prompt('New folder name:');
    if (!name) return;
    pantryData[name] = pantryData[name] || [];
    expandedFolders.add(name);
    renderPantry(pantryData);
    set(pantryRef, pantryData).catch(console.error);
  };

  // Render everything
  function renderPantry(data) {
    const container = document.getElementById('pantry-container');
    container.innerHTML = '';

    Object.entries(data).forEach(([folder, items]) => {
      // Folder header
      const fld = document.createElement('div');
      fld.className = 'folder';

      const isExpanded = expandedFolders.has(folder);

      const arrow = document.createElement('span');
      arrow.className = 'arrow';
      arrow.textContent = isExpanded ? '▼' : '▶';
      fld.appendChild(arrow);

      const title = document.createElement('span');
      title.textContent = folder;
      title.className   = 'folder-title';
      fld.appendChild(title);

      const addBtn = document.createElement('button');
      addBtn.textContent = '+';
      addBtn.title       = 'Add item to ' + folder;
      addBtn.className   = 'folder-add';
      fld.appendChild(addBtn);

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '🗑️';
      removeBtn.className   = 'folder-remove';
      fld.appendChild(removeBtn);

      // Delete folder (with confirm)
      removeBtn.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (!confirm(`Delete folder “${folder}” and all its items?`)) return;
        delete pantryData[folder];
        expandedFolders.delete(folder);
        renderPantry(pantryData);
        set(pantryRef, pantryData).catch(console.error);
      });

      container.appendChild(fld);

      // Items container
      const list = document.createElement('div');
      list.className     = 'folder-items';
      list.style.display = isExpanded ? 'block' : 'none';
      container.appendChild(list);

      // Toggle open/close
      arrow.onclick = () => {
        const showing = list.style.display === 'block';
        if (showing) {
          arrow.textContent = '▶';
          list.style.display = 'none';
          expandedFolders.delete(folder);
        } else {
          arrow.textContent = '▼';
          list.style.display = 'block';
          expandedFolders.add(folder);
        }
      };

      // Add item to this folder
      addBtn.onclick = () => {
        items.push({ name: '', quantity: 0, expires: '', level: null });  // include level
        expandedFolders.add(folder);
        renderPantry(pantryData);
        set(pantryRef, pantryData).catch(console.error);
      };

      // Render rows
      items.forEach((item, i) => {
        const row = document.createElement('div');
        row.className = 'row';

        // Delete row
        const del = document.createElement('button');
        del.textContent = '🗑️';
        del.classList.add('delete-btn');
        del.addEventListener('pointerdown', e => {
          e.preventDefault();
          items.splice(i, 1);
          set(pantryRef, pantryData);
        });
        row.appendChild(del);

        // Name
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = item.name || '';
        nameInput.placeholder = 'Item name';
        nameInput.onchange = () => {
          items[i].name = nameInput.value;
          set(pantryRef, pantryData);
        };
        row.appendChild(nameInput);

        // Minus
        const minus = document.createElement('button');
        minus.textContent = '–';
        minus.addEventListener('pointerdown', e => {
          e.preventDefault();
          item.quantity = Math.max(0, (item.quantity || 0) - 1);
          qty.value = item.quantity;
          set(pantryRef, pantryData);
        });
        row.appendChild(minus);

        // Quantity
        const qty = document.createElement('input');
        qty.type = 'number';
        qty.min = 0;
        qty.value = item.quantity || 0;
        qty.onchange = () => {
          items[i].quantity = parseInt(qty.value, 10) || 0;
          set(pantryRef, pantryData);
        };
        row.appendChild(qty);

        // Plus
        const plus = document.createElement('button');
        plus.textContent = '+';
        plus.addEventListener('pointerdown', e => {
          e.preventDefault();
          item.quantity = (item.quantity || 0) + 1;
          qty.value = item.quantity;
          set(pantryRef, pantryData);
        });
        row.appendChild(plus);

        // ── Level buttons (Empty / Half / Full) — inserted here ─────────
        const levelGroup = document.createElement('span');
        levelGroup.className = 'level-group';

        const levels = [
          { key: 'empty', label: 'Empty' },
          { key: 'half',  label: 'Half'  },
          { key: 'full',  label: 'Full'  },
        ];

        levels.forEach(({ key, label }) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'level-btn';
          b.dataset.level = key;
          b.textContent = label;

          // restore selection
          if (item.level === key) b.classList.add('active');

          b.addEventListener('pointerdown', e => {
            e.preventDefault();
            // single-select
            levelGroup.querySelectorAll('.level-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            items[i].level = key;  // save to DB schema
            set(pantryRef, pantryData);
          });

          levelGroup.appendChild(b);
        });

        row.appendChild(levelGroup);

        // ── EXP (right of level buttons). Accepts MM-YY or MM-DD-YY ─────
        const expGroup = document.createElement('span');
        expGroup.className = 'exp-group';

        const expLabel = document.createElement('span');
        expLabel.textContent = 'EXP';
        expLabel.className = 'exp-label';
        expGroup.appendChild(expLabel);

        const exp = document.createElement('input');
        exp.type = 'text';
        exp.inputMode = 'numeric';
        exp.placeholder = 'MM-DD-YY';  // set order clearly
        exp.maxLength = 12;            // fits MM-DD-YYYY too
        exp.className = 'exp-input';
        exp.style.width = '12ch';      // make the field a bit larger

        // Show existing value from DB ('YYYY-MM' or 'YYYY-MM-DD')
        exp.value = formatISOforDisplay(item.expires || '');

        // Live mask while typing
        exp.addEventListener('input', () => {
          exp.value = maskExpiryInput(exp.value);
        });

        // Save on change (allow blank)
        exp.addEventListener('change', () => {
          const iso = parseDisplayToISO(exp.value);
          items[i].expires = iso;  // '' or 'YYYY-MM' or 'YYYY-MM-DD'
          set(pantryRef, pantryData);
          applyExpiryStyle(row, items[i].expires);
        });

        expGroup.appendChild(exp);
        row.appendChild(expGroup);

        // Initial style (expired / expiring-soon)
        applyExpiryStyle(row, item.expires);

        list.appendChild(row);
      });
    });
  }
}
