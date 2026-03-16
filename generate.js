#!/usr/bin/env node
/**
 * Fetches today's breakfast & lunch menus from HealthePro and
 * generates a static index.html sized for TRMNL (800x480, e-ink friendly).
 *
 * Run via GitHub Actions daily, output committed to gh-pages branch.
 */

const fs = require('fs');

const ORG_ID = 1184;
const BREAKFAST_MENU_ID = 103752;
const LUNCH_MENU_ID = 103751;

async function fetchTodayMenu(menuId) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const dateStr = today.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

  const [metaRes, datesRes] = await Promise.all([
    fetch(`https://menus.healthepro.com/api/organizations/${ORG_ID}/menus/${menuId}`),
    fetch(`https://menus.healthepro.com/api/organizations/${ORG_ID}/menus/${menuId}/year/${year}/month/${month}/date_overwrites`),
  ]);

  const meta = await metaRes.json();
  const dates = await datesRes.json();

  const todayEntry = (dates.data || []).find(d => d.day === dateStr);
  if (!todayEntry) return { menuName: meta.data?.public_name || 'Menu', categories: [], noSchool: false, noEntry: true };

  let setting;
  try { setting = JSON.parse(todayEntry.setting); } catch { return null; }

  if (setting.days_off?.status) {
    return {
      menuName: meta.data?.public_name || 'Menu',
      categories: [],
      noSchool: true,
      noSchoolReason: setting.days_off.description || 'No school today',
    };
  }

  const categories = [];
  let currentCat = null;
  for (const item of setting.current_display || []) {
    if (item.type === 'category') {
      currentCat = { name: item.name, items: [] };
      categories.push(currentCat);
    } else if (item.type === 'recipe' && currentCat) {
      currentCat.items.push(item.name);
    }
  }

  return { menuName: meta.data?.public_name || 'Menu', categories, noSchool: false };
}

function renderSection(label, emoji, menu) {
  if (!menu || menu.noEntry) {
    return `
      <section class="menu-section">
        <h2>${emoji} ${label}</h2>
        <p class="no-menu">No menu posted</p>
      </section>`;
  }
  if (menu.noSchool) {
    return `
      <section class="menu-section">
        <h2>${emoji} ${label}</h2>
        <p class="no-school">🏫 ${menu.noSchoolReason || 'No school today'}</p>
      </section>`;
  }

  // Only show Entree + Vegetables (skip Fruit/Milk/Condiments to save space)
  const priority = ['Lunch Entree', 'Breakfast Entree', 'Entree', 'Vegetables', 'Grains'];
  const shown = menu.categories.filter(c =>
    priority.some(p => c.name.toLowerCase().includes(p.toLowerCase()))
  );
  const rest = menu.categories.filter(c =>
    !priority.some(p => c.name.toLowerCase().includes(p.toLowerCase()))
  );
  const allCats = [...shown, ...rest];

  const rows = allCats.map(cat => `
    <div class="cat-row">
      <span class="cat-name">${cat.name}</span>
      <span class="cat-items">${cat.items.join(' · ')}</span>
    </div>`).join('');

  return `
    <section class="menu-section">
      <h2>${emoji} ${label}</h2>
      ${rows}
    </section>`;
}

async function main() {
  const [breakfast, lunch] = await Promise.all([
    fetchTodayMenu(BREAKFAST_MENU_ID),
    fetchTodayMenu(LUNCH_MENU_ID),
  ]);

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'America/Los_Angeles',
  });

  const bSection = renderSection('Breakfast', '🍳', breakfast);
  const lSection = renderSection('Lunch', '🍽️', lunch);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=800">
  <title>Roy Cloud Menu — ${dateLabel}</title>
  <style>
    /* TRMNL target: 800x480px, e-ink (black & white) */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 800px;
      height: 480px;
      overflow: hidden;
      font-family: 'Georgia', serif;
      background: #fff;
      color: #000;
      display: flex;
      flex-direction: column;
      padding: 16px 20px 12px;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    header h1 { font-size: 22px; font-weight: bold; letter-spacing: 0.5px; }
    header .date { font-size: 13px; color: #333; }
    .menus {
      display: flex;
      gap: 20px;
      flex: 1;
      overflow: hidden;
    }
    .menu-section {
      flex: 1;
      border: 1px solid #ccc;
      border-radius: 6px;
      padding: 10px 12px;
      overflow: hidden;
    }
    .menu-section h2 {
      font-size: 15px;
      font-weight: bold;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
      margin-bottom: 8px;
    }
    .cat-row {
      margin-bottom: 6px;
      font-size: 12px;
      line-height: 1.4;
    }
    .cat-name {
      display: block;
      font-weight: bold;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #555;
    }
    .cat-items {
      display: block;
      font-size: 13px;
    }
    .no-menu, .no-school {
      font-size: 14px;
      color: #666;
      font-style: italic;
      padding-top: 8px;
    }
    footer {
      font-size: 10px;
      color: #999;
      text-align: right;
      padding-top: 6px;
      border-top: 1px solid #eee;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <header>
    <h1>🏫 Roy Cloud School Menu</h1>
    <span class="date">${dateLabel}</span>
  </header>
  <div class="menus">
    ${bSection}
    ${lSection}
  </div>
  <footer>Updated ${new Date().toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' })} PT · menus.healthepro.com</footer>
</body>
</html>`;

  fs.writeFileSync('docs/index.html', html);
  console.log(`Generated docs/index.html for ${dateLabel}`);
}

main().catch(e => { console.error(e); process.exit(1); });
