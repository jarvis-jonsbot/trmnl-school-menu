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

/** Returns true if today is Wednesday in Pacific time */
function isTodayWednesdayPT() {
  return new Date().toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long' }) === 'Wednesday';
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

// ─── Summer Quest Board ───────────────────────────────────────────────────────

/** True if today (Pacific) is summer break: June 21 – August 31 */
function isSummer() {
  const [, m, d] = pacificDateStr(new Date()).split('-').map(Number);
  return (m === 6 && d >= 21) || m === 7 || m === 8;
}

const QUESTS = [
  // 🎨 Art & Craft
  { category: 'Art & Craft', icon: '🎨', quest: 'Draw a dragon', detail: 'Make it fierce — add treasure for it to guard!' },
  { category: 'Art & Craft', icon: '🎨', quest: 'Make a bookmark', detail: 'Decorate it for your very favorite book.' },
  { category: 'Art & Craft', icon: '🎨', quest: 'Design a superhero', detail: 'Draw their costume and invent their superpower.' },
  { category: 'Art & Craft', icon: '🎨', quest: "Draw a mermaid's house", detail: 'What furniture do mermaids have underwater?' },
  { category: 'Art & Craft', icon: '🎨', quest: 'Make a paper crown', detail: 'Decorate it with gems, stars, and anything sparkly.' },
  { category: 'Art & Craft', icon: '🎨', quest: 'Create a comic strip', detail: 'Tell a story in 4 panels. You choose the hero!' },
  { category: 'Art & Craft', icon: '🎨', quest: 'Draw a map', detail: 'Map your house or neighborhood with secret spots.' },
  { category: 'Art & Craft', icon: '🎨', quest: 'Design your dream room', detail: 'What would your perfect bedroom look like?' },
  { category: 'Art & Craft', icon: '🎨', quest: 'Make paper animals', detail: 'Fold 3 different animals and give them silly names.' },
  { category: 'Art & Craft', icon: '🎨', quest: 'Draw a magical forest', detail: 'Fill it with creatures only you can see.' },
  // 🌿 Outdoor Adventure
  { category: 'Outdoor Adventure', icon: '🌿', quest: 'Find 3 kinds of bugs', detail: 'Look under rocks, in grass, and near flowers.' },
  { category: 'Outdoor Adventure', icon: '🌿', quest: 'Collect 5 leaves', detail: 'Pick different shapes and make a collage.' },
  { category: 'Outdoor Adventure', icon: '🌿', quest: 'Cloud watch for 5 minutes', detail: 'Draw 3 shapes you spotted in the sky.' },
  { category: 'Outdoor Adventure', icon: '🌿', quest: 'Find something that smells nice', detail: 'No flowers allowed — find something surprising!' },
  { category: 'Outdoor Adventure', icon: '🌿', quest: 'Count bird sounds', detail: 'Sit quietly outside and count different calls.' },
  { category: 'Outdoor Adventure', icon: '🌿', quest: 'Build a fairy house', detail: 'Use sticks, leaves, and pebbles. Tiny furniture is a bonus!' },
  { category: 'Outdoor Adventure', icon: '🌿', quest: 'Rainbow color hunt', detail: 'Find one thing in every color of the rainbow.' },
  { category: 'Outdoor Adventure', icon: '🌿', quest: 'Find the biggest rock', detail: 'Carry it! How heavy is it? Draw it with a label.' },
  { category: 'Outdoor Adventure', icon: '🌿', quest: 'Make a mud pie', detail: 'The messier, the better. Decorate with petals.' },
  { category: 'Outdoor Adventure', icon: '🌿', quest: 'Walk Kátur an extra block', detail: 'Let him choose the direction at every corner.' },
  // 📚 Learning & Brain
  { category: 'Learning & Brain', icon: '📚', quest: 'Learn a word in a new language', detail: 'Teach it to someone before the day is over.' },
  { category: 'Learning & Brain', icon: '📚', quest: 'Read for 20 minutes', detail: 'Pick the book YOU want — no rules on which.' },
  { category: 'Learning & Brain', icon: '📚', quest: 'Write a summer poem', detail: 'It can rhyme or not. 4 lines is plenty.' },
  { category: 'Learning & Brain', icon: '📚', quest: 'Learn 5 new spelling words', detail: 'Write a sentence with each one.' },
  { category: 'Learning & Brain', icon: '📚', quest: 'Write a letter to future you', detail: 'Seal it! Open it when summer ends.' },
  { category: 'Learning & Brain', icon: '📚', quest: 'Learn 3 planet names', detail: 'Find their order from the sun. Quiz someone!' },
  { category: 'Learning & Brain', icon: '📚', quest: 'Write a story', detail: 'It must start: "One magical morning..."' },
  { category: 'Learning & Brain', icon: '📚', quest: 'Memorize a short poem', detail: 'Recite it to someone from memory.' },
  { category: 'Learning & Brain', icon: '📚', quest: 'Draw a butterfly life cycle', detail: 'Egg → caterpillar → chrysalis → butterfly.' },
  { category: 'Learning & Brain', icon: '📚', quest: 'Count to 100 by 5s', detail: 'Time yourself. Can you beat 30 seconds?' },
  // 🍳 Kitchen Magic
  { category: 'Kitchen Magic', icon: '🍳', quest: 'Make a fruit salad', detail: "Use at least 4 different fruits. You're the chef!" },
  { category: 'Kitchen Magic', icon: '🍳', quest: 'Help make breakfast', detail: 'Contribute at least one thing — eggs, toast, juice.' },
  { category: 'Kitchen Magic', icon: '🍳', quest: 'Invent a sandwich', detail: 'Name it after yourself. Write down the recipe.' },
  { category: 'Kitchen Magic', icon: '🍳', quest: 'Make lemonade', detail: 'From real lemons! Add something secret for flavor.' },
  { category: 'Kitchen Magic', icon: '🍳', quest: 'Make a smoothie', detail: 'Only 3 ingredients allowed. Make it delicious.' },
  { category: 'Kitchen Magic', icon: '🍳', quest: 'Build a snack tower', detail: 'Stack food as tall as you can — then eat it!' },
  { category: 'Kitchen Magic', icon: '🍳', quest: 'Make ants on a log', detail: 'Celery + peanut butter + raisins. Classic!' },
  { category: 'Kitchen Magic', icon: '🍳', quest: 'Set a fancy table', detail: 'Napkin folds, place cards, the works. Impress the family.' },
  { category: 'Kitchen Magic', icon: '🍳', quest: 'Make a fruit kabob', detail: 'At least 5 pieces per stick. Make 2!' },
  { category: 'Kitchen Magic', icon: '🍳', quest: 'Decorate a cookie', detail: 'Use frosting and whatever toppings you can find.' },
  // 🌟 Kindness Mission
  { category: 'Kindness Mission', icon: '🌟', quest: 'Write a love note', detail: 'Tell someone exactly what you love about them.' },
  { category: 'Kindness Mission', icon: '🌟', quest: 'Do a surprise chore', detail: "Clean something you didn't mess up. Don't tell anyone." },
  { category: 'Kindness Mission', icon: '🌟', quest: 'Give Kátur extra love', detail: 'Long belly rub, extra treats, lots of cuddles.' },
  { category: 'Kindness Mission', icon: '🌟', quest: 'Say 3 nice things', detail: 'Tell 3 different people one thing you love about them.' },
  { category: 'Kindness Mission', icon: '🌟', quest: 'Draw art for a faraway person', detail: 'Mail it or send a photo. Make their day.' },
  { category: 'Kindness Mission', icon: '🌟', quest: 'Share your favorite snack', detail: 'Offer some to everyone in the house first.' },
  { category: 'Kindness Mission', icon: '🌟', quest: 'Make a card for a grandparent', detail: 'Draw something that will make them smile.' },
  { category: 'Kindness Mission', icon: '🌟', quest: 'Say thank you creatively', detail: "No boring 'thanks' — make it funny or surprising." },
  { category: 'Kindness Mission', icon: '🌟', quest: 'Help without being asked', detail: 'Notice something that needs doing and just do it.' },
  { category: 'Kindness Mission', icon: '🌟', quest: 'Compliment a stranger', detail: "A smile counts. Make someone's day a little better." },
  // 🔬 Science & Discovery
  { category: 'Science & Discovery', icon: '🔬', quest: 'Make a rainbow', detail: 'Put a glass of water in sunlight. Catch the colors!' },
  { category: 'Science & Discovery', icon: '🔬', quest: 'Volcano time!', detail: 'Baking soda + vinegar. Add food coloring for drama.' },
  { category: 'Science & Discovery', icon: '🔬', quest: 'Test paper airplanes', detail: 'Fold 3 designs. Which one flies the farthest?' },
  { category: 'Science & Discovery', icon: '🔬', quest: 'Make oobleck', detail: 'Cornstarch + water. Is it a liquid or a solid?' },
  { category: 'Science & Discovery', icon: '🔬', quest: 'Magnet hunt', detail: 'Count how many things a magnet sticks to in one room.' },
  { category: 'Science & Discovery', icon: '🔬', quest: 'Grow a sprout', detail: 'Put a bean in a wet paper towel. Check it tomorrow!' },
  { category: 'Science & Discovery', icon: '🔬', quest: 'Trace your shadow', detail: 'Trace it in the morning AND afternoon. What changed?' },
  { category: 'Science & Discovery', icon: '🔬', quest: 'Tiny world expedition', detail: 'Use a magnifying glass on 5 different things.' },
  { category: 'Science & Discovery', icon: '🔬', quest: 'Weather forecaster', detail: "Predict tomorrow's weather. Check if you were right!" },
  { category: 'Science & Discovery', icon: '🔬', quest: 'Color-drinking flower', detail: 'Put a white flower in colored water. Wait and watch.' },
  // 🎮 Fun & Games
  { category: 'Fun & Games', icon: '🎮', quest: 'Invent a new game', detail: 'Write the rules. Teach it to at least one person.' },
  { category: 'Fun & Games', icon: '🎮', quest: 'Build the tallest tower', detail: 'Use only household items. No glue allowed!' },
  { category: 'Fun & Games', icon: '🎮', quest: 'Make up a dance', detail: 'To your favorite song. Perform it for someone.' },
  { category: 'Fun & Games', icon: '🎮', quest: 'I Spy challenge', detail: 'Play 3 rounds — you go first with the hardest one.' },
  { category: 'Fun & Games', icon: '🎮', quest: 'Build a blanket fort', detail: 'Read a whole book inside it. No peeking out.' },
  { category: 'Fun & Games', icon: '🎮', quest: 'Hot lava floor!', detail: 'Cross the living room without touching the ground.' },
  { category: 'Fun & Games', icon: '🎮', quest: 'Learn a magic trick', detail: 'Practice it until you can do it without laughing.' },
  { category: 'Fun & Games', icon: '🎮', quest: 'Backyard obstacle course', detail: 'Set it up, run it 3 times. Beat your own time!' },
  { category: 'Fun & Games', icon: '🎮', quest: 'Play a board game', detail: 'Be a gracious winner AND a gracious loser. Both matter.' },
  { category: 'Fun & Games', icon: '🎮', quest: 'Put on a puppet show', detail: 'Make the puppets from socks. 3-minute performance!' },
];

function buildQuestHtml(starsData = { total: 0, log: [] }) {
  const questsJson = JSON.stringify(QUESTS);
  const starsJson = JSON.stringify(starsData);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=800">
  <title>Aurora's Summer Quest</title>
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
      background: #000; color: #fff;
      padding: 10px 20px;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 15px; font-weight: bold; letter-spacing: 0.12em; text-transform: uppercase;
      flex-shrink: 0;
    }
    .cat-bar {
      padding: 8px 20px;
      border-bottom: 2px solid #000;
      display: flex; align-items: center; gap: 10px;
      font-size: 11px; font-weight: bold; letter-spacing: 0.2em; text-transform: uppercase;
      flex-shrink: 0;
    }
    .cat-icon { font-size: 20px; }
    .summer-day { margin-left: auto; font-weight: normal; font-size: 12px; letter-spacing: 0.05em; }
    .main {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 20px 56px; text-align: center; gap: 14px;
    }
    .quest-text { font-size: 46px; font-weight: bold; line-height: 1.2; letter-spacing: 0.01em; }
    .quest-detail { font-size: 16px; color: #333; line-height: 1.5; }
    .footer {
      border-top: 3px double #000;
      padding: 10px 20px; text-align: center;
      font-size: 13px; font-weight: bold; letter-spacing: 0.12em; text-transform: uppercase;
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <span>✨ Aurora's Summer Quest ✨</span>
    <span id="date-label"></span>
  </div>
  <div class="cat-bar">
    <span id="cat-icon" class="cat-icon"></span>
    <span id="cat-name"></span>
    <span id="summer-day" class="summer-day"></span>
  </div>
  <div class="main">
    <div id="quest-text" class="quest-text"></div>
    <div id="quest-detail" class="quest-detail"></div>
  </div>
  <div id="footer" class="footer">⭐ Complete your quest and earn a star! ⭐</div>
  <script>
    const QUESTS = ${questsJson};
    const STARS = ${starsJson};

    const TZ = 'America/Los_Angeles';
    const now = new Date();

    // New day starts at 6 AM PT, not midnight
    const ptDateStr = now.toLocaleDateString('en-CA', { timeZone: TZ });
    const ptHour = parseInt(now.toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }), 10);
    let dateStr;
    if (ptHour < 6) {
      const [py, pm, pd] = ptDateStr.split('-').map(Number);
      const prev = new Date(py, pm - 1, pd - 1);
      dateStr = prev.toLocaleDateString('en-CA', { timeZone: TZ });
    } else {
      dateStr = ptDateStr;
    }

    const [y, m, d] = dateStr.split('-').map(Number);
    const summerStart = new Date(2026, 5, 29); // June 29, 2026 — first day of summer quest
    const today = new Date(y, m - 1, d);
    const daysSinceSummerStart = Math.max(0, Math.floor((today - summerStart) / 86400000));
    const quest = QUESTS[daysSinceSummerStart % QUESTS.length];
    const summerDay = daysSinceSummerStart + 1;

    const dateLabel = now.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });

    document.getElementById('date-label').textContent = dateLabel;
    document.getElementById('cat-icon').textContent = quest.icon;
    document.getElementById('cat-name').textContent = quest.category;
    document.getElementById('summer-day').textContent = 'Day ' + summerDay + ' of Summer ☀️';
    document.getElementById('quest-text').textContent = quest.quest;
    document.getElementById('quest-detail').textContent = quest.detail;

    const starCount = STARS.total || 0;
    if (starCount > 0) {
      document.getElementById('footer').textContent =
        '⭐ ' + starCount + ' star' + (starCount === 1 ? '' : 's') + ' earned! Keep going! ⭐';
    }
  </script>
</body>
</html>`;
}

// ─── Theme A: Stacked rows, left-bordered meal blocks ────────────────────────

function buildHtml_A({ heading, dayLabel, breakfast, lunch, updatedAt, reminderBanner }) {
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
    .reminder-banner { background: #000; color: #fff; text-align: center; font-size: 13px; font-weight: bold; letter-spacing: 0.05em; padding: 5px 12px; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <span class="school">Roy Cloud School</span>
    <span class="date-label">${heading}</span>
  </div>
  ${reminderBanner}
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

function buildHtml_B({ heading, dayLabel, breakfast, lunch, updatedAt, reminderBanner }) {
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
    .reminder-banner { background: #000; color: #fff; text-align: center; font-size: 13px; font-weight: bold; letter-spacing: 0.05em; padding: 5px 12px; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="day">${heading}</div>
    <div class="school">Roy Cloud School</div>
  </div>
  ${reminderBanner}
  <div class="cols">
    ${renderCol('Breakfast', '🍳', breakfast)}
    ${renderCol('Lunch', '🍽️', lunch)}
  </div>
  <footer>Updated ${updatedAt} PT &bull; menu.ulfhedinn.net</footer>
</body>
</html>`;
}

// ─── Theme C: Monospace table, pure black ────────────────────────────────────

function buildHtml_C({ heading, dayLabel, breakfast, lunch, updatedAt, reminderBanner }) {
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
    .reminder-banner { background: #000; color: #fff; text-align: center; font-size: 11px; font-weight: bold; letter-spacing: 0.15em; text-transform: uppercase; padding: 4px 20px; }
  </style>
</head>
<body>
  <div class="top-bar">
    <span>Roy Cloud School</span>
    <span>${heading}</span>
  </div>
  ${reminderBanner}
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
  if (isSummer()) {
    let starsData = { total: 0, log: [] };
    try { starsData = JSON.parse(fs.readFileSync('docs/stars.json', 'utf8')); } catch {}
    fs.writeFileSync('docs/index.html', buildQuestHtml(starsData));
    console.log(`Generated docs/index.html — Summer Quest mode [${pacificDateStr(new Date())}] — ${starsData.total} star(s)`);
    return;
  }

  const { dateStr, isToday, isTomorrow, breakfast, lunch } = await findTargetMenu();

  // Format the display date in Pacific time
  const [yr, mo, dy] = dateStr.split('-').map(Number);
  const menuDate = new Date(yr, mo - 1, dy, 12, 0, 0); // noon local, avoids DST edge
  const dayLabel = menuDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const heading = isToday ? `Today — ${dayLabel}` : isTomorrow ? `Tomorrow — ${dayLabel}` : `Coming up — ${dayLabel}`;
  const updatedAt = new Date().toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });

  const reminderBanner = isTodayWednesdayPT()
    ? `<div class="reminder-banner">🛒 Student Store tomorrow — bring money!</div>`
    : '';

  const themes = [buildHtml_A, buildHtml_B, buildHtml_C];
  const themeNames = ['A (stacked rows)', 'B (entree focus)', 'C (monospace)'];
  const pick = Math.floor(Math.random() * themes.length);
  const html = themes[pick]({ heading, dayLabel, breakfast, lunch, updatedAt, reminderBanner });

  fs.writeFileSync('docs/index.html', html);
  console.log(`Generated docs/index.html — ${heading} [theme ${themeNames[pick]}]`);
}

main().catch(e => { console.error(e); process.exit(1); });
