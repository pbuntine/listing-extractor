const test = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

function load(html, url = 'https://example.com/search') {
  const dom = new JSDOM(html, { url });
  // The modules attach to globalThis; give them this window's globals.
  const LE = {};
  global.ListingExtractor = LE;
  for (const f of ['detector', 'extract']) {
    delete require.cache[require.resolve(`../src/content/${f}.js`)];
    require(`../src/content/${f}.js`);
  }
  delete require.cache[require.resolve('../src/adapters/index.js')];
  require('../src/adapters/index.js');
  return { doc: dom.window.document, LE: global.ListingExtractor };
}

const card = (i) => `
  <li class="result-card ${i === 1 ? 'active' : ''}">
    <a href="/property/${i}"><img data-src="/img/${i}.jpg" alt=""></a>
    <h3><a href="/property/${i}">Flat number ${i} in the city centre</a></h3>
    <p class="price">€${100 + i},000</p>
    <p>3 rooms · 90 m² · Lorem ipsum dolor sit amet</p>
  </li>`;

const PAGE = `<!doctype html><html><head><title>Search</title></head><body>
  <nav><ul>${['Home', 'Buy', 'Rent', 'Sell', 'Help'].map((t) => `<li><a href="/${t}">${t}</a></li>`).join('')}</ul></nav>
  <main><ul id="results">${[1, 2, 3, 4, 5, 6].map(card).join('')}</ul></main>
  <footer><ul>${['About', 'Terms', 'Privacy', 'Jobs'].map((t) => `<li><a href="/${t}">${t}</a></li>`).join('')}</ul></footer>
</body></html>`;

test('picks the listing group over nav and footer lists', () => {
  const { doc, LE } = load(PAGE);
  const [best] = LE.findCandidates(doc);
  assert.ok(best, 'a candidate is found');
  assert.strictEqual(best.container.id, 'results');
  assert.strictEqual(best.items.length, 6);
});

test('ignores state classes when grouping siblings', () => {
  const { doc, LE } = load(PAGE);
  const [best] = LE.findCandidates(doc);
  assert.ok(best.items[0].classList.contains('active'));
  assert.strictEqual(best.items.length, 6);
});

test('returns nothing for a page without repeated structure', () => {
  const { doc, LE } = load('<body><p>Hello</p><div>One</div><section>Two</section></body>');
  assert.deepStrictEqual(LE.findCandidates(doc), []);
});

test('snippet is cleaned: absolute urls, lazy images, no scripts or handlers', () => {
  const html = PAGE.replace('<p class="price">', '<script>alert(1)</script><p onclick="x()" class="price">');
  const { doc, LE } = load(html);
  const [best] = LE.findCandidates(doc);
  const snippet = LE.buildSnippet(best, { url: 'https://example.com/search', title: 'Search', selector: 'ul#results' });
  assert.strictEqual(snippet.count, 6);
  assert.ok(snippet.html.includes('href="https://example.com/property/1"'));
  assert.ok(snippet.html.includes('src="https://example.com/img/1.jpg"'));
  assert.ok(!snippet.html.includes('<script'));
  assert.ok(!snippet.html.includes('onclick'));
});

test('site adapter is matched by host and parent domains', () => {
  const { doc, LE } = load('<body><article class="item">a</article><article class="item">b</article></body>');
  const adapter = LE.findAdapter('https://www.idealista.com/venta-viviendas/valencia/');
  assert.strictEqual(adapter.id, 'idealista');
  assert.strictEqual(LE.findAdapter('https://notidealista.com/'), null);
  assert.strictEqual(LE.runAdapter(adapter, doc).items.length, 2);
});
