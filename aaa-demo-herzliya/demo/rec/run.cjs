// Records the film's screen clips from the real system. Usage: node demo/rec/run.cjs [clip ...]  (default: all, in order)
// Clips build on each other (the intake creates the inquiry the manager then gets), so run them in order after demo/restart.sh.
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const L = require('./lib.cjs');

const BASE = 'http://localhost:3000';
const OUT = '/home/user/herzliya-video/clips';
const PSQL = 'psql postgres://aaa:aaa@localhost/aaa_dev -tAc';
const sql = (s) => execSync(`${PSQL} "${s.replace(/"/g, '\\"')}"`).toString().trim();
const APP = sql("select a.id from apps a join orgs o on o.id=a.org_id where o.slug='herzliya'");
const BAPP = () => sql("select a.id from apps a join orgs o on o.id=a.org_id where o.slug='herzliya-build' order by a.created_at desc limit 1");
const TOKEN = sql("select public_token from apps where id='" + APP + "'");

let browser;
const MARKS = {};
function marker(name) { const t0 = Date.now(); MARKS[name] = {}; return (k) => { MARKS[name][k] = +((Date.now() - t0) / 1000).toFixed(2); }; }
async function session(email, { env = 'live', start = 'requests', mobile = false, app = APP } = {}) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 430, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL' }
    : { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3, locale: 'he-IL' });
  await L.setup(ctx);
  const page = await ctx.newPage();
  if (email) {
    await page.goto(BASE + '/');
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', 'demo1234');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
    if (app) await page.evaluate(([id, env]) => sessionStorage.setItem('env:' + id, env), [app, env]);
  }
  if (start !== null) {
    await page.goto(start.startsWith('/') ? BASE + start : `${BASE}/app/${app}/${start}`);
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
  // ---- the build, in the council copy with no apps (seed-build.ts), then after-build.ts
  async build() {
    const { ctx, page } = await session('dana.b@herzliya.example', { start: '/', app: null });
    const stop = await L.record(page, OUT);
    const mark = marker('build');
    await wait(page, 1800);
    mark('hoverNew');
    await L.hover(page, page.getByText('אפליקציה חדשה').first(), 1000);
    await wait(page, 1200);
    await L.click(page, page.getByText('אפליקציה חדשה').first(), { ms: 300, wait: 1500 });
    mark('chat');
    await L.click(page, page.locator('textarea[aria-label="הודעה לעוזר"]'), { ms: 700, wait: 300 });
    mark('typing');
    await L.type(page, 'אנחנו עיריית הרצליה. אנחנו צריכים מערכת לניהול הקשר עם התושבים: פניות שמגיעות בטלפון, בוואטסאפ ובאתר, ניתוב שלהן למחלקות, מעקב אחרי זמני הטיפול, ועדכון לתושב כשהטיפול נגמר.', 24);
    await wait(page, 500);
    await L.click(page, page.locator('button.asst-send'), { ms: 500 });
    mark('sent');
    const q = () => page.locator('.question').last();
    const answer = async (opts, next) => {
      await q().locator('.option').first().waitFor({ state: 'visible', timeout: 30000 });
      await wait(page, 1300);
      for (const o of opts) await L.click(page, q().locator('.option').filter({ hasText: o }).first(), { ms: 550, wait: 350 });
      if (next) await L.click(page, q().getByRole('button', { name: 'המשך' }), { ms: 500, wait: 200 });
    };
    mark('q1'); await answer(['מוקד טלפוני של העירייה'], true);
    mark('q2'); await answer(['אחזקה ותשתיות', 'איכות הסביבה', 'חינוך', 'רווחה', 'גבייה'], true);
    mark('q3'); await answer(['התראה מיידית למנהל המחלקה']);
    mark('q4'); await answer(['5 ימים']);
    await waitText(page, 'אישור האפיון', 30000);
    mark('spec');
    await wait(page, 1500);
    await L.scroll(page, 500, 2500);
    await wait(page, 800);
    mark('fix');
    await L.click(page, page.locator('textarea[aria-label="הודעה לעוזר"]'), { ms: 600, wait: 300 });
    await L.type(page, 'להוסיף טופס באתר העירייה, שתושבים יוכלו לפנות ישירות, גם מהטלפון', 30);
    await L.click(page, page.locator('button.asst-send'), { ms: 500 });
    await page.getByText('טופס לתושבים (חדש)').first().waitFor({ state: 'visible', timeout: 30000 });
    mark('spec2');
    await wait(page, 1500);
    await L.hover(page, page.getByText('טופס לתושבים (חדש)').first(), 800).catch(() => {});
    await wait(page, 1500);
    await L.click(page, page.getByRole('button', { name: 'אישור האפיון' }).last(), { ms: 800 });
    mark('building');
    await waitText(page, 'האפליקציה מוכנה בסביבת הבדיקה', 180000);
    mark('built');
    await wait(page, 2500);
    await stop('build');
    await ctx.close();
  },

  async tour() {
    const { ctx, page } = await session('dana.b@herzliya.example', { env: 'test', start: 'requests', app: BAPP() });
    const stop = await L.record(page, OUT);
    const mark = marker('tour');
    await wait(page, 1500);
    await L.hover(page, page.locator('iframe').first(), 800).catch(() => {});
    await wait(page, 800);
    mark('map');
    await L.click(page, nav(page, 'מפת פניות'), { ms: 800, wait: 3200 });
    mark('settings');
    await L.click(page, page.locator('aside.side').getByText('הגדרות').first(), { ms: 900, wait: 2200 });
    for (const t of ['קליטה וניתוב למחלקה', 'דחופה או סכנה', 'התראה מיידית למנהל']) { await L.hover(page, page.getByText(t).first(), 650); await wait(page, 350); }
    const scroller = async (left) => page.getByText('טיפול בשטח').first().evaluate((el, left) => { let p = el; while (p && p.scrollWidth <= p.clientWidth + 2) p = p.parentElement; if (p) p.scrollTo({ left, behavior: 'smooth' }); }, left);
    await scroller(-10000);
    await wait(page, 1300);
    for (const t of ['טיפול בשטח', 'חרגה מהיעד?', 'העברה להנהלה', 'סגירה ועדכון התושב']) { const l = page.getByText(t).first(); if (await l.isVisible().catch(() => false)) { const b = await l.boundingBox(); if (b && b.x > 0) { await L.cursorTo(page, b.x + b.width / 2, b.y + b.height / 2, 550); await wait(page, 300); } } }
    await scroller(10000);
    await wait(page, 900);
    mark('rule');
    const input = page.locator('input[type=number]').first();
    await L.click(page, input, { ms: 900 });
    await page.keyboard.press('Control+A');
    await L.type(page, '4', 80);
    await L.click(page, page.getByRole('button', { name: 'שמירה' }).first(), { ms: 600, wait: 2200 });
    await stop('tour');
    await ctx.close();
  },

  async viewas() {
    const { ctx, page } = await session('dana.b@herzliya.example', { env: 'test', start: 'requests', app: BAPP() });
    const stop = await L.record(page, OUT);
    const mark = marker('viewas');
    await wait(page, 1200);
    const sel = page.locator('label.viewas select');
    mark('open1');
    await L.click(page, sel, { ms: 900, wait: 200 });
    await L.pickFromList(page, sel, 'שירה לוי', { hold: 1300 });
    mark('as1');
    await wait(page, 2500);
    await L.hover(page, page.locator('aside.side').first(), 900);
    await wait(page, 1500);
    mark('open2');
    await L.click(page, sel, { ms: 700, wait: 200 });
    await L.pickFromList(page, sel, 'סמיר חורי', { hold: 1100 });
    mark('as2');
    await wait(page, 3500);
    await stop('viewas');
    await ctx.close();
  },

  async bot() {
    const { ctx, page } = await session('dana.b@herzliya.example', { env: 'test', start: 'requests', app: BAPP() });
    const stop = await L.record(page, OUT);
    const mark = marker('bot');
    await wait(page, 800);
    await L.click(page, page.locator('button.fab'), { ms: 900, wait: 900 });
    mark('list');
    await L.click(page, page.locator('.asst-who'), { ms: 700, wait: 800 });
    await L.click(page, page.getByRole('button', { name: 'בוט חדש' }), { ms: 700, wait: 800 });
    mark('form');
    await L.click(page, page.locator('input[placeholder="למשל: גבייה"]'), { ms: 500, wait: 200 });
    await L.type(page, 'קליטת פניות', 60);
    await L.click(page, page.locator('button[aria-label="צבע #0E7C86"]'), { ms: 600, wait: 300 });
    await L.click(page, page.locator('label').filter({ hasText: 'משותף' }).first(), { ms: 600, wait: 400 });
    await L.click(page, page.locator('.bot-roles label').filter({ hasText: 'מוקד' }).first(), { ms: 600, wait: 400 });
    await L.click(page, page.getByRole('button', { name: 'יצירת הבוט' }), { ms: 700, wait: 1500 });
    mark('talk');
    await L.click(page, page.locator('textarea[aria-label="הודעה לעוזר"]'), { ms: 600, wait: 300 });
    await L.type(page, 'התפקיד שלך הוא לעזור למוקד לקלוט פניות של תושבים מתוך שיחה: לזהות שכונה, תחום ודחיפות, לבדוק שאין כבר פנייה פתוחה על אותו מקום, ולפתוח פנייה חדשה.', 24);
    await L.click(page, page.locator('button.asst-send'), { ms: 500 });
    await waitText(page, 'המוקדנים יראו את הבוט', 60000);
    mark('saved');
    await wait(page, 3000);
    await stop('bot');
    await ctx.close();
  },

  async guided() {
    const { ctx, page } = await session('dana.b@herzliya.example', { env: 'test', start: 'test', app: BAPP() });
    const stop = await L.record(page, OUT);
    const mark = marker('guided');
    await wait(page, 1500);
    for (const s of await page.locator('.step').all()) { await L.hover(page, s, 600); await wait(page, 400); }
    await wait(page, 600);
    mark('publish');
    await L.click(page, page.locator('aside.side').getByText('העלאה לאוויר').first(), { ms: 900, wait: 2200 });
    await L.click(page, page.getByRole('button', { name: 'להעלות לאוויר' }), { ms: 800, wait: 3000 });
    await stop('guided');
    await ctx.close();
  },

  async approve() {
    const { ctx, page } = await session('uri.b@herzliya.example', { env: 'test', start: 'publish', app: BAPP() });
    const stop = await L.record(page, OUT);
    await wait(page, 1500);
    await L.hover(page, page.getByText('בקשה שמחכה לאישור').first(), 900).catch(() => {});
    await wait(page, 1500);
    await L.click(page, page.getByRole('button', { name: 'אישור' }).first(), { ms: 900, wait: 3000 });
    await stop('approve');
    await ctx.close();
  },

  // ---- the result, in the council that has worked with the app for weeks (seed-herzliya.ts)
  async intake() {
    const { ctx, page } = await session('shira@herzliya.example');
    const stop = await L.record(page, OUT);
    const mark = marker('intake');
    await wait(page, 700);
    await L.click(page, page.locator('button.fab'), { ms: 900, wait: 900 });
    await L.click(page, page.locator('.asst-who'), { ms: 700, wait: 800 });
    await L.click(page, page.locator('.bot-pick').filter({ hasText: 'קליטת פניות' }), { ms: 600, wait: 1000 });
    mark('typing');
    await L.click(page, page.locator('textarea[aria-label="הודעה לעוזר"]'), { ms: 500, wait: 300 });
    await L.type(page, 'תושבת מנווה עמל, מיכל אדלר 052-4418830, michal.adler@mail.example, מדווחת שהפנס ברחוב הזיתים מול הצרכנייה לא דולק כבר שלושה ימים', 26);
    await wait(page, 400);
    await L.click(page, page.locator('button.asst-send'), { ms: 500 });
    mark('sent');
    await page.locator('.asst-did').first().waitFor({ state: 'visible', timeout: 60000 });
    mark('created');
    await waitText(page, 'יראה אותה בלוח הטיפול', 60000);
    mark('done');
    await wait(page, 2500);
    await stop('intake');
    await ctx.close();
  },

  async manager() {
    sql("update records set data = jsonb_set(data, '{status}', to_jsonb('חדשה'::text)) where entity='requests' and data->>'title' like 'פנס רחוב לא דולק, רחוב הזיתים%' and env='live'");
    const { ctx, page, app } = await session('amit@herzliya.example');
    const stop = await L.record(page, OUT);
    const mark = marker('manager');
    await wait(page, 900);
    await L.click(page, page.locator('button.bar-icon[aria-label="התראות"]'), { ms: 900, wait: 1200 });
    const note = page.locator('.notes .note').filter({ hasText: 'רחוב הזיתים' }).first();
    await L.hover(page, note, 600);
    await wait(page, 900);
    await L.click(page, page.locator('button.bar-icon[aria-label="התראות"]'), { ms: 400, wait: 500 });
    mark('board');
    await L.click(page, nav(page, 'לוח טיפול'), { ms: 800, wait: 2500 });
    const card = app.locator('.k-kcard').filter({ hasText: 'רחוב הזיתים' }).first();
    await L.hover(page, card, 900);
    await wait(page, 400);
    const sel = card.locator('select.k-kmove');
    mark('move');
    await L.click(page, sel, { ms: 500, wait: 200 });
    await L.pickFromList(page, sel, 'בטיפול', { hold: 1000 });
    await wait(page, 1800);
    mark('map');
    await L.click(page, nav(page, 'מפת פניות'), { ms: 900, wait: 3500 });
    await wait(page, 1500);
    await stop('manager');
    await ctx.close();
  },

  async morning() {
    const { ctx, page } = await session('amit@herzliya.example', { start: 'board' });
    const stop = await L.record(page, OUT);
    const mark = marker('morning');
    await wait(page, 700);
    await L.click(page, page.locator('button.fab'), { ms: 900, wait: 900 });
    await L.click(page, page.locator('.asst-who'), { ms: 700, wait: 800 });
    await L.click(page, page.locator('.bot-pick').filter({ hasText: 'סיכום בוקר' }), { ms: 600, wait: 1000 });
    mark('ask');
    await L.click(page, page.locator('.option').filter({ hasText: 'מה דחוף היום?' }), { ms: 700 });
    await waitText(page, 'כדאי להתחיל', 60000);
    mark('summary');
    await wait(page, 2600);
    await L.click(page, page.locator('textarea[aria-label="הודעה לעוזר"]'), { ms: 500, wait: 300 });
    await L.type(page, 'תסגור את הפנייה על הפנס בנווה עמל', 40);
    await L.click(page, page.locator('button.asst-send'), { ms: 500 });
    await waitText(page, 'לקריאה בלבד', 60000);
    mark('blocked');
    await wait(page, 3000);
    await stop('morning');
    await ctx.close();
  },

  async close() {
    const { ctx, page, app } = await session('amit@herzliya.example');
    const stop = await L.record(page, OUT);
    const mark = marker('close');
    await wait(page, 800);
    const row = app.locator('tr').filter({ hasText: 'רחוב הזיתים' }).first();
    await L.hover(page, row, 900);
    await L.click(page, row.getByRole('button', { name: 'סגירה' }), { ms: 700, wait: 900 });
    mark('modal');
    await L.click(page, app.locator('textarea').first(), { ms: 600, wait: 300 });
    await L.type(page, 'הוחלפה נורה בפנס, נבדק בערב ודולק', 38);
    await L.click(page, app.getByRole('button', { name: 'סגירה ועדכון התושב' }), { ms: 700, wait: 2600 });
    await stop('close');
    await ctx.close();
  },

  async automation() {
    sql("update emails set status = 'sent', sent_at = now(), note = null where status in ('held','queued','failed','sending')");
    const { ctx, page } = await session('dana@herzliya.example', { start: 'automation' });
    const stop = await L.record(page, OUT);
    await wait(page, 900);
    await L.hover(page, page.getByText('הפנייה שלך לעירייה טופלה').first(), 1000).catch(() => {});
    await wait(page, 2500);
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
    await L.type(page, 'בור גדול בכביש ליד הכניסה לשכונה', 40);
    await L.click(page, field('שכונה וכתובת'), { ms: 500, wait: 200 });
    await L.type(page, 'שביב, רחוב סוקולוב', 40);
    await L.click(page, field('פירוט'), { ms: 500, wait: 200 });
    await L.type(page, 'הבור בצד ימין, ליד תחנת האוטובוס. מסוכן לרוכבי אופניים', 32);
    await wait(page, 600);
    await L.click(page, page.getByRole('button', { name: 'שליחת הפנייה' }), { ms: 800, wait: 2800 });
    await stop('public');
    await ctx.close();
  },

  async overview() {
    const { ctx, page } = await session('uri@herzliya.example', { start: 'overview' });
    const stop = await L.record(page, OUT);
    await wait(page, 1500);
    await L.hover(page, page.locator('iframe').first(), 800);
    await wait(page, 600);
    await L.scroll(page, 450, 1600);
    await wait(page, 2500);
    await stop('overview');
    await ctx.close();
  },

  async change() {
    const { ctx, page } = await session('dana@herzliya.example', { start: 'requests' });
    const stop = await L.record(page, OUT);
    const mark = marker('change');
    await wait(page, 700);
    await L.click(page, page.locator('button.fab'), { ms: 900, wait: 1000 });
    await L.click(page, page.locator('textarea[aria-label="הודעה לעוזר"]'), { ms: 500, wait: 300 });
    await L.type(page, 'אני רוצה שכל יום ראשון בבוקר כל רכז שכונה יקבל במייל את הפניות הפתוחות בשכונה שלו, ושבפנייה יהיה סימון "ועד השכונה עודכן"', 26);
    await L.click(page, page.locator('button.asst-send'), { ms: 500 });
    await waitText(page, 'אישור האפיון', 60000);
    mark('spec');
    await wait(page, 2000);
    await L.click(page, page.getByRole('button', { name: 'אישור האפיון' }), { ms: 800 });
    mark('building');
    await waitText(page, 'גרסה חדשה מוכנה', 120000);
    mark('done');
    await wait(page, 2500);
    await stop('change');
    await ctx.close();
  },
};

(async () => {
  browser = await chromium.launch();
  const names = process.argv.slice(2).length ? process.argv.slice(2) : ['intake', 'manager', 'morning', 'close', 'automation', 'public', 'overview', 'change'];
  for (const n of names) {
    try { await CLIPS[n](); } catch (e) { console.error(`clip ${n} failed:`, e.message.split('\n')[0]); }
  }
  await browser.close();
  const fs = require('fs');
  const file = OUT + '/marks.json';
  const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  fs.writeFileSync(file, JSON.stringify(Object.assign(all, MARKS), null, 2));
})();
