/*
 * Turns detected listing elements into a clean, self-contained HTML snippet:
 * scripts/handlers removed, lazy-loaded images resolved, URLs made absolute.
 */
(function (root) {
  'use strict';

  const LE = (root.ListingExtractor = root.ListingExtractor || {});

  const REMOVE_SELECTOR = 'script, style, noscript, iframe, template, link, meta';
  const URL_ATTRS = ['href', 'src', 'poster'];
  const LAZY_SRC_ATTRS = ['data-src', 'data-original', 'data-lazy-src'];
  const LAZY_SRCSET_ATTRS = ['data-srcset', 'data-lazy-srcset'];
  const HIGHLIGHT_CLASS = '__le-highlight';

  function absolutize(value, base) {
    try {
      return new URL(value, base).href;
    } catch (e) {
      return value;
    }
  }

  function absolutizeSrcset(value, base) {
    return value
      .split(',')
      .map((part) => {
        const [url, ...rest] = part.trim().split(/\s+/);
        return [absolutize(url, base), ...rest].join(' ');
      })
      .join(', ');
  }

  function cleanElement(el, base) {
    el.querySelectorAll(REMOVE_SELECTOR).forEach((n) => n.remove());

    const all = [el, ...el.querySelectorAll('*')];
    for (const node of all) {
      for (const attr of Array.from(node.attributes)) {
        if (/^on/i.test(attr.name) || /^javascript:/i.test(attr.value.trim())) node.removeAttribute(attr.name);
      }
      if (node.classList.contains(HIGHLIGHT_CLASS)) {
        node.classList.remove(HIGHLIGHT_CLASS);
        if (!node.classList.length) node.removeAttribute('class');
      }

      if (node.tagName === 'IMG' || node.tagName === 'SOURCE') {
        const src = node.getAttribute('src');
        if (!src || src.startsWith('data:')) {
          for (const a of LAZY_SRC_ATTRS) {
            if (node.hasAttribute(a)) {
              node.setAttribute('src', node.getAttribute(a));
              break;
            }
          }
        }
        for (const a of LAZY_SRCSET_ATTRS) {
          if (node.hasAttribute(a) && !node.hasAttribute('srcset')) node.setAttribute('srcset', node.getAttribute(a));
        }
        node.removeAttribute('loading');
      }

      for (const a of URL_ATTRS) {
        if (node.hasAttribute(a)) node.setAttribute(a, absolutize(node.getAttribute(a), base));
      }
      if (node.hasAttribute('srcset')) node.setAttribute('srcset', absolutizeSrcset(node.getAttribute('srcset'), base));
    }
    return el;
  }

  function cleanedHtml(item, base) {
    return cleanElement(item.cloneNode(true), base).outerHTML;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /**
   * @param {object} candidate  {container, items, signature}
   * @param {object} meta       {url, title, selector}
   * @returns {{html: string, count: number}}
   */
  function buildSnippet(candidate, meta) {
    const base = meta.url;
    const header =
      `<!-- Listing Extractor\n` +
      `     source:   ${meta.url.replace(/--/g, '- -')}\n` +
      `     title:    ${String(meta.title).replace(/--/g, '- -')}\n` +
      `     saved:    ${new Date().toISOString()}\n` +
      `     detector: ${candidate.signature}\n` +
      `     selector: ${String(meta.selector).replace(/--/g, '- -')}\n` +
      `     items:    ${candidate.items.length}\n-->\n`;
    const body = candidate.items
      .map((item, i) => `<!-- listing ${i + 1} -->\n${cleanedHtml(item, base)}`)
      .join('\n\n');
    return { html: header + body + '\n', count: candidate.items.length };
  }

  /** Full standalone page (so the saved file opens nicely in a browser). */
  function buildDocument(snippet, meta) {
    return (
      `<!doctype html>\n<html><head><meta charset="utf-8">\n` +
      `<title>${escapeHtml(meta.title)} — listings</title>\n` +
      `<base href="${escapeHtml(meta.url)}">\n</head>\n<body>\n${snippet.html}</body></html>\n`
    );
  }

  LE.cleanedHtml = cleanedHtml;
  LE.buildSnippet = buildSnippet;
  LE.buildDocument = buildDocument;
  LE.HIGHLIGHT_CLASS = HIGHLIGHT_CLASS;

  if (typeof module !== 'undefined' && module.exports) module.exports = LE;
})(typeof globalThis !== 'undefined' ? globalThis : this);
