const FIELDS = ['apiKey', 'model', 'sourceLang', 'tone', 'brief', 'preserveHtml', 'skipFilled'];
const DEFAULTS = {
  apiKey: '',
  model: 'gpt-4o-mini',
  sourceLang: 'pl',
  tone: 'marketing',
  brief: '',
  preserveHtml: true,
  skipFilled: true,
};

function setStatus(text, cls = 'info') {
  const el = document.getElementById('status');
  el.textContent = text;
  el.className = 'status ' + cls;
}

async function load() {
  const stored = await chrome.storage.local.get(FIELDS);
  const cfg = { ...DEFAULTS, ...stored };
  for (const key of FIELDS) {
    const el = document.getElementById(key);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!cfg[key];
    else el.value = cfg[key] ?? '';
  }
}

async function save() {
  const cfg = {};
  for (const key of FIELDS) {
    const el = document.getElementById(key);
    if (!el) continue;
    cfg[key] = el.type === 'checkbox' ? el.checked : el.value.trim();
  }
  await chrome.storage.local.set(cfg);
  setStatus('Ustawienia zapisane.', 'success');
}

async function testKey() {
  const key = document.getElementById('apiKey').value.trim();
  const model = document.getElementById('model').value;
  if (!key) {
    setStatus('Wpisz klucz API.', 'error');
    return;
  }
  setStatus('Testuję klucz…', 'info');
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'MDD_AI_TEST',
      apiKey: key,
      model,
    });
    if (res && res.ok) setStatus('Klucz działa. Model dostępny.', 'success');
    else setStatus('Błąd: ' + (res && res.error ? res.error : 'nieznany'), 'error');
  } catch (e) {
    setStatus('Błąd: ' + e.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  document.getElementById('save').addEventListener('click', save);
  document.getElementById('test').addEventListener('click', testKey);
});
