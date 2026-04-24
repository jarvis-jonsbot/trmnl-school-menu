#!/usr/bin/env node
/**
 * Fetches today's (or next school day's) breakfast & lunch menus from HealthePro
 * and generates a static index.html sized for TRMNL (800x480, e-ink friendly).
 *
 * Randomly picks one of three layout themes each run for variety.
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
 * After 1 PM PT, flips to show tomorrow's menu so families can plan ahead.
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
  if (dayOfMonth >= 25) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthData = await getEntriesForMenus(nextYear, nextMonth);
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

  // Find target date: today (or tomorrow after 1 PM) or next available school day
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

// ─── Theme A: Stacked rows, left-bordered meal blocks ────────────────────────

function buildHtml_A({ heading, dayLabel, breakfast, lunch, updatedAt }) {
  function renderMeal(label, emoji, menu) {
    if (!menu || menu.noEntry || menu.categories.length === 0) {
      return `<div class="meal-block"><div class="meal-title">${emoji} ${label}</div><p class="no-menu">No menu posted</p></div>`;
    }
    if (menu.noSchool) {
      return `<div class="meal-block"><div class="meal-title">${emoji} ${label}</div><p class="no-menu">🏫 ${menu.noSchoolReason || 'No school today'}</p></div>`;
    }
    const rows = menu.categories.map(cat => `
      <div class="cat-row">
        <span class="cat-name">${cat.name}</span>
        <span class="cat-items">${cat.items.join(' · ')}</span>
      </div>`).join('');
    return `<div class="meal-block"><div class="meal-title">${emoji} ${label}</div><div class="cat-rows">${rows}</div></div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=800">
  <title>Roy Cloud Menu — ${dayLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 800px; height: 480px;
      background: #fff; color: #000;
      font-family: Georgia, serif;
      overflow: hidden;
      display: flex; flex-direction: column;
      padding: 14px 20px 10px;
    }
    .header {
      display: flex; justify-content: space-between; align-items: baseline;
      border-bottom: 3px solid #000;
      padding-bottom: 8px; margin-bottom: 12px;
    }
    .school { font-size: 22px; font-weight: bold; letter-spacing: 0.02em; text-transform: uppercase; }
    .date-label { font-size: 14px; font-style: italic; }
    .meals { display: flex; flex-direction: column; gap: 10px; flex: 1; }
    .meal-block { border-left: 4px solid #000; padding-left: 12px; }
    .meal-title { font-size: 13px; font-weight: bold; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 6px; }
    .cat-rows { display: flex; flex-direction: column; gap: 3px; }
    .cat-row { display: flex; font-size: 13px; line-height: 1.4; }
    .cat-name { font-weight: bold; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; min-width: 72px; padding-top: 1px; flex-shrink: 0; }
    .cat-items { flex: 1; }
    .divider { border: none; border-top: 1px solid #000; margin: 4px 0; }
    .no-menu { font-size: 13px; font-style: italic; }
    footer { font-size: 10px; text-align: right; border-top: 1px solid #000; padding-top: 5px; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="header">
    <span class="school">Roy Cloud School</span>
    <span class="date-label">${heading}</span>
  </div>
  <div class="meals">
    ${renderMeal('Breakfast', '🍳', breakfast)}
    <hr class="divider">
    ${renderMeal('Lunch', '🍽️', lunch)}
  </div>
  <footer>Updated ${updatedAt} PT &bull; menu.ulfhedinn.net</footer>
</body>
</html>`;
}

// ─── Theme B: Big entree focus, sides condensed ───────────────────────────────

function buildHtml_B({ heading, dayLabel, breakfast, lunch, updatedAt }) {
  function splitMenu(menu) {
    if (!menu || menu.noEntry || menu.noSchool || menu.categories.length === 0) return { entrees: [], sides: [] };
    const entrees = [];
    const sides = [];
    for (const cat of menu.categories) {
      if (/entree/i.test(cat.name)) {
        entrees.push(...cat.items);
      } else {
        sides.push(...cat.items);
      }
    }
    return { entrees, sides };
  }

  function renderCol(label, emoji, menu) {
    if (!menu || menu.noEntry || menu.categories.length === 0) {
      return `<div class="col"><div class="col-title">${emoji} ${label}</div><p class="no-menu">No menu posted</p></div>`;
    }
    if (menu.noSchool) {
      return `<div class="col"><div class="col-title">${emoji} ${label}</div><p class="no-menu">🏫 ${menu.noSchoolReason || 'No school today'}</p></div>`;
    }
    const { entrees, sides } = splitMenu(menu);
    const entreeHtml = entrees.map(e => `<div class="entree-item">${e}</div>`).join('');
    const sidesHtml = sides.length
      ? `<div class="also-label">Also available</div><div class="also-items">${sides.join(' · ')}</div>`
      : '';
    return `
      <div class="col">
        <div class="col-title">${emoji} ${label}</div>
        <div class="entrees">${entreeHtml}</div>
        ${sidesHtml}
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=800">
  <title>Roy Cloud Menu — ${dayLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 800px; height: 480px;
      background: #fff; color: #000;
      font-family: Georgia, serif;
      overflow: hidden;
      display: flex; flex-direction: column;
      padding: 14px 20px 10px;
    }
    .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 14px; }
    .day { font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase; font-weight: bold; }
    .school { font-size: 18px; font-style: italic; }
    .cols { display: flex; gap: 0; flex: 1; }
    .col { flex: 1; display: flex; flex-direction: column; padding: 0 16px; }
    .col:first-child { border-right: 2px solid #000; padding-left: 0; }
    .col:last-child { padding-right: 0; }
    .col-title { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 10px; }
    .entrees { flex: 1; display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .entree-item { font-size: 20px; line-height: 1.25; font-weight: bold; }
    .also-label { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; border-top: 1px dashed #000; padding-top: 6px; }
    .also-items { font-size: 13px; line-height: 1.5; }
    .no-menu { font-size: 13px; font-style: italic; }
    footer { font-size: 10px; text-align: right; border-top: 1px solid #000; padding-top: 5px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="day">${heading}</div>
    <div class="school">Roy Cloud School</div>
  </div>
  <div class="cols">
    ${renderCol('Breakfast', '🍳', breakfast)}
    ${renderCol('Lunch', '🍽️', lunch)}
  </div>
  <footer>Updated ${updatedAt} PT &bull; menu.ulfhedinn.net</footer>
</body>
</html>`;
}

// ─── Theme C: Monospace table, pure black ────────────────────────────────────

function buildHtml_C({ heading, dayLabel, breakfast, lunch, updatedAt }) {
  function renderMeal(label, menu) {
    if (!menu || menu.noEntry || menu.categories.length === 0) {
      return `<div class="cat-rows"><div class="cat-row"><span class="cat-name">Info</span><span class="sep">|</span><span class="cat-items">No menu posted</span></div></div>`;
    }
    if (menu.noSchool) {
      return `<div class="cat-rows"><div class="cat-row"><span class="cat-name">Info</span><span class="sep">|</span><span class="cat-items">🏫 ${menu.noSchoolReason || 'No school today'}</span></div></div>`;
    }
    const rows = menu.categories.map(cat => `
      <div class="cat-row">
        <span class="cat-name">${cat.name}</span><span class="sep">|</span>
        <span class="cat-items">${cat.items.join(' / ')}</span>
      </div>`).join('');
    return `<div class="cat-rows">${rows}</div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=800">
  <title>Roy Cloud Menu — ${dayLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 800px; height: 480px;
      background: #fff; color: #000;
      font-family: 'Courier New', Courier, monospace;
      overflow: hidden;
      display: flex; flex-direction: column;
    }
    .top-bar {
      display: flex; justify-content: space-between; align-items: center;
      background: #000; color: #fff;
      padding: 8px 20px;
      font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: bold;
    }
    .content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .meal-section { flex: 1; display: flex; flex-direction: column; }
    .meal-section:first-child { border-bottom: 3px double #000; }
    .meal-header {
      background: #000; color: #fff;
      font-size: 11px; font-weight: bold; letter-spacing: 0.2em; text-transform: uppercase;
      padding: 3px 20px;
    }
    .cat-rows { flex: 1; display: flex; flex-direction: column; justify-content: space-evenly; padding: 3px 20px; }
    .cat-row { display: flex; font-size: 12px; line-height: 1.35; border-bottom: 1px dotted #000; padding: 2px 0; }
    .cat-row:last-child { border-bottom: none; }
    .cat-name { min-width: 80px; font-weight: bold; text-transform: uppercase; font-size: 10px; letter-spacing: 0.1em; padding-top: 1px; flex-shrink: 0; }
    .sep { margin: 0 8px; flex-shrink: 0; }
    .cat-items { flex: 1; }
    footer { font-size: 9px; text-align: right; border-top: 2px solid #000; padding: 4px 20px; letter-spacing: 0.05em; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="top-bar">
    <span>Roy Cloud School</span>
    <span>${heading}</span>
  </div>
  <div class="content">
    <div class="meal-section">
      <div class="meal-header">/// Breakfast</div>
      ${renderMeal('Breakfast', breakfast)}
    </div>
    <div class="meal-section">
      <div class="meal-header">/// Lunch</div>
      ${renderMeal('Lunch', lunch)}
    </div>
  </div>
  <footer>Updated ${updatedAt} PT &bull; menu.ulfhedinn.net</footer>
</body>
</html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { dateStr, isToday, isTomorrow, breakfast, lunch } = await findTargetMenu();

  // Format the display date in Pacific time
  const [yr, mo, dy] = dateStr.split('-').map(Number);
  const menuDate = new Date(yr, mo - 1, dy, 12, 0, 0); // noon local, avoids DST edge
  const dayLabel = menuDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const heading = isToday ? `Today — ${dayLabel}` : isTomorrow ? `Tomorrow — ${dayLabel}` : `Coming up — ${dayLabel}`;
  const updatedAt = new Date().toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });

  const themes = [buildHtml_A, buildHtml_B, buildHtml_C];
  const themeNames = ['A (stacked rows)', 'B (entree focus)', 'C (monospace)'];
  const pick = Math.floor(Math.random() * themes.length);
  const html = themes[pick]({ heading, dayLabel, breakfast, lunch, updatedAt });

  fs.writeFileSync('docs/index.html', html);
  console.log(`Generated docs/index.html — ${heading} [theme ${themeNames[pick]}]`);
}

main().catch(e => { console.error(e); process.exit(1); });
