// פניות תושבים, מועצה אזורית עמק יזרעאל: הלוגיקה העסקית. רץ בתוך AAA, בסביבה מבודדת.

const OPEN = ['חדשה', 'בטיפול', 'ממתינה לקבלן'];
const DONE = ['טופלה', 'נסגרה'];
const num = (v) => Number(v || 0);
const dayOnly = (d) => (d ? String(d).slice(0, 10) : null);
const fmtDate = (d) => { const s = dayOnly(d); return s ? s.slice(8, 10) + '/' + s.slice(5, 7) : ''; };

function israelToday() {
  const now = new Date();
  const m = now.getUTCMonth();
  const offset = m >= 3 && m <= 9 ? 3 : 2;
  return new Date(now.getTime() + offset * 3600000).toISOString().slice(0, 10);
}
const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(dayOnly(b) + 'T00:00:00Z') - Date.parse(dayOnly(a) + 'T00:00:00Z')) / 86400000);

// המחלקה שמטפלת בתחום, לפי מסך המחלקות
function departmentFor(category) {
  if (!category) return null;
  const d = db.list('departments').find((x) => String(x.categories || '').split(',').map((s) => s.trim()).includes(category));
  return d || null;
}

app.hooks.beforeSave = (entity, record, old) => {
  if (entity !== 'requests') return;
  const out = {};
  const publicForm = user.id === null;
  if (publicForm) {
    out.channel = 'טופס באתר';
    out.status = 'חדשה';
    out.department = null;
    out.assignee = null;
    out.resolution = null;
    out.satisfaction = null;
  } else if (!record.community) {
    fail('יש לבחור יישוב');
  }
  if (!record.urgency) out.urgency = record.category === 'בטיחות ומפגעים' ? 'סכנה בטיחותית' : 'רגילה';
  const urgency = out.urgency || record.urgency;
  if (String(record.residentEmail || '').trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(record.residentEmail).trim())) fail('כתובת הדואר לא תקינה');
  if (record.satisfaction != null && (num(record.satisfaction) < 1 || num(record.satisfaction) > 5)) fail('שביעות הרצון היא מספר בין 1 ל-5');

  // ניתוב: פנייה בלי מחלקה עוברת למחלקה של התחום
  const category = record.category;
  if (!publicForm && !record.department) {
    const d = departmentFor(category);
    if (d) {
      out.department = d.id;
      if (!record.assignee && d.manager) out.assignee = d.manager;
    }
  } else if (publicForm) {
    const d = departmentFor(category);
    if (d) out.department = d.id;
  }
  if (!old && !publicForm && !record.status) out.status = 'חדשה';

  // יעד לטיפול: נקבע בפתיחה, ומחושב מחדש כשהדחיפות משתנה
  const opened = old ? dayOnly(old._createdAt) || israelToday() : israelToday();
  if (!old || old.urgency !== urgency || !record.dueDate) {
    const days = urgency === 'רגילה' ? num(settings.get('slaDays')) : num(settings.get('urgentDays'));
    out.dueDate = addDays(opened, days);
  }

  // סגירה: חייבים לכתוב מה נעשה
  const status = out.status || record.status;
  if (DONE.includes(status)) {
    if (!String(record.resolution || '').trim()) fail('לפני סגירה כתבו מה נעשה, כדי שהתושב יקבל תשובה');
    if (!record.closedOn) out.closedOn = israelToday();
    if (record.overdue) out.overdue = false;
  } else if (record.closedOn) {
    out.closedOn = null;
  }
  return out;
};

function tellResident(r) {
  if (!String(r.residentEmail || '').trim()) return;
  sendEmail(
    { email: String(r.residentEmail).trim() },
    'הפנייה שלך למועצה טופלה',
    'שלום ' + (r.residentName || '') + ',\n\nהפנייה "' + r.title + '" טופלה.\n' + (r.resolution ? 'מה נעשה: ' + r.resolution + '\n' : '') + '\nתודה שפנית אלינו,\nמוקד מועצה אזורית עמק יזרעאל'
  );
}

app.hooks.afterSave = (entity, r, old) => {
  if (entity !== 'requests') return;
  const at = (page) => ({ page, entity: 'requests', id: r.id });
  const community = r.community ? db.get('communities', r.community) : null;
  const where = community ? ' ב' + community.name : '';
  if (!old) {
    if (user.id === null) notify({ role: 'moked' }, 'פנייה חדשה מהאתר: ' + r.title + where, at('requests'));
    if (r.urgency !== 'רגילה') {
      const d = r.department ? db.get('departments', r.department) : null;
      const text = (r.urgency === 'סכנה בטיחותית' ? 'סכנה בטיחותית: ' : 'פנייה דחופה: ') + r.title + where;
      if (d && d.manager) notify({ userId: d.manager }, text, at('board'));
      else notify({ role: 'management' }, text, at('board'));
    } else if (r.assignee && r.assignee !== user.id) {
      notify({ userId: r.assignee }, 'פנייה חדשה בטיפולך: ' + r.title + where, at('board'));
    }
  }
  if (DONE.includes(r.status) && !(old && DONE.includes(old.status))) tellResident(r);
};

app.actions.closeRequest = (input) => {
  const r = db.get('requests', input.id);
  if (!r) fail('הפנייה לא נמצאה');
  if (DONE.includes(r.status)) fail('הפנייה כבר סגורה');
  const resolution = String(input.resolution || '').trim();
  if (!resolution) fail('כתבו מה נעשה');
  const patch = { status: 'טופלה', resolution, closedOn: israelToday(), overdue: false };
  db.update('requests', r.id, patch);
  const saved = Object.assign({}, r, patch);
  tellResident(saved);
  return saved;
};

// כל בוקר: פניות פתוחות שעברו את היעד. מנהל המחלקה מקבל התראה, וחריגה ארוכה עוברת להנהלה
app.schedules.slaCheck = () => {
  const today = israelToday();
  const late = db.list('requests').filter((r) => OPEN.includes(r.status) && r.dueDate && dayOnly(r.dueDate) < today);
  const byManager = {};
  late.forEach((r) => {
    const patch = {};
    if (!r.overdue) patch.overdue = true;
    if (!r.escalated && daysBetween(r.dueDate, today) >= num(settings.get('escalateAfter'))) {
      patch.escalated = true;
      notify({ role: 'management' }, 'פנייה בחריגה של ' + daysBetween(r.dueDate, today) + ' ימים: ' + r.title, { page: 'requests', entity: 'requests', id: r.id });
    }
    if (Object.keys(patch).length) db.update('requests', r.id, patch);
    const d = r.department ? db.get('departments', r.department) : null;
    if (d && d.manager) (byManager[d.manager] = byManager[d.manager] || []).push(r);
  });
  Object.keys(byManager).forEach((id) => {
    const list = byManager[id];
    notify({ userId: id }, list.length + ' פניות במחלקה שלך עברו את יעד הטיפול:\n' + list.slice(0, 8).map((r) => '- ' + r.title + ' (יעד ' + fmtDate(r.dueDate) + ')').join('\n'), { page: 'board' });
  });
};

app.tests.routed = () => db.list('requests').some((r) => r.category === 'תאורת רחוב' && r.department);
app.tests.urgent = () => db.list('requests').some((r) => r.urgency === 'סכנה בטיחותית' && r.dueDate && daysBetween(r._createdAt, r.dueDate) <= 1);
app.tests.closed = () => db.list('requests').some((r) => DONE.includes(r.status) && String(r.resolution || '').trim());
