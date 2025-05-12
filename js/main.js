console.log("✅ main.js loaded");


// 1) Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import {
  getDatabase, ref, onValue, set
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js';

// ← NEW AUTH IMPORTS →
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';

// 2) Your Firebase config (from the console)
const firebaseConfig = {
  apiKey: "AIzaSyADqsTz-IHi5JvXLh1pqqFFTZT8RxfBlps",
  authDomain: "food-inventory-data-3c5cb.firebaseapp.com",
  databaseURL: "https://food-inventory-data-3c5cb-default-rtdb.firebaseio.com",
  projectId: "food-inventory-data-3c5cb",
  storageBucket: "food-inventory-data-3c5cb.appspot.com",
  messagingSenderId: "731050960925",
  appId: "1:731050960925:web:29241f709b5c94aedd3ef4"
};

// 3) Init Firebase & Database
const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ← NEW: Init Auth & UI elements →
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const btnSignIn = document.getElementById('sign-in');
const btnSignOut = document.getElementById('sign-out');
const signedInDiv = document.getElementById('signed-in');
const userEmailSpan = document.getElementById('user-email');

// 4) Auth state observer
onAuthStateChanged(auth, user => {
  if (user) {
    // show inventory UI
    btnSignIn.style.display = 'none';
    signedInDiv.style.display = 'block';
    userEmailSpan.textContent = user.email;

    // now we can listen for data
    setupDatabaseListeners();

  } else {
    // hide inventory UI
    btnSignIn.style.display = 'block';
    signedInDiv.style.display = 'none';
    document.getElementById('inventory').innerHTML = '';
  }
});

// 5) Sign-In button
btnSignIn.onclick = () => {
  signInWithPopup(auth, provider).catch(console.error);
};

// 6) Sign-Out button
btnSignOut.onclick = () => {
  signOut(auth).catch(console.error);
};

function setupDatabaseListeners() {
  // determine pageKey, itemsRef, etc.
  onValue(itemsRef, snapshot => { … });
  document.getElementById('add-row').onclick = () => { … };
  // etc.
}


// 4) Figure out which page we’re on
const pageKey = location.pathname.includes('lockers.html') ? 'lockers' : 'fridge';
const itemsRef = ref(db, pageKey);

let items = [];

// 5) Sync from Firebase
onValue(itemsRef, (snap) => {
  items = snap.val() || [];
  renderItems();
});

// 6) Add-row button
document.getElementById('add-row')
  .addEventListener('click', () => {
    console.log("🖱️ + Add Item clicked");
    items.push({ name: '', quantity: 0 });
    saveItems();
  });


// 7) Write to Firebase
function saveItems() {
  set(itemsRef, items);
}

// 8) Draw rows
function renderItems() {
  const container = document.getElementById('inventory');
  container.innerHTML = '';
  items.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'row';

    // Name
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = item.name;
    nameInput.placeholder = 'Item name';
    nameInput.onchange = () => {
      items[i].name = nameInput.value;
      saveItems();
    };
    row.appendChild(nameInput);

    // Minus
    const minus = document.createElement('button');
    minus.textContent = '–';
    minus.onclick = () => {
  // never go below zero
  items[i].quantity = Math.max(0, (items[i].quantity || 0) - 1);
  saveItems();
};

    row.appendChild(minus);

// ️ Delete button
const del = document.createElement('button');
del.textContent = '🗑️';
del.title = 'Remove this item';
del.onclick = () => {
  items.splice(i, 1);  // remove this item
  saveItems();
};
// insert delete button at the very start of the row
row.insertBefore(del, row.firstChild);


    // Quantity
    const qty = document.createElement('input');
    qty.type = 'number';
    qty.min = 0;
    qty.value = item.quantity;
    qty.onchange = () => {
      items[i].quantity = parseInt(qty.value) || 0;
      saveItems();
    };
    row.appendChild(qty);

    // Plus
    const plus = document.createElement('button');
    plus.textContent = '+';
    plus.onclick = () => {
      items[i].quantity = (items[i].quantity || 0) + 1;
      saveItems();
    };
    row.appendChild(plus);

    container.appendChild(row);
  });
}

