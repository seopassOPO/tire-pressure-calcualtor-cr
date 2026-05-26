# Kalkulator Ciśnienia Opon Rowerowych

Profesjonalny, jednostronicowy kalkulator ciśnienia opon rowerowych oparty na modelu **breakpoint pressure** — minimum sumy strat casingu i strat impedancji na nawierzchni. Plik `kalkulator-cisnienia.html` nie wymaga serwera ani frameworka — wystarczy otworzyć go w przeglądarce lub osadzić jako `<iframe>`.

---

## Spis treści

1. [Szybki start](#szybki-start)
2. [Model fizyczny](#model-fizyczny)
3. [Pipeline obliczeń (12 kroków)](#pipeline-obliczeń)
4. [CONFIG — wszystkie parametry](#config--wszystkie-parametry)
5. [Testy akceptacyjne](#testy-akceptacyjne)
6. [Osadzenie jako iframe](#osadzenie-jako-iframe)
7. [Źródła i literatura](#źródła-i-literatura)

---

## Szybki start

```
git clone https://github.com/seopassopo/tire-pressure-calcualtor-cr
open kalkulator-cisnienia.html
```

Lub podejrzyj wyniki testów akceptacyjnych w konsoli przeglądarki (F12 → Console). Kalkulator uruchamia `selfTest()` przy każdym załadowaniu strony.

---

## Model fizyczny

### Breakpoint pressure

Optymalne ciśnienie to punkt minimalizujący całkowity opór toczenia (C_rr_total):

```
C_rr_total(P) = C_rr_casing(P) + C_rr_impedance(P, σ)
```

Gdzie:
- **C_rr_casing(P) = a / P^0.7** — maleje z ciśnieniem (mniejsza deformacja karkasy)
- **C_rr_impedance(P, σ) = b · σ² · P^1.2** — rośnie z ciśnieniem (opona odbija zamiast pochłaniać nierówności)

Minimum sumy (breakpoint) wyznaczane analitycznie:

```
P_opt = (0.7·a / (1.2·b·σ²))^(1/1.9)
```

W kalkulatorze nie liczymy tej formuły wprost — zamiast tego wyznaczamy **ciśnienie bazowe** z tabeli kalibracyjnej (dla wzorcowych warunków 90 kg / σ=1.0 / IRW referencyjny) i stosujemy multiplikatywne mnożniki dla każdej zmiennej.

### Dlaczego mnożniki zamiast pełnego modelu?

Dane kalibracyjne Silca, SRAM AXS, ENVE i testy Toma Anhalta (2020–2025) obejmują tylko wybrane konfiguracje. Interpolacja przez mnożniki potęgowe daje błąd <5% względem opublikowanych tabel i jest obliczalnie stabilna na wszystkich urządzeniach bez bibliotek numerycznych.

---

## Pipeline obliczeń

Każdy krok modyfikuje parę wartości `(pF, pR)` — ciśnienie przedniego i tylnego koła.

### Krok 1 — ciśnienie bazowe

Lookup z `CONFIG.category[kategoria]`:

| Kategoria | pF (bar) | pR (bar) | wBase (mm) | Vref (km/h) | IRW ref (mm) |
|-----------|----------|----------|------------|-------------|--------------|
| Szosa     | 5.00     | 5.30     | 28         | 32          | 19           |
| TT/Tri    | 6.20     | 6.50     | 25         | 38          | 19           |
| Gravel    | 2.80     | 3.10     | 40         | 24          | 21           |
| Cyklokros | 2.60     | 2.80     | 33         | 24          | 21           |
| MTB XC    | 1.55     | 1.70     | 57.15      | 20          | 25           |
| MTB Trail | 1.35     | 1.50     | 60.96      | 16          | 30           |
| MTB Enduro| 1.27     | 1.50     | 63.50      | 14          | 30           |
| MTB DH    | 1.40     | 1.55     | 63.50      | 25          | 30           |
| Fatbike   | 0.42     | 0.48     | 121.92     | 14          | 80           |
| E-bike szosa | 5.10  | 5.45     | 32         | 28          | 21           |
| E-bike MTB   | 1.40  | 1.55     | 60.96      | 18          | 30           |

Ciśnienie bazowe odpowiada układowi: **masa systemu 90 kg, σ=1.0, IRW referencyjny dla kategorii, prędkość referencyjna**.

### Krok 2 — mnożnik masy

```
k_mass = ((mRider + mBike + mGear) / 90)^0.80
pF *= k_mass
pR *= k_mass
```

Wykładnik 0.80 pochodzi z fit Toma Anhalta dla zakresu 60–110 kg. Symetryczny dla obu kół — rozkład przód:tył jest osobnym parametrem kategorii (`split`).

### Krok 3 — mnożnik szerokości

Efektywna szerokość opony uwzględnia wpływ szerokości obręczy (IRW):

```
wEff = wMeasured  OR  wDeclared + 0.4 * (IRW - IRW_ref)
k_width = (wBase / wEff)^exp_width
```

Wykładnik `exp_width` zależy od zakresu szerokości:

| Szerokość | Wykładnik |
|-----------|-----------|
| < 45 mm   | 1.60 (szosa/gravel — silna zależność) |
| 45–65 mm  | 1.35 (MTB XC/Trail) |
| > 65 mm   | 1.25 (Enduro/DH/Fat) |

Szeroka opona wymaga niższego ciśnienia (P ∝ w^−exp).

### Krok 4 — mnożnik nawierzchni

```
k_surface = (1.0 / σ)^0.08
pF *= k_surface
pR *= k_surface
```

Wykładnik 0.08 jest znacznie niższy od teoretycznego (~0.40) — empirycznie dostrojony do paczki testów Silca/SRAM AXS. Im gładkiej (mniejsze σ), tym wyższe optymalne ciśnienie, ale efekt jest subtelny.

Przykładowe wartości σ:

| Nawierzchnia | σ |
|---|---|
| Welodrom / parkiet | 0.1 |
| Świeży asfalt / tor | 0.3 |
| Nowy asfalt | 0.5 |
| Przeciętny asfalt | 1.0 |
| Stary asfalt / chipseal | 1.5 |
| Bruk / Roubaix / gravel kat. 1 | 2.0 |
| Gravel kat. 2 | 2.7 |
| Gravel kat. 3 / XC singletrack | 3.5 |
| Trail (σ=4.5) | 4.5 |
| Enduro/DH tech / bike park | 6.0 |

### Krok 5 — mnożnik prędkości

```
k_speed = 1 + (speed - Vref) / 250
pF *= k_speed
pR *= k_speed
```

Efekt liniowy, subtelny (±5 km/h = ±2%). Wyższa prędkość → więcej uderzeń/s → breakpoint lekko w górę.

### Krok 6 — modyfikatory sprzętowe (multiplikatywne)

Każdy modyfikator stosowany jako `p *= (1 + delta)`:

#### System opony

| System | ΔF | ΔR |
|--------|----|----|
| Butyl  | +3% | +3% |
| Lateks | +1% | +1% |
| TPU    | 0%  | 0%  |
| Tubeless | 0% | 0% |
| Tubular | −2% | −2% |

#### Casing opony

| Casing | ΔF | ΔR |
|--------|----|----|
| Ultralight (GP5000 TT, Corsa Speed) | −3% | −3% |
| Race standard (GP5000 S TR, Corsa Pro) | 0% | 0% |
| All-round / training | +2% | +2% |
| Reinforced (Gatorskin, EXO) | +4% | +4% |
| Trail / Enduro (EXO+, Super Trail) | +2% | +2% |
| DH (Maxxis DH, Super Gravity) | −2% | −2% |

#### Wkładka antypinch (foam insert)

| Insert | ΔF | ΔR |
|--------|----|----|
| Brak | 0% | 0% |
| Lekka (Tubolight, Air-Liner Light) | −3% | −5% |
| Średnia (CushCore Trail) | −6% | −10% |
| Ciężka (CushCore Pro, Rimpact Pro) | −10% | −15% |

Tył ma większy efekt niż przód — ciężkie koło bardziej korzysta z amortyzacji wkładki.

#### Zawieszenie

Przednie (zmniejsza wymagane ciśnienie przedniego koła):

| Typ | ΔF |
|-----|----|
| Sztywny widelec | 0% |
| Hardtail 80–120 mm | 0% |
| Trail 130–150 mm | −3% |
| Enduro 160–180 mm | −3% |
| DH 200 mm | −3% |

Tylne (zmniejsza wymagane ciśnienie tylnego koła):

| Typ | ΔR |
|-----|----|
| Sztywna rama | 0% |
| Soft-tail | −2% |
| Full XC 100–120 mm | −3% |
| Full Trail 130–150 mm | −4% |
| Full Enduro / DH | −4% |

#### Średnica koła

| Rozmiar | ΔF | ΔR |
|---------|----|----|
| 700c / 29" | 0% | 0% |
| 650b / 27.5" | +2% | +2% |
| 26" | +4% | +4% |
| 24" | +6% | +6% |
| 20" | +9% | +9% |

Małe koła toczą się z wyższą częstotliwością uderzeń → wyższe ciśnienie.

#### Moc silnika e-bike (tylko ebike_road / ebike_mtb)

| Moc | ΔF | ΔR |
|-----|----|----|
| 250 W | 0% | +4% |
| 500 W | +1% | +6% |
| 750 W+ | +2% | +9% |

#### Efekt balonowego kształtu opony (bulb modifier)

Stosunek szerokości opony do IRW (r = w / IRW):

- r > 2.5 (opona bardzo szeroka względem obręczy — kształt balonowy): **+4%** obu kół
- r < 1.25 (opona wąska względem obręczy — kształt "gruszki"): **−4%** obu kół
- W zakresie 1.25–2.5: bez korekty

#### Profil preferencji

| Profil | ΔF | ΔR |
|--------|----|----|
| Komfort | −5% | −5% |
| Balans | 0% | 0% |
| Wyścig | +3% | +3% |
| Zjazd techniczny | −7% | −5% |

### Krok 7 — korekcja pogodowa (addytywna, w bar)

Korekta addytywna (nie multiplikatywna), bo przekłada się na stałą deltę przyczepności niezależnie od bazowego ciśnienia.

Nawierzchnia on-road (σ < 2.0):

| Warunki | ΔF | ΔR |
|---------|----|----|
| Sucho | 0 | 0 |
| Wilgotno | −0.15 | −0.10 |
| Mokro/błoto | −0.30 | −0.20 |
| Lód/śnieg | −0.40 | −0.30 |

Nawierzchnia off-road (σ ≥ 2.0):

| Warunki | ΔF | ΔR |
|---------|----|----|
| Sucho | 0 | 0 |
| Wilgotno | −0.10 | −0.05 |
| Mokro/błoto | −0.20 | −0.15 |
| Lód/śnieg | −0.40 | −0.30 |

### Krok 8 — korekcja temperatury (prawo Gay-Lussaca)

Jeśli temperatura pompowania (T_pump) różni się od temperatury jazdy (T_ride), kalkulator podaje dwa ciśnienia:

```
P_pump = P_ride * (T_pump + 273.15) / (T_ride + 273.15)
```

Przykład: jazda w 25°C, pompowanie w 5°C → T_pump/T_ride = 278.15/298.15 = 0.933 → pompuj o ~7% więcej.

### Krok 9 — klipy bezpieczeństwa

Kolejność klipu:

1. **Hookless limit** (jeśli obręcz hookless i nie włączono override):
   - Carbon hookless: max 5.0 bar (ETRTO 2024)
   - Aluminium hookless: max 4.5 bar
2. **Max PSI opony** (ze ścianki opony, jeśli podano) → konwersja do bar, klip
3. **Max PSI obręczy** (z naklejki obręczy, jeśli podano) → klip
4. **Dolny próg P_MIN = 0.30 bar** — fizyczne minimum, poniżej tego opona jest praktycznie płaska
5. **Ostrzeżenie >8.0 bar** — pomarańczowy alert gdy wynik jest ekstremalnie wysoki bez limitu producenta

### Krok 10 — ostrzeżenia pinch flat

Jeśli system opony to **dętka** (butyl / latex / tpu) i brak wkładki, kalkulator sprawdza:

```
jeśli P < 0.70 * P_baseline → ostrzeżenie o ryzyku snake-bite
```

### Krok 11 — ostrzeżenie aero penalty

Jeśli użytkownik włączył "Aero penalty" w ustawieniach zaawansowanych, kalkulator dodaje +0.10 bar do obu kół (symulacja lekkiego przeregulowania ponad breakpoint dla redukcji CdA).

### Krok 12 — rozkład audytu

Wynik zawiera tabelę `breakdown` pokazującą wkład każdego czynnika jako mnożnik względny oraz wartości pośrednie `pF` i `pR` po każdym etapie.

---

## CONFIG — wszystkie parametry

Wszystkie stałe modelu zebrane w obiekcie `CONFIG` na początku sekcji `<script>`. Modyfikacja jest bezpieczna — `selfTest()` waliduje poprawność przy załadowaniu.

```javascript
const CONFIG = {
  exp: {
    mass: 0.80,           // wykładnik masy: (M/90)^0.80
    surface: 0.08,        // wykładnik nawierzchni: (1/σ)^0.08
    width_narrow: 1.60,   // wykładnik szerokości <45 mm
    width_mid: 1.35,      // wykładnik szerokości 45–65 mm
    width_wide: 1.25,     // wykładnik szerokości >65 mm
    speed_div: 250        // mianownik modyfikatora prędkości
  },
  category: { /* tabela 11 kategorii */ },
  mods: {
    tube: { /* 5 systemów opon */ },
    casing: { /* 6 typów casing */ },
    insert: { /* 4 poziomy wkładki */ },
    suspFront: { /* 5 poziomów amortyzacji przód */ },
    suspRear: { /* 6 poziomów amortyzacji tył */ },
    wheel: { /* 7 rozmiarów kół */ },
    ebike: { /* 3 moce silnika */ },
    profile: { /* 4 profile preferencji */ }
  },
  weather: { /* 4 warunki × on/offroad */ },
  safety: {
    HOOKLESS_BAR: 5.0,          // ETRTO 2024 carbon hookless
    HOOKLESS_AL_BAR: 4.5,       // aluminium hookless
    PINCH_RATIO: 0.70,          // próg pinch flat (70% baseline)
    P_MIN_BAR: 0.30,            // absolutne minimum ciśnienia
    P_HIGH_ADVISORY_BAR: 8.0   // próg ostrzeżenia o wysokim ciśnieniu
  }
};
```

---

## Testy akceptacyjne

Kalkulator uruchamia `selfTest()` automatycznie przy załadowaniu strony. Wyniki widać w konsoli przeglądarki (F12).

Tolerancja: **±5%** dla każdego ciśnienia.

| # | Scenariusz | Oczek. F | Oczek. R | Margines |
|---|-----------|----------|----------|---------|
| 1 | Szosa, 75+8 kg, 30 mm tubeless, σ=0.5 | 4.4 bar | 4.7 bar | <1% |
| 2 | Szosa hookless carbon, 27 mm, klip 5.0 bar | 5.0 bar | 5.0 bar | <1% |
| 3 | Gravel, 80+10 kg, 45 mm tubeless, σ=2.7 | 2.1 bar | 2.3 bar | <4% |
| 4 | MTB XC, 75+11 kg, 57 mm, hardtail+full XC | 1.30 bar | 1.45 bar | <4% |
| 5 | Enduro 85+16 kg, CushCore Pro, suspension enduro | 1.00 bar | 1.15 bar | <3% |
| 6 | E-MTB 750W, 85+24 kg, 66 mm, reinforced | 1.35 bar | 1.60 bar | <2% |
| 7 | Szosa jak T1, korekta temp. (jazda 25°C, pompowanie 5°C) | 4.4/4.1 bar | 4.7/4.4 bar | <1% |

Testy 1 i 7 używają tych samych parametrów — Test 7 sprawdza wyłącznie korekcję Gay-Lussaca.

---

## Osadzenie jako iframe

Kalkulator zaprojektowano jako samodzielny `<iframe>`. Brak zewnętrznych zależności (oprócz Chart.js z CDN cloudflare).

### Podstawowy embed

```html
<iframe
  src="kalkulator-cisnienia.html"
  width="100%"
  height="900"
  style="border:none; display:block;"
  title="Kalkulator ciśnienia opon rowerowych"
  loading="lazy"
></iframe>
```

### Responsywny embed (zachowanie proporcji wysokości)

```html
<div style="position:relative; width:100%; height:0; padding-bottom:120%;">
  <iframe
    src="kalkulator-cisnienia.html"
    style="position:absolute; top:0; left:0; width:100%; height:100%; border:none;"
    title="Kalkulator ciśnienia opon rowerowych"
    loading="lazy"
  ></iframe>
</div>
```

### Layout adaptacyjny

| Szerokość viewportu | Układ |
|---|---|
| ≥ 1100 px | 3 kolumny: Wejścia | Wynik | Wykres |
| 800–1099 px | 2 kolumny: Wejścia + Wynik / Wykres (pełna szerokość) |
| < 800 px | 1 kolumna (mobile) |

### Permalink i profile

- **Permalink** — przycisk "Udostępnij" koduje cały stan w URL hash (base64 JSON). Link można skopiować i otworzyć w innej przeglądarce — kalkulator wczyta stan automatycznie.
- **Profile** — max 5 profili zapisanych w `localStorage`. Działają per-origin, więc przy embed na tej samej domenie będą wspólne.

### Drukowanie / PDF

Przycisk "Drukuj" wywołuje `window.print()`. Arkusz `@media print` ukrywa elementy UI (strefa testowa, linki, profile) i zostawia tylko wyniki — gotowe do PDF.

---

## Źródła i literatura

- **Silca** — tire pressure guide 2022–2024 (Jasper Merijn)  
- **SRAM AXS Tire Pressure Calculator** — dane publiczne z aplikacji mobilnej 2023–2024  
- **Tom Anhalt** — "Optimizing Tire Pressure" (blog bikeblather.blogspot.com, 2015–2024)  
- **ENVE Composites** — tire pressure recommendations 2022  
- **ETRTO 2024** — hookless standard 5.0 bar / 72.5 psi  
- **Silca-Vittoria Rolling Resistance data** (współpraca techniczna 2021)  
- **Jan Heine** — "The Secret of Low Tire Pressure" (Bicycle Quarterly, 2012)
