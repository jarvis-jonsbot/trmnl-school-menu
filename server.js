const express = require('express');
const app = express();
const PORT = process.env.PORT || 3721;

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
