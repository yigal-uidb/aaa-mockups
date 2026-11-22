import React from 'react';
import { EntityPage, Page, Badge, Button, Stats, Stat, Card, Modal, RecordForm, BarChart, LineChart, ShareBar, Kanban, MapView, stats, useList, useLookups, sdk, fmt } from '@aaa/kit';

const STATUS_TONE = { 'חדשה': 'warn', 'בטיפול': 'info', 'ממתינה לקבלן': 'info', 'טופלה': 'ok', 'נסגרה': 'neutral' };
const URGENCY_TONE = { 'רגילה': 'neutral', 'דחופה': 'warn', 'סכנה בטיחותית': 'danger' };
const OPEN = ['חדשה', 'בטיפול', 'ממתינה לקבלן'];
const isOpen = (r) => OPEN.includes(r.status || 'חדשה');
const day = (d) => (d ? String(d).slice(0, 10) : '');
const isLate = (r) => isOpen(r) && r.dueDate && day(r.dueDate) < sdk.today();

const FORM = ['title', 'category', 'community', 'residentName', 'residentPhone', 'residentEmail', 'channel', 'urgency', 'description', 'photo', 'location', 'department', 'assignee', 'status', 'resolution', 'satisfaction'];

const statusCell = (r) => <Badge tone={STATUS_TONE[r.status] || 'neutral'}>{r.status || 'חדשה'}</Badge>;
const urgencyCell = (r) => (r.urgency && r.urgency !== 'רגילה' ? <Badge tone={URGENCY_TONE[r.urgency]}>{r.urgency}</Badge> : null);
const dueCell = (r) => (isLate(r) ? <Badge tone="danger">{'חריגה · ' + fmt.date(r.dueDate)}</Badge> : <span>{fmt.date(r.dueDate)}</span>);

function avgDays(list) {
  const done = list.filter((r) => r.closedOn && r._createdAt);
  if (!done.length) return '';
  const total = done.reduce((s, r) => s + Math.max(0, (Date.parse(day(r.closedOn)) - Date.parse(day(r._createdAt))) / 86400000), 0);
  return (total / done.length).toFixed(1);
}

// סגירת פנייה: מה נעשה, והתושב מקבל עדכון
function CloseModal({ request, onClose }) {
  const [text, setText] = React.useState('');
  const save = () => sdk.action('closeRequest', { id: request.id, resolution: text }).then(() => { sdk.toast('הפנייה נסגרה והתושב עודכן'); onClose(); }, (e) => sdk.toast(e.message, 'error'));
  return (
    <Modal title={'סגירת הפנייה: ' + request.title} onClose={onClose}>
      <form className="k-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="k-field k-field-wide">
          <span>מה נעשה (התושב יקבל את זה במייל)</span>
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <footer>
          <Button tone="primary" type="submit">סגירה ועדכון התושב</Button>
          <Button type="button" onClick={onClose}>ביטול</Button>
        </footer>
      </form>
    </Modal>
  );
}

function Requests() {
  const { records } = useList('requests');
  const [closing, setClosing] = React.useState(null);
  const open = records.filter(isOpen);
  const today = records.filter((r) => day(r._createdAt) === sdk.today());
  return (
    <>
      <div style={{ padding: '24px 28px 0', maxWidth: 1400, margin: '0 auto' }} dir="rtl">
        <Stats>
          <Stat label="פניות פתוחות" value={open.length} />
          <Stat label="נפתחו היום" value={today.length} />
          <Stat label="חרגו מיעד הטיפול" value={open.filter(isLate).length} hint="לפי ההגדרות של המועצה" />
          <Stat label="ימי טיפול בממוצע" value={avgDays(records)} />
        </Stats>
      </div>
      <EntityPage
        entity="requests"
        title="פניות"
        columns={['title', 'category', 'community', { key: 'urgency', label: 'דחיפות', render: urgencyCell }, 'department', { key: 'status', render: statusCell }, { key: 'dueDate', label: 'יעד לטיפול', render: dueCell }]}
        formFields={FORM}
        defaults={{ urgency: 'רגילה', channel: 'מוקד טלפוני', status: 'חדשה' }}
        rowActions={(r) => (isOpen(r) ? <Button small onClick={() => setClosing(r)}>סגירה</Button> : null)}
      />
      {closing ? <CloseModal request={closing} onClose={() => setClosing(null)} /> : null}
    </>
  );
}

// לוח טיפול: הפניות ככרטיסים לפי סטטוס. גרירה מעדכנת את הסטטוס
function Board() {
  const { records } = useList('requests');
  const lookups = useLookups('requests');
  const [open, setOpen] = React.useState(null);
  const shown = records.filter((r) => r.status !== 'נסגרה');
  return (
    <Page title="לוח טיפול" count={shown.filter(isOpen).length}>
      <Kanban
        entity="requests"
        field="status"
        records={shown}
        onOpen={setOpen}
        columns={['חדשה', 'בטיפול', 'ממתינה לקבלן', 'טופלה']}
        render={(r) => (
          <>
            <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {urgencyCell(r)}
              {isLate(r) ? <Badge tone="danger">חריגה</Badge> : null}
            </span>
            <span>{lookups?.refs?.communities?.get(r.community)} · {r.category}</span>
            <span>{lookups?.refs?.departments?.get(r.department)}</span>
          </>
        )}
      />
      {open ? (
        <Modal title={open.title} onClose={() => setOpen(null)} wide>
          <RecordForm entity="requests" record={open} fields={FORM} onSaved={() => setOpen(null)} onCancel={() => setOpen(null)} submitLabel="שמירה" />
        </Modal>
      ) : null}
    </Page>
  );
}

// מפת פניות: הפניות הפתוחות לפי מיקום, בצבע הדחיפות
function RequestMap() {
  const { records, loading } = useList('requests');
  const lookups = useLookups('requests');
  const [open, setOpen] = React.useState(null);
  const shown = records.filter(isOpen).filter((r) => r.location && r.location.lat != null);
  const points = shown.map((r) => ({ id: r.id, lat: r.location.lat, lng: r.location.lng, label: r.title + ' · ' + (lookups?.refs?.communities?.get(r.community) || ''), tone: r.urgency === 'סכנה בטיחותית' ? 'danger' : r.urgency === 'דחופה' ? 'warn' : 'info' }));
  return (
    <Page title="מפת פניות" count={shown.length}>
      {loading ? <div style={{ height: 480 }} /> : <MapView points={points} height={480} onSelect={(p) => setOpen(shown.find((r) => r.id === p.id))} />}
      {open ? (
        <Modal title={open.title} onClose={() => setOpen(null)} wide>
          <RecordForm entity="requests" record={open} fields={FORM} onSaved={() => setOpen(null)} onCancel={() => setOpen(null)} submitLabel="שמירה" />
        </Modal>
      ) : null}
    </Page>
  );
}

function Overview() {
  const { records } = useList('requests');
  const lookups = useLookups('requests');
  const open = records.filter(isOpen);
  const rated = records.filter((r) => r.satisfaction);
  const sat = rated.length ? (rated.reduce((s, r) => s + Number(r.satisfaction), 0) / rated.length).toFixed(1) : '';
  const communityName = (id) => lookups?.refs?.communities?.get(id) || 'ללא יישוב';
  const deptName = (id) => lookups?.refs?.departments?.get(id) || 'לא נותבה';
  const lateByDept = stats.count(open.filter(isLate), 'department', deptName);
  return (
    <Page title="תמונת מצב">
      <Stats>
        <Stat label="פניות פתוחות" value={open.length} />
        <Stat label="חרגו מהיעד" value={open.filter(isLate).length} />
        <Stat label="ימי טיפול בממוצע" value={avgDays(records)} />
        <Stat label="שביעות רצון התושבים" value={sat ? sat + ' / 5' : ''} hint={rated.length + ' דירוגים'} />
      </Stats>
      <div className="k-grid2" style={{ marginTop: 16 }}>
        <BarChart title="פניות לפי תחום" note="כל הפניות" data={stats.count(records, 'category')} valueLabel="פניות" />
        <LineChart title="פניות חדשות לפי חודש" note="כמה פניות נפתחו בכל חודש" data={stats.byMonth(records, '_createdAt')} />
        <BarChart title="פניות פתוחות לפי יישוב" data={stats.count(open, 'community', communityName)} valueLabel="פניות" />
        <ShareBar title="פניות בחריגה לפי מחלקה" data={lateByDept} valueLabel="פניות" empty="אין פניות בחריגה" />
      </div>
    </Page>
  );
}

function Communities() {
  return <EntityPage entity="communities" title="יישובים" columns={['name', 'kind', 'contact']} />;
}

function Departments() {
  return <EntityPage entity="departments" title="מחלקות" columns={['name', 'manager', 'categories']} />;
}

export const pages = { requests: Requests, board: Board, map: RequestMap, overview: Overview, communities: Communities, departments: Departments };
