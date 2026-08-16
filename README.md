# Vocora

Vocora is a small authenticated vocabulary-learning application built around a Leitner workflow, a normalized MySQL vocabulary library, and focused browser interactions.

## Running locally

Copy `.env.example` to `.env`, fill in the required secrets, and start the stack:

```bash
docker compose up --build
```

The application is available on the configured app port. phpMyAdmin is available on its configured port.

## Architecture

The repository is split into:

- `ui/`: browser application
- `back/`: Express API, application/domain code, and MySQL persistence

The backend uses explicit application commands/queries and normalized persistence instead of storing one JSON document per user.

## Learning-state persistence

Normal application startup uses the lean bootstrap state view:

```text
GET /api/state?view=bootstrap
```

The bootstrap contains the current vocabulary/progress required by the UI, settings, daily statistics, collection versions, and only the latest review-event tail needed for the persistence cursor. Default/null progress fields on unseen vocabulary are omitted and restored by the client hydrator. This keeps routine startup independent of the size of the historical review log.

The full authoritative state remains available explicitly:

```text
GET /api/state?view=full
```

and through the backward-compatible default `GET /api/state`. The UI requests the full view only for explicit backup/analysis exports.

State writes use an optimistic revision. Legacy full-state writes remain available for operations that genuinely replace broad state, but common learning mutations use compact commands:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/learning/vocabulary-activations` | activate one word from the word bank |
| POST | `/api/learning/vocabulary-activation-batches` | activate a small daily/home-selection batch |
| POST | `/api/learning/reviews` | persist one review result |
| PUT | `/api/state` | broad/legacy state replacement |

A successful `PUT /api/state` acknowledges only the new revision rather than echoing the entire state.

## Library API

| Method | Path | کاربرد |
|---|---|---|
| GET | `/api/library` | فهرست مجموعه‌های قابل مشاهده |
| GET | `/api/library/:id` | جزئیات مجموعه |
| POST | `/api/library/:id/subscription` | افزودن مجموعه به جعبه |
| DELETE | `/api/library/:id/subscription` | کنارگذاشتن مجموعه با حفظ progress |
| GET | `/api/library/vocabulary-sources?ids=...` | sourceهای واژه‌های درخواست‌شده‌ی کاربر |
| POST | `/api/library` | ساخت مجموعه (admin) |
| PUT | `/api/library/:id` | ویرایش مجموعه (admin) |
| POST | `/api/library/:id/import` | append/replace فایل (admin) |
| POST | `/api/library/:id/entries` | افزودن واژه (admin) |
| PUT | `/api/library/:id/entries/:entryId` | ویرایش واژه (admin) |
| DELETE | `/api/library/:id/entries/:entryId` | soft-remove واژه (admin) |

### Practice sessions

| Method | Path | کاربرد |
|---|---|---|
| POST | `/api/learning/sessions` | ثبت شروع صریح جلسه |
| PUT | `/api/learning/sessions/:id/complete` | تکمیل جلسه |
| POST | `/api/learning/sessions/:id/abandon` | انصراف از جلسه |

UI هنگام save پاسخ‌ها `X-Vocora-Session-Id` می‌فرستد تا eventهای جدید به session صحیح متصل شوند. همچنین cursor تاریخچهٔ persistشده همراه save ارسال می‌شود تا repository فقط review eventهای جدید را append کند و برای هر پاسخ کل history را دوباره پردازش نکند.

## Diagnostics

JSON API responses expose origin-side timing separately from any CDN/proxy timing:

- `Server-Timing: vocora;dur=...`
- `X-Vocora-Origin-Ms`
- `X-Vocora-Request-Bytes`

These headers make it possible to distinguish application/DB latency from network/CDN latency and to confirm the request size seen by the origin.

## Tests

```bash
cd back
npm test

cd ../ui
npm ci
npm test
```

CI additionally starts MySQL 8.4 and the full Docker stack and smoke-tests migrations, authentication, normalized persistence, compact learning mutations, library operations, and the lean startup state view.

## Progress story

Story Studio keeps the current learning behavior unchanged. The `1080 × 1920` output is generated in the browser, excludes private details such as email and typed answers, and uses the Web Share API on supported mobile browsers.
