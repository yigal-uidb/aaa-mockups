// A second copy of the council, with no apps yet: the film builds its app from scratch in conversation.
import { hashPassword } from '../server/auth.ts';
import { migrate, one, pool, q } from '../server/db/pool.ts';

const PEOPLE: [string, string, 'admin' | 'member'][] = [
  ['דנה כרמי', 'dana.b@herzliya.example', 'admin'], ['אורי בן דוד', 'uri.b@herzliya.example', 'admin'],
  ['שירה לוי', 'shira.b@herzliya.example', 'member'], ['עמית גולן', 'amit.b@herzliya.example', 'member'], ['סמיר חורי', 'samir.b@herzliya.example', 'member'],
];
await migrate();
if (!(await one(`select 1 from orgs where slug = 'herzliya-build'`))) {
  const org = (await one<{ id: string }>(`insert into orgs (name, slug, branding) values ('עיריית הרצליה', 'herzliya-build', $1) returning id`, [JSON.stringify({ primary: '#1F6E4A', accent: '#D9A23A' })]))!;
  for (const [name, email, role] of PEOPLE) {
    const u = (await one<{ id: string }>(`insert into users (email, name, password_hash) values ($1, $2, $3) on conflict (email) do update set name = excluded.name returning id`, [email, name, hashPassword('demo1234')]))!;
    await q(`insert into memberships (org_id, user_id, role) values ($1, $2, $3) on conflict do nothing`, [org.id, u.id, role]);
  }
  console.log('seeded herzliya-build');
}
await pool.end();
