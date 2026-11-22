// Demo organization for the film: "מועצה אזורית עמק יזרעאל" with the resident-relations app. All people are fictional.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../server/auth.ts';
import { appById, createApp, ctxFor } from '../server/platform/apps.ts';
import { writeRecord } from '../server/platform/data.ts';
import { readAppDir } from '../server/platform/files.ts';
import { migrate, one, pool, q } from '../server/db/pool.ts';
import { ensureAdmin } from '../server/db/seed-admin.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PEOPLE: { name: string; email: string; org: 'admin' | 'member'; role?: string }[] = [
  { name: 'דנה כרמי', email: 'dana@emek.example', org: 'admin', role: 'management' },
  { name: 'אורי בן דוד', email: 'uri@emek.example', org: 'admin', role: 'management' },
  { name: 'שירה לוי', email: 'shira@emek.example', org: 'member', role: 'moked' },
  { name: 'יוסי אברהם', email: 'yossi@emek.example', org: 'member', role: 'moked' },
  { name: 'עמית גולן', email: 'amit@emek.example', org: 'member', role: 'deptManager' },
  { name: 'סמיר חורי', email: 'samir@emek.example', org: 'member', role: 'staff' },
  { name: 'רונית שחר', email: 'ronit@emek.example', org: 'member', role: 'deptManager' },
  { name: 'נעמה פרץ', email: 'naama@emek.example', org: 'member', role: 'deptManager' },
  { name: 'גלעד מור', email: 'gilad@emek.example', org: 'member', role: 'deptManager' },
];
const COMMUNITIES: [string, string, number, number][] = [
  ['נהלל', 'מושב', 32.6905, 35.1975], ['כפר יהושע', 'מושב', 32.6812, 35.1536], ['גבת', 'קיבוץ', 32.6724, 35.2131],
  ['יפעת', 'קיבוץ', 32.6667, 35.2425], ['מזרע', 'קיבוץ', 32.6519, 35.2878], ['מרחביה', 'מושב', 32.6037, 35.3076],
  ['בלפוריה', 'מושב', 32.6316, 35.2910], ['תל עדשים', 'מושב', 32.6553, 35.3036], ['שריד', 'קיבוץ', 32.6697, 35.2244],
  ['רמת דוד', 'קיבוץ', 32.6827, 35.1864], ['תמרת', 'יישוב קהילתי', 32.7036, 35.2283], ['גניגר', 'קיבוץ', 32.6512, 35.2556],
  ['הושעיה', 'יישוב קהילתי', 32.7338, 35.2527], ['אלוני אבא', 'מושב', 32.7290, 35.1720],
];
const DEPTS: [string, string, string][] = [
  ['אחזקה ותשתיות', 'amit@emek.example', 'מים וביוב, תאורת רחוב, כבישים ומדרכות, בטיחות ומפגעים'],
  ['איכות הסביבה', 'ronit@emek.example', 'פסולת וניקיון, גינון ושטחים פתוחים'],
  ['רווחה ושירותים חברתיים', 'naama@emek.example', 'רווחה'],
  ['חינוך', 'gilad@emek.example', 'חינוך'],
  ['גבייה', 'gilad@emek.example', 'ארנונה וגבייה, אחר'],
];
// title, category, urgency
const TOPICS: [string, string, string][] = [
  ['פנס רחוב לא דולק', 'תאורת רחוב', 'רגילה'], ['נזילת מים מצינור ראשי', 'מים וביוב', 'דחופה'], ['בור בכביש הכניסה', 'כבישים ומדרכות', 'סכנה בטיחותית'],
  ['פח אשפה לא פונה', 'פסולת וניקיון', 'רגילה'], ['גזם בצד הדרך', 'גינון ושטחים פתוחים', 'רגילה'], ['ביוב עולה ליד הגן', 'מים וביוב', 'דחופה'],
  ['מדרכה שבורה ליד בית הכנסת', 'כבישים ומדרכות', 'רגילה'], ['עץ נוטה לכיוון חוטי חשמל', 'בטיחות ומפגעים', 'סכנה בטיחותית'], ['שאלה על הנחה בארנונה', 'ארנונה וגבייה', 'רגילה'],
  ['בקשה לליווי משפחה', 'רווחה', 'רגילה'], ['הסעה לבית הספר לא הגיעה', 'חינוך', 'דחופה'], ['תאורה כבויה במגרש המשחקים', 'תאורת רחוב', 'רגילה'],
  ['פסולת בניין בשטח פתוח', 'פסולת וניקיון', 'רגילה'], ['השקיה פועלת בצהריים', 'גינון ושטחים פתוחים', 'רגילה'], ['מכסה ביוב חסר', 'בטיחות ומפגעים', 'סכנה בטיחותית'],
  ['רישום לצהרון', 'חינוך', 'רגילה'], ['כלב משוטט ליד בית הספר', 'בטיחות ומפגעים', 'דחופה'], ['לחץ מים נמוך', 'מים וביוב', 'רגילה'],
  ['ספסל שבור בגן הציבורי', 'גינון ושטחים פתוחים', 'רגילה'], ['מתקן משחקים פגום', 'בטיחות ומפגעים', 'דחופה'], ['ריח ביוב ליד המרכז המסחרי', 'מים וביוב', 'רגילה'],
  ['שלט רחוב חסר', 'כבישים ומדרכות', 'רגילה'], ['בקשה לפינוי גרוטאות', 'פסולת וניקיון', 'רגילה'], ['עשבייה גבוהה ליד הגדר', 'גינון ושטחים פתוחים', 'רגילה'],
  ['חשבון ארנונה כפול', 'ארנונה וגבייה', 'רגילה'], ['מעבר חצייה דהוי', 'כבישים ומדרכות', 'רגילה'], ['פנס מהבהב בכניסה ליישוב', 'תאורת רחוב', 'רגילה'],
  ['בקשה לסיוע לקשיש בודד', 'רווחה', 'דחופה'], ['מזגן לא עובד בגן הילדים', 'חינוך', 'דחופה'], ['צינור השקיה פרוץ', 'מים וביוב', 'רגילה'],
  ['מכולת אשפה עולה על גדותיה', 'פסולת וניקיון', 'רגילה'], ['ענפים על המדרכה אחרי הסערה', 'גינון ושטחים פתוחים', 'רגילה'], ['מכסה שוחה רועד בכביש', 'כבישים ומדרכות', 'רגילה'],
];
const NAMES = ['מיכל אדלר', 'יוסף נחום', 'רחל גרוס', 'אבי שטרן', 'ליאת בר', 'עומר זיו', 'תמר הדר', 'אלון ברקן', 'נוי כץ', 'חן אלמוג', 'רועי סגל', 'הילה מרום', 'עידו פלג', 'שני אורן', 'דוד ענבר', 'מאיה רז'];
const CHANNELS = ['מוקד טלפוני', 'מוקד טלפוני', 'טופס באתר', 'וואטסאפ', 'בעל תפקיד ביישוב'];
const RESOLUTIONS = ['הוחלפה נורה ונבדק הפנס', 'הצוות תיקן את הצינור והזרם חזר', 'הבור מולא ואוספלט', 'הפח פונה ונקבע פינוי נוסף בשבוע', 'הגזם פונה', 'נקבעה פגישה עם העובדת הסוציאלית', 'התשובה נשלחה לתושב'];

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const dayAgo = (n: number) => new Date(Date.now() - n * 86400000);

await migrate();
await ensureAdmin();
if (await one(`select 1 from orgs where slug = 'emek'`)) { console.log('exists'); await pool.end(); process.exit(0); }
const org = (await one<{ id: string }>(`insert into orgs (name, slug, website, branding) values ('מועצה אזורית עמק יזרעאל', 'emek', null, $1) returning id`, [JSON.stringify({ primary: '#1F6E4A', accent: '#D9A23A' })]))!;
const ids: Record<string, string> = {};
for (const p of PEOPLE) {
  const u = (await one<{ id: string }>(`insert into users (email, name, password_hash) values ($1, $2, $3) on conflict (email) do update set name = excluded.name returning id`, [p.email, p.name, hashPassword('demo1234')]))!;
  ids[p.email] = u.id;
  await q(`insert into memberships (org_id, user_id, role) values ($1, $2, $3) on conflict do nothing`, [org.id, u.id, p.org]);
}
const { app } = await createApp(org.id, 'moked', readAppDir(path.join(root, 'apps/emek-moked')), ids['dana@emek.example']);
for (const p of PEOPLE) if (p.role) await q(`insert into app_roles (app_id, user_id, role) values ($1, $2, $3)`, [app.id, ids[p.email], p.role]);
const fresh = (await appById(app.id))!;
const admin = await ctxFor(fresh, 'test', { userId: ids['dana@emek.example'], name: 'דנה כרמי', roles: ['management'], admin: true });

const comm: { id: string; name: string; lat: number; lng: number }[] = [];
for (const [name, kind, lat, lng] of COMMUNITIES) {
  const r = await writeRecord(admin, 'communities', null, { name, kind, location: { lat, lng } });
  comm.push({ id: r.id, name, lat, lng });
}
for (const [name, mgr, categories] of DEPTS) await writeRecord(admin, 'departments', null, { name, manager: ids[mgr], categories });

const moked = await ctxFor(fresh, 'test', { userId: ids['shira@emek.example'], name: 'שירה לוי', roles: ['moked'], admin: false });
for (let i = 0; i < 126; i++) {
  const age = i < 8 ? Math.floor(rnd() * 2) : i < 52 ? 2 + Math.floor(rnd() * 23) : 25 + Math.floor(rnd() * 155);
  const [title, category, urgency] = TOPICS[(i * 7 + Math.floor(i / TOPICS.length)) % TOPICS.length];
  const c = pick(comm);
  const rec = await writeRecord(moked, 'requests', null, {
    title, category, urgency, community: c.id, residentName: pick(NAMES), residentPhone: '05' + Math.floor(20000000 + rnd() * 79999999),
    channel: pick(CHANNELS), location: { lat: c.lat + (rnd() - 0.5) * 0.008, lng: c.lng + (rnd() - 0.5) * 0.008 },
  });
  const created = dayAgo(age);
  const sla = urgency === 'רגילה' ? 5 : 1;
  const due = new Date(created.getTime() + sla * 86400000).toISOString().slice(0, 10);
  const patch: Record<string, unknown> = { dueDate: due };
  if (age > 24 || (age > 2 && rnd() < 0.5)) {
    const took = Math.max(0, Math.round((urgency === 'רגילה' ? 1 + rnd() * 6 : rnd() * 2)));
    patch.status = rnd() < 0.5 ? 'נסגרה' : 'טופלה';
    patch.resolution = pick(RESOLUTIONS);
    patch.closedOn = new Date(Math.min(Date.now(), created.getTime() + took * 86400000)).toISOString().slice(0, 10);
    if (rnd() < 0.7) patch.satisfaction = rnd() < 0.75 ? 5 : rnd() < 0.6 ? 4 : 3;
  } else if (age >= 1) {
    patch.status = pick(['בטיפול', 'בטיפול', 'ממתינה לקבלן', 'חדשה']);
    if (rnd() < 0.75) patch.dueDate = new Date(Date.now() + (1 + Math.floor(rnd() * 4)) * 86400000).toISOString().slice(0, 10);
    if (String(patch.dueDate) < new Date().toISOString().slice(0, 10)) patch.overdue = true;
  }
  await q(`update records set data = data || $2::jsonb, created_at = $3, updated_at = $3 where id = $1`, [rec.id, JSON.stringify(patch), created.toISOString()]);
}
// bots: a shared one for the call center, a personal read-only one for the maintenance manager
await q(`insert into bots (org_id, app_id, owner_id, name, color, shared, share_roles, goals, behavior, read_only, suggestions) values
  ($1, $2, $3, 'קליטת פניות', '#0E7C86', true, '["moked"]', 'לעזור למוקד לקלוט פנייה של תושב בשיחה: לזהות יישוב, תחום ודחיפות, לבדוק אם כבר יש פנייה פתוחה על אותו מקום, ולפתוח פנייה חדשה', 'קצר ולעניין. לפני פתיחת פנייה לסכם אותה במשפט אחד', false, '["תושב מנהלל מדווח על פנס כבוי", "יש פניות פתוחות בכפר יהושע?"]'),
  ($1, $2, $4, 'סיכום בוקר', '#5B3FB5', false, '[]', 'לסכם לי כל בוקר מה פתוח במחלקה: חריגות, פניות דחופות ומה נסגר אתמול', 'רשימה קצרה, הכי דחוף ראשון', true, '["מה דחוף היום?", "כמה פניות חרגו מהיעד?"]')`,
  [org.id, app.id, ids['dana@emek.example'], ids['amit@emek.example']]);
// the app went live a few weeks ago (approved by a second admin), with the same data in the live environment
const v = (await one<{ test_version_id: string }>(`select test_version_id from apps where id = $1`, [app.id]))!;
await q(`update apps set live_version_id = test_version_id where id = $1`, [app.id]);
await q(`insert into publish_requests (app_id, version_id, requested_by, status, decided_by, decided_at, created_at) values ($1, $2, $3, 'approved', $4, now() - interval '40 days', now() - interval '41 days')`, [app.id, v.test_version_id, ids['dana@emek.example'], ids['uri@emek.example']]);
const rows = await q<{ id: string; entity: string; data: unknown; owner_id: string | null; created_by: string | null; created_at: string; updated_at: string }>(`select id, entity, data, owner_id, created_by, created_at, updated_at from records where app_id = $1 and env = 'test'`, [app.id]);
const map = new Map(rows.map((r) => [r.id, crypto.randomUUID()]));
for (const r of rows) {
  let text = JSON.stringify(r.data);
  for (const [a, b] of map) text = text.split(a).join(b);
  await q(`insert into records (id, app_id, env, entity, data, owner_id, created_by, created_at, updated_at) values ($1, $2, 'live', $3, $4, $5, $6, $7, $8)`, [map.get(r.id), app.id, r.entity, text, r.owner_id, r.created_by, r.created_at, r.updated_at]);
}
await q(`delete from notifications where org_id = $1`, [org.id]).catch(() => q(`delete from notifications`));
console.log('seeded emek', app.id);
await pool.end();
