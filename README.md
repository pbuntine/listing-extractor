# Listing Extractor

A Chrome extension (Manifest V3) that finds the listings on the page you have open and saves them as an HTML snippet.

Click the toolbar icon. The extension scans the page, highlights the group of listings it thinks is the real one, and lets you switch between the top candidates. Then **Save .html** (a standalone file with a metadata header) or **Copy HTML**.

## Install (development)

1. `git clone` this repo
2. Open `chrome://extensions`, enable **Developer mode**
3. **Load unpacked** and select this folder

No build step. The extension only runs on a page when you click its icon (`activeTab`), and needs no host permissions.

## How detection works

1. **Site adapter** (`src/adapters/index.js`): if the host has an adapter, its CSS selector is tried first.
2. **Generic heuristic** (`src/content/detector.js`): find every element whose children repeat the same tag and class signature, then score each group on repetition, text length, links, images and price-like text. Groups inside `nav`, `header`, `footer` or `aside` are penalised. The top five are offered.

## Layout

```
manifest.json
popup/             popup UI (scan, pick candidate, save/copy)
src/content/
  detector.js      generic listing detection (pure DOM, unit tested)
  extract.js       cleaning + snippet/document building
  main.js          content-script message handler (scan/highlight/extract)
src/adapters/      per-site selectors
test/              node:test + jsdom
```

## Extending

- **New site**: add an entry to `ADAPTERS` in `src/adapters/index.js`.
- **Better generic detection**: tune `scoreGroup` in `detector.js` and add a fixture to `test/`.
- **Output format**: change `buildSnippet` / `buildDocument` in `extract.js`.

## Tests

```
npm install
npm test
```

## Ideas / roadmap

- Click-to-pick an element manually when detection is wrong
- Remember the chosen selector per site
- Export structured JSON (title, price, link, image) alongside the HTML
- Handle infinite scroll / "load more"
- Icons and Chrome Web Store packaging

## Notes

Only use this on pages and sites whose terms permit saving their content.

## License

MIT
