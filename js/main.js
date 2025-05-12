// ─────────────────────────────────────────────────────────────────
// 1) Imports
// ─────────────────────────────────────────────────────────────────
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
// 2) Firebase config
// ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyADqsTz-IHi5JvXLh1pqqFFTZT8RxfBlps",
  authDomain: "food-inventory-data-3c5cb.firebaseapp.com",
  databaseURL: "https://food-inventory-data-3c5cb-default-rtdb.firebaseio.com",
  projectId: "food-inventory-data-3c5cb",
  storageBucket: "food-inventory-data-3c5cb.appspot.com",
  messagingSenderId: "731050960925",
  appId: "1:731050960925:web:29241f709b5c94aedd3ef4"
};

// ─────────────────────────────────────────────────────────────────
// 3) Initialize Firebase & Services
// ─────────────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ─────────────────────────────────────────────────────────────────
// 4) Cache your DOM elements for Auth
// ─────────────────────────────────────────────────────────────────
const btnSignIn    = document.getElementById('sign-in');
const btnSignOut   = document.getElementById('sign-out');
const signedInDiv  = document.getElementById('signed-in');
const userEmailSpan= document.getElementById('user-email');

// ─────────────────────────────────────────────────────────────────
// 5) Auth state observer
// ─────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (user) {
    // Show the inventory UI
    btnSignIn.style.display    = 'none';
    signedInDiv.style.display  = 'block';
    userEmailSpan.textContent  = user.email;

    // Now that we’re authenticated, hook up the database
    setupDatabaseListeners();
  } else {
    // Hide it
    btnSignIn.style.display    = 'block';
    signedInDiv.style.display  = 'none';
    document.getElementById('inventory').innerHTML = '';
  }
});

// ─────────────────────────────────────────────────────────────────
// 6) Sign-in & Sign-out handlers
// ─────────────────────────────────────────────────────────────────
btnSignIn.onclick = () => {
  signInWithPopup(auth, provider).catch(console.error);
};
btnSignOut.onclick = () => {
  signOut(auth).catch(console.error);
};

// ─────────────────────────────────────────────────────────────────
// 7) Set up your database listeners and UI only after auth
// ─────────────────────────────────────────────────────────────────
function setupDatabaseListeners() {
  // Determine which “page” we’re on
  const pageKey = location.pathname.includes('lockers.html') ? 'lockers' : 'fridge';
  const itemsRef = ref(db, pageKey);
  let items = [];

  // Listen for data
  onValue(itemsRef, snap => {
    items = snap.val() || [];
    renderItems();
  });

  // Add-row button
  document.getElementById('add-row').onclick = () => {
    items.push({ name: '', quantity: 0 });
    set(itemsRef, items);
  };

  // Render function
  function renderItems() {
    const container = document.getElementById('inventory');
    container.innerHTML = '';

    items.forEach((item, i) => {

