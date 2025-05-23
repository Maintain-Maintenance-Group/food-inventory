

// ─── Imports ─────────────────────────────────────────────────────────────
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import {
  getDatabase,
  ref,
  onValue,
  set
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
// ─────────────────────────────────────────────────────────────────
// Disable double-tap-to-zoom but keep pinch-to-zoom
// ─────────────────────────────────────────────────────────────────
let lastTouchEnd = 0;
document.addEventListener('touchend', function(event) {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    // second tap within 300ms → prevent zoom
    event.preventDefault();
  }
  lastTouchEnd = now;
}, false);

// ─── Allowed users ────────────────────────────────────────────────────────
const allowedEmails = [
  "letsgotomikeys@gmail.com",
  "maddylawn@gmail.com",
  "mikeandmadisonlawn@gmail.com"
];

// ─── Firebase config ────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyADqsTz-IHi5JvXLh1pqqFFTZT8RxfBlps",
  authDomain: "food-inventory-data-3c5cb.firebaseapp.com",
  databaseURL: "https://food-inventory-data-3c5cb-default-rtdb.firebaseio.com",
  projectId: "food-inventory-data-3c5cb",
  storageBucket: "food-inventory-data-3c5cb.appspot.com",
  messagingSenderId: "731050960925",
  appId: "1:731050960925:web:29241f709b5c94aedd3ef4"
};

// ─── Initialize services ─────────────────────────────────────────────────
const app      = initializeApp(firebaseConfig);
const db       = getDatabase(app);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

// ─── Cache DOM elements ───────────────────────────────────────────────────
const btnSignIn   = document.getElementById('sign-in');
const btnSignOut  = document.getElementById('sign-out');
const signedInDiv = document.getElementById('signed-in');
const userEmail   = document.getElementById('user-email');

// ─── Auth state listener ──────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  const addBtn = document.getElementById('add-row');

  if (user) {
    // ❓ New check: is this user’s email in the allowed list?
    if (!allowedEmails.includes(user.email)) {
      alert("⛔️ You (“" + user.email + "”) are not authorized here.");
      signOut(auth);      // kick them back out
      return;             // stop running the rest of this block
    }

    // ——— If we get here, they ARE allowed — show the UI:
    btnSignIn.style.display   = 'none';
    signedInDiv.style.display = 'block';
    userEmail.textContent     = user.email;
    addBtn.style.display      = 'inline-block';
    setupDatabaseListeners();

  } else {
    // when they sign out, hide everything again
    btnSignIn.style.display   = 'block';
    signedInDiv.style.display = 'none';
    addBtn.style.display      = 'none';
    document.getElementById('inventory').innerHTML = '';
  }
});


// ─── Sign-in / Sign-out handlers ──────────────────────────────────────────
btnSignIn.onclick  = () => signInWithPopup(auth, provider).catch(console.error);
btnSignOut.onclick = () => signOut(auth).catch(console.error);

// ─── Only after auth: database + UI setup ─────────────────────────────────
function setupDatabaseListeners() {
  console.log('✅ setupDatabaseListeners running');
  const pageKey  = location.pathname.includes('lockers.html') ? 'lockers' : 'fridge';
  const itemsRef = ref(db, pageKey);
  let items = [];

  // Listen for real-time data changes
  onValue(itemsRef, snap => {
    items = snap.val() || [];
    renderItems();
  });

  // Wire the +Add Item button
  const addBtn = document.getElementById('add-row');
  addBtn.onclick = () => {
    console.log('🖱️ + Add Item clicked');
    items.push({ name: '', quantity: 0 });
    set(itemsRef, items)
      .then(() => console.log('✅ item saved'))
      .catch(console.error);
  };

  // Renders the list
  function renderItems() {
    const container = document.getElementById('inventory');
    container.innerHTML = '';  // clear old rows

    items.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'row';

      // Delete button
      const del = document.createElement('button');
      del.textContent = '🗑️';
      del.classList.add('delete-btn');
      del.onclick = () => {
        items.splice(i, 1);
        set(itemsRef, items);
      };
      row.appendChild(del);

      // Name field
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = item.name;
      nameInput.placeholder = 'Item name';
      nameInput.onchange = () => {
        items[i].name = nameInput.value;
        set(itemsRef, items);
      };
      row.appendChild(nameInput);

              // Minus button
      const minus = document.createElement('button');
      minus.textContent = '–';
      minus.addEventListener('pointerdown', event => {
        event.preventDefault(); // remove the 300ms delay
        items[i].quantity = Math.max(0, (items[i].quantity || 0) - 1);
        qty.value = items[i].quantity;                   // update UI immediately
        set(itemsRef, items).catch(console.error);        // save in background
      });
      row.appendChild(minus);

      // Quantity input
      const qty = document.createElement('input');
      qty.type = 'number';
      qty.min = 0;
      qty.value = item.quantity;
      qty.onchange = () => {
        items[i].quantity = parseInt(qty.value) || 0;
        set(itemsRef, items).catch(console.error);
      };
      row.appendChild(qty);

      // Plus button
      const plus = document.createElement('button');
      plus.textContent = '+';
      plus.addEventListener('pointerdown', event => {
        event.preventDefault();
        items[i].quantity = (items[i].quantity || 0) + 1;
        qty.value = items[i].quantity;
        set(itemsRef, items).catch(console.error);
      });
      row.appendChild(plus);

      container.appendChild(row);
    });
  }
}

