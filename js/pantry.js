// ─── Imports ────────────────────────────────────────────────────────────
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import { getDatabase, ref, onValue, set } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';

// ─── Firebase config (reuse your existing config) ───────────────────────
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
const btnSignIn    = document.getElementById('sign-in');
const btnSignOut   = document.getElementById('sign-out');
const signedInDiv  = document.getElementById('signed-in');
const userEmailSpan= document.getElementById('user-email');

// ─── Auth observer ─────────────────────────────────────────────────────
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

// ─── Sign-in/out handlers ─────────────────────────────────────────────
btnSignIn.onclick  = () => signInWithPopup(auth, provider);
btnSignOut.onclick = () => signOut(auth);

// ─── Main setup once authenticated ────────────────────────────────────
function setupPantryListeners() {
  const pantryRef = ref(db, 'pantry');
  let pantryData = {};        // { folderName: [items] }

  // Listen for data changes
  onValue(pantryRef, snap => {
    pantryData = snap.val() || {};
    renderPantry(pantryData);
  });

  // Add a new folder
  document.getElementById('add-folder').onclick = () => {
    const name = prompt('New folder name:');
    if (!name) return;
    pantryData[name] = pantryData[name] || [];
    set(pantryRef, pantryData);
  };

  // Render function
  function renderPantry(data) {
    const container = document.getElementById('pantry-container');
    container.innerHTML = '';   // clear

    // For each folder
    Object.entries(data).forEach(([folder, items]) => {
      // Folder header
      const fld = document.createElement('div');
      fld.className = 'folder';

      const arrow = document.createElement('span');
      arrow.textContent = '▶';
      arrow.className   = 'arrow';
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

      container.appendChild(fld);

      // Items list (initially hidden)
      const list = document.createElement('div');
      list.className = 'folder-items';
      list.style.display = 'none';
      container.appendChild(list);

      // Toggle collapse
      arrow.onclick = () => {
        const showing = list.style.display === 'block';
        arrow.textContent = showing ? '▶' : '▼';
        list.style.display = showing ? 'none' : 'block';
      };

      // Add item in this folder
      addBtn.onclick = () => {
        items.push({ name: '', quantity: 0 });
        set(pantryRef, pantryData);
      };

      // Render each item row
      items.forEach((item, i) => {
        const row = document.createElement('div');
        row.className = 'row';

        // Delete
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
        nameInput.value = item.name;
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
          row.querySelector('input[type=number]').value = item.quantity;
          set(pantryRef, pantryData);
        });
        row.appendChild(minus);

        // Quantity
        const qty = document.createElement('input');
        qty.type = 'number';
        qty.min = 0;
        qty.value = item.quantity;
        qty.onchange = () => {
          items[i].quantity = parseInt(qty.value) || 0;
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

        list.appendChild(row);
      });
    });
  }
}

