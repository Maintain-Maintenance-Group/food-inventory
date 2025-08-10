// ─── Imports ────────────────────────────────────────────────────────────
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import { getDatabase, ref, onValue, set } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';

// Keep track of which folders are currently open
const expandedFolders = new Set();

// ─── Firebase config (same as your other pages) ────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyADqsTz-IHi5JvXLh1pqqFFTZT8RxfBlps",
  authDomain: "food-inventory-data-3c5cb.firebaseapp.com",
  databaseURL: "https://food-inventory-data-3c5cb-default-rtdb.firebaseio.com",
  projectId: "food-inventory-data-3c5cb",
  storageBucket: "food-inventory-data-3c5cb.appspot.com",
  messagingSenderId: "731050960925",
  appId: "1:731050960925:web:29241f709b5c94aedd3ef4"
};

// ─── Init Firebase & Auth & DB ─────────────────────────────────────────
const app      = initializeApp(firebaseConfig);
const db       = getDatabase(app);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

// ─── Cache Auth UI elements ────────────────────────────────────────────
const btnSignIn     = document.getElementById('sign-in');
const btnSignOut    = document.getElementById('sign-out');
const signedInDiv   = document.getElementById('signed-in');
const userEmailSpan = document.getElementById('user-email');

// ─── Auth observer ─────────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  const addFolderBtn = document.getElementById('add-folder');
  const container    = document.getElementById('lockers-container');
  if (user) {
    btnSignIn.style.display    = 'none';
    signedInDiv.style.display  = 'block';
    userEmailSpan.textContent  = user.email;
    addFolderBtn.style.display = 'inline-block';
    container.style.display    = 'block';
    setupLockersListeners();
  } else {
    btnSignIn.style.display    = 'block';
    signedInDiv.style.display  = 'none';
    addFolderBtn.style.display = 'none';
    container.style.display    = 'none';
  }
});

// ─── Sign-in/out handlers ─────────────────────────────────────────────
btnSignIn.onclick  = () => signInWithPopup(auth, provider);
btnSignOut.onclick = () => signOut(auth);

// ─── Main setup once authenticated ────────────────────────────────────
function setupLockersListeners() {
  const lockersRef = ref(db, 'lockers');
  let lockersData = {};  // { folderName: [items] }

  // Listen for data changes
  onValue(lockersRef, snap => {
    lockersData = snap.val() || {};
    renderLockers(lockersData);
  });

  // Add a new folder
  document.getElementById('add-folder').onclick = () => {
    const name = prompt('New folder name:');
    console.log('🗂️ Add folder clicked, name =', name);
    if (!name) return;

    // 1) Update local data
    lockersData[name] = lockersData[name] || [];

    // 2) Immediately redraw the UI
    renderLockers(lockersData);

    // 3) Save to Firebase
    set(lockersRef, lockersData)
      .then(() => console.log('✅ Lockers saved with new folder'))
      .catch(console.error);
  };

  // Render function
  function renderLockers(data) {
    const container = document.getElementById('lockers-container');
    if (!container) { console.warn('renderLockers: ❌ lockers-container not found'); return; }
    container.innerHTML = ''; // clear

    Object.entries(data).forEach(([folder, items]) => {
      // Folder header
      const fld = document.createElement('div');
      fld.className = 'folder';

      // expanded?
      const isExpanded = expandedFolders.has(folder);

      // Arrow
      const arrow = document.createElement('span');
      arrow.className = 'arrow';
      arrow.textContent = isExpanded ? '▼' : '▶';
      fld.appendChild(arrow);

      // Title
      const title = document.createElement('span');
      title.textContent = folder;
      title.className   = 'folder-title';
      fld.appendChild(title);

      // Add item
      const addBtn = document.createElement('button');
      addBtn.textContent = '+';
      addBtn.title       = 'Add item to ' + folder;
      addBtn.className   = 'folder-add';
      fld.appendChild(addBtn);

      // Delete folder
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '🗑️';
      removeBtn.className   = 'folder-remove';
      fld.appendChild(removeBtn);

      removeBtn.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (!confirm(`Delete folder “${folder}” and all its items?`)) return;
        delete lockersData[folder];
        expandedFolders.delete(folder);
        renderLockers(lockersData);
        set(ref(db, 'lockers'), lockersData).catch(console.error);
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

      // Add row to this folder
      addBtn.onclick = () => {
        items.push({ name: '', quantity: 0 });
        expandedFolders.add(folder);
        renderLockers(lockersData);
        set(lockersRef, lockersData).catch(console.error);
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
          set(lockersRef, lockersData);
        });
        row.appendChild(del);

        // Name
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = item.name;
        nameInput.placeholder = 'Item name';
        nameInput.onchange = () => {
          items[i].name = nameInput.value;
          set(lockersRef, lockersData);
        };
        row.appendChild(nameInput);

        // Minus
        const minus = document.createElement('button');
        minus.textContent = '–';
        minus.addEventListener('pointerdown', e => {
          e.preventDefault();
          item.quantity = Math.max(0, (item.quantity || 0) - 1);
          row.querySelector('input[type=number]').value = item.quantity;
          set(lockersRef, lockersData);
        });
        row.appendChild(minus);

        // Quantity
        const qty = document.createElement('input');
        qty.type = 'number';
        qty.min = 0;
        qty.value = item.quantity;
        qty.onchange = () => {
          items[i].quantity = parseInt(qty.value) || 0;
          set(lockersRef, lockersData);
        };
        row.appendChild(qty);

        // Plus
        const plus = document.createElement('button');
        plus.textContent = '+';
        plus.addEventListener('pointerdown', e => {
          e.preventDefault();
          item.quantity = (item.quantity || 0) + 1;
          qty.value = item.quantity;
          set(lockersRef, lockersData);
        });
        row.appendChild(plus);

        list.appendChild(row);
      });
    });
  }
}
