// The real AAA server for recording the film, with a scripted model in place of Claude: every tool call it makes runs
// for real (searching, creating records, the read-only guard of a bot, building a new version). Only the words are prepared.
import { readFileSync } from 'node:fs';
import { buildServer } from '../server/index.ts';
import { setAssistantModel } from '../server/routes/assistant.ts';
import { migrate, one, q } from '../server/db/pool.ts';
import { config } from '../server/config.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const say = (text: string) => ({ type: 'text', text });
const use = (name: string, input: object) => ({ type: 'tool_use', id: `toolu_demo_${++n}`, name, input });

const APP = async () => (await one<{ id: string }>(`select a.id from apps a join orgs o on o.id = a.org_id where o.slug = 'emek'`))!.id;
const idOf = async (entity: string, name: string) =>
  (await one<{ id: string }>(`select id from records where app_id = $1 and env = 'live' and entity = $2 and data->>'name' = $3`, [await APP(), entity, name]))!.id;
const userId = async (email: string) => (await one<{ id: string }>(`select id from users where email = $1`, [email]))!.id;
const fmt = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
const plusDays = (k: number) => new Date(Date.now() + k * 86400000).toISOString().slice(0, 10);

type Step = () => Promise<any[]>;
type Scenario = { match: (text: string) => boolean; steps: Step[]; then?: Scenario };
let current: Step[] = [];
let pending: Scenario | null = null;

const intake: Scenario = {
  match: (t) => t.includes('מנהלל'),
  steps: [
    async () => [say('בודק אם כבר יש פנייה פתוחה על פנס בנהלל.'), use('find_records', { entity: 'requests', search: 'פנס', where: { community: await idOf('communities', 'נהלל'), status: 'בטיפול' } })],
    async () => [
      say('אין פנייה פתוחה על המקום. פותח פנייה חדשה.'),
      use('create_record', {
        entity: 'requests',
        data: {
          title: 'פנס רחוב לא דולק, רחוב הזיתים מול הצרכנייה', category: 'תאורת רחוב', community: await idOf('communities', 'נהלל'),
          residentName: 'מיכל אדלר', residentPhone: '052-4418830', residentEmail: 'michal.adler@mail.example', channel: 'מוקד טלפוני', urgency: 'רגילה',
          description: 'הפנס ברחוב הזיתים, מול הצרכנייה, לא דולק כבר שלושה ימים', location: { lat: 32.6912, lng: 35.1968 },
        },
      }),
    ],
    async () => {
      const r = await one<{ id: string; data: any }>(`select id, data from records where app_id = $1 and entity = 'requests' and data->>'residentName' = 'מיכל אדלר' order by created_at desc limit 1`, [await APP()]);
      return [use('open_page', { page: 'requests', entity: 'requests', record_id: r!.id })];
    },
    async () => {
      const r = await one<{ data: any }>(`select data from records where app_id = $1 and entity = 'requests' and data->>'residentName' = 'מיכל אדלר' order by created_at desc limit 1`, [await APP()]);
      return [say(`הפנייה נפתחה ונותבה למחלקת אחזקה ותשתיות, עם יעד לטיפול עד ${fmt(r!.data.dueDate)}. עמית גולן, מנהל המחלקה, יראה אותה בלוח הטיפול.`)];
    },
  ],
};

const morning: Scenario = {
  match: (t) => t.includes('דחוף היום'),
  steps: [
    async () => [use('find_records', { entity: 'requests', where: { department: await idOf('departments', 'אחזקה ותשתיות') }, limit: 50 })],
    async () => {
      const app = await APP();
      const dept = await idOf('departments', 'אחזקה ותשתיות');
      const rows = await q<{ data: any; community: string }>(
        `select r.data, c.data->>'name' as community from records r left join records c on c.id::text = r.data->>'community'
          where r.app_id = $1 and r.env = 'live' and r.entity = 'requests' and r.data->>'department' = $2 and r.data->>'status' in ('חדשה','בטיפול','ממתינה לקבלן')`, [app, dept]);
      const today = plusDays(0);
      const late = rows.filter((r) => r.data.dueDate < today);
      const danger = rows.filter((r) => r.data.urgency !== 'רגילה' && r.data.dueDate >= today);
      const line = (r: any) => `- ${r.data.title}, ${r.community}`;
      const text = [
        `בוקר טוב עמית. במחלקה ${rows.length} פניות פתוחות.`,
        '',
        `**דחוף היום (${danger.length}):**`, ...danger.slice(0, 4).map(line),
        '',
        `**עברו את היעד (${late.length}):**`, ...late.slice(0, 4).map((r) => `${line(r)} (יעד ${fmt(r.data.dueDate)})`),
        '',
        'כדאי להתחיל מהמפגעים הבטיחותיים.',
      ].join('\n');
      return [say(text)];
    },
  ],
};

const readOnly: Scenario = {
  match: (t) => t.includes('תסגור'),
  steps: [
    async () => {
      const r = await one<{ id: string }>(`select id from records where app_id = $1 and entity = 'requests' and data->>'residentName' = 'מיכל אדלר' order by created_at desc limit 1`, [await APP()]);
      return [use('update_record', { entity: 'requests', id: r!.id, data: { status: 'טופלה', resolution: 'הוחלפה נורה' } })];
    },
    async () => [say('אני בוט לקריאה בלבד, ולכן אין לי אפשרות לשנות פניות. אפשר לסגור אותה בלוח הטיפול, בכפתור "סגירה".')],
  ],
};

const NEW_APP_JSON = () => {
  const m = JSON.parse(readFileSync(new URL('../apps/emek-moked/app.json', import.meta.url), 'utf8'));
  m.entities[0].fields.splice(m.entities[0].fields.findIndex((f: any) => f.key === 'resolution'), 0, { key: 'committeeUpdated', label: 'ועד היישוב עודכן', type: 'boolean' });
  const c = m.entities.find((e: any) => e.key === 'communities');
  c.fields.splice(3, 0, { key: 'contactEmail', label: 'הדואר של רכז/ת היישוב', type: 'text' });
  m.schedules.push({ key: 'weeklyCommunity', title: 'סיכום שבועי לרכזי היישובים: הפניות הפתוחות ביישוב', every: 'week', at: '08:00', weekday: 0 });
  return JSON.stringify(m, null, 2);
};
const WEEKLY_JS = `

// כל יום ראשון בבוקר: לכל רכז יישוב, הפניות הפתוחות ביישוב שלו
app.schedules.weeklyCommunity = () => {
  const open = db.list('requests').filter((r) => OPEN.includes(r.status));
  db.list('communities').filter((c) => String(c.contactEmail || '').trim()).forEach((c) => {
    const mine = open.filter((r) => r.community === c.id);
    if (!mine.length) return;
    sendEmail({ email: String(c.contactEmail).trim() }, 'הפניות הפתוחות ב' + c.name + ' השבוע',
      'שלום ' + (c.contact || '') + ',\\n\\nאלה הפניות הפתוחות מהיישוב:\\n' + mine.map((r) => '- ' + r.title + ' (' + r.status + ')').join('\\n') + '\\n\\nמוקד המועצה');
  });
};
`;

const change: Scenario = {
  match: (t) => t.includes('רכז'),
  steps: [
    async () => [
      say('בשמחה. כך אני מבין את הבקשה:'),
      use('present_spec', {
        title: 'סיכום שבועי לרכזי היישובים',
        sections: [
          { title: 'מה מתווסף', items: ['שדה "הדואר של רכז/ת היישוב" במסך היישובים', 'שדה "ועד היישוב עודכן" בכל פנייה'] },
          { title: 'סיכום שבועי', items: ['כל יום ראשון ב-08:00', 'כל רכז מקבל במייל את הפניות הפתוחות ביישוב שלו', 'יישוב בלי פניות פתוחות לא מקבל מייל'] },
          { title: 'מה לא משתנה', items: ['ההרשאות, הניתוב ויעדי הטיפול נשארים כמו שהם'] },
        ],
      }),
    ],
  ],
  then: {
    match: () => true,
    steps: [
      async () => [use('read_app_files', {})],
      async () => [use('write_file', { path: 'app.json', content: NEW_APP_JSON() })],
      async () => {
        const js = readFileSync(new URL('../apps/emek-moked/server.js', import.meta.url), 'utf8');
        return [use('write_file', { path: 'server.js', content: js + WEEKLY_JS })];
      },
      async () => [use('publish_version', { note: 'סיכום שבועי לרכזי היישובים, ושדה "ועד היישוב עודכן" בפנייה' })],
      async () => [say('גרסה חדשה מוכנה בסביבת הבדיקה. אפשר לנסות אותה, ואחר כך לבקש העלאה לאוויר. מנהל נוסף במועצה יתבקש לאשר.')],
    ],
  },
};


const appFile = (f: string) => readFileSync(new URL('../apps/emek-moked/' + f, import.meta.url), 'utf8');
const SPEC_BASE = [
  { title: 'מי משתמש במערכת', items: ['מוקד: קולט פניות ופותח אותן', 'עובד מחלקה: מטפל בפניות של המחלקה', 'מנהל מחלקה: מקבל התראות, רואה את כל העבודה של המחלקה', 'הנהלת המועצה: תמונת מצב, ופניות שחרגו מהיעד'] },
  { title: 'תהליך העבודה', items: ['פנייה נקלטת ומנותבת אוטומטית למחלקה לפי התחום', 'דחופה או סכנה בטיחותית: התראה מיידית למנהל המחלקה', 'יעד לטיפול: 5 ימים לפנייה רגילה, יום אחד לדחופה', 'כל בוקר: בדיקת חריגות, ופנייה שחרגה ב-3 ימים עוברת להנהלה', 'סגירה מחייבת לכתוב מה נעשה, והתושב מקבל עדכון במייל'] },
  { title: 'פנייה', items: ['נושא, תחום, יישוב, דחיפות, פירוט, תמונה ומיקום', 'פרטי התושב, וערוץ הפנייה (טלפון, וואטסאפ, אתר)', 'מחלקה ומטפל, סטטוס ויעד לטיפול'] },
  { title: 'מסכים', items: ['פניות, עם מה פתוח, מה דחוף ומה חרג', 'לוח טיפול לפי סטטוס', 'מפת פניות של יישובי המועצה', 'תמונת מצב להנהלה'] },
  { title: 'מה המועצה משנה בעצמה, בלי גרסה חדשה', items: ['ימי היעד לטיפול', 'ימי חריגה עד העברה להנהלה'] },
];
const PUBLIC_SEC = { title: 'טופס לתושבים (חדש)', items: ['טופס באתר המועצה, בלי כניסה למערכת, נוח גם מהטלפון', 'כל פנייה מהטופס נכנסת ישר למוקד, עם התראה למוקדנים'] };
const ask = (question: string, options: string[], multi = false) => use('ask_question', { question, options, multi });

const newApp: Scenario = {
  match: (t) => t.includes('הקשר עם התושבים'),
  steps: [async () => [say('נשמע כמו מערכת מוקד ופניות. כמה שאלות קצרות לפני שאני מסכם.'), ask('מי קולט את הפניות מהתושבים?', ['מוקד טלפוני של המועצה', 'מזכירויות היישובים', 'המחלקות עצמן'], true)]],
  then: {
    match: () => true,
    steps: [async () => [ask('אילו מחלקות מטפלות בפניות?', ['אחזקה ותשתיות', 'איכות הסביבה', 'חינוך', 'רווחה', 'גבייה'], true)]],
    then: {
      match: () => true,
      steps: [async () => [ask('מה קורה כשמגיעה פנייה דחופה, או סכנה בטיחותית?', ['התראה מיידית למנהל המחלקה', 'מעבירים ישר להנהלה', 'מטפלים לפי התור הרגיל'])]],
      then: {
        match: () => true,
        steps: [async () => [ask('תוך כמה זמן צריך לטפל בפנייה רגילה?', ['3 ימים', '5 ימים', 'שבוע'])]],
        then: {
          match: () => true,
          steps: [async () => [say('תודה. זה האפיון, לפני שאני בונה:'), use('present_spec', { title: 'פניות תושבים, מועצה אזורית עמק יזרעאל', sections: SPEC_BASE })]],
          then: {
            match: () => true,
            steps: [async () => [say('הוספתי טופס לתושבים. זה האפיון המעודכן:'), use('present_spec', { title: 'פניות תושבים, מועצה אזורית עמק יזרעאל', sections: [...SPEC_BASE.slice(0, 4), PUBLIC_SEC, SPEC_BASE[4]] })]],
            then: {
              match: () => true,
              steps: [
                async () => [use('write_file', { path: 'app.json', content: appFile('app.json') })],
                async () => [use('write_file', { path: 'server.js', content: appFile('server.js') })],
                async () => [use('write_file', { path: 'ui/index.jsx', content: appFile('ui/index.jsx') })],
                async () => [use('write_file', { path: 'seed.json', content: appFile('seed.json') })],
                async () => [use('publish_version', { note: 'גרסה ראשונה, מהאפיון שאושר', slug: 'moked' })],
                async () => [say('האפליקציה מוכנה בסביבת הבדיקה, עם היישובים והמחלקות. אפשר להיכנס ולנסות.')],
              ],
            },
          },
        },
      },
    },
  },
};

const botSetup: Scenario = {
  match: (t) => t.includes('התפקיד שלך הוא'),
  steps: [
    async () => [say('הבנתי. אני שומר את ההגדרות.'), use('set_bot_profile', {
      goals: 'לעזור למוקד לקלוט פנייה של תושב מתוך שיחה: לזהות יישוב, תחום ודחיפות, לבדוק שאין כבר פנייה פתוחה על אותו מקום, ולפתוח פנייה חדשה',
      behavior: 'קצר ולעניין. לפני שפותחים פנייה, לסכם אותה במשפט אחד',
      read_only: false,
      suggestions: ['תושב מנהלל מדווח על פנס כבוי', 'יש פניות פתוחות בכפר יהושע?'],
    })],
    async () => [say('מוכן. המוקדנים יראו את הבוט בחלון העוזר, והוא יפעל בהרשאות של מי שמדבר איתו.')],
  ],
};

const SCENARIOS = [newApp, botSetup, intake, morning, readOnly, change];

setAssistantModel({
  name: 'scripted',
  async turn(messages, onText) {
    const last = messages[messages.length - 1];
    const blocks = Array.isArray(last.content) ? last.content : [{ type: 'text', text: last.content }];
    const isResult = blocks.some((b: any) => b.type === 'tool_result');
    if (isResult) console.log('tool_result:', JSON.stringify(blocks).slice(0, 400));
    if (!isResult || (!current.length && pending)) {
      const text = blocks.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ');
      const sc = pending ?? SCENARIOS.find((s) => s.match(text));
      pending = sc?.then ?? null;
      current = sc ? [...sc.steps] : [async () => [say('אני כאן. במה לעזור?')]];
    }
    const step = current.shift();
    await sleep(isResult ? 700 : 1300);
    const content = step ? await step() : [];
    for (const b of content) {
      if (b.type !== 'text') continue;
      for (let i = 0; i < b.text.length; i += 3) {
        onText(b.text.slice(i, i + 3));
        await sleep(28);
      }
    }
    const usesTool = content.some((b: any) => b.type === 'tool_use');
    return { content, stopReason: usesTool ? 'tool_use' : 'end_turn', usage: { input: 1200, output: 160 } } as any;
  },
});

await migrate();
const app = await buildServer();
await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`demo AAA on :${config.port}`);
