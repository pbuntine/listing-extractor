const CONTENT_FILES = [
  'src/content/detector.js',
  'src/adapters/index.js',
  'src/content/extract.js',
  'src/content/main.js',
];

const $ = (id) => document.getElementById(id);
let tab;
let selected = 0;

function setStatus(text, isError) {
  $('status').textContent = text;
  $('status').classList.toggle('error', !!isError);
}

function send(msg) {
  return chrome.tabs.sendMessage(tab.id, msg);
}

function filenameFor(url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `listings-${host}-${stamp}.html`;
}

function render(candidates) {
  const list = $('candidates');
  list.textContent = '';
  candidates.forEach((c) => {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'candidate';
    radio.checked = c.id === selected;
    radio.addEventListener('change', () => {
      selected = c.id;
      send({ type: 'highlight', id: c.id });
    });
    const text = document.createElement('div');
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = `${c.count} items`;
    const sig = document.createElement('span');
    sig.textContent = ` · ${c.signature}`;
    const sample = document.createElement('div');
    sample.className = 'sample';
    sample.textContent = c.sample;
    text.append(count, sig, sample);
    label.append(radio, text);
    li.append(label);
    list.append(li);
  });
}

async function scan() {
  setStatus('Scanning page…');
  $('save').disabled = $('copy').disabled = true;
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_FILES });
    const res = await send({ type: 'scan' });
    if (!res.ok) throw new Error(res.error);
    if (!res.candidates.length) {
      render([]);
      setStatus('No listings found on this page.', true);
      return;
    }
    selected = 0;
    render(res.candidates);
    setStatus('Highlighted on the page. Pick the best match, then save.');
    $('save').disabled = $('copy').disabled = false;
  } catch (e) {
    render([]);
    setStatus(`Can't read this page: ${e.message}`, true);
  }
}

async function extract() {
  const res = await send({ type: 'extract', id: selected });
  if (!res.ok) throw new Error(res.error);
  return res;
}

$('save').addEventListener('click', async () => {
  try {
    const res = await extract();
    const url = URL.createObjectURL(new Blob([res.document], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filenameFor(tab.url);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`Saved ${res.count} listings.`);
  } catch (e) {
    setStatus(e.message, true);
  }
});

$('copy').addEventListener('click', async () => {
  try {
    const res = await extract();
    await navigator.clipboard.writeText(res.snippet);
    setStatus(`Copied ${res.count} listings to the clipboard.`);
  } catch (e) {
    setStatus(e.message, true);
  }
});

$('rescan').addEventListener('click', scan);
window.addEventListener('pagehide', () => tab && chrome.tabs.sendMessage(tab.id, { type: 'clear' }).catch(() => {}));

scan();
