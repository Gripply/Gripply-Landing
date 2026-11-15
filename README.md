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
| any missing path | `404.html` | "Page not found", in the legal pages' shape, with links to the home page, Features and FAQ. Netlify serves it with a 404 status for any path that has no file (no redirect rule needed). It is `noindex`, has no canonical and is not in the sitemap; every link and asset in it is root-relative because it can be served at any depth. |

The extensionless URLs are Netlify redirects in `netlify.toml`. `sitemap.xml` lists the same six pages.

The app appears as a phone mock-up drawn in HTML and CSS (`.phone-mock`), in two places: beside "What Gripply does" on the home page and beside the daily brief on the features page. Each is one labelled image (`role="img"`) that mirrors the app's Today screen, so update it when that screen changes. The home hero shows photographs, not the app. Don't add screenshots.

## Files

- `styles.css` — all styling, in the "Bold minimal" design: black, white, greys and one lime accent (`#a3e635`; labels use the darker `#3f6212`), Epilogue headings, Inter body, the wordmark in Space Grotesk, hairlines instead of cards. Light only; the dark values are kept in a comment for later. Design tokens are CSS variables on `:root`, and the contents list at the top of the file gives its sections (tokens, base, shared components, then each page). Shared pieces include the sticky black top bar (`.topbar`, with the phone menu `.nav-menu`), label chips (`.chip`), outlined numerals (`.numeral`), hairline rows (`.row`), the waitlist form (`.waitlist`), the phone mock-up and the black footer.
- `site.js` — waitlist form submission (posts to the Netlify function), and the phone menu (a `<details>` element): it slides the panel in and back out, and closes it on a link tap or Escape.
- `consent.js` — cookie banner and gated Google Analytics loader. GA only loads after the visitor accepts; the choice is kept in `localStorage`.
- `netlify/functions/subscribe.js` — serverless function that upserts the email into Kit (ConvertKit) and adds it to the waitlist form. Needs `KIT_API_KEY` and `KIT_FORM_ID` in the Netlify environment.
- `img/` — the five home hero photographs (WebP, in colour; the CSS shows them in black and white).
- `og-image.png` — social share image (1200×630), referenced as `og-image.png?v=N` in every page's head.
- `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` — the logo mark (dark rounded square, white speech bubble, lime dot) as icon files. `favicon.svg` is the mark exactly; the PNGs are rendered from it (transparent corners), `favicon.ico` holds 16, 32 and 48px PNG images, and `apple-touch-icon.png` (180×180) fills the square to the corners with no transparency, because iOS rounds them itself. `icon-512.png` is also the logo in the structured data. Every page links them the same way; the ICO's link says `sizes="48x48"` on purpose, because listing all three sizes makes Chromium browsers use the ICO instead of the SVG. If the mark changes, regenerate all five from the new SVG.
- `site.webmanifest` — name, theme colour and the 192 and 512 icons, with `display: browser` (this is a website, not an installable app).
- `robots.txt` — allows every crawler, search and AI alike, and names the sitemap. Keep it that way: blocking a crawler takes the site out of that engine's results or AI answers.
- `sitemap.xml` — the six clean URLs with a `<lastmod>` each.
- `llms.txt` — a plain-text summary of the site for AI tools ([llmstxt.org](https://llmstxt.org) format), written only from the site's visible copy and the published company details.

## Cache busting

`styles.css`, `site.js`, `consent.js` and `img/*` are served with a one-year immutable cache (`netlify.toml`). Every page references the three files with a `?v=N` query string, and `index.html` its photographs. **When you change one of those files, bump its `N` in all six HTML pages and `404.html`** (for a photograph, on its `src` in `index.html`), or returning visitors keep the old version. `og-image.png` has a short cache instead, but the pages reference it as `og-image.png?v=N` too: when you replace it, bump that `N` in the `og:image` and `twitter:image` tags of all six pages so share previews fetch the new one. The icons and `site.webmanifest` are never versioned (Google wants a stable favicon URL), so they have a week's and a day's cache instead.

## Working locally

There is nothing to install. Serve the folder with any static server so the absolute `/styles.css` paths resolve:

```sh
python3 -m http.server 8765
```

Then open `http://localhost:8765/index.html`. A plain static server doesn't apply the `netlify.toml` redirects, so links such as `/features` give a 404 there: open `/features.html` instead. The waitlist form needs the Netlify function, so use `netlify dev` (which applies the redirects too) if you want to test submissions.

## Deployment

Netlify builds from `main`: `publish = "."`, functions from `netlify/functions`. Security headers and caching rules are in `netlify.toml`.

## Search and AI metadata

Each page's head carries, besides the title and meta description: `<html lang="en-GB">`, robots `index, follow, max-image-preview:large` (never add `nosnippet`, `noarchive` or a `max-snippet` limit: they cut what Google's and Bing's AI answers can use), an absolute canonical, Open Graph and Twitter tags (with `og:site_name` "Gripply" and `og:locale` `en_GB`), the icon links and one JSON-LD block of schema.org structured data:

- `index.html`: an `@graph` of the Organization (`https://gripply.app/#organization`: Gripply Limited, company number, registered office, the privacy and complaints addresses, logo), the WebSite (`#website`), the app (`#app`, a SoftwareApplication: description, category, audience and feature list from the copy) and the home WebPage.
- the other five pages: their WebPage (on `faq.html` a FAQPage holding the five questions and answers word for word), with the page's meta description, linked to those nodes by `@id`, plus a short Organization and WebSite (name and URL only, same `@id`), because search engines read each page's structured data on its own.

Everything in the metadata must be true and visible somewhere on the site. In particular, add no price, `offers`, ratings, reviews, `sameAs` profiles, operating systems or app-store links until they exist and the pages show them. Google Search Console (and the Rich Results Test) will list the SoftwareApplication as an invalid "Software apps" item, missing `offers` and a rating or review, because Google's app rich result needs a price and ratings. That error is expected and does not hurt ranking: the markup is there to tell search engines and AI tools what Gripply is. Don't "fix" it with a made-up price or rating; add real ones once Gripply is in the app stores with a published price. The structured data carries no dates; a legal page's WebPage could take a `dateModified`, but only one that matches its visible "Last updated" date and its last real change.

## Keeping copy in step with the product

The site describes what Gripply does, so when the product changes, check:

- the hero and meta descriptions on `index.html`, and the channel strip;
- the feature rows on the home and features pages, the "Also in the box" extras, the phone mock-ups and the FAQ page;
- `privacy.html` and `terms.html`, which name the channels and every third party that handles data (the `.partner` list in `privacy.html`: Twilio, Meta, Deepgram, Anthropic, OpenAI, Stripe, Auth0, AWS, Expo, Netlify, Kit, Google Analytics).

And when the copy or the company details change, keep the metadata in step:

- each page's `<title>`, meta description and the `og:`/`twitter:` titles and descriptions (the WebPage `name` in the JSON-LD repeats the `<title>`);
- the JSON-LD: the company facts in the Organization (they come from the legal pages), the app's description and feature list (from the home and features copy), and the FAQPage on `faq.html`, which must match the visible questions and answers word for word;
- `sitemap.xml`: set a page's `<lastmod>` to the day its content, links or structured data last changed in a meaningful way (not for a copyright year or a stylesheet bump);
- `llms.txt`, which repeats the product summary, pricing status, company details and contact addresses.
