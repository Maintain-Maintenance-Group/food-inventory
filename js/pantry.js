import { mountInventoryPage } from './inventory.js';
mountInventoryPage({ dbRoot: 'pantry', containerId: 'pantry-container' });

import { mountInventoryPage } from './inventory.js';
import { fetchAllInventory, generateDailyMealPlan } from './meal_suggest.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js';

mountInventoryPage({ dbRoot: 'pantry', containerId: 'pantry-container' });

// Dev preview of the SMS text
window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('preview-meal-text');
  const pre = document.getElementById('meal-text');
  if (!btn || !pre) return;
  btn.addEventListener('click', async () => {
    const db = getDatabase();
    const all = await fetchAllInventory(db);
    const plan = generateDailyMealPlan(all);
    pre.textContent = plan.text;
    pre.style.display = 'block';
  });
});
