// ─── Imports ────────────────────────────────────────────────────────────
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import { getDatabase, ref, onValue, set } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';

// Keep track of which folders are currently open
const expandedFolders = new Set();

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
  const container    = document.getElementById('fridge-container');
  if (user) {
    btnSignIn.style.display    = 'none';
    signedInDiv.style.display  = 'block';
    userEmailSpan.textContent  = user.email;
    addFolderBtn.style.display = 'inline-block';
    container.style.display    = 'block';
    setupFridgeListeners();
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

// ─── Fridge setup once authenticated ────────────────────────────────────
function setupFridgeListeners() {
  const fridgeRef = ref(db, 'fridge');
  let fridgeData = {};        // { folderName: [items] }

  // Listen for data changes
  onValue(fridgeRef, snap => {
    fridgeData = snap.val() || {};
    renderFridge(fridgeData);
  });

    // Add a new folder (with debug + immediate UI update)
  document.getElementById('add-folder').onclick = () => {
    const name = prompt('New folder name:');
    console.log('🗂️ Add folder clicked, name =', name);
    if (!name) return;

    // 1) Update local data
    fridgeData[name] = fridgeData[name] || [];

    // 2) Immediately redraw the UI so you can see it
    renderFridge(pantryData);

    // 3) Save to Firebase in the background
    set(fridgeRef, fridgeData)
      .then(() => console.log('✅ fridge saved with new folder'))
      .catch(console.error);
  };


  // Render function
  function renderFridge(data) {
    const container = document.getElementById('Fridge-container');
    container.innerHTML = '';   // clear

    // For each folder
    Object.entries(data).forEach(([folder, items]) => {
      // Folder header
      const fld = document.createElement('div');
      fld.className = 'folder';

      // Decide if this folder should start open
const isExpanded = expandedFolders.has(folder);

// Arrow icon
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

// Delete‐folder button
const removeBtn = document.createElement('button');
removeBtn.textContent = '🗑️';
removeBtn.className   = 'folder-remove';
fld.appendChild(removeBtn);

removeBtn.addEventListener('pointerdown', e => {
  e.preventDefault();
  // Ask first:
  if (!confirm(`Delete folder “${folder}” and all its items?`)) return;
  // Remove from local data
  delete fridgeData[folder];
  expandedFolders.delete(folder);
  // Update UI immediately
  renderFridge(fridgeData);
  // Persist to Firebase
  set(ref(db, 'fridge'), fridgeData).catch(console.error);
});

      container.appendChild(fld);

// The items container
const list = document.createElement('div');
list.className     = 'folder-items';
list.style.display = isExpanded ? 'block' : 'none';
container.appendChild(list);

      arrow.onclick = () => {
  const showing = list.style.display === 'block';
  if (showing) {
    // close folder
    arrow.textContent = '▶';
    list.style.display = 'none';
    expandedFolders.delete(folder);
  } else {
    // open folder
    arrow.textContent = '▼';
    list.style.display = 'block';
    expandedFolders.add(folder);
  }
};


      addBtn.onclick = () => {
  items.push({ name: '', quantity: 0 });

  // ensure this folder stays open
  expandedFolders.add(folder);

  // immediately re-render so you see the new row
  renderFridge(fridgeData);

  // then save to Firebase
  set(fridgeRef, fridgeData)
    .catch(console.error);
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
          set(pantryRef, fridgeData);
        });
        row.appendChild(del);

        // Name
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = item.name;
        nameInput.placeholder = 'Item name';
        nameInput.onchange = () => {
          items[i].name = nameInput.value;
          set(fridgeRef, fridgeData);
        };
        row.appendChild(nameInput);

        // Minus
        const minus = document.createElement('button');
        minus.textContent = '–';
        minus.addEventListener('pointerdown', e => {
          e.preventDefault();
          item.quantity = Math.max(0, (item.quantity || 0) - 1);
          row.querySelector('input[type=number]').value = item.quantity;
          set(fridgeRef, fridgeData);
        });
        row.appendChild(minus);

        // Quantity
        const qty = document.createElement('input');
        qty.type = 'number';
        qty.min = 0;
        qty.value = item.quantity;
        qty.onchange = () => {
          items[i].quantity = parseInt(qty.value) || 0;
          set(fridgeRef, fridgeData);
        };
        row.appendChild(qty);

        // Plus
        const plus = document.createElement('button');
        plus.textContent = '+';
        plus.addEventListener('pointerdown', e => {
          e.preventDefault();
          item.quantity = (item.quantity || 0) + 1;
          qty.value = item.quantity;
          set(fridgeRef, fridgeData);
        });
        row.appendChild(plus);

        list.appendChild(row);
      });
    });
  }
}

