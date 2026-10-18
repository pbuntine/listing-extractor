/*
 * Generic listing detector.
 *
 * Idea: a page of listings is a parent element whose children repeat the same
 * structure (same tag + same classes), and each child looks like a "card":
 * some text, a link, often an image and a price. We find every such group,
 * score it, and return the groups ranked best-first.
 *
 * Pure DOM code: no chrome.* APIs, so it can be unit tested under jsdom.
 */
(function (root) {
  'use strict';

  const LE = (root.ListingExtractor = root.ListingExtractor || {});

  const IGNORED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META', 'BR', 'HR']);
  const CHROME_SELECTOR =
    'nav, header, footer, aside, [role=navigation], [role=banner], [role=contentinfo], [role=menu]';
  // Classes that describe state, not structure, and differ between siblings.
  const STATE_CLASS = /^(active|selected|current|open|show|hover|focus|first|last|odd|even|is-|has-|js-)/i;
  const PRICE_RE = /(?:[$€£]\s?\d|\d[\d.,\s]*\s?(?:€|\$|£|EUR|USD|GBP|AUD)(?![A-Za-z]))/;

  const DEFAULTS = { minItems: 3, maxCandidates: 5 };

  function signature(el, tagOnly) {
    const tag = el.tagName.toLowerCase();
    if (tagOnly) return tag;
    const classes = Array.from(el.classList)
      .filter((c) => !STATE_CLASS.test(c) && !/\d{3,}/.test(c))
      .sort();
    return tag + '.' + classes.join('.');
  }

  function elementChildren(el) {
    return Array.from(el.children).filter((c) => !IGNORED_TAGS.has(c.tagName));
  }

  function textLength(el) {
    return (el.textContent || '').replace(/\s+/g, ' ').trim().length;
  }

  function hasLayout(doc) {
    const rect = doc.documentElement.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isRendered(el) {
    const win = el.ownerDocument.defaultView;
    if (!win) return true;
    const style = win.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return el.getClientRects().length > 0;
  }

  function mean(nums) {
    return nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
  }

  function scoreGroup(container, items) {
    const lengths = items.map((i) => Math.min(textLength(i), 800));
    const avgText = mean(lengths);
    if (avgText < 15) return 0;

    const linkFrac = mean(items.map((i) => (i.matches('a') || i.querySelector('a[href]') ? 1 : 0)));
    const imgFrac = mean(items.map((i) => (i.querySelector('img, picture, [style*="background-image"]') ? 1 : 0)));
    const priceFrac = mean(items.map((i) => (PRICE_RE.test(i.textContent || '') ? 1 : 0)));

    let score =
      Math.log2(items.length + 1) * Math.sqrt(avgText) * (1 + 1.5 * linkFrac + imgFrac + 2 * priceFrac);
    if (linkFrac < 0.5) score *= 0.3;
    if (container.closest(CHROME_SELECTOR)) score *= 0.2;
    return score;
  }

  function describe(el) {
    const sample = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    return sample;
  }

  /**
   * @returns {Array<{container: Element, items: Element[], score: number,
   *   signature: string, sample: string}>} ranked best-first
   */
  function findCandidates(doc, options) {
    const opts = Object.assign({}, DEFAULTS, options);
    const layout = hasLayout(doc);
    const seen = new Set();
    const candidates = [];

    for (const container of doc.body.querySelectorAll('*')) {
      if (IGNORED_TAGS.has(container.tagName)) continue;
      const children = elementChildren(container);
      if (children.length < opts.minItems) continue;

      for (const tagOnly of [false, true]) {
        const groups = new Map();
        for (const child of children) {
          const sig = signature(child, tagOnly);
          if (!groups.has(sig)) groups.set(sig, []);
          groups.get(sig).push(child);
        }
        for (const [sig, group] of groups) {
          const items = layout ? group.filter(isRendered) : group;
          if (items.length < opts.minItems) continue;
          // The same item set can be found by class signature and by tag only.
          const key = items.length + '|' + cssPath(container) + '|' + cssPath(items[0]) + '|' + cssPath(items[items.length - 1]);
          if (seen.has(key)) continue;
          seen.add(key);
          const score = scoreGroup(container, items);
          if (score > 0) {
            candidates.push({ container, items, score, signature: sig, sample: describe(items[0]) });
          }
        }
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, opts.maxCandidates);
  }

  /** Short, human-readable CSS path (not guaranteed unique). */
  function cssPath(el) {
    const parts = [];
    for (let node = el; node && node.nodeType === 1 && node.tagName !== 'HTML'; node = node.parentElement) {
      let part = node.tagName.toLowerCase();
      if (node.id && /^[A-Za-z][\w-]*$/.test(node.id)) {
        parts.unshift(part + '#' + node.id);
        break;
      }
      const cls = Array.from(node.classList).filter((c) => /^[A-Za-z_][\w-]*$/.test(c)).slice(0, 2);
      if (cls.length) part += '.' + cls.join('.');
      parts.unshift(part);
    }
    return parts.join(' > ');
  }

  LE.findCandidates = findCandidates;
  LE.cssPath = cssPath;

  if (typeof module !== 'undefined' && module.exports) module.exports = LE;
})(typeof globalThis !== 'undefined' ? globalThis : this);
