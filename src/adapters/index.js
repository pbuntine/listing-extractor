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

  /** @returns candidate in the same shape as findCandidates, or null */
  function runAdapter(adapter, doc) {
    const items = Array.from(doc.querySelectorAll(adapter.itemSelector));
    if (!items.length) return null;
    const container = adapter.containerSelector
      ? doc.querySelector(adapter.containerSelector) || items[0].parentElement
      : items[0].parentElement;
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
