// Builds src/timeline.json: when each scene starts and how long it lasts, from the narration audio
// (or an estimate from the text when there is no audio yet), plus the subtitles file.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const FPS = 30;
const scenes: { id: string; visual: string; text: string }[] = JSON.parse(readFileSync('script/scenes.json', 'utf8'));
const probe = (f: string) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
// time on screen around the narration: a lead-in before the voice and a tail after it
const LEAD: Record<string, number> = { 'card-open': 1.2, 'card-close': 0.6, 'card-later': 0.2 };
const TAIL: Record<string, number> = { 'card-close': 3.5, 'card-later': 2.3, building: 1.5, questions: 0.8, spec: 1.0, bot: 1.2, golive: 1.2, claude: 1.4, 'r-overview': 2.5, public: 3.2, 'r-close': 3.5 };
let t = 0;
const out = [];
for (const s of scenes) {
  const audio = `public/audio/${s.id}.mp3`;
  const hasAudio = existsSync(audio);
  const voice = !s.text.trim() ? 0 : hasAudio ? probe(audio) : s.text.split(/\s+/).length / 2.25;
  const lead = LEAD[s.visual] ?? 0.5;
  const tail = TAIL[s.visual] ?? 0.7;
  const dur = lead + voice + tail;
  out.push({ id: s.id, visual: s.visual, text: s.text, from: Math.round(t * FPS), frames: Math.round(dur * FPS), voiceFrom: Math.round((t + lead) * FPS), voiceFrames: Math.round(voice * FPS), audio: hasAudio ? `audio/${s.id}.mp3` : null });
  t += dur;
}
writeFileSync('src/timeline.json', JSON.stringify({ fps: FPS, total: Math.round(t * FPS), scenes: out }, null, 2));

// subtitles: each scene's narration split into short lines, timed by length
const ts = (sec: number) => { const ms = Math.round(sec * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
export function chunks(text: string): string[] {
  const parts = text.split(/(?<=[.,:?!])\s+/);
  const lines: string[] = [];
  for (const p of parts) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + p).length <= 52 && !/[.?!]$/.test(last)) lines[lines.length - 1] = last + ' ' + p; else lines.push(p);
  }
  return lines;
}
let n = 0; const srt: string[] = [];
for (const s of out) {
  if (!s.text.trim()) continue;
  const lines = chunks(s.text); const total = lines.reduce((a, l) => a + l.length, 0);
  let at = s.voiceFrom / FPS;
  for (const l of lines) { const d = (l.length / total) * (s.voiceFrames / FPS); srt.push(`${++n}\n${ts(at)} --> ${ts(at + d)}\n${l}\n`); at += d; }
}
writeFileSync('out/aaa-emek-yizrael.srt', srt.join('\n'));
console.log(`timeline: ${(t).toFixed(1)}s, ${out.length} scenes${out.every((s) => s.audio || !s.text.trim()) ? '' : ' (estimated: no narration audio yet)'}`);
