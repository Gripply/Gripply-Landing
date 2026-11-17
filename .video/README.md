# The home page video

The source of "Gripply in under a minute", the video under the home page's channels strip (`/video/gripply-summary.mp4`).
It lives in a dot-folder so Netlify doesn't publish it.

The video isn't edited in a video editor: it's a web page (`stage.html`, `stage.css`, `stage.js`) drawn in the site's
own look, rendered frame by frame in headless Edge and put together with ffmpeg. To change a word, a colour or a
move, change the page or the script and render it again; never edit the mp4.

## What it is

37 seconds, 1920×1080, 30 fps: eight scenes of kinetic type on the site's white and grey pages and black panels,
in the site's tokens and type (Epilogue headlines, Inter, the Space Grotesk wordmark, sentence case, the lime
full stop at the end of every headline). The lime full stop is the thread through it: it bursts to open the next
scene, bounces down the quote-to-paid steps and ends up as the dot in the logo.

| Scene | Narration | On screen |
| --- | --- | --- |
| hook | Hands full, and the phone's ringing... again? | The builder photograph (black and white, as on the site) and a ringing call card |
| textback | Miss the call, and Gripply texts them back for you. Job saved! | The real default text-back (`MissedCallTextBackService`) and the reply |
| channels | Calls, texts, WhatsApp, Instagram and Messenger... all in one thread. | The five channels pop in as they're named, then line up as one thread |
| todo | Whatever you agree becomes a to-do. | A line from a call, highlighted, dropping into a to-do |
| diary | Settle on a time, and it's in the diary. | A visit dropping into Thursday |
| money | Then quote it, bill it, and get paid, all from your phone. | Quote, invoice, paid, with the lime dot bouncing down them |
| brief | And every morning, a brief of who to ring back and what to chase. | The site's phone mock-up (copied live from `index.html`), the video's one look at the app |
| end | Gripply. More jobs... less admin. | The logo, the tagline and gripply.app |

People and numbers are the made-up ones the app's tours use (Sarah Mitchell), plus the phone mock-up's own.
Nothing on screen is a screenshot.

## Files

- `script.json`: the narration, a line per scene, with the quiet after each; the voice; and where the music's
  groove and final hit fall in its file.
- `voice.mjs`: speaks each line in the house voice (ElevenLabs "Gripply Voiceover Female", eleven_v3, the voice of
  the app's tours) with word timings, into `audio/<scene>-<hash>.mp3` and `.json`. Cached by the words, so only a
  changed line is spoken again. Needs an ElevenLabs key in `ELEVENLABS_API_KEY` or `~/.elevenlabs_key`.
- `audio/music.mp3`: the music, an upbeat instrumental made with Eleven Music through Runway (the ElevenLabs key
  has no music permission). `music.mjs` can make one straight from ElevenLabs with a key that has it.
- `timeline.mjs`: works out when each line is said, when each scene starts, and when every word lands, and how
  much to stretch the music (pitch kept) so its groove lands on the first scene change and its final hit on the
  end card. `timeline.json` is its output (not committed).
- `stage.html`, `stage.css`, `stage.js`: the video as a page. `render(t)` draws the moment `t` seconds in, so any
  frame can be drawn on its own. Headline words rise as the voice says them (`wt(scene, 'word')`).
- `make.mjs`: renders it all. The frames, the mix and the encodes go to `out/` (not committed); the finished
  video, its poster and captions to `/video`.
- `fonts/`: Epilogue, Inter and Space Grotesk (SIL Open Font License, licences beside them), so the render needs no
  network.

## Making it

```sh
node .video/voice.mjs                  # only when a line in script.json changed
node .video/make.mjs stills 4.3 9.6    # check a few moments: .video/out/stills/
node .video/make.mjs                   # frames (about 5 minutes), mix, encode → /video
```

Needs Node 22 or later, ffmpeg with rubberband on the PATH (the gyan.dev full build has it) and Edge or Chrome.
Open `.video/stage.html?play` from any static server at the repo root (`python3 -m http.server`) to watch the
motion in real time without audio, or `?t=12.5` for one moment.

After a re-render, bump `?v=N` on the video, poster and captions in `index.html` (the `<video>` and the
VideoObject in the structured data), and if the length changed, the VideoObject's `duration`.
