# Gripply landing site

The public site at [gripply.app](https://gripply.app): a static marketing site with an early-access waitlist. No build step — plain HTML, one stylesheet, two small scripts, deployed on Netlify.

## Pages

| URL | File | What it is |
| --- | --- | --- |
| `/` | `index.html` | Home. Hero over photographs (shown in black and white by CSS, drifting slowly with the scroll), the waitlist form and a strip of the five channels (calls, SMS, WhatsApp Business, Instagram, Messenger); "How it works" in three numbered steps; "What Gripply does": the phone mock-up beside three feature rows and a link to `/features`. |
| `/features` | `features.html` | The full tour: nine numbered features (the daily brief, 05, beside the phone mock-up) and six "Also in the box" extras. |
| `/faq` | `faq.html` | Questions and answers (moved off the home page). |
| `/privacy` | `privacy.html` | Privacy policy. |
| `/terms` | `terms.html` | Terms of use. |
| `/complaints` | `complaints.html` | Complaints code of practice (Ofcom General Condition C4). |

The extensionless URLs are Netlify redirects in `netlify.toml`. `sitemap.xml` lists the same six pages.

The app appears as a phone mock-up drawn in HTML and CSS (`.phone-mock`), in two places: beside "What Gripply does" on the home page and beside the daily brief on the features page. Each is one labelled image (`role="img"`) that mirrors the app's Today screen, so update it when that screen changes. The home hero shows photographs, not the app. Don't add screenshots.

## Files

- `styles.css` — all styling, in the "Bold minimal" design: black, white, greys and one lime accent (`#a3e635`; labels use the darker `#3f6212`), Epilogue headings, Inter body, the wordmark in Space Grotesk, hairlines instead of cards. Light only; the dark values are kept in a comment for later. Design tokens are CSS variables on `:root`, and the contents list at the top of the file gives its sections (tokens, base, shared components, then each page). Shared pieces include the sticky black top bar (`.topbar`, with the phone menu `.nav-menu`), label chips (`.chip`), outlined numerals (`.numeral`), hairline rows (`.row`), the waitlist form (`.waitlist`), the phone mock-up and the black footer.
- `site.js` — waitlist form submission (posts to the Netlify function), and closing the phone menu (a `<details>` element) on a link tap or Escape.
- `consent.js` — cookie banner and gated Google Analytics loader. GA only loads after the visitor accepts; the choice is kept in `localStorage`.
- `netlify/functions/subscribe.js` — serverless function that upserts the email into Kit (ConvertKit) and adds it to the waitlist form. Needs `KIT_API_KEY` and `KIT_FORM_ID` in the Netlify environment.
- `img/` — the five home hero photographs (WebP, in colour; the CSS shows them in black and white).
- `og-image.png` — social share image (1200×630), referenced as `og-image.png?v=N` in every page's head.

## Cache busting

`styles.css`, `site.js`, `consent.js` and `img/*` are served with a one-year immutable cache (`netlify.toml`). Every page references the three files with a `?v=N` query string, and `index.html` its photographs. **When you change one of those files, bump its `N` in all six HTML pages** (for a photograph, on its `src` in `index.html`), or returning visitors keep the old version. `og-image.png` has a short cache instead, but the pages reference it as `og-image.png?v=N` too: when you replace it, bump that `N` in the `og:image` and `twitter:image` tags of all six pages so share previews fetch the new one.

## Working locally

There is nothing to install. Serve the folder with any static server so the absolute `/styles.css` paths resolve:

```sh
python3 -m http.server 8765
```

Then open `http://localhost:8765/index.html`. A plain static server doesn't apply the `netlify.toml` redirects, so links such as `/features` give a 404 there: open `/features.html` instead. The waitlist form needs the Netlify function, so use `netlify dev` (which applies the redirects too) if you want to test submissions.

## Deployment

Netlify builds from `main`: `publish = "."`, functions from `netlify/functions`. Security headers and caching rules are in `netlify.toml`.

## Keeping copy in step with the product

The site describes what Gripply does, so when the product changes, check:

- the hero and meta descriptions on `index.html`, and the channel strip;
- the feature rows on the home and features pages, the "Also in the box" extras, the phone mock-ups and the FAQ page;
- `privacy.html` and `terms.html`, which name the channels and every third party that handles data (the `.partner` list in `privacy.html`: Twilio, Meta, Deepgram, Anthropic, OpenAI, Stripe, Auth0, AWS, Expo, Netlify, Kit, Google Analytics).
