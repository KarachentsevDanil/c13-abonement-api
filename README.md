# abonement-api — навчальний репозиторій кейса C13

«Абонемент» — вигадана мережа міських бібліотек. Читач бере книгу на 21 день і зараз може продовжити видачу лише на стійці. Репозиторій відтворює кейс C13 (M2T2, теорії 1 і 2) за змістом: код, перевірки й конфігурацію, з якими команда береться за тікет LIB-218.

## Гілка `own-process`: практика M2T4

Практика M2T4-task-1, тікет LIB-233 (кейс C31): спосіб «власний процес». Текст тікета й рішення Product Owner — у завданні.

Що налаштовано (один коміт від `main`):

- скіли `/research`, `/tdd`, `/implement` у `.claude/skills/` з `disable-model-invocation: true`: їх запускає лише розробник;
- хук `PostToolUse` на `ExitPlanMode` (`.claude/hooks/save-plan.mjs`): копіює схвалений план у `docs/<тікет>/plan.md`; номер тікета береться з першого рядка плану `# LIB-…`;
- `"plansDirectory": "docs/plans"` у `.claude/settings.json`: чернетки плану Claude Code пише в `docs/plans/`;
- `docs/` у `.gitignore`: план і перелік кейсів лишаються поза Git;
- дані стенда для LIB-233 (див. «Локальний стенд»).

Встановлювати нічого не потрібно. Сесія стартує в auto mode; до plan mode — `Shift+Tab`, доки під полем вводу не з'явиться «⏸ plan mode on», або `claude --permission-mode plan`.

Перевірено 15.11.2026: Claude Code 2.1.319, Opus 5.5.

## Гілки

| Гілка | Що в ній |
| --- | --- |
| `main` | Стан до LIB-218: продовження лише на стійці (`adminRenew`), контур «як є», локальний стенд із базовими даними |
| `final` | LIB-218 за theory-1: секція `## TDD` у `CLAUDE.md`, специфікація й схвалений перелік кейсів у `docs/LIB-218/`, цикл TDD по одному коміту на кейс |
| `theory-2` | `final` + мутаційне тестування, гарди й сценарії стенда для доказу (M2T5) |
| `own-process` | M2T4, практика LIB-233 (кейс C31): власний процес — скіли `/research`, `/tdd`, `/implement` і хук, що зберігає схвалений план |
| `openspec` | M2T4, практика LIB-233 (кейс C31): результат `openspec init --tools claude`, OpenSpec 1.15.0 |
| `superpowers` | M2T4, практика LIB-233 (кейс C31): Superpowers v7.0.0, закріплений маркетплейсом курсу в `.claude/settings.json` |

`main` — також базова гілка для M2T4: у C18 від неї LIB-218 і LIB-240 проходять трьома процесами, а гілки практики (C31, LIB-233) відходять від неї одним комітом налаштування. Що встановити й на яких версіях гілку перевірено — у README кожної гілки практики.

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
| 7 | reader4 | 107 | 30.10 | 0 | — |

catalog-api (`stand/catalog-api/holds.json`): бронь reader2 на книгу 104 і бронь reader1 на книгу 101, тобто на його власну видачу 1.

Для LIB-233: видача 7 на 03.11 прострочена, `fineMinor` дає 1000 (два робочі дні по 500); видача 4 має бронь іншого читача, видача 1 — лише власну бронь, видачі 2 і 6 уже повернені.

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

Workflow `.github/workflows/ci.yml`: jobs `lint`, `typecheck`, `unit`, `integration`, `sonar` на кожен PR у `main`. Покриття unit та integration іде в Sonar як lcov. Секрети `SONAR_TOKEN` і `SONAR_HOST_URL` — у налаштуваннях репозиторію.

Сервера Sonar у навчального репозиторію немає, тож без цих секретів job `sonar` червоний. Команда `@abonement/backend-leads` у CODEOWNERS умовна: на GitHub такої немає.

Branch protection задається в налаштуваннях GitHub і в репозиторій не входить, тому вона описана тут:

```
Branch protection (main)
  Require status checks to pass: lint, unit, integration, SonarQube quality gate
  Require approvals: 1
  Require review from Code Owners: увімкнено
  .github/CODEOWNERS: /drizzle/
```

## Прод-моніторинг

Описаний текстом, у репозиторії його немає: Grafana, алерт на частку 5xx > 2 % за 5 хв по кожному маршруту; логи в Loki, алертів за логами немає.
