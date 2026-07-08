const LANG_NAMES = {
  pl: 'polski',
  en: 'angielski (British English, uniwersalny)',
  gb: 'angielski (British English, wersja dla rynku UK)',
  us: 'angielski (American English, wersja dla rynku USA)',
  de: 'niemiecki',
  es: 'hiszpański',
  fr: 'francuski',
  it: 'włoski',
  nl: 'niderlandzki',
};

const TONE_INSTRUCTIONS = {
  marketing: 'Piszesz atrakcyjny, płynny opis marketingowy dla producenta mebli biurowych MDD. Zachowaj profesjonalny, zapraszający ton.',
  neutral: 'Piszesz w neutralnym, formalnym stylu.',
  seo: 'Piszesz zwięzły, zoptymalizowany pod SEO tekst z naturalnie użytymi słowami kluczowymi.',
  technical: 'Piszesz w stylu technicznym, precyzyjnie, bez zbędnych ozdobników.',
};

function langLabel(code) {
  return LANG_NAMES[code] || code;
}

function buildSystemPrompt({ sourceLang, targetLang, tone, brief, preserveHtml, fieldKey }) {
  const parts = [
    `Jesteś profesjonalnym tłumaczem i copywriterem specjalizującym się w branży mebli biurowych i wyposażenia biur (marka MDD).`,
    `Tłumaczysz z języka ${langLabel(sourceLang)} na ${langLabel(targetLang)}.`,
    TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.neutral,
    `Nazwy własne, marki (MDD, nazwy modeli mebli takie jak Coda, Astro, Sail, Ogi itp.) pozostaw bez zmian.`,
    `Zachowaj sens, intencję marketingową i strukturę tekstu.`,
    `Nie dodawaj komentarzy, wstępów, "Oto tłumaczenie:", cudzysłowów wokół całości.`,
    `Zwróć wyłącznie przetłumaczony tekst.`,
  ];
  if (preserveHtml) {
    parts.push(`Wejście może zawierać HTML (np. <p>, <ul>, <li>, <strong>, <br>, <h2>). Zachowaj DOKŁADNIE tę samą strukturę tagów, atrybuty, klasy i kolejność. Tłumacz wyłącznie treść tekstową w węzłach tekstowych i wartości atrybutów alt/title.`);
  }
  if (fieldKey === 'seo_title') {
    parts.push('To pole SEO title. Zwróć zwięzły tytuł (do ~60 znaków), bez kropki na końcu.');
  } else if (fieldKey === 'seo_description') {
    parts.push('To pole SEO description. Zwróć opis do ~155 znaków, zwięzły i chwytliwy.');
  } else if (fieldKey === 'url') {
    parts.push('To slug URL. Zwróć wyłącznie ścieżkę zaczynającą się od "/", małymi literami, bez znaków diakrytycznych, wyrazy oddzielone myślnikami. Nie tłumacz slugu jeśli nie masz pewności — zwróć oryginał.');
  } else if (fieldKey === 'name') {
    parts.push('To krótka nazwa kategorii. Zwróć krótką, naturalną nazwę.');
  }
  if (brief && brief.trim()) {
    parts.push(`Dodatkowe wytyczne użytkownika: ${brief.trim()}`);
  }
  return parts.join('\n');
}

async function callOpenAI({ apiKey, model, system, user }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data && data.error && data.error.message) || `HTTP ${res.status}`;
    throw new Error(err);
  }
  const text = data?.choices?.[0]?.message?.content ?? '';
  return text.trim();
}

async function handleTranslate(msg) {
  const cfg = await chrome.storage.local.get([
    'apiKey', 'model', 'sourceLang', 'tone', 'brief', 'preserveHtml'
  ]);
  const apiKey = cfg.apiKey;
  if (!apiKey) throw new Error('Brak klucza API. Otwórz popup wtyczki i zapisz klucz.');
  const model = cfg.model || 'gpt-4o-mini';
  const sourceLang = msg.sourceLang || cfg.sourceLang || 'pl';
  const preserveHtml = cfg.preserveHtml !== false;

  const system = buildSystemPrompt({
    sourceLang,
    targetLang: msg.targetLang,
    tone: cfg.tone || 'marketing',
    brief: cfg.brief || '',
    preserveHtml,
    fieldKey: msg.fieldKey,
  });

  const userMsg = `Tekst do przetłumaczenia (${langLabel(sourceLang)} → ${langLabel(msg.targetLang)}, pole: ${msg.fieldKey}):\n\n${msg.text}`;

  const translated = await callOpenAI({ apiKey, model, system, user: userMsg });
  return { ok: true, text: translated };
}

async function handleTestKey(msg) {
  try {
    const text = await callOpenAI({
      apiKey: msg.apiKey,
      model: msg.model || 'gpt-4o-mini',
      system: 'Odpowiadasz jednym słowem.',
      user: 'Powiedz "ok".',
    });
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'MDD_AI_TRANSLATE') {
        sendResponse(await handleTranslate(msg));
      } else if (msg.type === 'MDD_AI_TEST') {
        sendResponse(await handleTestKey(msg));
      } else {
        sendResponse({ ok: false, error: 'unknown message type' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true;
});
