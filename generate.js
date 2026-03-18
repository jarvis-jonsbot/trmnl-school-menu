#!/usr/bin/env node
/**
 * Fetches today's (or next school day's) breakfast & lunch menus from HealthePro
 * and generates a static index.html sized for TRMNL (800x480, e-ink friendly).
 *
 * Run via GitHub Actions daily, output committed to gh-pages branch.
 */

const fs = require('fs');

const ORG_ID = 1184;
const BREAKFAST_MENU_ID = 103752;
const LUNCH_MENU_ID = 103751;
const TZ = 'America/Los_Angeles';

/** Get YYYY-MM-DD string in Pacific time */
function pacificDateStr(date) {
  return date.toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Get year/month in Pacific time */
function pacificYearMonth(date) {
  const dateStr = pacificDateStr(date); // YYYY-MM-DD
  const [year, month] = dateStr.split('-').map(Number);
  return { year, month };
}

/**
 * Fetch all menu entries for a given year/month.
 */
async function fetchMonthEntries(menuId, year, month) {
  const res = await fetch(
    `https://menus.healthepro.com/api/organizations/${ORG_ID}/menus/${menuId}/year/${year}/month/${month}/date_overwrites`
  );
  const data = await res.json();
  return data.data || [];
}

/**
 * Parse a menu entry's setting into { categories, noSchool, noSchoolReason }.
 */
function parseSetting(entry) {
  let setting;
  try { setting = JSON.parse(entry.setting); } catch { return null; }

  if (setting.days_off?.status) {
    return { categories: [], noSchool: true, noSchoolReason: setting.days_off.description || 'No school today' };
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
  return { categories, noSchool: false };
}

/** Get Pacific hour (0-23) */
function pacificHour(date) {
  return parseInt(date.toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }));
}

/**
 * Find the target date: today if there's a menu, otherwise the next school day.
 * After 5 PM PT, flips to show tomorrow's menu so families can plan ahead.
 * Returns { dateStr, isToday, isTomorrow, displayDate, entries: { breakfast, lunch } }
 */
async function findTargetMenu() {
  const now = new Date();
  const todayStr = pacificDateStr(now);
  const { year, month } = pacificYearMonth(now);

  // After 1 PM PT, show tomorrow's menu so families can plan ahead before school pickup
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = pacificDateStr(tomorrow);
  const cutoffStr = pacificHour(now) >= 13 ? tomorrowStr : todayStr;

  // Fetch both menus for this month (and next if needed)
  async function getEntriesForMenus(yr, mo) {
    const [bEntries, lEntries] = await Promise.all([
      fetchMonthEntries(BREAKFAST_MENU_ID, yr, mo),
      fetchMonthEntries(LUNCH_MENU_ID, yr, mo),
    ]);
    return { bEntries, lEntries };
  }

  let { bEntries, lEntries } = await getEntriesForMenus(year, month);

  // Also fetch next month if we might need it (last week of month)
  const dayOfMonth = parseInt(todayStr.split('-')[2]);
  let nextMonthData = null;
  if (dayOfMonth >= 25) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    nextMonthData = await getEntriesForMenus(nextYear, nextMonth);
    bEntries = [...bEntries, ...nextMonthData.bEntries];
    lEntries = [...lEntries, ...nextMonthData.lEntries];
  }

  // Find all dates that have a real menu (not a day-off, not empty)
  const menuDates = new Set();
  for (const e of bEntries) {
    const parsed = parseSetting(e);
    if (parsed && !parsed.noSchool && parsed.categories.length > 0) menuDates.add(e.day);
  }
  for (const e of lEntries) {
    const parsed = parseSetting(e);
    if (parsed && !parsed.noSchool && parsed.categories.length > 0) menuDates.add(e.day);
  }

  // Find target date: today (or tomorrow after 5 PM) or next available school day
  const sortedDates = [...menuDates].sort();
  const targetDate = sortedDates.find(d => d >= cutoffStr) || cutoffStr;
  const isToday = targetDate === todayStr;
  const isTomorrow = targetDate === tomorrowStr;

  const bEntry = bEntries.find(e => e.day === targetDate);
  const lEntry = lEntries.find(e => e.day === targetDate);

  return {
    dateStr: targetDate,
    isToday,
    isTomorrow,
    breakfast: bEntry ? parseSetting(bEntry) : { categories: [], noSchool: false, noEntry: true },
    lunch: lEntry ? parseSetting(lEntry) : { categories: [], noSchool: false, noEntry: true },
  };
}

function renderSection(label, emoji, menu) {
  if (!menu || menu.noEntry || menu.categories.length === 0) {
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

  const rows = menu.categories.map(cat => `
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
  const { dateStr, isToday, isTomorrow, breakfast, lunch } = await findTargetMenu();

  // Format the display date in Pacific time
  const [yr, mo, dy] = dateStr.split('-').map(Number);
  const menuDate = new Date(yr, mo - 1, dy, 12, 0, 0); // noon local, avoids DST edge
  const dayLabel = menuDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const heading = isToday ? `Today — ${dayLabel}` : isTomorrow ? `Tomorrow — ${dayLabel}` : `Coming up — ${dayLabel}`;

  const bSection = renderSection('Breakfast', '🍳', breakfast);
  const lSection = renderSection('Lunch', '🍽️', lunch);

  const updatedAt = new Date().toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=800">
  <title>Roy Cloud Menu — ${dayLabel}</title>
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
    <span class="date">${heading}</span>
  </header>
  <div class="menus">
    ${bSection}
    ${lSection}
  </div>
  <footer>Updated ${updatedAt} PT · menus.healthepro.com</footer>
</body>
</html>`;

  fs.writeFileSync('docs/index.html', html);
  console.log(`Generated docs/index.html — ${heading}`);
}

main().catch(e => { console.error(e); process.exit(1); });
