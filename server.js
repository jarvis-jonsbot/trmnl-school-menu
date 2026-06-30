const express = require('express');
const app = express();
const PORT = process.env.PORT || 3721;

// ─── Summer Quest Board ───────────────────────────────────────────────────────

const QUESTS = [
  // 🎨 Art & Craft
  { category: 'Art & Craft', icon: '🎨', quest: 'Draw a dragon', detail: 'Make it fierce — add treasure for it to guard!' },
  { category: 'Art & Craft', icon: '🎨', quest: 'Make a bookmark', detail: 'Decorate it for your very favorite book.' },
  { category: 'Art & Craft', icon: '🎨', quest: 'Design a superhero', detail: 'Draw their costume and invent their superpower.' },
  { category: 'Art & Craft', icon: '🎨', quest: 'Draw a mermaid\'s house', detail: 'What furniture do mermaids have underwater?' },
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
  { category: 'Kitchen Magic', icon: '🍳', quest: 'Make a fruit salad', detail: 'Use at least 4 different fruits. You\'re the chef!' },
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
  { category: 'Kindness Mission', icon: '🌟', quest: 'Do a surprise chore', detail: 'Clean something you didn\'t mess up. Don\'t tell anyone.' },
  { category: 'Kindness Mission', icon: '🌟', quest: 'Give Kátur extra love', detail: 'Long belly rub, extra treats, lots of cuddles.' },
  { category: 'Kindness Mission', icon: '🌟', quest: 'Say 3 nice things', detail: 'Tell 3 different people one thing you love about them.' },
  { category: 'Kindness Mission', icon: '🌟', quest: 'Draw art for a faraway person', detail: 'Mail it or send a photo. Make their day.' },
  { category: 'Kindness Mission', icon: '🌟', quest: 'Share your favorite snack', detail: 'Offer some to everyone in the house first.' },
  { category: 'Kindness Mission', icon: '🌟', quest: 'Make a card for a grandparent', detail: 'Draw something that will make them smile.' },
  { category: 'Kindness Mission', icon: '🌟', quest: 'Say thank you creatively', detail: 'No boring "thanks" — make it funny or surprising.' },
  { category: 'Kindness Mission', icon: '🌟', quest: 'Help without being asked', detail: 'Notice something that needs doing and just do it.' },
  { category: 'Kindness Mission', icon: '🌟', quest: 'Compliment a stranger', detail: 'A smile counts. Make someone\'s day a little better.' },

  // 🔬 Science & Discovery
  { category: 'Science & Discovery', icon: '🔬', quest: 'Make a rainbow', detail: 'Put a glass of water in sunlight. Catch the colors!' },
  { category: 'Science & Discovery', icon: '🔬', quest: 'Volcano time!', detail: 'Baking soda + vinegar. Add food coloring for drama.' },
  { category: 'Science & Discovery', icon: '🔬', quest: 'Test paper airplanes', detail: 'Fold 3 designs. Which one flies the farthest?' },
  { category: 'Science & Discovery', icon: '🔬', quest: 'Make oobleck', detail: 'Cornstarch + water. Is it a liquid or a solid?' },
  { category: 'Science & Discovery', icon: '🔬', quest: 'Magnet hunt', detail: 'Count how many things a magnet sticks to in one room.' },
  { category: 'Science & Discovery', icon: '🔬', quest: 'Grow a sprout', detail: 'Put a bean in a wet paper towel. Check it tomorrow!' },
  { category: 'Science & Discovery', icon: '🔬', quest: 'Trace your shadow', detail: 'Trace it in the morning AND afternoon. What changed?' },
  { category: 'Science & Discovery', icon: '🔬', quest: 'Tiny world expedition', detail: 'Use a magnifying glass on 5 different things.' },
  { category: 'Science & Discovery', icon: '🔬', quest: 'Weather forecaster', detail: 'Predict tomorrow\'s weather. Check if you were right!' },
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

// Returns the effective quest date in PT: before 6 AM uses yesterday's date
function getQuestDatePT() {
  const now = new Date();
  const TZ = 'America/Los_Angeles';
  const ptDateStr = now.toLocaleDateString('en-CA', { timeZone: TZ });
  const ptHour = parseInt(now.toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }), 10);
  if (ptHour < 6) {
    const [y, m, d] = ptDateStr.split('-').map(Number);
    const prev = new Date(y, m - 1, d - 1);
    return prev.toLocaleDateString('en-CA', { timeZone: TZ });
  }
  return ptDateStr;
}

const SUMMER_START = new Date(2026, 5, 29); // June 29, 2026 — first day of summer quest

// Seeded shuffle (LCG, seed=2026) — INDEX[0]=39 ("Decorate a cookie"), INDEX[1]=1 ("Make a bookmark")
// guarantees every quest appears exactly once with no category runs
const QUEST_INDEX = [
  39,  1, 35, 30, 42,  5, 19, 47, 22, 21,
  52, 57, 64, 25, 28, 20, 54, 36, 34, 56,
  18, 46, 27, 23, 26, 51, 11, 62, 50,  8,
  37,  7, 44,  0,  4, 60, 49, 69, 12, 63,
  32,  9, 29, 58, 17, 38, 24, 14, 41, 55,
  13, 16,  6, 53, 66, 33, 15, 65, 61, 67,
  59, 10, 48, 40, 31, 43, 45, 68,  3,  2,
];

function getSummerDay() {
  const dateStr = getQuestDatePT();
  const [y, m, d] = dateStr.split('-').map(Number);
  const diff = new Date(y, m - 1, d) - SUMMER_START;
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
}

function getDailyQuest() {
  const dateStr = getQuestDatePT();
  const [y, m, d] = dateStr.split('-').map(Number);
  const daysSinceSummerStart = Math.max(0, Math.floor((new Date(y, m - 1, d) - SUMMER_START) / (1000 * 60 * 60 * 24)));
  return QUESTS[QUEST_INDEX[daysSinceSummerStart % QUEST_INDEX.length]];
}

function buildQuestMarkupFull(quest, dateLabel, summerDay) {
  const detail = (quest.detail || '').replace(/'/g, '&#39;');
  const questText = quest.quest.replace(/'/g, '&#39;');
  const category = quest.category.replace(/'/g, '&#39;');

  return `<div style="width:800px;height:480px;display:flex;flex-direction:column;background:#fff;color:#000;font-family:'Courier New',Courier,monospace;overflow:hidden;box-sizing:border-box;">
  <div style="background:#000;color:#fff;padding:10px 20px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
    <span style="font-size:15px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;">✨ Aurora's Summer Quest ✨</span>
    <span style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">${dateLabel}</span>
  </div>
  <div style="padding:10px 24px 8px;font-size:11px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;display:flex;align-items:center;gap:10px;border-bottom:2px solid #000;flex-shrink:0;">
    <span style="font-size:22px;">${quest.icon}</span>
    <span>${category}</span>
    <span style="margin-left:auto;font-weight:normal;letter-spacing:0.05em;">Day ${summerDay} of Summer ☀️</span>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 40px;text-align:center;gap:16px;">
    <div style="font-size:42px;font-weight:bold;line-height:1.25;letter-spacing:0.01em;">${questText}</div>
    <div style="font-size:16px;color:#333;letter-spacing:0.04em;line-height:1.5;">${detail}</div>
  </div>
  <div style="border-top:3px double #000;padding:10px 24px;display:flex;justify-content:center;align-items:center;background:#fff;flex-shrink:0;">
    <span style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;font-weight:bold;">⭐ Complete your quest and earn a star! ⭐</span>
  </div>
</div>`;
}

function buildQuestMarkupHalf(quest, summerDay) {
  const questText = quest.quest.replace(/'/g, '&#39;');
  return `<div style="width:400px;height:480px;display:flex;flex-direction:column;background:#fff;color:#000;font-family:'Courier New',Courier,monospace;overflow:hidden;box-sizing:border-box;">
  <div style="background:#000;color:#fff;padding:8px 14px;flex-shrink:0;">
    <div style="font-size:12px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;">✨ Summer Quest ✨</div>
    <div style="font-size:10px;letter-spacing:0.08em;margin-top:2px;">Day ${summerDay} ☀️</div>
  </div>
  <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:16px;text-align:center;">
    <div style="font-size:26px;font-weight:bold;line-height:1.3;">${quest.icon} ${questText}</div>
  </div>
  <div style="border-top:2px solid #000;padding:8px 14px;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;text-align:center;flex-shrink:0;">⭐ Complete for a star!</div>
</div>`;
}

// HealthePro menu IDs
const ORG_ID = 1184;
const BREAKFAST_MENU_ID = 103752;
const LUNCH_MENU_ID = 103751;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/**
 * Fetch today's menu items for a given menu ID.
 * Returns { menuName, categories } or null on error/no school day.
 */
async function fetchTodayMenu(menuId) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const dateStr = today.toISOString().slice(0, 10); // YYYY-MM-DD

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

  // Check for school closure
  if (setting.days_off?.status) {
    return {
      menuName: meta.data?.public_name || 'Menu',
      categories: [],
      noSchool: true,
      noSchoolReason: setting.days_off.description || 'No school today',
    };
  }

  // Group items by category
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

  return {
    menuName: meta.data?.public_name || 'Menu',
    categories,
    noSchool: false,
  };
}

/**
 * Build TRMNL HTML markup for a single menu panel.
 */
function renderMenuSection(label, menu) {
  if (!menu) {
    return `<div class="item"><span class="label">${label}</span><span class="value">Unavailable</span></div>`;
  }
  if (menu.noSchool) {
    return `<div class="item"><span class="label">${label}</span><span class="value">${menu.noSchoolReason}</span></div>`;
  }
  if (menu.noEntry || menu.categories.length === 0) {
    return `<div class="item"><span class="label">${label}</span><span class="value">No menu posted</span></div>`;
  }

  const rows = menu.categories.map(cat => {
    const items = cat.items.join(', ');
    return `<div class="item"><span class="label">${cat.name}</span><span class="value">${items}</span></div>`;
  }).join('');

  return `
    <div class="title--small mb-2">${label}</div>
    <div class="content gap--small">${rows}</div>
  `;
}

/**
 * Full-screen markup (800x480).
 */
function buildFullMarkup(breakfast, lunch, dateLabel) {
  const bSection = renderMenuSection('🍳 Breakfast', breakfast);
  const lSection = renderMenuSection('🍽️ Lunch', lunch);

  return `<div class="view view--full">
  <div class="layout layout--col">
    <div class="title">Roy Cloud School Menu</div>
    <div class="label label--underline mb-4">${dateLabel}</div>
    <div class="columns">
      <div class="column">${bSection}</div>
      <div class="column">${lSection}</div>
    </div>
  </div>
</div>`;
}

/**
 * Half-vertical markup (for mashups).
 */
function buildHalfMarkup(breakfast, lunch, dateLabel) {
  const bEntrees = breakfast?.categories?.find(c => c.name.toLowerCase().includes('entree'))?.items || [];
  const lEntrees = lunch?.categories?.find(c => c.name.toLowerCase().includes('entree'))?.items || [];

  const bText = breakfast?.noSchool ? breakfast.noSchoolReason : (bEntrees.length ? bEntrees.join(', ') : 'No menu');
  const lText = lunch?.noSchool ? lunch.noSchoolReason : (lEntrees.length ? lEntrees.join(', ') : 'No menu');

  return `<div class="view view--half_vertical">
  <div class="layout layout--col">
    <div class="title--small">Roy Cloud</div>
    <div class="label">${dateLabel}</div>
    <div class="item mt-2"><span class="label">🍳</span><span class="value">${bText}</span></div>
    <div class="item"><span class="label">🍽️</span><span class="value">${lText}</span></div>
  </div>
</div>`;
}

// TRMNL polls this endpoint
app.post('/markup', async (req, res) => {
  try {
    const [breakfast, lunch] = await Promise.all([
      fetchTodayMenu(BREAKFAST_MENU_ID),
      fetchTodayMenu(LUNCH_MENU_ID),
    ]);

    const today = new Date();
    const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    res.json({
      markup: buildFullMarkup(breakfast, lunch, dateLabel),
      markup_half_vertical: buildHalfMarkup(breakfast, lunch, dateLabel),
      markup_half_horizontal: buildHalfMarkup(breakfast, lunch, dateLabel),
      markup_quadrant: `<div class="view view--quadrant"><div class="title--small">Roy Cloud</div><div class="label">${dateLabel}</div></div>`,
    });
  } catch (err) {
    console.error('Error fetching menus:', err);
    res.status(500).json({ error: 'Failed to fetch menus' });
  }
});

// ─── Quest routes ─────────────────────────────────────────────────────────────

// TRMNL polls this for the quest plugin
app.post('/quest/markup', (req, res) => {
  const quest = getDailyQuest();
  const summerDay = getSummerDay();
  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  res.json({
    markup: buildQuestMarkupFull(quest, dateLabel, summerDay),
    markup_half_vertical: buildQuestMarkupHalf(quest, summerDay),
    markup_half_horizontal: buildQuestMarkupHalf(quest, summerDay),
    markup_quadrant: `<div style="width:400px;height:240px;display:flex;align-items:center;justify-content:center;font-family:'Courier New',monospace;background:#fff;text-align:center;padding:16px;box-sizing:border-box;"><span style="font-size:18px;font-weight:bold;">${quest.icon} ${quest.quest}</span></div>`,
  });
});

// Browser preview for the quest
app.get('/quest/preview', (req, res) => {
  const quest = getDailyQuest();
  const summerDay = getSummerDay();
  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const markup = buildQuestMarkupFull(quest, dateLabel, summerDay);

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Aurora's Summer Quest — Preview</title>
  <style>
    body { margin: 40px; background: #ccc; font-family: monospace; }
    .frame { width: 800px; height: 480px; border: 3px solid #333; box-shadow: 4px 4px 0 #999; overflow: hidden; }
    .info { margin-top: 16px; font-size: 13px; color: #444; }
  </style>
</head>
<body>
  <h2 style="font-family:monospace;">TRMNL Preview — Aurora's Summer Quest</h2>
  <div class="frame">${markup}</div>
  <div class="info">
    Quest #${(QUESTS.indexOf(quest) + 1)} of ${QUESTS.length} · ${quest.category} · Day ${summerDay} of Summer
  </div>
</body>
</html>`);
});

// Health check
app.get('/', (req, res) => res.json({ ok: true, service: 'trmnl-school-menu' }));

// Preview endpoint (GET for easy browser testing)
app.get('/preview', async (req, res) => {
  const [breakfast, lunch] = await Promise.all([
    fetchTodayMenu(BREAKFAST_MENU_ID),
    fetchTodayMenu(LUNCH_MENU_ID),
  ]);

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  res.send(`<!DOCTYPE html>
<html>
<head><title>Menu Preview</title>
<style>
  body { font-family: monospace; max-width: 800px; margin: 2rem auto; background: #f0f0f0; }
  h2 { border-bottom: 1px solid #333; }
  pre { background: #fff; padding: 1rem; border-radius: 4px; white-space: pre-wrap; }
</style>
</head>
<body>
<h1>Roy Cloud Menu — ${dateLabel}</h1>
<h2>🍳 Breakfast</h2>
<pre>${JSON.stringify(breakfast, null, 2)}</pre>
<h2>🍽️ Lunch</h2>
<pre>${JSON.stringify(lunch, null, 2)}</pre>
</body></html>`);
});

app.listen(PORT, () => {
  console.log(`TRMNL school menu server running on http://localhost:${PORT}`);
  console.log(`  POST /markup   — TRMNL plugin endpoint`);
  console.log(`  GET  /preview  — browser preview`);
});
