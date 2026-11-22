// A second copy of the council, with no apps yet: the film builds its app from scratch in conversation.
import { hashPassword } from '../server/auth.ts';
import { migrate, one, pool, q } from '../server/db/pool.ts';

const PEOPLE: [string, string, 'admin' | 'member'][] = [
  ['דנה כרמי', 'dana.b@emek.example', 'admin'], ['אורי בן דוד', 'uri.b@emek.example', 'admin'],
  ['שירה לוי', 'shira.b@emek.example', 'member'], ['עמית גולן', 'amit.b@emek.example', 'member'], ['סמיר חורי', 'samir.b@emek.example', 'member'],
];
await migrate();
if (!(await one(`select 1 from orgs where slug = 'emek-build'`))) {
  const org = (await one<{ id: string }>(`insert into orgs (name, slug, branding) values ('מועצה אזורית עמק יזרעאל', 'emek-build', $1) returning id`, [JSON.stringify({ primary: '#1F6E4A', accent: '#D9A23A' })]))!;
  for (const [name, email, role] of PEOPLE) {
    const u = (await one<{ id: string }>(`insert into users (email, name, password_hash) values ($1, $2, $3) on conflict (email) do update set name = excluded.name returning id`, [email, name, hashPassword('demo1234')]))!;
    await q(`insert into memberships (org_id, user_id, role) values ($1, $2, $3) on conflict do nothing`, [org.id, u.id, role]);
  }
  console.log('seeded emek-build');
}
await pool.end();
