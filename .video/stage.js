// Draws the summary video at any moment: render(t) sets every element for time t (seconds), so
// frames can be captured in any order and a still at 12.3 s is exactly frame 369 of the video.
// Times come from timeline.json: each scene opens just before its narration, and the words of
// each headline arrive as the voice says them.

const T = await (await fetch('timeline.json', { cache: 'no-store' })).json();
window.DURATION = T.duration;
const W = T.width, H = T.height;

// ---------- motion ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, p) => a + (b - a) * p;
const E = {
  out: p => 1 - Math.pow(1 - p, 3),
  in: p => p * p * p,
  inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  sine: p => 0.5 - Math.cos(Math.PI * p) / 2,
};
const ease = (t, t0, d, fn = E.out) => fn(clamp((t - t0) / d));
/** A damped spring from 0 to 1 starting at t0: k sets the speed, z the damping (overshoot ≈ e^(−πz/k)). */
function spring(t, t0, k = 16, z = 8) {
  const u = t - t0;
  if (u <= 0) return 0;
  return 1 - Math.exp(-z * u) * (Math.cos(k * u) + (z / k) * Math.sin(k * u));
}
/** 0 → 1 → 0 over d seconds from t0: a squash or a flash. */
const bump = (t, t0, d) => { const p = (t - t0) / d; return p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p); };
function tf(el, { x = 0, y = 0, s = 1, sx, sy, r = 0, o } = {}) {
  el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${r.toFixed(3)}deg) scale(${(sx ?? s).toFixed(4)}, ${(sy ?? s).toFixed(4)})`;
  if (o !== undefined) el.style.opacity = clamp(o).toFixed(3);
}
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const mix = (a, b, p) => {   // two #rrggbb colours
  const ca = a.match(/\w\w/g).map(h => parseInt(h, 16)), cb = b.match(/\w\w/g).map(h => parseInt(h, 16));
  return `rgb(${ca.map((c, i) => Math.round(lerp(c, cb[i], p))).join(',')})`;
};
const center = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; };

// ---------- headlines: every word rises out of its own mask ----------
for (const line of $$('.v-line[data-say]')) {
  line.innerHTML = line.dataset.say.split(' ').map(w => `<span class="w"><span>${w}</span></span>`).join(' ')
    + ('dot' in line.dataset ? '<span class="v-dot"></span>' : '');
}
/** Words of a scene's headline, in order. */
const headWords = el => $$('.v-hl .w > span', el);
function revealWords(words, times, t) {
  words.forEach((w, i) => {
    const p = spring(t, times[i], 13, 10);
    w.style.transform = `translateY(${((1 - p) * 150).toFixed(2)}%)`;
  });
}
function popDot(dot, t0, t) {
  const p = spring(t, t0, 18, 6.5);
  dot.style.transform = `scale(${p.toFixed(4)})`;
}
function popChip(chip, t0, t) {
  if (!chip) return;
  const p = spring(t, t0, 16, 9);
  tf(chip, { x: (1 - p) * -40, o: ease(t, t0, 0.15) });
}

// ---------- scenes ----------
const S = T.scenes.map((s, i) => ({ ...s, i, el: $(`#s-${s.id}`) }));
const byId = Object.fromEntries(S.map(s => [s.id, s]));
const norm = w => w.toLowerCase().replace(/[^a-z0-9'-]/g, '');
/** When the narration says `word` in this scene (the nth time it says it). */
function wt(sc, word, nth = 0) {
  const hits = sc.words.filter(w => norm(w.w) === norm(word));
  if (!hits[nth]) throw new Error(`"${word}" is not said in ${sc.id}`);
  return hits[nth].t;
}
const stagger = (t0, n, step = 0.12) => Array.from({ length: n }, (_, i) => t0 + i * step);

// 1. hook ----------------------------------------------------------------
{
  const sc = byId.hook, el = sc.el;
  const words = headWords(el);
  const again = words[4].parentElement;
  again.style.position = 'relative'; again.style.zIndex = '0';
  const mark = document.createElement('span'); mark.className = 'mark__bg'; again.prepend(mark);
  const photo = $('.hook-photo', el), img = $('img', photo), card = $('#hook-call'), icon = $('#hook-icon');
  const rings = $$('.call__ring', el), count = $('#hook-count');
  const times = [wt(sc, 'hands'), wt(sc, 'full'), wt(sc, "phone's"), wt(sc, 'ringing'), wt(sc, 'again')];
  // the phone rings in bursts on the music's finger snaps (every other beat of the intro)
  const P = T.music ? 2 * T.music.beat : 1.0, PHASE = T.music ? T.music.groove - T.music.beat : 0.45;
  const ringFrom = 0.45, ringTo = 4.4;
  const phase = t => (((t - PHASE) % P) + P) % P;
  const ringEnv = t => { if (t < ringFrom || t > ringTo) return 0; const ph = phase(t); return ph < 0.6 * P ? Math.sin(Math.PI * ph / (0.6 * P)) : 0; };
  sc.draw = t => {
    revealWords(words, times, t);
    mark.style.transform = `scaleX(${ease(t, times[4] + 0.12, 0.3).toFixed(4)})`;
    const env = ringEnv(t);
    words[3].style.rotate = `${(env * Math.sin(t * 2 * Math.PI * 9) * 2.2).toFixed(3)}deg`;
    const reveal = ease(t, 0, 0.6, E.out);
    photo.style.clipPath = `inset(0 0 0 ${((1 - reveal) * 100).toFixed(2)}%)`;
    img.style.transform = `scale(${(1.1 - 0.06 * ease(t, 0, 5, E.sine)).toFixed(4)})`;
    const pop = spring(t, 0.15, 15, 8);
    tf(card, { y: (1 - pop) * 120, s: lerp(0.8, 1, pop), r: env * Math.sin(t * 2 * Math.PI * 14) * 2.4, o: ease(t, 0.15, 0.12) });
    rings.forEach((ring, j) => {
      const ph = phase(t - j * 0.3 * P) / P;
      const on = t > ringFrom + j * 0.3 && t < ringTo + 0.5;
      ring.style.transform = `scale(${(1 + ph * 1.3).toFixed(3)})`;
      ring.style.opacity = on ? ((1 - ph) * 0.9).toFixed(3) : '0';
    });
    count.textContent = t < times[4] ? '2×' : '3×';
    const cp = t < times[4] ? 0 : 1 - spring(t, times[4], 18, 7);
    count.style.display = 'inline-block';
    count.style.transform = `scale(${(1 + cp * 0.8).toFixed(3)})`;
  };
}

// 2. missed-call text-back -----------------------------------------------
{
  const sc = byId.textback, el = sc.el;
  const words = headWords(el), dot = $('.v-dot', el), chip = $('.v-chip', el);
  const youT = wt(sc, 'you');
  const times = [wt(sc, 'miss'), wt(sc, 'the'), wt(sc, 'call'), ...stagger(youT - 0.05, 3, 0.11)];
  const items = [
    { el: $('#tb-sys'), on: wt(sc, 'miss') + 0.1, gap: 34 },
    { el: $('#tb-typing'), on: wt(sc, 'gripply') - 0.05, off: wt(sc, 'texts') + 0.15, gap: 22 },
    { el: $('#tb-out'), on: wt(sc, 'texts') + 0.12, gap: 12 },
    { el: $('#tb-note'), on: wt(sc, 'texts') + 0.45, gap: 34 },
    { el: $('#tb-in'), on: wt(sc, 'job') - 0.4, gap: 0 },
  ];
  const typingDots = $$('.typing i', el), sticker = $('#tb-sticker');
  const stickerT = wt(sc, 'saved') - 0.08;
  const BOTTOM = 880;
  sc.draw = t => {
    popChip(chip, sc.start + 0.2, t);
    revealWords(words, times, t);
    popDot(dot, wt(sc, 'job'), t);
    // the chat: anchored at the bottom, each new message pushing the older ones up
    let cursor = BOTTOM;
    const ys = [];
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const h = it.h ??= it.el.offsetHeight;
      let a = ease(t, it.on, 0.4, E.out);
      if (it.off !== undefined) a *= 1 - ease(t, it.off, 0.25, E.out);
      ys[i] = cursor - h;
      cursor -= (h + it.gap) * a;
    }
    items.forEach((it, i) => {
      const p = spring(t, it.on, 17, 9);
      let o = ease(t, it.on, 0.12);
      if (it.off !== undefined) o *= 1 - ease(t, it.off, 0.15);
      tf(it.el, { y: ys[i], s: lerp(0.55, 1, p), o });
    });
    typingDots.forEach((d, j) => { d.style.transform = `translateY(${(-9 * Math.max(0, Math.sin(2 * Math.PI * (t * 2.4 - j * 0.17)))).toFixed(2)}px)`; });
    const sp = spring(t, stickerT, 15, 6.5);
    // the sticker slaps on just under the reply, clear of its words and of the "sent for you" note
    tf(sticker, { x: 1060 + 260 - 1440, y: ys[4] + items[4].h - 22, s: sp, r: lerp(-30, -6, sp), o: ease(t, stickerT, 0.08) });
  };
}

// 3. every channel, one thread -------------------------------------------
{
  const sc = byId.channels, el = sc.el;
  const words = headWords(el), dot = $('.v-dot', el), chip = $('.v-chip', el);
  const times = [...stagger(sc.start + 0.25, 2, 0.12), wt(sc, 'one'), wt(sc, 'thread')];
  const tags = $$('.tag', el), head = $('#ch-head'), line = $('#ch-line');
  const scatter = [[30, 150, -7], [370, 70, 6], [90, 360, 4], [330, 520, -5], [40, 690, 6]];
  const ROW0 = 170, ROW = 124, X = 70;
  const at = tags.map(tag => wt(sc, tag.dataset.word));
  const gather = wt(sc, 'all');
  const whens = tags.map(tag => $('.tag__when', tag));
  sc.draw = t => {
    popChip(chip, sc.start + 0.15, t);
    revealWords(words, times, t);
    popDot(dot, wt(sc, 'thread') + 0.32, t);
    tags.forEach((tag, i) => {
      const p = spring(t, at[i] - 0.05, 18, 8);
      const g = spring(t, gather + i * 0.06, 12, 8.5);
      const [sx0, sy0, r0] = scatter[i];
      tf(tag, { x: lerp(sx0, X, g), y: lerp(sy0 + (1 - p) * 40, ROW0 + i * ROW, g), r: lerp(r0, 0, g) + (1 - p) * r0 * 2, s: lerp(0.2, 1, p), o: ease(t, at[i] - 0.05, 0.1) });
      whens[i].style.opacity = ease(t, gather + 0.3 + i * 0.06, 0.3).toFixed(3);
    });
    const lp = ease(t, gather + 0.25, 0.7, E.inOut);
    line.style.left = `${X + 37}px`;
    line.style.top = `${ROW0 + 44}px`;
    line.style.height = `${(4 * ROW * lp).toFixed(1)}px`;
    line.style.opacity = lp > 0 ? '1' : '0';
    const hp = spring(t, wt(sc, 'one') - 0.15, 15, 8);
    tf(head, { y: (1 - hp) * 30, s: lerp(0.8, 1, hp), o: ease(t, wt(sc, 'one') - 0.15, 0.12) });
  };
}

// 4. every promise becomes a to-do ---------------------------------------
{
  const sc = byId.todo, el = sc.el;
  const words = headWords(el), dot = $('.v-dot', el), chip = $('.v-chip', el);
  const times = [...stagger(sc.start + 0.2, 2, 0.12), wt(sc, 'becomes'), wt(sc, 'a'), wt(sc, 'to-do')];
  const said = $('#td-said'), m1 = $('#td-mark'), m2 = $('#td-mark2'), row = $('#td-row');
  said.style.transformOrigin = '0 100%';
  sc.draw = t => {
    popChip(chip, sc.start + 0.15, t);
    revealWords(words, times, t);
    popDot(dot, wt(sc, 'to-do') + 0.3, t);
    const sp = spring(t, sc.start + 0.1, 15, 8);
    tf(said, { y: (1 - sp) * 60, s: lerp(0.7, 1, sp), o: ease(t, sc.start + 0.1, 0.12) });
    m1.style.transform = `scaleX(${ease(t, wt(sc, 'agree') - 0.15, 0.32).toFixed(4)})`;
    m2.style.transform = `scaleX(${ease(t, wt(sc, 'agree') + 0.12, 0.25).toFixed(4)})`;
    const rp = spring(t, wt(sc, 'becomes') - 0.05, 13, 7.5);
    tf(row, { y: lerp(-300, 0, rp), s: lerp(0.45, 1, rp), o: ease(t, wt(sc, 'becomes') - 0.05, 0.1) });
  };
}

// 5. agree a time, it's booked -------------------------------------------
{
  const sc = byId.diary, el = sc.el;
  const words = headWords(el), dot = $('.v-dot', el), chip = $('.v-chip', el);
  const times = [wt(sc, 'settle'), wt(sc, 'a'), wt(sc, 'time'), wt(sc, 'in'), wt(sc, 'diary')];
  const day = $('.day', el), thu = $('#dy-thu'), pill = $('#dy-time'), booking = $('#dy-booking');
  const pillT = wt(sc, 'time') - 0.05, dropT = wt(sc, 'in') - 0.1;
  sc.draw = t => {
    popChip(chip, sc.start + 0.15, t);
    revealWords(words, times, t);
    popDot(dot, wt(sc, 'diary') + 0.28, t);
    const dp = spring(t, sc.start + 0.05, 13, 8);
    tf(day, { x: (1 - dp) * 260, o: ease(t, sc.start + 0.05, 0.15) });
    const tp = spring(t, pillT, 16, 7);
    thu.style.background = mix('#ffffff', '#a3e635', ease(t, pillT, 0.2));
    thu.style.borderColor = mix('#0b0b0d', '#a3e635', ease(t, pillT, 0.2));
    tf(thu, { s: 1 + 0.25 * bump(t, pillT, 0.35) });
    tf(pill, { y: (1 - tp) * 40 - ease(t, dropT, 0.3, E.in) * 40, s: lerp(0.3, 1, tp), r: lerp(12, -4, tp), o: ease(t, pillT, 0.08) * (1 - ease(t, dropT + 0.05, 0.2)) });
    const bp = spring(t, dropT, 15, 7.5);
    const squash = bump(t, dropT + 0.13, 0.3);
    tf(booking, { y: lerp(-360, 0, bp), sx: 1 + 0.07 * squash, sy: 1 - 0.12 * squash, o: ease(t, dropT, 0.08) });
  };
}

// 6. quote it, bill it, get paid -----------------------------------------
{
  const sc = byId.money, el = sc.el;
  const words = headWords(el), dot = $('.v-dot', el), chip = $('.v-chip', el);
  const times = [wt(sc, 'quote'), wt(sc, 'it', 0), wt(sc, 'bill'), wt(sc, 'it', 1), wt(sc, 'get'), wt(sc, 'paid')];
  const stops = $$('.stop', el), nums = $$('.numeral', el), labels = $$('.stop__label', el), subs = $$('.stop__sub', el);
  const hop = $('#mn-hop'), ripples = [$('#mn-ripple1'), $('#mn-ripple2')], ways = $('#mn-ways');
  const land = [wt(sc, 'quote') - 0.05, wt(sc, 'bill'), wt(sc, 'paid')];
  const JUMP = 0.34;
  let pts;
  sc.draw = t => {
    popChip(chip, sc.start + 0.15, t);
    revealWords(words, times, t);
    popDot(dot, wt(sc, 'paid') + 0.3, t);
    if (!pts) {   // where the dot lands: left of each numeral, measured at rest
      stops.forEach(s => { s.style.transform = ''; });
      pts = nums.map(n => { const r = n.getBoundingClientRect(); return { x: r.left - 62, y: r.top + r.height / 2 }; });
    }
    stops.forEach((s, i) => { const p = spring(t, sc.start + 0.05 + i * 0.07, 14, 9); tf(s, { x: (1 - p) * 120, o: ease(t, sc.start + 0.05 + i * 0.07, 0.15) }); });
    // the lime dot: appears on 01, then bounces down to 02 and 03 on "bill" and "paid"
    let x = pts[0].x, y = pts[0].y, sx = 1, sy = 1;
    for (let i = 1; i < 3; i++) {
      const p = clamp((t - (land[i] - JUMP)) / JUMP);
      if (p <= 0) break;
      const q = E.inOut(p);
      x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * q - Math.sin(Math.PI * q) * 150;
      y = lerp(pts[i - 1].y, pts[i].y, q) - Math.sin(Math.PI * q) * 40;
      const st = 1 + 0.25 * Math.sin(Math.PI * p);
      sx = 1 / st; sy = st;
    }
    const sq = Math.max(...land.map(l => bump(t, l, 0.2)));
    const pop = spring(t, land[0] - 0.1, 18, 7);
    tf(hop, { x, y, s: pop, sx: pop * (sx + 0.35 * sq), sy: pop * (sy - 0.3 * sq), o: ease(t, land[0] - 0.1, 0.06) });
    nums.forEach((n, i) => {
      const f = ease(t, land[i], 0.25);
      n.style.color = mix('#ffffff', '#0b0b0d', f);
      labels[i].style.color = mix('#5f5f66', '#0b0b0d', f);
      subs[i].style.color = mix('#9a9aa0', '#474747', f);
      tf(n, { s: 1 + 0.12 * bump(t, land[i], 0.3) });
    });
    ripples.forEach((rp, j) => {
      const p = ease(t, land[2] + j * 0.14, 0.7, E.out);
      tf(rp, { x: pts[2].x, y: pts[2].y, s: 1 + p * 5, o: p > 0 ? 0.9 * (1 - p) : 0 });
    });
    const wp = spring(t, wt(sc, 'from') - 0.15, 14, 9);
    tf(ways, { y: (1 - wp) * 40, o: ease(t, wt(sc, 'from') - 0.15, 0.15) });
  };
}

// 7. the daily brief -----------------------------------------------------
{
  const sc = byId.brief, el = sc.el;
  const words = headWords(el), dot = $('.v-dot', el), chip = $('.v-chip', el);
  const times = [wt(sc, 'every'), wt(sc, 'morning'), wt(sc, 'brief') - 0.08, wt(sc, 'brief') + 0.06];
  const holder = $('#br-phone'), notif = $('#br-notif'), focus = $('#br-focus');
  const doc = new DOMParser().parseFromString(await (await fetch('/index.html', { cache: 'no-store' })).text(), 'text/html');
  holder.append(document.importNode(doc.querySelector('.does__mock .phone'), true));
  const SCALE = 1.42;
  const targets = [['.phone__brief', wt(sc, 'brief') - 0.1], ['.phone__list', wt(sc, 'ring') - 0.1], ['.phone__task', wt(sc, 'chase') - 0.1]];
  const notifT = wt(sc, 'morning') - 0.1, notifOff = wt(sc, 'brief') - 0.15;
  sc.draw = t => {
    popChip(chip, sc.start + 0.15, t);
    revealWords(words, times, t);
    popDot(dot, wt(sc, 'brief') + 0.35, t);
    const pp = spring(t, sc.start + 0.02, 11, 7);
    holder.style.transform = `translate(0px, ${((1 - pp) * 900).toFixed(1)}px) rotate(${((1 - pp) * 8).toFixed(3)}deg) scale(${SCALE})`;
    const np = spring(t, notifT, 15, 8);
    const off = ease(t, notifOff, 0.35, E.in);
    tf(notif, { y: lerp(-260, 0, np) - off * 300, s: lerp(0.9, 1, np), o: ease(t, notifT, 0.1) * (1 - off) });
    // the lime ring moves to what the voice is talking about
    const rects = targets.map(([sel]) => holder.querySelector(sel).getBoundingClientRect());
    let k = -1;
    targets.forEach(([, at], i) => { if (t >= at) k = i; });
    if (k < 0) { focus.style.opacity = '0'; return; }
    const from = rects[Math.max(0, k - 1)], to = rects[k];
    const p = k === 0 ? 1 : ease(t, targets[k][1], 0.35, E.inOut);
    const pad = 12;
    focus.style.left = `${lerp(from.left, to.left, p) - pad}px`;
    focus.style.top = `${lerp(from.top, to.top, p) - pad}px`;
    focus.style.width = `${lerp(from.width, to.width, p) + pad * 2}px`;
    focus.style.height = `${lerp(from.height, to.height, p) + pad * 2}px`;
    const fp = spring(t, targets[0][1], 16, 8);
    focus.style.opacity = ease(t, targets[0][1], 0.1).toFixed(3);
    focus.style.transform = `scale(${lerp(1.15, 1, fp).toFixed(4)})`;
  };
}

// 8. end card -------------------------------------------------------------
{
  const sc = byId.end, el = sc.el;
  const words = headWords(el), dot = $('.v-dot', el);
  const times = [wt(sc, 'more'), wt(sc, 'jobs'), wt(sc, 'less'), wt(sc, 'admin')];
  const logo = $('#end-logo'), bubble = $('#end-bubble'), ldot = $('#end-dot'), word = $('#end-word'), cta = $('#end-cta');
  const L = bubble.getTotalLength();
  bubble.style.strokeDasharray = `${L}`;
  ldot.style.transformBox = 'fill-box'; ldot.style.transformOrigin = '50% 50%';
  const g = wt(sc, 'gripply');
  sc.draw = t => {
    const lp = spring(t, g - 0.25, 14, 8);
    tf(logo, { y: (1 - lp) * 40, s: lerp(0.85, 1, lp), o: ease(t, g - 0.25, 0.12) });
    bubble.style.strokeDashoffset = `${(L * (1 - ease(t, g - 0.2, 0.6, E.inOut))).toFixed(1)}`;
    const dp = spring(t, g + 0.3, 16, 6);
    ldot.style.transform = `translateY(${((1 - dp) * -90).toFixed(2)}px) scale(${clamp(dp * 1.5, 0, 1.6).toFixed(3)})`;
    ldot.style.opacity = ease(t, g + 0.3, 0.05).toFixed(3);
    word.style.clipPath = `inset(-10% ${((1 - ease(t, g - 0.05, 0.5, E.out)) * 100).toFixed(2)}% -10% 0)`;
    revealWords(words, times, t);
    popDot(dot, wt(sc, 'admin') + 0.32, t);
    const cp = spring(t, wt(sc, 'admin') + 0.75, 13, 8);
    tf(cta, { y: (1 - cp) * 70, o: ease(t, wt(sc, 'admin') + 0.75, 0.15) });
  };
}

// ---------- transitions between scenes ----------
// dot: the lime full stop (or the call's lime button) bursts to fill the frame and the next scene opens out of it
// up: the next scene slides up over this one · push: the next scene pushes this one off to the left
const TRANS = {
  textback: { type: 'dot', from: '#hook-icon' },
  channels: { type: 'up' },
  todo: { type: 'dot', from: '#s-channels .v-dot' },
  diary: { type: 'push' },
  money: { type: 'dot', from: '#s-diary .v-dot' },
  brief: { type: 'up' },
  end: { type: 'dot', from: '#s-brief .v-dot' },
};
const BEFORE = 0.3, AFTER = 0.3;
const wipe = $('#wipe');
S.forEach(s => { s.el.style.zIndex = String(2 * s.i + 1); });

window.render = t => {
  for (const sc of S) {
    const next = S[sc.i + 1];
    const v0 = sc.i === 0 ? -1 : sc.start - BEFORE, v1 = next ? next.start + AFTER : Infinity;
    const vis = t >= v0 && t < v1;
    sc.el.style.visibility = vis ? 'visible' : 'hidden';
    sc.el.style.transform = '';
    sc.el.style.clipPath = '';
    if (vis) sc.draw(t);
  }
  wipe.style.visibility = 'hidden';
  for (const B of S.slice(1)) {
    const A = S[B.i - 1], tr = TRANS[B.id];
    const t0 = B.start - BEFORE;
    if (t < t0 || t >= B.start + AFTER) continue;
    if (tr.type === 'dot') {
      const c = center($(tr.from));
      const R = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot(x - c.x, y - c.y))) + 40;
      const r0 = Math.min(c.r.width, c.r.height) / 2;
      const r1 = lerp(r0, R, ease(t, t0, 0.4, E.inOut));
      const r2 = R * ease(t, t0 + 0.15, 0.42, E.inOut);
      wipe.style.visibility = 'visible';
      wipe.style.zIndex = String(2 * B.i);
      wipe.style.clipPath = `circle(${r1.toFixed(1)}px at ${c.x.toFixed(1)}px ${c.y.toFixed(1)}px)`;
      B.el.style.clipPath = `circle(${r2.toFixed(1)}px at ${c.x.toFixed(1)}px ${c.y.toFixed(1)}px)`;
    } else if (tr.type === 'up') {
      const p = ease(t, t0, 0.55, E.inOut);
      B.el.style.transform = `translateY(${((1 - p) * H).toFixed(1)}px)`;
      A.el.style.transform = `translateY(${(-p * H * 0.3).toFixed(1)}px)`;
    } else if (tr.type === 'push') {
      const p = ease(t, t0, 0.55, E.inOut);
      B.el.style.transform = `translateX(${((1 - p) * W).toFixed(1)}px)`;
      A.el.style.transform = `translateX(${(-p * W).toFixed(1)}px)`;
    }
  }
};

// ---------- ready ----------
await Promise.all(['700 100px Epilogue', '500 100px Epilogue', '400 20px Inter', '500 20px Inter', '600 20px Inter', '700 100px "Space Grotesk"'].map(f => document.fonts.load(f)));
await document.fonts.ready;
await Promise.all($$('img').map(i => i.decode().catch(() => {})));
const q = new URLSearchParams(location.search);
window.render(parseFloat(q.get('t') ?? '0'));
window.ready = true;
// in a normal browser tab, ?play plays it in real time (for a quick look; frames come from capture.mjs)
if (q.has('play')) { const t0 = performance.now(); const tick = () => { window.render(((performance.now() - t0) / 1000) % T.duration); requestAnimationFrame(tick); }; tick(); }
