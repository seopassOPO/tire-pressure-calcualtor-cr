(() => {
  'use strict';

  const LANG_LABELS = {
    pl: 'PL 🇵🇱',
    en: 'EN 🇬🇧',
    gb: 'GB 🇬🇧',
    us: 'US 🇺🇸',
    de: 'DE 🇩🇪',
    es: 'ES 🇪🇸',
    fr: 'FR 🇫🇷',
    it: 'IT 🇮🇹',
    nl: 'NL 🇳🇱',
  };

  const TRANSLATABLE_FIELDS = [
    'name',
    'description_top',
    'description_bottom',
    'seo_title',
    'seo_description',
  ];

  const state = {
    sourceLang: 'pl',
    skipFilled: true,
    running: false,
    cancel: false,
    settingsLoaded: false,
  };

  function log(...args) {
    console.log('[MDD AI Translator]', ...args);
  }

  function debounce(fn, wait = 400) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function findAllLanguages() {
    const langs = new Set();
    document.querySelectorAll('[name^="fields["]').forEach((el) => {
      const m = el.getAttribute('name').match(/^fields\[([a-z]{2,3})\]\[[a-z_]+\]$/i);
      if (m) langs.add(m[1].toLowerCase());
    });
    return Array.from(langs);
  }

  function getFieldElement(lang, key) {
    return document.querySelector(
      `[name="fields[${lang}][${key}]"]`
    );
  }

  function readFieldValue(lang, key) {
    const el = getFieldElement(lang, key);
    if (!el) return null;
    // For hidden/text inputs and textareas, .value is fine.
    // For TinyMCE textareas, prefer the live editor content if available.
    if (el.tagName === 'TEXTAREA' && window.tinymce) {
      try {
        const ed = window.tinymce.get(el.id);
        if (ed) return ed.getContent();
      } catch (_) { /* ignore */ }
    }
    return el.value || '';
  }

  function fireInputEvents(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    // Livewire hook
    el.dispatchEvent(new Event('livewire:load', { bubbles: true }));
  }

  function writeFieldValue(lang, key, value) {
    const el = getFieldElement(lang, key);
    if (!el) return false;
    if (el.tagName === 'TEXTAREA' && window.tinymce) {
      try {
        const ed = window.tinymce.get(el.id);
        if (ed) {
          ed.setContent(value);
          ed.save();
          fireInputEvents(el);
          return true;
        }
      } catch (_) { /* ignore */ }
    }
    el.value = value;
    fireInputEvents(el);
    return true;
  }

  function isFilled(v) {
    if (v == null) return false;
    const stripped = String(v).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    return stripped.length > 0;
  }

  async function loadSettings() {
    const cfg = await chrome.storage.local.get(['sourceLang', 'skipFilled', 'apiKey']);
    state.sourceLang = cfg.sourceLang || 'pl';
    state.skipFilled = cfg.skipFilled !== false;
    state.hasApiKey = !!cfg.apiKey;
    state.settingsLoaded = true;
  }

  async function translateOne(text, targetLang, fieldKey) {
    const res = await chrome.runtime.sendMessage({
      type: 'MDD_AI_TRANSLATE',
      text,
      sourceLang: state.sourceLang,
      targetLang,
      fieldKey,
    });
    if (!res || !res.ok) throw new Error(res && res.error ? res.error : 'unknown error');
    return res.text;
  }

  function setStatus(text, cls) {
    const el = document.getElementById('mdd-ai-status');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'mdd-ai-status' + (cls ? ' ' + cls : '');
  }

  function setProgress(done, total) {
    const bar = document.getElementById('mdd-ai-progress-bar');
    const label = document.getElementById('mdd-ai-progress-label');
    if (!bar || !label) return;
    if (total <= 0) {
      bar.style.width = '0%';
      label.textContent = '';
      return;
    }
    const pct = Math.round((done / total) * 100);
    bar.style.width = pct + '%';
    label.textContent = `${done}/${total}`;
  }

  async function translateAll({ onlySelected } = {}) {
    if (state.running) return;
    await loadSettings();
    if (!state.hasApiKey) {
      setStatus('Brak klucza API. Otwórz ikonę wtyczki i wpisz klucz.', 'error');
      return;
    }

    const langs = findAllLanguages().filter((l) => l !== state.sourceLang);
    const selectedLangs = onlySelected
      ? Array.from(document.querySelectorAll('.mdd-ai-lang-checkbox:checked')).map((c) => c.value)
      : langs;

    if (selectedLangs.length === 0) {
      setStatus('Nie wybrano żadnego języka docelowego.', 'error');
      return;
    }

    const tasks = [];
    for (const key of TRANSLATABLE_FIELDS) {
      const sourceVal = readFieldValue(state.sourceLang, key);
      if (!isFilled(sourceVal)) continue;
      for (const lang of selectedLangs) {
        const targetEl = getFieldElement(lang, key);
        if (!targetEl) continue;
        const currentVal = readFieldValue(lang, key);
        if (state.skipFilled && isFilled(currentVal)) continue;
        tasks.push({ key, lang, sourceVal });
      }
    }

    if (tasks.length === 0) {
      setStatus('Nic do przetłumaczenia (pola już wypełnione lub brak treści źródłowej).', 'info');
      return;
    }

    state.running = true;
    state.cancel = false;
    setStatus(`Tłumaczę ${tasks.length} pól…`, 'info');
    setProgress(0, tasks.length);
    document.getElementById('mdd-ai-run').disabled = true;
    document.getElementById('mdd-ai-cancel').disabled = false;

    let done = 0;
    let errors = 0;
    for (const t of tasks) {
      if (state.cancel) break;
      try {
        highlightField(t.lang, t.key, 'busy');
        const translated = await translateOne(t.sourceVal, t.lang, t.key);
        writeFieldValue(t.lang, t.key, translated);
        highlightField(t.lang, t.key, 'ok');
      } catch (e) {
        errors++;
        log('Error', t, e);
        highlightField(t.lang, t.key, 'error');
        setStatus(`Błąd (${t.lang}/${t.key}): ${e.message}`, 'error');
      }
      done++;
      setProgress(done, tasks.length);
    }

    state.running = false;
    document.getElementById('mdd-ai-run').disabled = false;
    document.getElementById('mdd-ai-cancel').disabled = true;
    if (state.cancel) setStatus(`Przerwano po ${done}/${tasks.length}.`, 'info');
    else if (errors) setStatus(`Gotowe: ${done}/${tasks.length}, błędów: ${errors}.`, 'error');
    else setStatus(`Gotowe: przetłumaczono ${done} pól.`, 'success');
  }

  function highlightField(lang, key, cls) {
    const el = getFieldElement(lang, key);
    if (!el) return;
    const target = el.closest('.form-group, .input-container, .form-field') || el;
    target.classList.remove('mdd-ai-hl-busy', 'mdd-ai-hl-ok', 'mdd-ai-hl-error');
    if (cls === 'busy') target.classList.add('mdd-ai-hl-busy');
    else if (cls === 'ok') target.classList.add('mdd-ai-hl-ok');
    else if (cls === 'error') target.classList.add('mdd-ai-hl-error');
    if (cls === 'ok') {
      setTimeout(() => target.classList.remove('mdd-ai-hl-ok'), 4000);
    }
  }

  function buildPanel() {
    if (document.getElementById('mdd-ai-panel')) return;
    const langs = findAllLanguages();
    if (langs.length === 0) return; // not the right page

    const panel = document.createElement('div');
    panel.id = 'mdd-ai-panel';
    panel.innerHTML = `
      <div class="mdd-ai-header">
        <span class="mdd-ai-title">🤖 MDD AI Translator</span>
        <button class="mdd-ai-toggle" title="Zwiń / rozwiń">−</button>
      </div>
      <div class="mdd-ai-body">
        <div class="mdd-ai-row">
          <span class="mdd-ai-label">Źródło:</span>
          <select id="mdd-ai-source"></select>
        </div>
        <div class="mdd-ai-row mdd-ai-col">
          <span class="mdd-ai-label">Języki docelowe:</span>
          <div id="mdd-ai-langs" class="mdd-ai-langs"></div>
        </div>
        <div class="mdd-ai-actions">
          <button id="mdd-ai-run" class="mdd-ai-btn mdd-ai-primary">Tłumacz zaznaczone</button>
          <button id="mdd-ai-cancel" class="mdd-ai-btn mdd-ai-secondary" disabled>Przerwij</button>
        </div>
        <div class="mdd-ai-progress">
          <div class="mdd-ai-progress-track"><div id="mdd-ai-progress-bar"></div></div>
          <span id="mdd-ai-progress-label"></span>
        </div>
        <p id="mdd-ai-status" class="mdd-ai-status"></p>
        <p class="mdd-ai-hint">Tłumaczy pola: nazwa, opis górny/dolny, SEO tytuł, SEO opis. Otwórz ikonę wtyczki, aby ustawić klucz API i styl.</p>
      </div>
    `;
    document.body.appendChild(panel);

    // Populate source select
    const src = panel.querySelector('#mdd-ai-source');
    langs.forEach((l) => {
      const opt = document.createElement('option');
      opt.value = l;
      opt.textContent = LANG_LABELS[l] || l.toUpperCase();
      if (l === state.sourceLang) opt.selected = true;
      src.appendChild(opt);
    });
    src.addEventListener('change', async () => {
      state.sourceLang = src.value;
      await chrome.storage.local.set({ sourceLang: state.sourceLang });
      rebuildLangCheckboxes();
    });

    // Language checkboxes
    rebuildLangCheckboxes();

    panel.querySelector('.mdd-ai-toggle').addEventListener('click', () => {
      panel.classList.toggle('mdd-ai-collapsed');
      const t = panel.querySelector('.mdd-ai-toggle');
      t.textContent = panel.classList.contains('mdd-ai-collapsed') ? '+' : '−';
    });
    panel.querySelector('#mdd-ai-run').addEventListener('click', () => translateAll({ onlySelected: true }));
    panel.querySelector('#mdd-ai-cancel').addEventListener('click', () => {
      state.cancel = true;
    });
  }

  function rebuildLangCheckboxes() {
    const box = document.getElementById('mdd-ai-langs');
    if (!box) return;
    box.innerHTML = '';
    const langs = findAllLanguages().filter((l) => l !== state.sourceLang);
    langs.forEach((l) => {
      const id = 'mdd-ai-lang-' + l;
      const wrap = document.createElement('label');
      wrap.className = 'mdd-ai-lang';
      wrap.innerHTML = `<input type="checkbox" class="mdd-ai-lang-checkbox" value="${l}" id="${id}" checked><span>${LANG_LABELS[l] || l.toUpperCase()}</span>`;
      box.appendChild(wrap);
    });
  }

  function shouldShowPanel() {
    // Only show when form contains fields[<lang>][...] inputs
    return findAllLanguages().length > 0;
  }

  const rebuild = debounce(() => {
    if (shouldShowPanel()) buildPanel();
  }, 300);

  async function init() {
    await loadSettings();
    if (shouldShowPanel()) buildPanel();
    // Observe DOM changes because Livewire re-renders portions of the page.
    const mo = new MutationObserver(() => {
      if (!document.getElementById('mdd-ai-panel')) rebuild();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
