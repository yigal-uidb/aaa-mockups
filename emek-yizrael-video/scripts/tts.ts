// Narration with ElevenLabs: the same voice and settings as the previous AAA film (Brian, eleven_v3, 8% faster).
// Needs ELEVENLABS_API_KEY in the environment. Regenerates only scenes whose text changed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const VOICE = process.env.VOICE_ID ?? 'nPczCjzI2devNBz1zQrb'; // Brian
const MODEL = process.env.TTS_MODEL ?? 'eleven_v3';
const TEMPO = Number(process.env.TEMPO ?? 1.08);
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error('ELEVENLABS_API_KEY is not set'); process.exit(1); }

const scenes: { id: string; text: string; tts?: string }[] = JSON.parse(readFileSync('script/scenes.json', 'utf8'));
const hashes: Record<string, string> = existsSync('audio/hashes.json') ? JSON.parse(readFileSync('audio/hashes.json', 'utf8')) : {};
const only = process.argv.slice(2);
for (const s of scenes) {
  const text = s.tts ?? s.text;
  if (!text.trim()) continue;
  const h = createHash('sha1').update(VOICE + MODEL + TEMPO + text).digest('hex');
  const out = `public/audio/${s.id}.mp3`;
  if (!only.length && hashes[s.id] === h && existsSync(out)) continue;
  if (only.length && !only.includes(s.id)) continue;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: MODEL, language_code: 'he', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  });
  if (!r.ok) { console.error(s.id, r.status, (await r.text()).slice(0, 300)); process.exit(1); }
  writeFileSync(`audio/${s.id}.raw.mp3`, Buffer.from(await r.arrayBuffer()));
  // speed up a little, trim silence at both ends
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `audio/${s.id}.raw.mp3`, '-af',
    `silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,atempo=${TEMPO}`, '-b:a', '160k', out]);
  hashes[s.id] = h;
  writeFileSync('audio/hashes.json', JSON.stringify(hashes, null, 2));
  console.log('tts', s.id);
}
