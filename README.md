# Vocora

Vocora یک اپ full-stack برای تمرین واژگان با جعبهٔ لایتنر است. حساب‌ها، کتابخانهٔ واژگان، پیشرفت کاربران و تاریخچهٔ تمرین در MySQL ذخیره می‌شوند و با ورود از دستگاه‌های مختلف قابل دسترسی‌اند.

## ساختار پروژه

```text
.
├── ui/                       # HTML, CSS, JavaScript, Login/Register/Library
├── back/
│   ├── database/
│   │   └── migrations/       # schema source of truth
│   ├── scripts/              # setup + integrity verification
│   ├── src/
│   │   ├── domain/
│   │   ├── application/      # Commands / Queries / use cases
│   │   ├── infrastructure/
│   │   └── interfaces/
│   └── tests/
├── docs/
│   └── DATABASE_ARCHITECTURE.md
├── docker-compose.yml
└── .env.example
```

Domain و Application به Express یا MySQL وابسته نیستند. Repositoryها و سرویس‌ها با dependency injection وارد use caseها می‌شوند. برای کتابخانه، readها در `LibraryQueries` و writeها در `LibraryCommands` جدا هستند؛ lifecycle جلسه نیز command مستقل دارد.

## مدل داده

Vocora محتوای مشترک را از پیشرفت هر کاربر جدا می‌کند:

- `collections`: کتاب، آزمون، موضوع، دوره یا مجموعهٔ شخصی
- `collection_sections`: ساختار سلسله‌مراتبی مثل Unit / Lesson
- `vocabulary_entries` + `vocabulary_forms`: هویت واژه و املاهای پذیرفته
- `collection_entries`: رابطهٔ many-to-many مجموعه و واژه
- `user_collections`: مجموعه‌های فعال هر کاربر
- `user_vocabulary_progress`: خانه، موعد، خطا، streak و وضعیت لایتنر هر کاربر
- `review_events`: تاریخچهٔ append-only پاسخ‌ها
- `practice_sessions`: شروع/پایان/انصراف صریح جلسه
- `user_daily_stats`: aggregate روزانه
- `user_settings`: تنظیمات پایدار
- `user_state_revisions`: optimistic concurrency برای API سازگار با UI فعلی

جدول قدیمی `learning_states` فقط برای migration/backup کاربران قدیمی نگه داشته می‌شود و state جدید در آن نوشته نمی‌شود. جزئیات، invariants و نمودار روابط در `docs/DATABASE_ARCHITECTURE.md` آمده است.

## کتابخانه

در منوی اصلی صفحهٔ «کتابخانه» وجود دارد. مجموعهٔ پیش‌فرض `1500 IELTS Listening Words` هنگام setup از فایل موجود پروژه seed می‌شود. فایل منبع دقیقاً ۱۵۰۰ ردیف شماره‌دار دارد؛ املاهای هم‌ارز مثل aliasها به یک هویت واژگانی مشترک normalize می‌شوند، بنابراین تعداد vocabulary identityهای یکتا می‌تواند کمتر از ۱۵۰۰ باشد. هر دو عدد (`sourceItemCount` و `uniqueVocabularyCount`) همراه تعداد aliasهای ادغام‌شده در metadata مجموعه ثبت و verify می‌شوند.

مدیر می‌تواند مجموعهٔ جدیدی مثل `American English File 3` بسازد، فایل MD/TXT وارد کند، مجموعه را append یا replace کند، و بعداً واژه‌ها را تک‌به‌تک اضافه/ویرایش/حذف کند.

کاربر با «افزودن به جعبه» فقط یک subscription می‌سازد؛ هزاران واژه برای او کپی نمی‌شوند. پیشرفت هم به‌صورت lazy ساخته می‌شود و حذف یک واژه از کتاب یا حذف subscription، تاریخچه و progress قبلی را نابود نمی‌کند. اگر کاربر حتی مجموعهٔ پیش‌فرض را صریحاً کنار بگذارد، saveهای بعدی learning state آن تصمیم را برنمی‌گردانند؛ فقط subscribe صریح کاربر دوباره آن را فعال می‌کند.

در صفحهٔ «واژه‌ها» ستون «مجموعه‌ها» نشان می‌دهد هر واژه از کدام کتاب/موضوع آمده است. یک واژه می‌تواند همزمان عضو چند مجموعه باشد.

### دسترسی مدیریت کتابخانه

ایمیل مدیرها را به شکل comma-separated تنظیم کنید:

```env
LIBRARY_ADMIN_EMAILS=owner@example.com,editor@example.com
```

نبودن این مقدار، مدیریت محتوای عمومی را غیرفعال می‌کند؛ استفاده و subscribe کتابخانه برای کاربران لاگین‌شده همچنان فعال است.

### فرمت فایل واژگان

```md
# American English File 3

## Unit 1
### Lesson A
1. crowded
2. centre / center

### Lesson B
3. get along with
```

Headingهای `##` تا `######` به sectionهای سلسله‌مراتبی تبدیل می‌شوند. شماره‌ها ترتیب واژه را تعیین می‌کنند. عبارت‌های جداشده با ` / ` به عنوان accepted spelling ذخیره می‌شوند. normalization و duplicate detection در Domain انجام می‌شود. پاسخ import علاوه بر تعداد اضافه/ویرایش/حذف، تعداد ردیف‌های منبع، تعداد واژه‌های یکتا و تعداد duplicate aliasهای ردشده را نیز گزارش می‌کند.

## اجرای سریع با Docker

```bash
cp .env.example .env
# DB_PASSWORD, DB_ADMIN_PASSWORD, MYSQL_ROOT_PASSWORD, JWT_SECRET
# و در صورت نیاز LIBRARY_ADMIN_EMAILS را تنظیم کنید.
docker compose up --build
```

سپس:

- برنامه: `http://localhost:3000`
- کتابخانه: `http://localhost:3000/library.html`
- phpMyAdmin: `http://localhost:8081`
- health: `http://localhost:3000/api/health`

برای توقف بدون حذف داده:

```bash
docker compose down
```

برای حذف volume و شروع کامل از صفر:

```bash
docker compose down -v
```

## Migration و setup دیتابیس

Schema از migrationهای immutable ساخته می‌شود:

```bash
cd back
npm run db:setup
```

`db:setup` اتصال MySQL را با retry برقرار می‌کند، database را می‌سازد، migrationهای جدید را با checksum اجرا می‌کند، کاربر least-privilege اپ را تنظیم می‌کند، منبع IELTS با ۱۵۰۰ ردیف را seed و normalize می‌کند، `learning_states` قدیمی را به جداول normalized migrate می‌کند و برای کاربران legacy، progress کارت‌های alias که به یک هویت مشترک رسیده‌اند را یک‌بار reconcile می‌کند.

Migration اجراشده نباید ویرایش شود؛ تغییر schema باید migration شماره‌دار جدید داشته باشد.

برای بررسی invariants دیتابیس:

```bash
cd back
npm run db:verify
```

## مهاجرت کاربران قبلی

Migration destructive نیست. JSON قبلی در `learning_states` دست‌نخورده می‌ماند و داده‌ها به مدل جدید projection می‌شوند. علاوه بر migration زمان deploy، `GET/PUT /api/state` نیز در صورت مواجهه با کاربر legacy، migration همان کاربر را انجام می‌دهد.

لغت‌های استاندارد به vocabulary عمومی map می‌شوند؛ واژه‌های دستی/import شدهٔ کاربر در یک collection خصوصی «واژه‌های من» قرار می‌گیرند. Progress، history، daily stats و settings حفظ می‌شوند.

اگر چند کارت قدیمی فقط alias املایی یکدیگر باشند و در مدل جدید به یک `vocabulary_entry` برسند، migration صرفاً last-write-wins نمی‌کند: شمارنده‌های attempts/correct/mistakes ترکیب می‌شوند، وضعیت زمان‌بندی از آخرین کارت مرورشده گرفته می‌شود، تاریخ معرفی و metadata مفید حفظ می‌شوند و نتیجه با marker idempotent ثبت می‌شود تا روی deploy بعدی دوباره جمع نشود.

## اجرای محلی بدون Docker

یک MySQL در دسترس قرار دهید و `.env` را تنظیم کنید:

```bash
cd back
npm install
npm run db:setup
npm run dev
```

Express فایل‌های `ui/` و API را از یک origin ارائه می‌کند.

## احراز هویت

- register فقط با email/password
- bcrypt hash؛ password خام ذخیره نمی‌شود
- JWT در cookie از نوع `HttpOnly` و `SameSite=Lax`
- rate limit برای login/register
- endpointهای learning/library نیازمند login هستند
- mutation محتوای کتابخانه نیازمند admin policy است

## API

### Auth / compatibility state

| Method | Path | کاربرد |
|---|---|---|
| GET | `/api/health` | healthcheck |
| POST | `/api/auth/register` | ساخت حساب |
| POST | `/api/auth/login` | ورود |
| GET | `/api/auth/me` | کاربر فعلی |
| POST | `/api/auth/logout` | خروج |
| GET | `/api/state` | projection سازگار state از مدل normalized |
| PUT | `/api/state` | ذخیرهٔ state با optimistic revision |

### Library

| Method | Path | کاربرد |
|---|---|---|
| GET | `/api/library` | فهرست مجموعه‌های قابل‌مشاهده |
| GET | `/api/library/:id` | جزئیات، sectionها و واژه‌ها |
| POST | `/api/library/:id/subscription` | افزودن مجموعه به جعبه |
| DELETE | `/api/library/:id/subscription` | کنارگذاشتن مجموعه با حفظ progress |
| GET | `/api/library/vocabulary-sources` | sourceهای واژه‌های فعال کاربر |
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

## Self-hosted text-to-speech

Vocora provides authenticated, lazy Kokoro speech generation with a persistent
content-addressed filesystem cache. See [docs/TTS.md](docs/TTS.md) for Docker,
configuration, endpoint, cache-key, voice, and verification details.

## تست‌ها

```bash
cd back
npm test

cd ../ui
npm ci
npm test
```

Browser E2E tests are disabled locally and in CI until Vocora has a dedicated,
isolated test database. See [Testing Strategy](docs/TESTING.md) for the
fail-closed policy and lower-level coverage map.

CI علاوه بر unit/API/structural tests، MySQL 8.4 و کل Docker stack را بالا می‌آورد و موارد زیر را smoke-test می‌کند:

- migration و seed دقیق ۱۵۰۰ **ردیف منبع** به catalog normalized و بررسی count واژه‌های یکتا/aliasها
- auth و normalized state persistence
- sparse/lazy progress persistence و جلوگیری از lookup/write تکراری برای همهٔ لغات در هر save
- ساخت/import یک کتاب جدید
- subscription و unsubscribe کاربر، از جمله حفظ تصمیم حذف مجموعهٔ پیش‌فرض
- حفظ progress پس از حذف و re-add واژهٔ کتاب
- اتصال review event به practice session و عدم duplicate شدن event در save مجدد
- reset پیشرفت بدون حذف audit history append-only
- reconciliation بدون اتلاف progress کارت‌های legacy alias
- عدم نوشتن state کاربران جدید در JSON legacy
- `npm run db:verify`

## استوری پیشرفت

Story Studio فعلی بدون تغییر رفتار آموزشی باقی مانده است. خروجی `1080 × 1920` در مرورگر ساخته می‌شود، اطلاعات خصوصی مثل ایمیل و پاسخ‌های تایپ‌شده روی تصویر قرار نمی‌گیرد، و در موبایل از Web Share API در صورت پشتیبانی استفاده می‌کند.


## مدیریت فایل‌محور اپیزودهای Listening

هر اپیزود یک فولدر مستقل در `back/data/listening/episodes/` دارد: اطلاعات اپیزود در `episode.json`، آزمون‌ها در `listening.json`، تصویر کاور، `audio.mp3`، `vocabulary.md` و `transcript.md`. راهنمای کاملِ ساخت اپیزود توسط AI agent، سطح درس/آزمون، تولید ZIP و قوانین همگام‌سازی در [README اپیزودها](back/data/listening/episodes/README.md) است.

پس از کپی فایل ZIP روی **سرور**، آن را داخل مسیر اپیزودها باز کنید. فایل صوتی gitignored است و با `git pull` منتقل نمی‌شود. برای هر دیپلوی، حتی تغییر صرفاً محتوایی، از دستور زیر استفاده کنید تا `db-setup` حتماً دوباره اجرا شود و محتوای جدید/تغییریافته را وارد کند:

```bash
bash scripts/deploy.sh
```

متن کامل transcript وارد دیتابیس نمی‌شود. نمونه‌های BBC در ریپازیتوری و ZIP نمایشی فقط فایل ارجاع به transcript رسمی دارند؛ برای اضافه‌کردن متن کاملِ دارای مجوز، ابزار `import-transcript` در راهنما توضیح داده شده است.
