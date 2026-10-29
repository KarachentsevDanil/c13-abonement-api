# abonement-api

Бекенд «Абонемента», мережі міських бібліотек. TypeScript (strict), Node 22, Fastify 5, Drizzle ORM, Postgres 16, Vitest.

- src/api — HTTP-маршрути (GET /loans/:id, POST /admin/loans/:id/renew)
- src/clock — clock.now(), час для тестованості
- src/dates — addDays, businessDaysBetween (date-fns)
- src/loans — видачі, штрафи, продовження бібліотекарем (adminRenew)
- src/holds — клієнт catalog-api: броні, HTTP, таймаут 2 с без повторних спроб
- src/notify — email-нагадування (Handlebars)
- src/store — репозиторії на Drizzle; міграції в drizzle/

## Команди

```bash
npx tsc --noEmit
npx eslint .
npx vitest run --project unit
npx vitest run --project integration   # Testcontainers, потрібен Docker
docker compose up --build               # локальний стенд, API на localhost:3000
```

## Правила

- Час бери з clock.now() (LoanDeps), не з new Date() чи Date.now().
- Утиліти для дат — у src/dates, не дублюй.
- Нові запити до БД — у src/store, з інтеграційним тестом.
- Golden-файли листів (test/unit/notify/__snapshots__) не оновлюй: їх погоджує контент-команда.
- Змінюй лише те, що потрібно для тікета.
