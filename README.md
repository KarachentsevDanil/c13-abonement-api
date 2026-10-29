# abonement-api — навчальний репозиторій кейса C13

«Абонемент» — вигадана мережа міських бібліотек. Читач бере книгу на 21 день і зараз може продовжити видачу лише на стійці. Репозиторій відтворює кейс C13 (M2T2, теорії 1 і 2) за змістом: код, перевірки й конфігурацію, з якими команда береться за тікет LIB-218.

## Гілки

| Гілка | Що в ній |
| --- | --- |
| `main` | Стан до LIB-218: продовження лише на стійці (`adminRenew`), контур «як є», локальний стенд із базовими даними |
| `final` | LIB-218 за theory-1: секція `## TDD` у `CLAUDE.md`, специфікація й схвалений перелік кейсів у `docs/LIB-218/`, цикл TDD по одному коміту на кейс |
| `theory-2` | `final` + мутаційне тестування, гарди й сценарії стенда для доказу (M2T5) |

`main` — також базова гілка для M2T4 (C18): там LIB-218 і LIB-240 проходять трьома процесами.

## Тікет

```
LIB-218. Онлайн-продовження видачі

1. читач може продовжити видачу через API: POST /loans/:id/renew
2. кожне продовження — +14 днів до поточної дати повернення (due_at);
   не більше 2 продовжень на видачу
3. продовження заборонене, якщо на книгу є активна бронь іншого читача
4. продовження заборонене, якщо в читача є хоча б одна прострочена видача
5. відповідь: 200 з новою due_at; відмова — 409 з кодом причини
   LIMIT_REACHED | HOLD_EXISTS | OVERDUE_LOANS
```

## LIB-218 на гілці `final`

Задачу проведено за theory-1:

- `docs/LIB-218/spec.md` — критерії приймання, п'ять рішень після дослідження в plan mode, non-goals;
- `docs/LIB-218/cases.md` — 11 схвалених кейсів зі статусами й назвами тестів;
- історія комітів — по одному коміту на кейс: тест і код разом, вивід червоного прогону в тілі коміту (`git log final`). Якщо тест одразу був зеленим, коміт пояснює чому.

Новий код: `src/loans/renew.ts`, `src/loans/errors.ts`, методи `countOverdue` і `extend` у `src/store/loans.repo.ts`, маршрут `POST /loans/:id/renew` у `src/api/loans.route.ts`.

| Запит | Відповідь |
| --- | --- |
| `POST /loans/:id/renew` | `200 { dueAt }`; `409 { code }` з `LIMIT_REACHED`, `OVERDUE_LOANS` або `HOLD_EXISTS`; `503 { code: "CATALOG_UNAVAILABLE" }`; `404` для чужої чи неіснуючої видачі; `401` без токена |

## Гілка `theory-2`: мутанти й гарди

Продовжує `final`. Кожен крок — окремий коміт із виводом у тілі (`git log theory-2`).

### Мутаційне тестування

`stryker.config.json` — як у theory-2: `testRunner` vitest, `mutate` `src/loans/renew.ts`, пороги 90 / 80 / break 80.

```bash
npx stryker run      # звіт: reports/mutation/mutation.html
```

| Прогін | Мутантів | Убито | Вціліло | Без покриття | CompileError | Оцінка | Exit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| код `final`, конфіг theory-2 | 28 | 22 | 5 | 1 | — | 78,57 | 1 (нижче break) |
| те саме + `@stryker-mutator/typescript-checker` (окремий прогін, не в репозиторії) | 28 | 13 | 1 | 0 | 14 | 92,86 | 0 |
| після посилення тесту кейсу 8 | 28 | 24 | 3 | 1 | — | 85,71 | 0 |

Вцілілі на `final`: два мутанти в рядку 21 (`.catch((err) => {})` і `.catch((err) => { ; })`), бо тест кейсу 8 перевіряв лише `rejects.toThrow()`; три в рядку 17 і один без покриття там само — перевірку `NotFoundError` (чужа чи неіснуюча видача) жоден схвалений кейс не покриває. Рядок 17 лишено як є: тікет цієї поведінки не визначає, рішення — за авторкою тікету.

### Гарди

| Гард | Де | Спрацьовує | Пропускає погоджений виняток |
| --- | --- | --- | --- |
| ESLint: `vitest/no-disabled-tests`, `no-commented-out-tests`, `expect-expect`; eslint-comments `require-description` | `eslint.config.js`; PostToolUse; CI `lint` | `it.skip`, закоментований тест, тест без `expect`, `eslint-disable` без причини → хук exit 2 | `// eslint-disable-next-line vitest/no-disabled-tests -- <причина>` → exit 0 |
| Поріг покриття функцій репозиторіїв | CI `integration`: `--coverage.include='src/store/*.repo.ts' --coverage.thresholds.functions=100` | без інтеграційного тесту `extend` → 87,5 %, exit 1 | `/* v8 ignore next 5 -- <причина> */` → exit 0 |
| Мутаційне тестування | CI `mutation`: `npx stryker run` | оцінка нижча за 80 → exit 1 | `// Stryker disable next-line <мутатор>: <причина>` |
| Quality gate Sonar way | сервер SonarQube; CI `sonar` | сервера немає, не запускався | Accepted / False positive з правом Administer Issues |
| CODEOWNERS на конфіги гардів | `.github/CODEOWNERS` | зміна `eslint.config.js`, `vitest.config.ts`, `stryker.config.json`, `sonar-project.properties` потребує рев'ю власника | власник схвалює зміну |

Чого цей набір не ловить (перевірено): `it.todo` (ловить правило `vitest/warn-todo`, у конфіг його не додано) і `it.skipIf(true)` — лінт і Vitest зелені, «1 skipped».

`@vitest/eslint-plugin` закріплено на 1.6.27: 1.6.28 вимагає TypeScript ≥ 6, і `npm install` на TypeScript 5.6.3 падає з ERESOLVE.

### Доказ зі стенда

`http/renew.http` — 9 сценаріїв LIB-218, `docs/LIB-218/stand-proof.md` — команди, сирі відповіді й стан після запиту. Усі 9 збігаються з очікуваннями. Сценарій 9: після `docker compose stop catalog-api` 503 приходить за 0,02–0,2 с (ім'я не резолвиться), таймаут 2 с видно лише після `docker compose pause catalog-api` (2,02 с).

Дані стенда для LIB-218 (`stand/seed-data.ts`, не повернені, 2026 рік, 00:00 UTC):

| Видача | Читач | Книга | due_at | renewals | Сценарій |
| --- | --- | --- | --- | --- | --- |
| 7 | reader1 | 107 | 10.11 | 0 | 1 |
| 8 | reader1 | 108 | 17.11 | 1 | 2 |
| 9 | reader1 | 109 | 24.11 | 2 | 3 |
| 10 | reader1 | 110, бронь reader2 | 14.11 | 0 | 4 |
| 11 | reader1 | 111, бронь reader1 | 14.11 | 0 | 5 |
| 12 | reader3 | 112 | 15.11 | 0 | 6 |
| 13 | reader3 | 113 | 30.10 | 0 | прострочка для сценарію 6 |
| 14 | reader4 | 114 | 01.11 | 0 | 7 |
| 15 | reader4 | 115 | 20.11 | 2 | 8 |
| 16 | reader1 | 116 | 12.11 | 0 | 9 |

## Структура

```
src/
  api/       HTTP-маршрути: GET /loans/:id, POST /admin/loans/:id/renew
  clock/     clock.now(); CLOCK_FIXED_NOW фіксує час на стенді
  dates/     addDays, businessDaysBetween (date-fns)
  loans/     видачі, штрафи, продовження бібліотекарем (adminRenew.ts, 2021 рік)
  holds/     клієнт catalog-api: броні по HTTP, таймаут 2 с, без повторних спроб
  notify/    email-нагадування (Handlebars)
  store/     схема й репозиторії на Drizzle ORM
drizzle/     міграції drizzle-kit
test/unit/         Vitest, репозиторії й клієнт catalog-api замоковано (vi.fn)
test/integration/  Vitest, Testcontainers (Postgres 16, потрібен Docker); лише src/store
http/        .http-сценарії для стенда, токени читачів
stand/       тестові дані стенда й заглушка catalog-api
docker-compose.yml, Dockerfile, eslint.config.js, vitest.config.ts, sonar-project.properties,
CLAUDE.md, .claude/settings.json (хуки), .github/workflows/ci.yml, .github/CODEOWNERS
```

`src/loans/adminRenew.ts` — найближча до LIB-218 логіка, але з іншою політикою: на стійці нова дата рахується від сьогодні через `new Date()`, бо читач приносить книгу фізично. Файл старший за `src/clock` і `src/dates`, тому має власний `addDays`.

## Запуск

Хукам Claude Code потрібен `jq`: без нього PostToolUse-хук мовчки пропускає перевірку.

```bash
npm install
npx tsc --noEmit
npx eslint .
npx vitest run --project unit
npx vitest run --project integration   # Testcontainers сам підіймає postgres:16
```

### Локальний стенд

```bash
docker compose up --build -d            # abonement-api :3000, Postgres, catalog-api
source http/curl.env                    # $READER1–$READER4, $LIBRARIAN
curl -i http://localhost:3000/loans/1 -H "Authorization: Bearer $READER1"
docker compose down -v                  # скинути дані стенда
```

Час на стенді зафіксовано: `CLOCK_FIXED_NOW=2026-11-03T09:00:00Z`, тож `clock.now()` повертає 03.11.2026 незалежно від дня запуску. Токени читачів — у `http/http-client.env.json` (для `.http`-файлів) і `http/curl.env` (для curl). Якщо порт 5432 зайнятий: `POSTGRES_PORT=5433 docker compose up --build -d`.

| Запит | Відповідь |
| --- | --- |
| `GET /loans/:id` | `200 { id, dueAt, renewals }` для власної видачі; `404` без тіла для чужої чи неіснуючої; `401` без токена |
| `POST /admin/loans/:id/renew` | токен бібліотекаря (`LIBRARIAN_TOKEN`); `200 { dueAt }`, нова дата — від сьогодні + 14 днів; `404` |

`GET /loans/:id` не перевіряє формат id: `/loans/abc` відповідає `500` з текстом SQL у тілі, а `/loans/+1` повертає видачу 1. Це стан до тікету LIB-240 з M2T4.

Дані стенда (`stand/seed-data.ts`, усі дати 2026 року, 00:00 UTC):

| Видача | Читач | Книга | due_at | renewals | Повернена |
| --- | --- | --- | --- | --- | --- |
| 1 | reader1 | 101 | 10.11 | 0 | — |
| 2 | reader2 | 102 | 22.10 | 0 | 21.10 |
| 3 | reader2 | 103 | 15.11 | 0 | — |
| 4 | reader3 | 104 | 18.11 | 0 | — |
| 5 | reader4 | 105 | 04.11 | 0 | — |
| 6 | reader1 | 106 | 11.10 | 1 | 15.10 |

catalog-api (`stand/catalog-api/holds.json`): бронь reader2 на книгу 104.

## Контур перевірок «як є»

Цифри кейсу — для проєкту команди. Тут репозиторій маленький, тому в колонці «тут» заміри на MacBook: вони показують лише співвідношення.

| Шар | Команда | Де і коли | У кейсі | Тут |
| --- | --- | --- | --- | --- |
| Типи | `npx tsc --noEmit` | PostToolUse на Edit\|Write; CI | ~15 с | холодний 2,4 с; теплий 1,2 с |
| Лінтер | `npx eslint .` (typescript-eslint recommended; `@vitest/eslint-plugin` і eslint-comments не підключено) | PostToolUse на змінений файл; CI | ~15 с | файл 0,7 с; репозиторій 1,0 с |
| Юніт | `npx vitest run --project unit` | Stop; CI | ~30 с | 17 тестів, 1,7 с |
| Інтеграційні | `npx vitest run --project integration` | CI; локально в сесії агента | ~4 хв | 4 тести, 5,9 с разом із контейнером |
| Статичний аналіз | SonarQube, quality gate Sonar way на сервері; покриття з unit та integration | CI після тестів | ~2 хв | сервера немає, job не запускався |
| e2e | Postman-колекція на staging, 6 сценаріїв, QA перед релізом | вручну | ~15 хв | staging немає, колекції в репозиторії немає |

Хуки Claude Code — у `.claude/settings.json` і `.claude/hooks/`: після Edit або Write на `.ts`-файл — `tsc --noEmit` і `eslint` цього файлу, на Stop — юніт-тести. Обидва хуки повертають exit 2 з виводом, якщо перевірка червона. Stop пропускає другу зупинку поспіль (`stop_hook_active`).

Docker доступний і в CI, і в сесії агента.

## CI-гейт і branch protection

Workflow `.github/workflows/ci.yml`: jobs `lint`, `typecheck`, `unit`, `integration`, `sonar` на кожен PR у `main`; на `theory-2` ще `mutation` і поріг покриття в `integration`. Покриття unit та integration іде в Sonar як lcov. Секрети `SONAR_TOKEN` і `SONAR_HOST_URL` — у налаштуваннях репозиторію.

Сервера Sonar у навчального репозиторію немає, тож без цих секретів job `sonar` червоний. Команда `@abonement/backend-leads` у CODEOWNERS умовна: на GitHub такої немає.

Branch protection задається в налаштуваннях GitHub і в репозиторій не входить, тому вона описана тут:

```
Branch protection (main)
  Require status checks to pass: lint, unit, integration, SonarQube quality gate
                                  (theory-2: + mutation)
  Require approvals: 1
  Require review from Code Owners: увімкнено
  .github/CODEOWNERS: /drizzle/; на theory-2 також eslint.config.js, vitest.config.ts,
                      stryker.config.json, sonar-project.properties
```

## Прод-моніторинг

Описаний текстом, у репозиторії його немає: Grafana, алерт на частку 5xx > 2 % за 5 хв по кожному маршруту; логи в Loki, алертів за логами немає.
