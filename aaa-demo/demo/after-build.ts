// After the assistant built the app in the film: roles for the people, and sample inquiries in the test environment
// (the communities and departments come from the app's own seed.json).
import { appById, ctxFor } from '../server/platform/apps.ts';
import { listRecords, writeRecord } from '../server/platform/data.ts';
import { one, pool, q } from '../server/db/pool.ts';

const app = (await one<{ id: string }>(`select a.id from apps a join orgs o on o.id = a.org_id where o.slug = 'emek-build' order by a.created_at desc limit 1`))!;
const uid = async (e: string) => (await one<{ id: string }>(`select id from users where email = $1`, [e]))!.id;
const roles: [string, string][] = [['shira.b@emek.example', 'moked'], ['amit.b@emek.example', 'deptManager'], ['samir.b@emek.example', 'staff'], ['uri.b@emek.example', 'management']];
for (const [e, r] of roles) await q(`insert into app_roles (app_id, user_id, role) values ($1, $2, $3) on conflict do nothing`, [app.id, await uid(e), r]);
const fresh = (await appById(app.id))!;
const admin = await ctxFor(fresh, 'test', { userId: await uid('dana.b@emek.example'), name: 'דנה כרמי', roles: [], admin: true });
const depts = await listRecords(admin, 'departments');
const amit = await uid('amit.b@emek.example');
for (const d of depts) if (d.name === 'אחזקה ותשתיות') await writeRecord(admin, 'departments', d.id, { manager: amit });
const comm = Object.fromEntries((await listRecords(admin, 'communities')).map((c) => [String(c.name), c]));
const ROWS: [string, string, string, string][] = [
  ['פנס רחוב לא דולק', 'תאורת רחוב', 'נהלל', 'רגילה'], ['בור בכביש הכניסה', 'כבישים ומדרכות', 'מרחביה', 'סכנה בטיחותית'], ['פח אשפה לא פונה', 'פסולת וניקיון', 'גבת', 'רגילה'],
  ['נזילת מים מצינור ראשי', 'מים וביוב', 'כפר יהושע', 'דחופה'], ['גזם בצד הדרך', 'גינון ושטחים פתוחים', 'יפעת', 'רגילה'], ['הסעה לבית הספר לא הגיעה', 'חינוך', 'תמרת', 'דחופה'],
  ['בקשה לליווי משפחה', 'רווחה', 'שריד', 'רגילה'], ['שאלה על הנחה בארנונה', 'ארנונה וגבייה', 'בלפוריה', 'רגילה'],
];
for (const [title, category, c, urgency] of ROWS) {
  const loc = comm[c]?.location as { lat: number; lng: number } | undefined;
  await writeRecord(admin, 'requests', null, { title, category, community: comm[c]?.id, urgency, residentName: 'תושב לדוגמה', channel: 'מוקד טלפוני', location: loc });
}
const one1 = (await listRecords(admin, 'requests')).find((r) => r.title === 'פח אשפה לא פונה')!;
await writeRecord(admin, 'requests', one1.id, { status: 'טופלה', resolution: 'הפח פונה' });
console.log('after-build done', app.id);
await pool.end();
