/*
 * Site adapters: exact selectors for sites where the generic heuristic is not
 * good enough. An adapter is tried first; if its selector matches nothing the
 * generic detector runs instead.
 *
 * To add a site:
 *   { id: 'example', hosts: ['example.com'], itemSelector: 'li.result' }
 * `hosts` match the hostname or any of its parent domains.
 * `containerSelector` is optional (defaults to the items' common parent).
 */
(function (root) {
  'use strict';

  const LE = (root.ListingExtractor = root.ListingExtractor || {});

  const ADAPTERS = [
    // Starting point only: verify against the live site and adjust.
    { id: 'idealista', hosts: ['idealista.com', 'idealista.pt', 'idealista.it'], itemSelector: 'article.item' },
    // Class names are hashed; componentkey is stable. It is repeated on a nested div, which runAdapter drops.
    { id: 'linkedin-jobs', hosts: ['linkedin.com'], itemSelector: '[componentkey^="job-card-component-ref-"]' },
  ];

  function hostMatches(hostname, host) {
    return hostname === host || hostname.endsWith('.' + host);
  }

  function findAdapter(url) {
    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch (e) {
      return null;
    }
    return ADAPTERS.find((a) => a.hosts.some((h) => hostMatches(hostname, h))) || null;
  }

  function commonAncestor(items) {
    let node = items[0].parentElement;
    while (node && !items.every((el) => node.contains(el))) node = node.parentElement;
    return node || items[0].parentElement;
  }

  /** @returns candidate in the same shape as findCandidates, or null */
  function runAdapter(adapter, doc) {
    const matches = Array.from(doc.querySelectorAll(adapter.itemSelector));
    // Keep only outermost matches so a selector that also hits a card's inner element doesn't double-count.
    const items = matches.filter((el) => !matches.some((other) => other !== el && other.contains(el)));
    if (!items.length) return null;
    const container = adapter.containerSelector
      ? doc.querySelector(adapter.containerSelector) || commonAncestor(items)
      : commonAncestor(items);
    return {
      container,
      items,
      score: Infinity,
      signature: 'adapter:' + adapter.id,
      sample: (items[0].textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    };
  }

  LE.adapters = ADAPTERS;
  LE.findAdapter = findAdapter;
  LE.runAdapter = runAdapter;

  if (typeof module !== 'undefined' && module.exports) module.exports = LE;
})(typeof globalThis !== 'undefined' ? globalThis : this);
