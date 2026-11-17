// The video's timeline, from script.json and the narration's word timings in audio/:
// when each line is said, when each scene starts and ends, and when every word lands.
//   node .video/timeline.mjs   → timeline.json (stage.js reads it), and prints the scenes
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FPS = 30;
export const WIDTH = 1920, HEIGHT = 1080;
/** A scene opens this long before its first word, so the transition settles as the voice starts. */
const LEAD = 0.2;

export function clipName(script, line) {
  const { voiceId, model } = script.voice;
  const words = line.speak ? `${line.say}\n${line.speak}` : line.say;
  const hash = createHash('sha256').update(`${voiceId}\n${model}\n${words}`).digest('hex').slice(0, 10);
  return `${line.scene}-${hash}`;
}

export function timeline() {
  const script = JSON.parse(readFileSync(join(HERE, 'script.json'), 'utf8'));
  let at = script.intro;
  const lines = script.lines.map(line => {
    const name = clipName(script, line);
    const json = join(HERE, 'audio', `${name}.json`);
    if (!existsSync(json)) throw new Error(`no narration for "${line.scene}": run node .video/voice.mjs`);
    const { words } = JSON.parse(readFileSync(json, 'utf8'));
    const dur = words.at(-1).end;
    const out = { scene: line.scene, say: line.say, clip: `audio/${name}.mp3`, at: +at.toFixed(3), dur,
      words: words.map(w => ({ w: w.w, t: +(at + w.start).toFixed(3), e: +(at + w.end).toFixed(3) })) };
    at += dur + line.gap;
    return out;
  });
  const voiceEnd = lines.at(-1).at + lines.at(-1).dur;
  const duration = +(voiceEnd + script.outro).toFixed(3);
  const scenes = lines.map((l, i) => ({
    id: l.scene,
    start: i === 0 ? 0 : +(l.at - LEAD).toFixed(3),
    end: i === lines.length - 1 ? duration : +(lines[i + 1].at - LEAD).toFixed(3),
    words: l.words,
  }));
  // the music: stretched so its groove lands as the first scene opens and its final hit as the end card does
  let music = null;
  if (script.music) {
    const m = script.music;
    const g = scenes[1].start - 0.06, f = scenes.at(-1).start - 0.05;
    const tempo = (m.finale - m.groove) / (f - g);   // rubberband tempo: under 1 slows it down
    music = { file: m.file, tempo: +tempo.toFixed(5), offset: +(m.groove / tempo - g).toFixed(3), beat: +(m.beat / tempo).toFixed(4), groove: g, finale: f };
  }
  return { fps: FPS, width: WIDTH, height: HEIGHT, duration, lines, scenes, music };
}

if (process.argv[1]?.endsWith('timeline.mjs')) {
  const T = timeline();
  writeFileSync(join(HERE, 'timeline.json'), JSON.stringify(T, null, 1));
  for (const s of T.scenes) console.log(`${s.id.padEnd(9)} ${s.start.toFixed(2).padStart(6)} → ${s.end.toFixed(2).padStart(6)}  (${(s.end - s.start).toFixed(2)} s)`);
  console.log(`total ${T.duration.toFixed(2)} s`);
  if (T.music) console.log(`music: tempo ×${T.music.tempo}, starts ${T.music.offset} s into the stretched track, beat ${T.music.beat} s`);
}
