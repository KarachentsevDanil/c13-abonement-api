# LIB-218 — доказ зі стенда

Сценарії з `http/renew.http`, виконані curl на локальному стенді. Для кожного: команда, сира відповідь (без заголовків `date`, `connection`, `keep-alive`) і стан видачі після запиту.

- Збірка: `docker compose up --build -d` з поточного дерева; код `src/` — як у коміті `6121e88`, останньому, що змінює `src/`.
- Час стенда: `CLOCK_FIXED_NOW=2026-11-03T09:00:00Z`.
- Дані: `stand/seed-data.ts`, броні — `stand/catalog-api/holds.json`; стан перед прогоном скинуто `docker compose down -v`.
- Очікування — з тікету й `docs/LIB-218/spec.md`, не з коду.

### Сценарій 1 (видача 7)

```
$ curl -i -X POST http://localhost:3000/loans/7/renew -H "Authorization: Bearer $READER1"
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
content-length: 36

{"dueAt":"2026-11-24T00:00:00.000Z"}

$ curl http://localhost:3000/loans/7 -H "Authorization: Bearer $READER1"
{"id":7,"dueAt":"2026-11-24T00:00:00.000Z","renewals":1}
```

### Сценарій 2 (видача 8)

```
$ curl -i -X POST http://localhost:3000/loans/8/renew -H "Authorization: Bearer $READER1"
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
content-length: 36

{"dueAt":"2026-12-01T00:00:00.000Z"}

$ curl http://localhost:3000/loans/8 -H "Authorization: Bearer $READER1"
{"id":8,"dueAt":"2026-12-01T00:00:00.000Z","renewals":2}
```

### Сценарій 3 (видача 9)

```
$ curl -i -X POST http://localhost:3000/loans/9/renew -H "Authorization: Bearer $READER1"
HTTP/1.1 409 Conflict
content-type: application/json; charset=utf-8
content-length: 24

{"code":"LIMIT_REACHED"}

$ curl http://localhost:3000/loans/9 -H "Authorization: Bearer $READER1"
{"id":9,"dueAt":"2026-11-24T00:00:00.000Z","renewals":2}
```

### Сценарій 4 (видача 10)

```
$ curl -i -X POST http://localhost:3000/loans/10/renew -H "Authorization: Bearer $READER1"
HTTP/1.1 409 Conflict
content-type: application/json; charset=utf-8
content-length: 22

{"code":"HOLD_EXISTS"}

$ curl http://localhost:3000/loans/10 -H "Authorization: Bearer $READER1"
{"id":10,"dueAt":"2026-11-14T00:00:00.000Z","renewals":0}
```

### Сценарій 5 (видача 11)

```
$ curl -i -X POST http://localhost:3000/loans/11/renew -H "Authorization: Bearer $READER1"
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
content-length: 36

{"dueAt":"2026-11-28T00:00:00.000Z"}

$ curl http://localhost:3000/loans/11 -H "Authorization: Bearer $READER1"
{"id":11,"dueAt":"2026-11-28T00:00:00.000Z","renewals":1}
```

### Сценарій 6 (видача 12)

```
$ curl -i -X POST http://localhost:3000/loans/12/renew -H "Authorization: Bearer $READER3"
HTTP/1.1 409 Conflict
content-type: application/json; charset=utf-8
content-length: 24

{"code":"OVERDUE_LOANS"}

$ curl http://localhost:3000/loans/12 -H "Authorization: Bearer $READER3"
{"id":12,"dueAt":"2026-11-15T00:00:00.000Z","renewals":0}
```

### Сценарій 7 (видача 14)

```
$ curl -i -X POST http://localhost:3000/loans/14/renew -H "Authorization: Bearer $READER4"
HTTP/1.1 409 Conflict
content-type: application/json; charset=utf-8
content-length: 24

{"code":"OVERDUE_LOANS"}

$ curl http://localhost:3000/loans/14 -H "Authorization: Bearer $READER4"
{"id":14,"dueAt":"2026-11-01T00:00:00.000Z","renewals":0}
```

### Сценарій 8 (видача 15)

```
$ curl -i -X POST http://localhost:3000/loans/15/renew -H "Authorization: Bearer $READER4"
HTTP/1.1 409 Conflict
content-type: application/json; charset=utf-8
content-length: 24

{"code":"LIMIT_REACHED"}

$ curl http://localhost:3000/loans/15 -H "Authorization: Bearer $READER4"
{"id":15,"dueAt":"2026-11-20T00:00:00.000Z","renewals":2}
```

### Сценарій 9 (видача 16): catalog-api недоступний

Очікування зі специфікації: 503, `due_at` без змін. Клієнт catalog-api чекає 2 с без повторних спроб, тому важливо, як саме сервіс «недоступний».

Після `docker compose stop catalog-api` ім'я `catalog-api` перестає резолвитися, і запит падає одразу, без таймауту:

```
$ docker compose stop catalog-api
$ curl -s -w " time_total: %{time_total}s" -X POST http://localhost:3000/loans/16/renew -H "Authorization: Bearer $READER1"
{"code":"CATALOG_UNAVAILABLE"} time_total: 0.214550s
(ще два запуски: 0.015152s, 0.016458s)
$ docker compose exec -T abonement-api node -e "const t=Date.now();fetch('http://catalog-api:4000/health').catch(e=>console.log(Date.now()-t+'ms',e.name,e.cause.code,e.cause.message))"
51ms TypeError ENOTFOUND getaddrinfo ENOTFOUND catalog-api
```

Після `docker compose pause catalog-api` контейнер лишається в мережі, але не відповідає, і спрацьовує таймаут клієнта:

```
$ docker compose pause catalog-api
$ curl -s -w " time_total: %{time_total}s" -X POST http://localhost:3000/loans/16/renew -H "Authorization: Bearer $READER1"
{"code":"CATALOG_UNAVAILABLE"} time_total: 2.020556s
(ще два запуски: 2.018255s, 2.017652s)
$ docker compose unpause catalog-api
$ curl http://localhost:3000/loans/16 -H "Authorization: Bearer $READER1"
{"id":16,"dueAt":"2026-11-12T00:00:00.000Z","renewals":0}
```

Обидва варіанти дають 503 і `due_at` без змін. Таймаут 2 с перевіряє лише `pause`.
