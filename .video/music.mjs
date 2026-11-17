// The music: an Eleven Music track with a composition plan cut to the video's sections, so the
// groove holds steady under the narration and lands a final hit on the end card.
//   node .video/music.mjs              → audio/music.mp3 (committed, so re-renders cost nothing)
//   node .video/music.mjs --dry-run    print the plan only
// Needs an ElevenLabs key with the Music permission (ELEVENLABS_API_KEY or ~/.elevenlabs_key).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { timeline } from './timeline.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const T = timeline();
const end = T.scenes.find(s => s.id === 'end');
const textback = T.scenes.find(s => s.id === 'textback');

const ms = s => Math.round(s * 1000);
const plan = {
  positive_global_styles: ['upbeat feel-good indie pop', 'bouncy', 'playful', 'plucked synth riff', 'hand claps', 'finger snaps', 'warm round bass',
    'tight punchy kick', 'bright and friendly', 'modern advert music', '118 bpm', 'major key', 'instrumental'],
  negative_global_styles: ['vocals', 'singing', 'choir', 'aggressive', 'dark', 'distorted', 'heavy EDM drop', 'dubstep', 'trap hi-hats', 'sad', 'cinematic'],
  sections: [
    { section_name: 'Intro', positive_local_styles: ['sparse', 'plucked riff and finger snaps only', 'light anticipation', 'no kick yet'],
      negative_local_styles: ['full drums', 'loud'], duration_ms: ms(textback.start), lines: [] },
    { section_name: 'Groove', positive_local_styles: ['full bouncy groove comes in', 'claps on two and four', 'steady energy', 'even dynamics', 'sits under a voiceover'],
      negative_local_styles: ['ending', 'fade out', 'breakdown', 'getting louder', 'build-up'], duration_ms: ms(end.start - textback.start), lines: [] },
    { section_name: 'Finale', positive_local_styles: ['the riff one last time', 'cheerful final hit', 'bright final chord', 'short ring-out'],
      negative_local_styles: ['abrupt stop', 'long fade', 'getting quieter early'], duration_ms: ms(T.duration - end.start + 1.0), lines: [] },
  ],
};

if (process.argv.includes('--dry-run')) { console.log(JSON.stringify(plan, null, 1)); process.exit(0); }

const keyFile = join(homedir(), '.elevenlabs_key');
const key = process.env.ELEVENLABS_API_KEY?.trim() || (existsSync(keyFile) ? readFileSync(keyFile, 'utf8').trim() : null);
if (!key) throw new Error('No ElevenLabs key');
const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192', {
  method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' },
  body: JSON.stringify({ composition_plan: plan, model_id: 'music_v1' }),
});
if (!res.ok) { console.error(`${res.status} ${await res.text()}`); process.exit(1); }
const out = join(HERE, 'audio', process.argv.find(a => a.startsWith('--out='))?.slice(6) || 'music.mp3');
writeFileSync(out, Buffer.from(await res.arrayBuffer()));
console.log(`${out} (video ${T.duration.toFixed(2)} s)`);
