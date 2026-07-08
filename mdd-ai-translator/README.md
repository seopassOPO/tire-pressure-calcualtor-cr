# MDD AI Translator — wtyczka Chrome

Wtyczka dodaje do panelu MDD (`*.mdd.pl/dashboard*`, `devconfigurator.mdd.pl`) inteligentne tłumaczenie treści kategorii przy użyciu klucza API **OpenAI** (GPT-4o / GPT-4.1). Zastępuje słabe tłumaczenie maszynowe wysokiej jakości tłumaczeniem AI, świadomym kontekstu i branży (meble biurowe MDD).

## Co robi

- Wykrywa formularz edycji kategorii i pola pogrupowane po języku (`fields[pl][name]`, `fields[en][description_top]` itd.).
- Dodaje **pływający panel** w prawym dolnym rogu z:
  - wyborem języka źródłowego (domyślnie **PL**),
  - listą języków docelowych do zaznaczenia (EN, DE, ES, FR, IT, NL, GB, US),
  - przyciskiem **„Tłumacz zaznaczone"** i **„Przerwij"**,
  - paskiem postępu i statusem.
- Tłumaczy 5 kluczowych pól: `name`, `description_top`, `description_bottom`, `seo_title`, `seo_description`.
- Zachowuje **formatowanie HTML** z TinyMCE (tagi `<p>`, `<ul>`, `<strong>`, itd.).
- Automatycznie zapisuje wartość w polu i integruje się z **TinyMCE** oraz **Livewire** (dispatchuje eventy `input`/`change`).
- Ustawienia (klucz, model, styl, wytyczne) trzymane lokalnie w `chrome.storage.local` — klucz **nie opuszcza Twojej przeglądarki**, poza wywołaniem do `api.openai.com`.

## Instalacja (Chrome / Edge)

1. Pobierz cały folder `mdd-ai-translator` (albo sklonuj repo).
2. Otwórz `chrome://extensions`.
3. Włącz **Tryb dewelopera** (prawy górny róg).
4. Kliknij **„Załaduj rozpakowane"** i wskaż folder `mdd-ai-translator`.
5. Pojawi się ikona wtyczki — kliknij ją.

## Konfiguracja

W popupie wtyczki:

- **Klucz API OpenAI** — wklej klucz z https://platform.openai.com/api-keys (zaczyna się od `sk-…`).
- **Model** — domyślnie `gpt-4o-mini` (tani, bardzo dobra jakość). Dla trudniejszych opisów wybierz `gpt-4o` lub `gpt-4.1`.
- **Język źródłowy** — zwykle `pl`.
- **Styl / ton** — marketingowy (domyślnie), neutralny, SEO, techniczny.
- **Dodatkowe wytyczne** — np. „nie tłumacz nazwy modelu Coda, marka MDD zawsze wielkimi literami, zachowaj bezpośredni zwrot do klienta".
- **Zachowaj formatowanie HTML** — zostaw włączone dla pól TinyMCE.
- **Pomiń pola już wypełnione** — jeżeli pole EN już ma treść, nie zostanie nadpisane.

Kliknij **Zapisz ustawienia**, a następnie **Testuj klucz API**, aby sprawdzić, czy klucz jest poprawny.

## Użycie

1. Wejdź na stronę edycji kategorii, np. `https://devconfigurator.mdd.pl/dashboard-new/product-categories/5/edit`.
2. Wypełnij pola po polsku.
3. W prawym dolnym rogu pojawi się panel „🤖 MDD AI Translator".
4. Odznacz języki, których nie chcesz tłumaczyć.
5. Kliknij **„Tłumacz zaznaczone"** — pola zaczną się kolejno wypełniać (podświetlenie zieleń = OK, czerwień = błąd).
6. Sprawdź wyniki i zapisz formularz standardowym przyciskiem MDD.

## Uwagi

- Wtyczka wysyła treść pól **wyłącznie do `api.openai.com`** za pomocą Twojego klucza. Anthropic/OpenAI ani MDD **nie widzą** klucza po Twojej stronie.
- Koszty: `gpt-4o-mini` to zwykle ~0,01 USD za pełny opis kategorii ze wszystkimi 8 językami.
- Pole `url` (slug) NIE jest domyślnie tłumaczone.
- Jeżeli MDD zmieni strukturę formularza (nazwy `fields[...]`), wtyczka może wymagać aktualizacji.

## Rozwiązywanie problemów

- **„Brak klucza API"** — otwórz ikonę wtyczki i zapisz klucz.
- **„Błąd: 401"** — klucz nieprawidłowy lub odwołany.
- **„Błąd: 429"** — przekroczony limit / rate limit OpenAI — poczekaj chwilę.
- **Panel nie widoczny** — odśwież stronę; wtyczka aktywuje się tylko na dashboardzie MDD z formularzem edycji kategorii.
- **TinyMCE nie odświeża widoku** — kliknij w polu edytora, aby wymusić repaint; wartość jest już zapisana.
