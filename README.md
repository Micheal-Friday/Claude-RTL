# Claude & ChatGPT RTL — Persian & Arabic support

A small browser extension that makes **Persian/Arabic** text on
[Claude](https://claude.ai) and [ChatGPT](https://chatgpt.com) render **right-to-left** automatically, while
keeping code blocks and math (equations) **left-to-right**. It adds a toolbar
popup with an on/off toggle.

> Unofficial, independent project. Not affiliated with or endorsed by Anthropic or OpenAI.

## Features

- Per-paragraph direction: blocks containing Persian/Arabic use `dir="rtl"`,
  including paragraphs beginning with an English word. English-only blocks
  stay LTR, and the composer uses native `dir="auto"` detection.
- **Code stays LTR** — `pre`, `code`, `kbd`, `samp` are never flipped.
- **Math stays LTR** — KaTeX/MathML is isolated so an equation like `p = mg`
  is no longer reordered to `mg = p` inside an RTL line.
- **Toolbar toggle** — turn it on/off across supported tabs; state is saved in
  `storage.local`. Turning it off cleanly reverts every change.
- Works while Claude and ChatGPT stream responses (mutations are batched per frame).

## Repository layout

```
.
├── firefox/   # Manifest V2 build (SVG icon)  → addons.mozilla.org
└── chrome/    # Manifest V3 build (PNG icons)  → Chrome / Edge / Brave
```

The two builds share identical `content.js`, `styles.css`, and popup files;
only the `manifest.json` and icon format differ per store requirements.

## Install (from source, unpacked)

### Firefox
1. Open `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on…** → select `firefox/manifest.json`.

### Chrome / Edge / Brave
1. Open `chrome://extensions` (Edge: `edge://extensions`).
2. Enable **Developer mode**.
3. **Load unpacked** → select the `chrome/` folder.

Then open **claude.ai**, **chatgpt.com**, or **chat.openai.com** and click the **اA** toolbar icon to toggle RTL.

After updating the source in Firefox, open `about:debugging#/runtime/this-firefox`,
click **Reload** on the extension, then reload the ChatGPT tab. The popup shows
the installed version (currently **1.1.1**).

## Build (package for the stores)

Requires [Node.js](https://nodejs.org/) ≥ 18 (includes npm). Uses Mozilla's
[`web-ext`](https://github.com/mozilla/web-ext); there is no transpilation or
minification — source files are shipped verbatim.

```sh
npm install
npm test                 # verify RTL behavior for both builds
npm run lint:firefox     # validate the Firefox build (0 errors expected)
npm run build:firefox    # → dist/firefox/ packaged Firefox zip
npm run build:chrome     # → dist/chrome/ packaged Chrome zip
```

For real-browser table checks, run `npm run test:browser` with Chrome installed,
or `node tests/browser-check.cjs "C:/Program Files/Mozilla Firefox/firefox.exe"`
for Firefox. These use isolated profiles and a local test page.

## License

[MIT](LICENSE)
