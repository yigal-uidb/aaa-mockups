import React from 'react';
import { AbsoluteFill, Audio, Easing, Freeze, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import timeline from './timeline.json';

const NAVY = '#161B4B';
const GREEN = '#1F6E4A';
const GOLD = '#D9A23A';
const BLUE = '#2468B0';
const FONT = '"Open Sans", Arial, sans-serif';
const W = 1920, H = 1080;

type Scene = (typeof timeline.scenes)[number];
type Focus = { t: number; x: number; y: number; s: number };
type Clip = { src: string; dur: number; focus: Focus[] };

/* ---------------------------------------------------------------- clips and where to look in them */
const F = (t: number, x: number, y: number, s: number): Focus => ({ t, x, y, s });
const CLIPS: Record<string, Clip> = {
  home: { src: 'home', dur: 9.97, focus: [F(0, .5, .5, 1.05), F(2.5, .62, .25, 1.45), F(5.5, .62, .25, 1.45), F(7.5, .5, .4, 1.1)] },
  flow: { src: 'flow', dur: 22.7, focus: [F(0, .5, .33, 1.25), F(1.5, .62, .28, 1.75), F(7, .45, .28, 1.75), F(12, .32, .28, 1.75), F(15, .5, .58, 1.6), F(21, .4, .55, 1.6)] },
  requests: { src: 'requests', dur: 12.8, focus: [F(0, .5, .2, 1.45), F(4, .5, .2, 1.45), F(6.5, .5, .55, 1.2), F(12, .5, .55, 1.2)] },
  intake: { src: 'intake', dur: 27.0, focus: [F(0, .5, .5, 1.05), F(1.8, .15, .6, 1.85), F(20.5, .15, .6, 1.85), F(22, .38, .5, 1.3), F(27, .38, .5, 1.3)] },
  manager: { src: 'manager', dur: 26.8, focus: [F(0, .2, .12, 1.7), F(4, .2, .12, 1.7), F(6.5, .4, .5, 1.25), F(10.5, .4, .5, 1.25), F(12, .72, .3, 1.5), F(18, .72, .3, 1.5), F(20, .45, .5, 1.1), F(26, .45, .5, 1.25)] },
  morning: { src: 'morning', dur: 29.3, focus: [F(0, .5, .5, 1.05), F(2, .15, .6, 1.85), F(29, .15, .6, 1.85)] },
  close: { src: 'close', dur: 14.3, focus: [F(0, .45, .3, 1.5), F(3, .45, .3, 1.5), F(4.5, .5, .45, 1.6), F(14, .5, .45, 1.6)] },
  automation: { src: 'automation', dur: 8.0, focus: [F(0, .5, .45, 1.2), F(1.5, .55, .62, 1.8), F(4.5, .55, .62, 1.8), F(6.5, .6, .28, 1.6), F(8, .6, .28, 1.6)] },
  overview: { src: 'overview', dur: 10.0, focus: [F(0, .45, .25, 1.4), F(3, .45, .3, 1.4), F(7, .4, .5, 1.25), F(10, .4, .5, 1.25)] },
  change: { src: 'change', dur: 26.7, focus: [F(0, .5, .5, 1.05), F(1.8, .15, .6, 1.85), F(26.7, .15, .6, 1.85)] },
  publish: { src: 'publish', dur: 13.6, focus: [F(0, .45, .4, 1.35), F(5, .45, .4, 1.35), F(7, .6, .3, 1.6), F(13.6, .6, .3, 1.6)] },
};
const SCENE_CLIPS: Record<string, string[]> = {
  'clip:home': ['home'], 'clip:flow': ['flow'], 'clip:requests': ['requests'], 'clip:intake': ['intake'], 'clip:manager': ['manager'],
  'clip:morning': ['morning'], 'clip:close': ['close', 'automation'], 'clip:overview': ['overview'], 'clip:change': ['change', 'publish'],
};
const CAPTIONS: Record<string, [string, string]> = {
  'clip:home': ['AAA', 'המערכות של המועצה, במקום אחד'],
  'clip:flow': ['תהליך העבודה', 'ניתוב, התראות ויעדי טיפול שהמועצה קובעת'],
  'clip:requests': ['המוקד', 'כל הפניות, מה דחוף ומה חרג מהיעד'],
  'clip:intake': ['בוט "קליטת פניות"', 'פותח פנייה מתוך שיחה, בהרשאות של המוקדנית'],
  'clip:manager': ['מנהל המחלקה', 'התראה מיידית, לוח טיפול ומפת יישובים'],
  'clip:morning': ['בוט אישי, לקריאה בלבד', 'מסכם, ולא יכול לשנות נתונים'],
  'clip:close': ['סגירת פנייה', 'התושב מקבל עדכון במייל, אוטומטית'],
  'clip:overview': ['תמונת מצב להנהלה', 'תחומים, יישובים, זמני טיפול ושביעות רצון'],
  'clip:change': ['שינוי במערכת', 'בשיחה, בסביבת בדיקה, ובאישור מנהל נוסף'],
};

/* ---------------------------------------------------------------- shared bits */
const Fonts: React.FC = () => (
  <style>{[400, 600, 700, 800].map((w) => `
    @font-face{font-family:"Open Sans";font-weight:${w};src:url(${staticFile(`fonts/open-sans-hebrew-${w}-normal.woff2`)}) format("woff2");unicode-range:U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F}
    @font-face{font-family:"Open Sans";font-weight:${w};src:url(${staticFile(`fonts/open-sans-latin-${w}-normal.woff2`)}) format("woff2");unicode-range:U+0000-00FF,U+2000-206F}`).join('')}</style>
);
const ease = Easing.bezier(0.45, 0, 0.2, 1);
const fadeIn = (f: number, at = 0, len = 14) => interpolate(f, [at, at + len], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
const rise = (f: number, at = 0, dist = 30) => interpolate(f, [at, at + 18], [dist, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });

const Logo: React.FC<{ size?: number; color?: string }> = ({ size = 44, color = '#fff' }) => (
  <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: size, letterSpacing: size * 0.06, color, direction: 'ltr', display: 'inline-block' }}>AAA</span>
);

/* ---------------------------------------------------------------- a recorded screen, with zoom */
function focusAt(focus: Focus[], t: number): Focus {
  if (t <= focus[0].t) return focus[0];
  for (let i = 1; i < focus.length; i++) {
    const a = focus[i - 1], b = focus[i];
    if (t <= b.t) {
      const k = ease((t - a.t) / Math.max(0.001, b.t - a.t));
      return { t, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, s: a.s + (b.s - a.s) * k };
    }
  }
  return focus[focus.length - 1];
}
const Zoomed: React.FC<{ clip: Clip; rate: number; frames: number; freeze?: boolean }> = ({ clip, rate, frames, freeze }) => {
  const frame = useCurrentFrame();
  const t = freeze ? clip.dur - 0.1 : Math.min(clip.dur, (frame / 30) * rate);
  const f = focusAt(clip.focus, t);
  const s = f.s;
  const cx = Math.min(Math.max(f.x * W, W / (2 * s)), W - W / (2 * s));
  const cy = Math.min(Math.max(f.y * H, H / (2 * s)), H - H / (2 * s));
  const video = <OffthreadVideo src={staticFile(`clips/${clip.src}.mp4`)} playbackRate={rate} muted style={{ width: W, height: H }} />;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#F4F6FA' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `translate(${W / 2}px,${H / 2}px) scale(${s}) translate(${-cx}px,${-cy}px)` }}>
        {freeze ? <Freeze frame={Math.max(0, Math.floor(((clip.dur - 0.15) * 30) / rate))}>{video}</Freeze> : video}
      </div>
    </AbsoluteFill>
  );
};

const Caption: React.FC<{ title: string; sub: string }> = ({ title, sub }) => {
  const f = useCurrentFrame();
  const o = fadeIn(f, 8, 16) * interpolate(f, [190, 215], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', top: 44, right: 56, direction: 'rtl', opacity: o, transform: `translateY(${rise(f, 8, -20)}px)` }}>
      <div style={{ background: 'rgba(22,27,75,.94)', color: '#fff', borderRadius: 18, padding: '18px 28px 18px 30px', boxShadow: '0 18px 50px rgba(10,14,40,.35)', borderRight: `8px solid ${GOLD}`, fontFamily: FONT }}>
        <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: '#C9D6F2', marginTop: 4 }}>{sub}</div>
      </div>
    </div>
  );
};

const ClipScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const names = SCENE_CLIPS[scene.visual];
  const clips = names.map((n) => CLIPS[n]);
  const total = clips.reduce((a, c) => a + c.dur, 0);
  const sceneSec = scene.frames / 30;
  const rate = Math.min(2, Math.max(1, total / sceneSec));
  let at = 0;
  const parts = clips.map((c, i) => {
    const len = Math.round((c.dur / rate) * 30);
    const from = at;
    at += len;
    return <Sequence key={i} from={from} durationInFrames={len}><Zoomed clip={c} rate={rate} frames={len} /></Sequence>;
  });
  const last = clips[clips.length - 1];
  const cap = CAPTIONS[scene.visual];
  return (
    <AbsoluteFill>
      {parts}
      {at < scene.frames ? <Sequence from={at}><Zoomed clip={last} rate={rate} frames={scene.frames - at} freeze /></Sequence> : null}
      {cap ? <Caption title={cap[0]} sub={cap[1]} /> : null}
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- cards */
const Backdrop: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: dark ? `radial-gradient(1200px 700px at 75% 20%, #24307A 0%, ${NAVY} 60%, #0C1036 100%)` : 'linear-gradient(160deg,#F7F8FB 0%,#EAF1EC 100%)' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: 'absolute', width: 900, height: 900, borderRadius: '50%', border: `2px solid ${dark ? 'rgba(255,255,255,.06)' : 'rgba(31,110,74,.08)'}`, left: -300 + i * 120, top: 200 - i * 90, transform: `scale(${1 + Math.sin((f + i * 40) / 90) * 0.03})` }} />
      ))}
    </AbsoluteFill>
  );
};

const OpenCard: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: f - 6, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ fontFamily: FONT, direction: 'rtl' }}>
      <Backdrop dark />
      <AbsoluteFill style={{ justifyContent: 'center', padding: '0 170px', color: '#fff' }}>
        <div style={{ opacity: fadeIn(f, 4), transform: `translateY(${rise(f, 4)}px)`, fontSize: 34, fontWeight: 600, color: GOLD, letterSpacing: 1 }}>ניהול הקשר עם התושבים</div>
        <div style={{ opacity: pop, transform: `translateY(${(1 - pop) * 40}px)`, fontSize: 112, fontWeight: 800, lineHeight: 1.08, marginTop: 14 }}>מועצה אזורית<br />עמק יזרעאל</div>
        <div style={{ width: interpolate(f, [24, 60], [0, 420], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease }), height: 8, background: GREEN, borderRadius: 4, marginTop: 34 }} />
        <div style={{ opacity: fadeIn(f, 40), marginTop: 30, fontSize: 32, color: '#C9D6F2', display: 'flex', alignItems: 'center', gap: 16 }}>הדגמה על הפלטפורמה <Logo size={36} /></div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const CHANNELS = [
  { label: 'טלפון למוקד', x: 1450, y: 250 }, { label: 'וואטסאפ', x: 1530, y: 470 }, { label: 'טופס באתר', x: 1430, y: 690 }, { label: 'מייל', x: 1560, y: 860 },
];
const MESS = [
  { label: 'גיליון אקסל', x: 300, y: 300, r: -6 }, { label: 'מייל שהועבר', x: 430, y: 560, r: 4 }, { label: 'פתק על השולחן', x: 260, y: 760, r: -3 }, { label: 'הודעה בקבוצה', x: 560, y: 820, r: 7 },
];
const ISSUES = ['פנס כבוי בנהלל', 'נזילה בכפר יהושע', 'הסעה שלא הגיעה לגבת'];
const Problem: React.FC<{ scene: Scene }> = ({ scene }) => {
  const f = useCurrentFrame();
  const end = scene.frames;
  return (
    <AbsoluteFill style={{ fontFamily: FONT, direction: 'rtl' }}>
      <Backdrop />
      {ISSUES.map((t, i) => (
        <div key={t} style={{ position: 'absolute', top: 120 + i * 92, left: 0, right: 0, textAlign: 'center', opacity: fadeIn(f, 6 + i * 26) * interpolate(f, [130, 160], [1, 0.25], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), transform: `translateY(${rise(f, 6 + i * 26)}px)`, fontSize: 56, fontWeight: 800, color: NAVY }}>{t}</div>
      ))}
      {CHANNELS.map((c, i) => {
        const at = 120 + i * 14;
        const k = interpolate(f, [at + 40, at + 110], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
        const m = MESS[i];
        return (
          <React.Fragment key={c.label}>
            <div style={{ position: 'absolute', left: c.x + (m.x - c.x) * k, top: c.y + (m.y - c.y) * k, transform: `translate(-50%,-50%) rotate(${m.r * k}deg)`, opacity: fadeIn(f, at), background: '#fff', borderRadius: 16, padding: '18px 30px', boxShadow: '0 14px 40px rgba(22,27,75,.16)', fontSize: 34, fontWeight: 700, color: k > 0.6 ? '#8A90A8' : NAVY, border: `3px solid ${k > 0.6 ? '#E1E4EE' : BLUE}` }}>
              {k > 0.6 ? m.label : c.label}
            </div>
          </React.Fragment>
        );
      })}
      {['?', '?', '?'].map((q, i) => (
        <div key={i} style={{ position: 'absolute', left: 380 + i * 170, top: 420 + (i % 2) * 260, fontSize: 120, fontWeight: 800, color: '#C0392B', opacity: fadeIn(f, 250 + i * 18) * 0.85, transform: `scale(${0.6 + 0.4 * fadeIn(f, 250 + i * 18)})` }}>{q}</div>
      ))}
      <div style={{ position: 'absolute', bottom: 150, left: 0, right: 0, textAlign: 'center', fontSize: 44, fontWeight: 800, color: '#C0392B', opacity: fadeIn(f, Math.min(320, end - 90)) }}>מה טופל? מה מחכה? מה נשכח?</div>
    </AbsoluteFill>
  );
};

/* the phone: the public form as a resident sees it */
const PublicScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const f = useCurrentFrame();
  const rate = Math.min(2, Math.max(1, 22.3 / (scene.frames / 30)));
  return (
    <AbsoluteFill style={{ fontFamily: FONT, direction: 'rtl' }}>
      <Backdrop />
      <div style={{ position: 'absolute', right: 170, top: 330, width: 780, opacity: fadeIn(f, 6), transform: `translateY(${rise(f, 6)}px)` }}>
        <div style={{ fontSize: 34, fontWeight: 700, color: GREEN }}>טופס ציבורי</div>
        <div style={{ fontSize: 76, fontWeight: 800, color: NAVY, lineHeight: 1.1, marginTop: 10 }}>פנייה למועצה,<br />ישר מהטלפון</div>
        <div style={{ fontSize: 34, color: '#4A5170', marginTop: 26, lineHeight: 1.45 }}>בלי הרשמה ובלי סיסמה. הפנייה נכנסת למוקד ומנותבת למחלקה.</div>
      </div>
      <div style={{ position: 'absolute', left: 300, top: 60, width: 470, height: 960, borderRadius: 64, background: '#0E1230', padding: 20, boxShadow: '0 40px 90px rgba(10,14,40,.35)', opacity: fadeIn(f, 0, 10), transform: `translateY(${rise(f, 0, 60)}px)` }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 46, overflow: 'hidden', background: '#fff', position: 'relative' }}>
          <OffthreadVideo src={staticFile('clips/public.mp4')} playbackRate={rate} muted style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* Claude, connected to AAA over MCP */
const ClaudeScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const f = useCurrentFrame();
  const typed = 'כמה פניות פתוחות יש בגבת, ומה הכי דחוף?';
  const n = Math.round(interpolate(f, [20, 95], [0, typed.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const answer = ['בגבת יש 3 פניות פתוחות, כולן דחופות:', '• מזגן לא עובד בגן הילדים · יעד מחר', '• מתקן משחקים פגום · בטיפול, יעד מחר', '• בקשה לסיוע לקשיש בודד · יעד 26.11', 'הכי דחוף: הגן ומתקן המשחקים.'];
  const tool = (label: string, at: number) => (
    <div style={{ opacity: fadeIn(f, at, 10), display: 'flex', alignItems: 'center', gap: 12, fontSize: 24, color: '#6B5E4E', background: '#F3EEE6', border: '1px solid #E4DACB', borderRadius: 12, padding: '10px 16px', width: 'fit-content', marginTop: 12 }}>
      <span style={{ width: 22, height: 22, borderRadius: 6, background: NAVY, color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', direction: 'ltr' }}>AAA</span>{label}{f > at + 30 ? <span style={{ color: GREEN }}> ✓</span> : <span> …</span>}
    </div>
  );
  return (
    <AbsoluteFill style={{ fontFamily: FONT, direction: 'rtl', background: '#F5F1EA' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 86, borderBottom: '1px solid #E4DACB', display: 'flex', alignItems: 'center', padding: '0 56px', gap: 16, fontSize: 30, fontWeight: 700, color: '#3D3929' }}>
        <span style={{ direction: 'ltr' }}>Claude</span>
        <span style={{ fontSize: 22, fontWeight: 600, color: '#8A7F6E', marginRight: 'auto', direction: 'rtl' }}>קונקטור מחובר: AAA</span>
      </div>
      <div style={{ position: 'absolute', top: 150, left: 330, right: 330 }}>
        <div style={{ opacity: n ? 1 : 0, marginRight: 'auto', marginLeft: 0, width: 'fit-content', maxWidth: 900, background: '#EAE3D7', borderRadius: 22, padding: '20px 28px', fontSize: 34, color: '#2B2618' }}>{typed.slice(0, n)}</div>
        <div style={{ marginTop: 30 }}>
          {tool('פתיחת שיחה עם העוזר של AAA', 110)}
          {tool('הודעה לעוזר של AAA', 150)}
          <div style={{ marginTop: 26, fontSize: 34, lineHeight: 1.6, color: '#2B2618' }}>
            {answer.map((l, i) => <div key={i} style={{ opacity: fadeIn(f, 200 + i * 14, 12), fontWeight: i === 0 || i === 4 ? 700 : 400 }}>{l}</div>)}
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 60, left: 330, right: 330, height: 90, borderRadius: 24, background: '#fff', border: '1px solid #E4DACB', display: 'flex', alignItems: 'center', padding: '0 30px', fontSize: 28, color: '#A69C8B' }}>שאלו את Claude…</div>
      <div style={{ position: 'absolute', top: 120, right: 56, fontSize: 26, fontWeight: 700, color: '#6B5E4E', background: '#EFE8DC', borderRadius: 12, padding: '10px 18px', opacity: fadeIn(f, 10) }}>אותו עוזר ואותן הרשאות, דרך MCP</div>
    </AbsoluteFill>
  );
};

const VALUES = ['פחות פניות שנופלות בין הכיסאות', 'זמני טיפול גלויים לכולם', 'תושבים מעודכנים, אוטומטית', 'מערכת שהמועצה מתאימה לעצמה'];
const CloseCard: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ fontFamily: FONT, direction: 'rtl' }}>
      <Backdrop dark />
      <AbsoluteFill style={{ justifyContent: 'center', padding: '0 170px', color: '#fff' }}>
        {VALUES.map((v, i) => (
          <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 26, fontSize: 60, fontWeight: 800, margin: '14px 0', opacity: fadeIn(f, 8 + i * 30), transform: `translateX(${-rise(f, 8 + i * 30, 50)}px)` }}>
            <span style={{ width: 54, height: 54, borderRadius: 16, background: GREEN, display: 'grid', placeItems: 'center', fontSize: 34 }}>✓</span>{v}
          </div>
        ))}
        <div style={{ marginTop: 60, display: 'flex', alignItems: 'center', gap: 28, opacity: fadeIn(f, 150) }}>
          <Logo size={86} />
          <span style={{ fontSize: 34, color: '#C9D6F2' }}>הפלטפורמה שבה הארגון בונה את המערכות שלו</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- subtitles */
function chunks(text: string): string[] {
  const parts = text.split(/(?<=[.,:?!])\s+/);
  const lines: string[] = [];
  for (const p of parts) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + p).length <= 52 && !/[.?!]$/.test(last)) lines[lines.length - 1] = last + ' ' + p; else lines.push(p);
  }
  return lines;
}
const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();
  const s = timeline.scenes.find((x) => frame >= x.voiceFrom && frame < x.voiceFrom + x.voiceFrames);
  if (!s) return null;
  const lines = chunks(s.text);
  const total = lines.reduce((a, l) => a + l.length, 0);
  let at = s.voiceFrom;
  let line = lines[0];
  for (const l of lines) { const d = (l.length / total) * s.voiceFrames; if (frame >= at && frame < at + d) { line = l; break; } at += d; }
  return (
    <div style={{ position: 'absolute', bottom: 46, left: 0, right: 0, display: 'flex', justifyContent: 'center', direction: 'rtl' }}>
      <div style={{ background: 'rgba(12,16,48,.82)', color: '#fff', fontFamily: FONT, fontSize: 38, fontWeight: 600, padding: '12px 30px', borderRadius: 14, maxWidth: 1500, textAlign: 'center' }}>{line.replace(/טריפל איי/g, 'AAA').replace(/קלוד/g, 'Claude')}</div>
    </div>
  );
};

/* ---------------------------------------------------------------- the film */
const SceneView: React.FC<{ scene: Scene }> = ({ scene }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const v = scene.visual;
  const body = v === 'card-open' ? <OpenCard /> : v === 'card-close' ? <CloseCard /> : v === 'problem' ? <Problem scene={scene} /> : v === 'claude' ? <ClaudeScene scene={scene} /> : v === 'clip:public' ? <PublicScene scene={scene} /> : <ClipScene scene={scene} />;
  return <AbsoluteFill style={{ opacity: o }}>{body}</AbsoluteFill>;
};

export const Film: React.FC = () => {
  const music = (frame: number) => {
    const voiced = timeline.scenes.some((s) => frame >= s.voiceFrom - 8 && frame < s.voiceFrom + s.voiceFrames + 8);
    const fadeOut = interpolate(frame, [timeline.total - 90, timeline.total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return (voiced ? 0.09 : 0.2) * fadeOut;
  };
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Fonts />
      {timeline.scenes.map((s) => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.frames + 12}>
          <SceneView scene={s} />
        </Sequence>
      ))}
      {timeline.scenes.map((s) => (s.audio ? <Sequence key={'a' + s.id} from={s.voiceFrom} durationInFrames={s.voiceFrames + 15}><Audio src={staticFile(s.audio)} /></Sequence> : null))}
      <Audio src={staticFile('music.m4a')} volume={music} />
      <Subtitles />
    </AbsoluteFill>
  );
};
