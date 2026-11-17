// Renders the summary video. Run from anywhere; everything is relative to this folder.
//   node .video/make.mjs                 timeline → frames → audio mix → encode → copy into /video
//   node .video/make.mjs stills 4.2 9.5  still frames at those seconds → .video/out/stills/
//   node .video/make.mjs frames [from to]  only the frames (or only those seconds)   node .video/make.mjs mix  only the audio
//   node .video/make.mjs encode          only the encode (needs frames and mix)
// Needs ffmpeg and ffprobe on the PATH and Edge or Chrome (BROWSER=<path> to choose). The narration
// (audio/*.mp3, voice.mjs) and the music (audio/music.mp3) are committed, so this costs no credits.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, copyFileSync, statSync } from 'node:fs';
import { join, extname, normalize, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timeline } from './timeline.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');            // the site: the stage uses /styles.css, /img and /index.html
const OUT = join(HERE, 'out');
const SITE_OUT = join(ROOT, 'video');
const NAME = 'gripply-summary';
const POSTER_AT = 9.6;                       // the poster frame (seconds): text-back, settled

const [mode = 'all', ...rest] = process.argv.slice(2);
const T = timeline();
writeFileSync(join(HERE, 'timeline.json'), JSON.stringify(T, null, 1));
mkdirSync(OUT, { recursive: true });

function ff(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`ffmpeg failed:\n${r.stderr}`);
  return r;
}
function loudness(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const s = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  return { I: parseFloat(s.match(/I:\s+(-?[\d.]+)/)[1]), TP: parseFloat(s.match(/Peak:\s+(-?[\d.]+)/)[1]) };
}

// ---------- frames: the stage in headless Edge over the DevTools protocol ----------
async function capture(times, dir) {
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.ttf': 'font/ttf', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
  const server = createServer((req, res) => {
    const p = normalize(join(ROOT, decodeURIComponent(req.url.split('?')[0])));
    if (!p.startsWith(normalize(ROOT)) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(readFileSync(p));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BROWSERS = [process.env.BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
  const exe = BROWSERS.find(p => existsSync(p));
  if (!exe) throw new Error('no Edge or Chrome found: set BROWSER');
  const port = 9300 + Math.floor(Math.random() * 600);
  const profile = join(OUT, `browser-${port}`);
  const browser = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${T.width},${T.height}`,
    '--hide-scrollbars', '--force-device-scale-factor=1', '--no-first-run', '--disable-extensions', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
  let ws;
  try {
    let page;
    for (let i = 0; i < 100 && !page; i++) {
      try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
      if (!page) await new Promise(r => setTimeout(r, 150));
    }
    if (!page) throw new Error('the browser did not start');
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));
    let id = 0; const pending = new Map(); const errors = [];
    ws.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
      else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description);
      else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    });
    const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
    const evaluate = async expression => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
      return r.result.value;
    };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: T.width, height: T.height, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/.video/stage.html` });
    for (let i = 0; i < 150; i++) {
      if (errors.length) throw new Error(`stage error: ${errors.join('\n')}`);
      if (await evaluate('window.ready === true').catch(() => false)) break;
      if (i === 149) throw new Error('the stage never became ready');
      await new Promise(r => setTimeout(r, 100));
    }
    mkdirSync(dir, { recursive: true });
    const t0 = Date.now();
    for (const [n, { t, file }] of times.entries()) {
      await evaluate(`render(${t}); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(dir, file), Buffer.from(data, 'base64'));
      if (n % 150 === 0 && times.length > 20) console.log(`  frame ${n}/${times.length}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    if (errors.length) throw new Error(`stage error: ${errors.join('\n')}`);
  } finally {
    ws?.close(); browser.kill(); server.close();
    setTimeout(() => rmSync(profile, { recursive: true, force: true, maxRetries: 5 }), 1500).unref();
  }
}

// all the frames, or (frames <from s> <to s>) just that stretch, over the frames already there
async function frames(from, to) {
  const dir = join(OUT, 'frames');
  const n = Math.round(T.duration * T.fps);
  const f0 = from === undefined ? 0 : Math.max(0, Math.floor(from * T.fps)), f1 = to === undefined ? n : Math.min(n, Math.ceil(to * T.fps));
  if (f0 === 0 && f1 === n) rmSync(dir, { recursive: true, force: true });
  console.log(`frames: ${f1 - f0} of ${n} at ${T.fps} fps (${T.duration.toFixed(2)} s)`);
  await capture(Array.from({ length: f1 - f0 }, (_, i) => ({ t: (f0 + i) / T.fps, file: `f${String(f0 + i).padStart(5, '0')}.png` })), dir);
}

// ---------- audio: the narration on its times, the music under it ----------
function mixAudio() {
  const dir = join(OUT, 'audio'); mkdirSync(dir, { recursive: true });
  const D = T.duration.toFixed(3);
  const voice = join(dir, 'voice.wav');
  const ins = T.lines.flatMap(l => ['-i', join(HERE, l.clip)]);
  const placed = T.lines.map((l, j) => `[${j}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(l.at * 1000)}:all=1[v${j}]`).join(';');
  ff([...ins, '-filter_complex', `${placed};${T.lines.map((_, j) => `[v${j}]`).join('')}amix=inputs=${T.lines.length}:normalize=0,apad=whole_dur=${D},atrim=0:${D},highpass=f=70,acompressor=threshold=-20dB:ratio=2:attack=10:release=150`,
    '-ar', '48000', '-c:a', 'pcm_s24le', voice]);
  const music = T.music && join(HERE, T.music.file);
  const pre = join(dir, 'pre.wav');
  if (music && existsSync(music)) {
    const below = parseFloat(process.env.MUSIC_BELOW ?? '8');   // dB under the voice
    const EQ = 'highpass=f=60,equalizer=f=2800:t=q:w=1.4:g=-3.5';
    const Iv = loudness(voice).I;
    const Im = loudness(music).I;
    const gain = Iv - below - Im;
    ff(['-i', voice, '-i', music, '-filter_complex',
      `[1:a]aresample=48000,rubberband=tempo=${T.music.tempo}:transients=crisp,atrim=start=${T.music.offset},asetpts=PTS-STARTPTS,${EQ},volume=${gain.toFixed(2)}dB,atrim=0:${D},apad=whole_dur=${D},afade=t=out:st=${(T.duration - 1.2).toFixed(2)}:d=1.2[mus];` +
      `[0:a]asplit[v1][v2];[mus][v1]sidechaincompress=threshold=0.03:ratio=3:attack=40:release=450[musd];[v2][musd]amix=inputs=2:normalize=0`,
      '-ar', '48000', '-c:a', 'pcm_s24le', pre]);
  } else {
    console.log('  (no audio/music.mp3: voice only)');
    copyFileSync(voice, pre);
  }
  const L = loudness(pre);
  const g = -16 - L.I;
  const limit = L.TP + g > -1.5 ? ',alimiter=limit=0.82:attack=4:release=60:level=disabled' : '';
  const out = join(dir, 'mix.wav');
  ff(['-i', pre, '-af', `volume=${g.toFixed(2)}dB${limit}`, '-ar', '48000', '-c:a', 'pcm_s24le', out]);
  const fin = loudness(out);
  console.log(`mix: ${fin.I} LUFS, ${fin.TP} dBTP${limit ? ' (limited)' : ''}`);
}

// ---------- encode, poster, captions → /video ----------
function encode() {
  mkdirSync(SITE_OUT, { recursive: true });
  const color = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709'];
  const mp4 = join(SITE_OUT, `${NAME}.mp4`);
  ff(['-framerate', String(T.fps), '-i', join(OUT, 'frames', 'f%05d.png'), '-i', join(OUT, 'audio', 'mix.wav'),
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', process.env.CRF ?? '23', '-tune', 'animation',
    '-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p', ...color, '-g', String(T.fps * 2),
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-movflags', '+faststart', '-t', T.duration.toFixed(3), mp4]);
  const pf = join(OUT, 'frames', `f${String(Math.round(POSTER_AT * T.fps)).padStart(5, '0')}.png`);
  ff(['-i', pf, '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '3', join(SITE_OUT, `${NAME}-poster.jpg`)]);
  // captions: the narration, line by line
  const ts = s => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3.6e6), m = Math.floor(ms / 6e4) % 60, sec = Math.floor(ms / 1000) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`; };
  const vtt = ['WEBVTT', '', ...T.lines.flatMap((l, i) => [`${i + 1}`, `${ts(l.at)} --> ${ts(l.at + l.dur + 0.3)}`, l.say.replace(/\.\.\./g, '…'), ''])].join('\n');
  writeFileSync(join(SITE_OUT, `${NAME}.vtt`), vtt);
  const mb = f => `${(statSync(f).size / 1e6).toFixed(2)} MB`;
  console.log(`${mp4}  ${mb(mp4)}  (${T.duration.toFixed(2)} s)`);
  const l = loudness(mp4); console.log(`audio: ${l.I} LUFS, ${l.TP} dBTP`);
}

if (mode === 'stills') {
  const times = rest.map(parseFloat).filter(x => !isNaN(x));
  await capture(times.map(t => ({ t, file: `t_${t.toFixed(2)}.png` })), join(OUT, 'stills'));
  console.log(times.map(t => join(OUT, 'stills', `t_${t.toFixed(2)}.png`)).join('\n'));
} else if (mode === 'frames') await frames(rest[0] && parseFloat(rest[0]), rest[1] && parseFloat(rest[1]));
else if (mode === 'mix') mixAudio();
else if (mode === 'encode') encode();
else if (mode === 'all') { await frames(); mixAudio(); encode(); }
else throw new Error(`unknown mode ${mode}`);
process.exit(0);
