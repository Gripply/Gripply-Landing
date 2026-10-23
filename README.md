# Gripply landing site

The public site at [gripply.app](https://gripply.app): a static marketing site with an early-access waitlist. No build step — plain HTML, one stylesheet, two small scripts, deployed on Netlify.

## Pages

| URL | File | What it is |
| --- | --- | --- |
| `/` | `index.html` | Home. Hero with the phone mock-up and channel chips (calls, SMS, WhatsApp Business, Instagram, Messenger), waitlist form, "how it works" steps, three feature cards, a second waitlist form, FAQ. |
| `/features` | `features.html` | The full tour: six feature cards, "also in the box" mini-cards, waitlist form. |
| `/privacy` | `privacy.html` | Privacy policy. |
| `/terms` | `terms.html` | Terms of use. |
| `/complaints` | `complaints.html` | Complaints code of practice (Ofcom General Condition C4). |

The extensionless URLs are Netlify redirects in `netlify.toml`. `sitemap.xml` and `robots.txt` list the same five pages.

The only picture of the app on the site is the hero on the home page. Feature sections are copy-only cards; don't add mock-ups or screenshots elsewhere.

## Files

- `styles.css` — all styling. Design tokens are CSS variables on `:root` (dark theme, lime accent `#a3e635`). Feature cards use `.feature-grid` / `.feature-row`; the hero phone is `.phone-tilt`.
- `site.js` — waitlist form submission (posts to the Netlify function) and the mobile menu.
- `consent.js` — cookie banner and gated Google Analytics loader. GA only loads after the visitor accepts; the choice is kept in `localStorage`.
- `netlify/functions/subscribe.js` — serverless function that upserts the email into Kit (ConvertKit) and adds it to the waitlist form. Needs `KIT_API_KEY` and `KIT_FORM_ID` in the Netlify environment.
- `og-image.png` — social share image.

## Cache busting

`styles.css`, `site.js` and `consent.js` are served with a one-year immutable cache (`netlify.toml`). Every page references them with a `?v=N` query string. **When you change one of those files, bump its `N` in all five HTML pages**, or returning visitors keep the old version.

## Working locally

There is nothing to install. Serve the folder with any static server so the absolute `/styles.css` paths resolve:

```sh
python3 -m http.server 8765
```

Then open `http://localhost:8765/index.html`. The waitlist form needs the Netlify function, so use `netlify dev` if you want to test submissions.

## Deployment

Netlify builds from `main`: `publish = "."`, functions from `netlify/functions`. Security headers and caching rules are in `netlify.toml`.

## Keeping copy in step with the product

The site describes what Gripply does, so when the product changes, check:

- the hero and meta descriptions on `index.html`, and the channel chips;
- the feature cards on both pages and the FAQ;
- `privacy.html` and `terms.html`, which name the channels and third parties (Twilio, Meta for WhatsApp, Instagram and Messenger, Deepgram, Anthropic, OpenAI, Stripe, Auth0).
