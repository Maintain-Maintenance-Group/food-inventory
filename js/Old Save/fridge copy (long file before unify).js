// Fridge: same UI/logic as Pantry, but DB path = 'fridge'

// Firebase imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import { getDatabase, ref, onValue, set } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';

// Keep which folders are currently open
const expandedFolders = new Set();

// Firebase config (same as Pantry)
const firebaseConfig = {
  apiKey: "AIzaSyADqsTz-IHi5JvXLh1pqqFFTZT8RxfBlps",
  authDomain: "food-inventory-data-3c5cb.firebaseapp.com",
  databaseURL: "https://food-inventory-data-3c5cb-default-rtdb.firebaseio.com",
  projectId: "food-inventory-data-3c5cb",
  storageBucket: "food-inventory-data-3c5cb.appspot.com",
  messagingSenderId: "731050960925",
  appId: "1:731050960925:web:29241f709b5c94aedd3ef4"
};

// Init Firebase
const app      = initializeApp(firebaseConfig);
const db       = getDatabase(app);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

// Auth UI elements
const btnSignIn     = document.getElementById('sign-in');
const btnSignOut    = document.getElementById('sign-out');
const signedInDiv   = document.getElementById('signed-in');
const userEmailSpan = document.getElementById('user-email');

// ---- Expiry helpers (same as Pantry) ----
function todayISO(){const d=new Date();const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');const day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
function endOfMonthISO(y,m){const last=new Date(y,Number(m),0).getDate();return `${y}-${m}-${String(last).padStart(2,'0')}`;}
function toComparableDate(iso){if(!iso)return null; if(iso.length===7){const [y,m]=iso.split('-');return endOfMonthISO(y,m);} if(iso.length===10)return iso; return null;}
function addDaysISO(iso,days){const [y,m,d]=iso.split('-').map(Number);const dt=new Date(y,m-1,d);dt.setDate(dt.getDate()+days);const yy=dt.getFullYear();const mm=String(dt.getMonth()+1).padStart(2,'0');const dd=String(dt.getDate()).padStart(2,'0');return `${yy}-${mm}-${dd}`;}
function isExpired(iso){const c=toComparableDate(iso);return c?(c<todayISO()):false;}
function isExpiringSoon(iso){const c=toComparableDate(iso);if(!c)return false;const t=todayISO();const in7=addDaysISO(t,7);return (c>=t && c<=in7);}
function applyExpiryStyle(rowEl, iso){rowEl.classList.toggle('expired', isExpired(iso));rowEl.classList.toggle('expiring-soon', !isExpired(iso) && isExpiringSoon(iso));}
function formatISOforDisplay(iso){if(!iso)return '';const p=iso.split('-');if(p.length===2){const [y,m]=p;return `${m}-${y.slice(2)}`;} if(p.length===3){const [y,m,d]=p;return `${m}-${d}-${y.slice(2)}`;} return '';}
function parseDisplayToISO(input){
  if(!input) return '';
  const digits = input.replace(/[^\d]/g,'');
  if(digits.length===4){const mm=digits.slice(0,2),yy=digits.slice(2,4);return `20${yy}-${mm}`;}
  if(digits.length===6){const mm=digits.slice(0,2),dd=digits.slice(2,4),yy=digits.slice(4,6);return `20${yy}-${mm}-${dd}`;}
  if(digits.length===8){const mm=digits.slice(0,2),dd=digits.slice(2,4),yyyy=digits.slice(4,8);return `${yyyy}-${mm}-${dd}`;}
  if(digits.length===6){const yyyy=digits.slice(0,4),mm=digits.slice(4,6);return `${yyyy}-${mm}`;}
  if(digits.length===8){const yyyy=digits.slice(0,4),mm=digits.slice(4,6),dd=digits.slice(6,8);return `${yyyy}-${mm}-${dd}`;}
  return '';
}
function maskExpiryInput(raw){
  const digits = raw.replace(/[^\d]/g,'').slice(0,8);
  if(digits.length<=2) return digits;
  if(digits.length<=4) return digits.slice(0,2)+'-'+digits.slice(2);
  if(digits.length<=6) return digits.slice(0,2)+'-'+digits.slice(2,4)+'-'+digits.slice(4);
  return digits.slice(0,2)+'-'+digits.slice(2,4)+'-'+digits.slice(4,8);
}

// Auth observer
onAuthStateChanged(auth, user => {
  const addFolderBtn = document.getElementById('add-folder');
  const container    = document.getElementById('fridge-container');
  if (user) {
    btnSignIn.style.display    = 'none';
    signedInDiv.style.display  = 'block';
    userEmailSpan.textContent  = user.email;
    addFolderBtn.style.display = 'inline-block';
    container.style.display    = 'block';
    setupListeners();
  } else {
    btnSignIn.style.display    = 'block';
    signedInDiv.style.display  = 'none';
    addFolderBtn.style.display = 'none';
    container.style.display    = 'none';
  }
});
btnSignIn.onclick  = () => signInWithPopup(auth, provider);
btnSignOut.onclick = () => signOut(auth);

// Main
function setupListeners() {
  const rootRef = ref(db, 'fridge'); // <— DB path for this page
  let data = {}; // { folderName: [ {name, quantity, expires?, level?} ] }

  onValue(rootRef, snap => { data = snap.val() || {}; render(data); });

  document.getElementById('add-folder').onclick = () => {
    const name = prompt('New folder name:');
    if (!name) return;
    data[name] = data[name] || [];
    expandedFolders.add(name);
    render(data);
    set(rootRef, data).catch(console.error);
  };

  function render(state) {
    const container = document.getElementById('fridge-container');
    container.innerHTML = '';

    Object.entries(state).forEach(([folder, items]) => {
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

      removeBtn.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (!confirm(`Delete folder “${folder}” and all its items?`)) return;
        delete state[folder];
        expandedFolders.delete(folder);
        render(state);
        set(rootRef, state).catch(console.error);
      });

      container.appendChild(fld);

      const list = document.createElement('div');
      list.className     = 'folder-items';
      list.style.display = isExpanded ? 'block' : 'none';
      container.appendChild(list);

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

      addBtn.onclick = () => {
        items.push({ name: '', quantity: 0, expires: '', level: null });
        expandedFolders.add(folder);
        render(state);
        set(rootRef, state).catch(console.error);
      };

      items.forEach((item, i) => {
        const row = document.createElement('div');
        row.className = 'row';

        const del = document.createElement('button');
        del.textContent = '🗑️';
        del.classList.add('delete-btn');
        del.addEventListener('pointerdown', e => {
          e.preventDefault();
          items.splice(i, 1);
          set(rootRef, state);
        });
        row.appendChild(del);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = item.name || '';
        nameInput.placeholder = 'Item name';
        nameInput.onchange = () => { items[i].name = nameInput.value; set(rootRef, state); };
        row.appendChild(nameInput);

        const minus = document.createElement('button');
        minus.textContent = '–';
        minus.addEventListener('pointerdown', e => {
          e.preventDefault();
          item.quantity = Math.max(0, (item.quantity || 0) - 1);
          qty.value = item.quantity;
          set(rootRef, state);
        });
        row.appendChild(minus);

        const qty = document.createElement('input');
        qty.type = 'number';
        qty.min = 0;
        qty.value = item.quantity || 0;
        qty.onchange = () => { items[i].quantity = parseInt(qty.value, 10) || 0; set(rootRef, state); };
        row.appendChild(qty);

        const plus = document.createElement('button');
        plus.textContent = '+';
        plus.addEventListener('pointerdown', e => {
          e.preventDefault();
          item.quantity = (item.quantity || 0) + 1;
          qty.value = item.quantity;
          set(rootRef, state);
        });
        row.appendChild(plus);

        // Level buttons
        const levelGroup = document.createElement('span');
        levelGroup.className = 'level-group';
        [{key:'empty',label:'Empty'},{key:'half',label:'Half'},{key:'full',label:'Full'}].forEach(({key,label})=>{
          const b=document.createElement('button');
          b.type='button'; b.className='level-btn'; b.dataset.level=key; b.textContent=label;
          if (item.level === key) b.classList.add('active');
          b.addEventListener('pointerdown', e => {
            e.preventDefault();
            levelGroup.querySelectorAll('.level-btn').forEach(x=>x.classList.remove('active'));
            b.classList.add('active');
            items[i].level = key;
            set(rootRef, state);
          });
          levelGroup.appendChild(b);
        });
        row.appendChild(levelGroup);

        // EXP field
        const expGroup = document.createElement('span');
        expGroup.className = 'exp-group';

        const expLabel = document.createElement('span');
        expLabel.textContent = 'EXP';
        expLabel.className = 'exp-label';
        expGroup.appendChild(expLabel);

        const exp = document.createElement('input');
        exp.type='text'; exp.inputMode='numeric'; exp.placeholder='MM-DD-YY'; exp.maxLength=12;
        exp.className='exp-input'; exp.style.width='12ch';
        exp.value = formatISOforDisplay(item.expires || '');
        exp.addEventListener('input', () => { exp.value = maskExpiryInput(exp.value); });
        exp.addEventListener('change', () => {
          const iso = parseDisplayToISO(exp.value);
          items[i].expires = iso;
          set(rootRef, state);
          applyExpiryStyle(row, items[i].expires);
        });
        expGroup.appendChild(exp);
        row.appendChild(expGroup);

        applyExpiryStyle(row, item.expires);
        list.appendChild(row);
      });
    });
  }
}
