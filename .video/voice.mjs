// Speaks each line of script.json in the house voice, with ElevenLabs' word timings, into audio/.
//   node .video/voice.mjs            speak lines that changed (cached by the words and the voice)
//   node .video/voice.mjs --force    speak every line again
// Each line is kept as audio/<scene>-<hash>.mp3 plus audio/<scene>-<hash>.json (the words and when each
// is said, in seconds from the clip's start). Those files are committed, so a re-render costs nothing.
// A word the voice gets wrong is respelt in the line's "speak" (same words, e.g. "kwote" for "quote", which
// eleven_v3 said as "krote"); the captions and the stage keep "say".
// Needs an ElevenLabs key in ELEVENLABS_API_KEY or ~/.elevenlabs_key (never in the repo).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { clipName } from './timeline.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const script = JSON.parse(readFileSync(join(HERE, 'script.json'), 'utf8'));
const force = process.argv.includes('--force');
const dir = join(HERE, 'audio');
mkdirSync(dir, { recursive: true });

function key() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const f = join(homedir(), '.elevenlabs_key');
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  throw new Error('No ElevenLabs key: set ELEVENLABS_API_KEY or put it alone in ~/.elevenlabs_key');
}

// Characters and their times → words with start/end.
function words(alignment) {
  const out = [];
  let cur = null;
  alignment.characters.forEach((ch, i) => {
    const s = alignment.character_start_times_seconds[i], e = alignment.character_end_times_seconds[i];
    if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = null; } return; }
    if (!cur) cur = { w: '', start: s, end: e };
    cur.w += ch; cur.end = e;
  });
  if (cur) out.push(cur);
  return out.map(w => ({ ...w, start: +w.start.toFixed(3), end: +w.end.toFixed(3) }));
}

for (const line of script.lines) {
  const name = clipName(script, line);
  const mp3 = join(dir, `${name}.mp3`), json = join(dir, `${name}.json`);
  if (existsSync(mp3) && existsSync(json) && !force) { console.log(`${line.scene}: cached`); continue; }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${script.voice.voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key(), 'content-type': 'application/json' },
    body: JSON.stringify({ text: line.speak ?? line.say, model_id: script.voice.model }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status} on "${line.scene}": ${(await res.text()).slice(0, 400)}`);
  const body = await res.json();
  const ws = words(body.alignment || body.normalized_alignment);
  // a respelt line ("speak") is timed by its spoken words but keeps the written ones, which the stage looks up
  if (line.speak) {
    const written = line.say.split(/\s+/);
    if (written.length !== ws.length) throw new Error(`"${line.scene}": "speak" must have the same words as "say", respelt`);
    ws.forEach((w, i) => { w.w = written[i]; });
  }
  writeFileSync(mp3, Buffer.from(body.audio_base64, 'base64'));
  writeFileSync(json, JSON.stringify({ say: line.say, ...(line.speak && { speak: line.speak }), words: ws }, null, 1));
  console.log(`${line.scene}: ${ws[0]?.start.toFixed(2)}–${ws.at(-1)?.end.toFixed(2)} s  "${line.say}"`);
}
