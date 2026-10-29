# LIB-218 — схвалений перелік кейсів

Дані юніт-кейсів: сьогодні (`clock.now()`) 03.11.2026. Статус: не почато / у роботі / зелений.

| # | Умова чи рішення | Кейс | Дані й очікування | Шар | Тест | Статус |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | умова 2 | продовження рахується від due_at | сьогодні 03.11, due_at 10.11, renewals = 0 → 200, нова due_at 24.11 | unit | `test/unit/loans/renew.test.ts` › counts the renewal from due_at, not from today | зелений |
| 2 | умова 2 | друге продовження дозволене | renewals = 1 → 200 | unit | `test/unit/loans/renew.test.ts` › allows the second renewal | зелений |
| 3 | умова 2 | ліміт продовжень | renewals = 2 → LimitReachedError (409 LIMIT_REACHED) | unit | `test/unit/loans/renew.test.ts` › rejects the third renewal with LIMIT_REACHED | зелений |
| 4 | умова 3 | бронь іншого читача | бронь читача 2 → HoldExistsError (409 HOLD_EXISTS) | unit | `test/unit/loans/renew.test.ts` › rejects when another reader holds the book | зелений |
| 5 | умова 3, рішення 3 | власна бронь не блокує | бронь читача 1 → 200 | unit | `test/unit/loans/renew.test.ts` › own hold does not block renewal | зелений |
| 6 | умова 4 | є прострочена видача | countOverdue повертає 1 → OverdueLoansError (409 OVERDUE_LOANS), extend не викликано | unit | `test/unit/loans/renew.test.ts` › rejects when the reader has an overdue loan | зелений |
| 7 | рішення 4 | порядок причин | renewals = 2 і є прострочена видача → LIMIT_REACHED | unit | | не почато |
| 8 | рішення 2 | catalog-api недоступний | activeForBook відхиляє запит (таймаут) → CatalogUnavailableError, extend не викликано | unit | | не почато |
| 9 | умова 4, рішення 1 | countOverdue проти Postgres | due_at на хвилину раніше за clock.now() → 1, на хвилину пізніше → 0; повернена прострочена видача → 0; сама видача, яку продовжують, рахується | integration | `test/integration/store/loans.repo.test.ts` › countOverdue against Postgres (3 тести) | зелений |
| 10 | правило CLAUDE.md | extend проти Postgres | due_at оновлено, renewals + 1 | integration | `test/integration/store/loans.repo.test.ts` › extend against Postgres | зелений |
| 11 | умова 5 | формат відповіді | 200 { dueAt }; 409 { code }; 503 { code: "CATALOG_UNAVAILABLE" } | API | | не почато |

Порядок проходження: спершу кейси 9 і 10 (нові запити `src/store`), потім 1–8 (`renew`), потім 11 (маршрут).
