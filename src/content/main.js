/*
 * Content-script entry point. Injected on demand by the popup (activeTab +
 * scripting), so it never runs on pages the user did not ask about.
 * Messages: scan | highlight | extract | clear
 */
(function (root) {
  'use strict';

  const LE = root.ListingExtractor;
  if (LE.__listening) return;
  LE.__listening = true;

  let candidates = [];

  function clearHighlight() {
    document.querySelectorAll('.' + LE.HIGHLIGHT_CLASS).forEach((el) => {
      el.classList.remove(LE.HIGHLIGHT_CLASS);
      if (!el.classList.length) el.removeAttribute('class');
    });
    const style = document.getElementById('__le-style');
    if (style) style.remove();
  }

  function highlight(index) {
    clearHighlight();
    const c = candidates[index];
    if (!c) return;
    const style = document.createElement('style');
    style.id = '__le-style';
    style.textContent = `.${LE.HIGHLIGHT_CLASS}{outline:2px solid #e8590c !important;outline-offset:-2px;background-color:rgba(232,89,12,.08) !important}`;
    document.head.appendChild(style);
    c.items.forEach((el) => el.classList.add(LE.HIGHLIGHT_CLASS));
    c.items[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function scan() {
    candidates = [];
    const adapter = LE.findAdapter(location.href);
    const fromAdapter = adapter && LE.runAdapter(adapter, document);
    if (fromAdapter) candidates.push(fromAdapter);
    for (const c of LE.findCandidates(document)) {
      // Skip generic candidates that just repeat the adapter's result.
      if (fromAdapter && c.items[0] === fromAdapter.items[0]) continue;
      candidates.push(c);
    }
    return candidates.map((c, id) => ({
      id,
      count: c.items.length,
      signature: c.signature,
      sample: c.sample,
      selector: LE.cssPath(c.container),
    }));
  }

  function extract(index) {
    const c = candidates[index];
    if (!c) return { ok: false, error: 'No such candidate; rescan the page.' };
    const meta = { url: location.href, title: document.title, selector: LE.cssPath(c.container) };
    const snippet = LE.buildSnippet(c, meta);
    return { ok: true, count: snippet.count, snippet: snippet.html, document: LE.buildDocument(snippet, meta) };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      switch (msg && msg.type) {
        case 'scan': {
          const list = scan();
          sendResponse({ ok: true, url: location.href, title: document.title, candidates: list });
          if (list.length) highlight(0);
          break;
        }
        case 'highlight':
          highlight(msg.id);
          sendResponse({ ok: true });
          break;
        case 'extract':
          sendResponse(extract(msg.id));
          break;
        case 'clear':
          clearHighlight();
          sendResponse({ ok: true });
          break;
        default:
          sendResponse({ ok: false, error: 'Unknown message' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
    return false;
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
