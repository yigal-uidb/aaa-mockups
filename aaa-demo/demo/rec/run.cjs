// Records the film's screen clips from the real system. Usage: node demo/rec/run.cjs [clip ...]  (default: all, in order)
// Clips build on each other (the intake creates the inquiry the manager then gets), so run them in order after demo/restart.sh.
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const L = require('./lib.cjs');

const BASE = 'http://localhost:3000';
const OUT = '/home/user/aaa-emek-video/clips';
const PSQL = 'psql postgres://aaa:aaa@localhost/aaa_dev -tAc';
const sql = (s) => execSync(`${PSQL} "${s.replace(/"/g, '\\"')}"`).toString().trim();
const APP = sql("select a.id from apps a join orgs o on o.id=a.org_id where o.slug='emek'");
const TOKEN = sql("select public_token from apps where id='" + APP + "'");

let browser;
async function session(email, { env = 'live', start = 'requests', mobile = false } = {}) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 430, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL' }
    : { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: 'he-IL' });
  await L.setup(ctx);
  const page = await ctx.newPage();
  if (email) {
    await page.goto(BASE + '/');
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', 'demo1234');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
    await page.evaluate(([id, env]) => sessionStorage.setItem('env:' + id, env), [APP, env]);
  }
  if (start !== null) {
    await page.goto(start.startsWith('/') ? BASE + start : `${BASE}/app/${APP}/${start}`);
    await page.waitForTimeout(2500);
  }
  return { ctx, page, app: page.frameLocator('iframe').first() };
}
const nav = (page, label) => page.locator('aside.side nav button, aside.side nav a').filter({ hasText: label }).first();
const wait = (page, ms) => page.waitForTimeout(ms);
async function waitText(scope, text, timeout = 30000) {
  await scope.getByText(text).first().waitFor({ state: 'visible', timeout });
}

const CLIPS = {
  async home() {
    const { ctx, page } = await session('dana@emek.example', { start: '/' });
    const stop = await L.record(page, OUT);
    await wait(page, 1200);
    await L.hover(page, page.getByText('מועצה אזורית עמק יזרעאל').first(), 900);
    await wait(page, 700);
    await L.click(page, page.getByText('פניות תושבים').first(), { ms: 900 });
    await wait(page, 3500);
    await stop('home');
    await ctx.close();
  },

  async flow() {
    const { ctx, page } = await session('dana@emek.example', { start: 'settings' });
    const stop = await L.record(page, OUT);
    await wait(page, 1000);
    for (const t of ['קליטה וניתוב למחלקה', 'דחופה או סכנה', 'התראה מיידית למנהל', 'טיפול בשטח']) {
      await L.hover(page, page.getByText(t).first(), 700);
      await wait(page, 450);
    }
    const flowBox = page.getByText('טיפול בשטח').first();
    await flowBox.evaluate((el) => { let p = el; while (p && p.scrollWidth <= p.clientWidth + 2) p = p.parentElement; if (p) p.scrollTo({ left: -10000, behavior: 'smooth' }); });
    await wait(page, 1200);
    for (const t of ['חרגה מהיעד?', 'העברה להנהלה', 'סגירה ועדכון התושב']) {
      const loc = page.getByText(t).first();
      if (await loc.isVisible().catch(() => false)) { await L.hover(page, loc, 650); await wait(page, 400); }
    }
    const input = page.locator('input[type=number]').first();
    await L.click(page, input, { ms: 900 });
    await page.keyboard.press('Control+A');
    await L.type(page, '4', 80);
    await wait(page, 400);
    await L.click(page, page.getByRole('button', { name: 'שמירה' }).first(), { ms: 600 });
    await wait(page, 2200);
    await stop('flow');
    await ctx.close();
  },

  async requests() {
    const { ctx, page, app } = await session('shira@emek.example');
    const stop = await L.record(page, OUT);
    await wait(page, 800);
    await L.hover(page, app.getByText('פניות פתוחות').first(), 800);
    await wait(page, 500);
    await L.hover(page, app.getByText('חרגו מיעד הטיפול').first(), 700);
    await wait(page, 600);
    await L.hover(page, app.locator('.k-badge-danger').first(), 800);
    await wait(page, 600);
    await L.scroll(page, 420, 1200);
    await wait(page, 600);
    await L.hover(page, app.locator('.k-badge-danger').nth(3), 800);
    await wait(page, 900);
    await stop('requests');
    await ctx.close();
  },

  async intake() {
    const { ctx, page } = await session('shira@emek.example');
    const stop = await L.record(page, OUT);
    await wait(page, 700);
    await L.click(page, page.locator('button.fab'), { ms: 900, wait: 900 });
    await L.click(page, page.locator('.asst-who'), { ms: 700, wait: 800 });
    await L.click(page, page.locator('.bot-pick').filter({ hasText: 'קליטת פניות' }), { ms: 600, wait: 1000 });
    await L.click(page, page.locator('textarea[aria-label="הודעה לעוזר"]'), { ms: 500, wait: 300 });
    await L.type(page, 'תושבת מנהלל, מיכל אדלר 052-4418830, michal.adler@mail.example, מדווחת שהפנס ברחוב הזיתים מול הצרכנייה לא דולק כבר שלושה ימים', 30);
    await wait(page, 500);
    await L.click(page, page.locator('button.asst-send'), { ms: 500 });
    await waitText(page, 'יראה אותה בלוח הטיפול', 60000);
    await wait(page, 3000);
    await stop('intake');
    await ctx.close();
  },

  async manager() {
    const { ctx, page, app } = await session('amit@emek.example');
    const stop = await L.record(page, OUT);
    await wait(page, 900);
    await L.click(page, page.locator('button.bar-icon[aria-label="התראות"]'), { ms: 900, wait: 1200 });
    const note = page.locator('.notes .note').filter({ hasText: 'רחוב הזיתים' }).first();
    await L.hover(page, note, 600);
    await wait(page, 900);
    await L.click(page, note, { ms: 300, wait: 2600 });
    // the record opens over the board: close it, then move the card to "בטיפול"
    const closeBtn = page.locator('[aria-label="סגירה"], .modal-close, button:has-text("×")').first();
    if (await closeBtn.isVisible().catch(() => false)) await L.click(page, closeBtn, { ms: 700, wait: 900 });
    else {
      const appClose = app.locator('.k-modal button, button[aria-label="סגירה"]').first();
      if (await appClose.isVisible().catch(() => false)) await L.click(page, appClose, { ms: 700, wait: 900 });
    }
    if (!page.url().includes('/board')) { await L.click(page, nav(page, 'לוח טיפול'), { ms: 800, wait: 2200 }); }
    const card = app.locator('.k-kcard').filter({ hasText: 'רחוב הזיתים' }).first();
    await L.hover(page, card, 900);
    await wait(page, 500);
    const sel = card.locator('select.k-kmove');
    await L.click(page, sel, { ms: 500, wait: 300 });
    await sel.selectOption('בטיפול');
    await wait(page, 1800);
    await L.click(page, nav(page, 'מפת פניות'), { ms: 900, wait: 3500 });
    await L.hover(page, page.locator('iframe').first(), 600).catch(() => {});
    await wait(page, 1500);
    await stop('manager');
    await ctx.close();
  },

  async morning() {
    const { ctx, page } = await session('amit@emek.example', { start: 'board' });
    const stop = await L.record(page, OUT);
    await wait(page, 700);
    await L.click(page, page.locator('button.fab'), { ms: 900, wait: 900 });
    await L.click(page, page.locator('.asst-who'), { ms: 700, wait: 800 });
    await L.click(page, page.locator('.bot-pick').filter({ hasText: 'סיכום בוקר' }), { ms: 600, wait: 1000 });
    await L.click(page, page.locator('.option').filter({ hasText: 'מה דחוף היום?' }), { ms: 700 });
    await waitText(page, 'כדאי להתחיל', 60000);
    await wait(page, 2600);
    await L.click(page, page.locator('textarea[aria-label="הודעה לעוזר"]'), { ms: 500, wait: 300 });
    await L.type(page, 'תסגור את הפנייה על הפנס בנהלל', 40);
    await L.click(page, page.locator('button.asst-send'), { ms: 500 });
    await waitText(page, 'לקריאה בלבד', 60000);
    await wait(page, 3200);
    await stop('morning');
    await ctx.close();
  },

  async close() {
    const { ctx, page, app } = await session('amit@emek.example');
    const stop = await L.record(page, OUT);
    await wait(page, 800);
    const row = app.locator('tr').filter({ hasText: 'רחוב הזיתים' }).first();
    await L.hover(page, row, 900);
    await wait(page, 400);
    await L.click(page, row.getByRole('button', { name: 'סגירה' }), { ms: 700, wait: 900 });
    await L.click(page, app.locator('textarea').first(), { ms: 600, wait: 300 });
    await L.type(page, 'הוחלפה נורה בפנס, נבדק בערב ודולק', 38);
    await wait(page, 500);
    await L.click(page, app.getByRole('button', { name: 'סגירה ועדכון התושב' }), { ms: 700, wait: 2600 });
    await stop('close');
    await ctx.close();
  },

  async automation() {
    sql("update emails set status = 'sent', sent_at = now(), note = null where status in ('held','queued')");
    const { ctx, page } = await session('dana@emek.example', { start: 'automation' });
    const stop = await L.record(page, OUT);
    await wait(page, 900);
    await L.hover(page, page.getByText('הפנייה שלך למועצה טופלה').first(), 1000).catch(() => {});
    await wait(page, 1200);
    await L.hover(page, page.getByText('בדיקת בוקר').first(), 900).catch(() => {});
    await wait(page, 1800);
    await stop('automation');
    await ctx.close();
  },

  async public() {
    const { ctx, page } = await session(null, { start: `/f/${TOKEN}/report`, mobile: true });
    const stop = await L.record(page, OUT, { w: 860, h: 1800 });
    await wait(page, 1000);
    const field = (label) => page.locator('label').filter({ hasText: label }).locator('input, textarea, select').first();
    await L.click(page, field('שם התושב'), { ms: 600, wait: 200 });
    await L.type(page, 'אלון ברקן', 45);
    await L.click(page, field('טלפון'), { ms: 500, wait: 200 });
    await L.type(page, '054-7712093', 45);
    await L.hover(page, field('תחום'), 500);
    await field('תחום').selectOption('כבישים ומדרכות');
    await wait(page, 500);
    await L.click(page, field('נושא'), { ms: 500, wait: 200 });
    await L.type(page, 'בור גדול בכביש ליד הכניסה למושב', 40);
    await L.click(page, field('יישוב וכתובת'), { ms: 500, wait: 200 });
    await L.type(page, 'בלפוריה, הכביש הראשי', 40);
    await L.click(page, field('פירוט'), { ms: 500, wait: 200 });
    await L.type(page, 'הבור בצד ימין, ליד תחנת האוטובוס. מסוכן לרוכבי אופניים', 32);
    await wait(page, 600);
    await L.click(page, page.getByRole('button', { name: 'שליחת הפנייה' }), { ms: 800, wait: 2800 });
    await stop('public');
    await ctx.close();
  },

  async overview() {
    const { ctx, page } = await session('uri@emek.example', { start: 'overview' });
    const stop = await L.record(page, OUT);
    await wait(page, 1500);
    await L.hover(page, page.locator('iframe').first(), 900).catch(() => {});
    await wait(page, 800);
    await L.scroll(page, 520, 1600);
    await wait(page, 2500);
    await stop('overview');
    await ctx.close();
  },

  async change() {
    const { ctx, page } = await session('dana@emek.example', { start: 'requests' });
    const stop = await L.record(page, OUT);
    await wait(page, 700);
    await L.click(page, page.locator('button.fab'), { ms: 900, wait: 1000 });
    await L.click(page, page.locator('textarea[aria-label="הודעה לעוזר"]'), { ms: 500, wait: 300 });
    await L.type(page, 'אני רוצה שכל יום ראשון בבוקר כל רכז יישוב יקבל במייל את הפניות הפתוחות ביישוב שלו, ושבפנייה יהיה סימון "ועד היישוב עודכן"', 26);
    await L.click(page, page.locator('button.asst-send'), { ms: 500 });
    await waitText(page, 'אישור האפיון', 60000);
    await wait(page, 1500);
    await L.hover(page, page.getByText('כל יום ראשון ב-08:00').first(), 800).catch(() => {});
    await wait(page, 1200);
    await L.click(page, page.getByRole('button', { name: 'אישור האפיון' }), { ms: 800 });
    await waitText(page, 'גרסה חדשה מוכנה', 120000);
    await wait(page, 2500);
    await stop('change');
    await ctx.close();
  },

  async publish() {
    const { ctx, page } = await session('dana@emek.example', { env: 'test', start: 'versions' });
    const stop = await L.record(page, OUT);
    await wait(page, 1500);
    await L.hover(page, page.getByText('סיכום שבועי לרכזי היישובים').first(), 900).catch(() => {});
    await wait(page, 1200);
    await L.click(page, nav(page, 'העלאה לאוויר'), { ms: 900, wait: 2500 });
    await L.scroll(page, 300, 900);
    await wait(page, 2500);
    await stop('publish');
    await ctx.close();
  },
};

(async () => {
  browser = await chromium.launch();
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CLIPS);
  for (const n of names) {
    try { await CLIPS[n](); } catch (e) { console.error(`clip ${n} failed:`, e.message.split('\n')[0]); }
  }
  await browser.close();
})();
