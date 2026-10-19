# دانش‌نامه جامع برنامه «تنظیم» (Tanzim)

این سند برای تحویل زمینه کامل پروژه به یک ایجنت توسعه‌دهنده دیگر تهیه شده است. مبنای آن کد فعلی مخزن در تاریخ ۱۴۰۵/۰۷/۱۲ (2026-10-04) است؛ بنابراین میان «قابلیت موجود در رابط»، «قابلیت موجود فقط در API» و «قابلیت پیش‌بینی‌شده اما ناتمام» تفاوت می‌گذارد.

## 1. تعریف محصول

«تنظیم» یک سامانه فارسی و راست‌به‌چپ برای مدیریت موجودی است که با رویکرد **offline-first** ساخته شده است. کاربر باید بتواند عملیات روزمره انبار را بدون اینترنت انجام دهد؛ داده عملیاتی روی همان دستگاه در IndexedDB نگهداری می‌شود، تصاویر محلی در OPFS ذخیره می‌شوند، تغییرات در یک outbox پایدار صف می‌شوند و بعداً با سرور FastAPI/PostgreSQL همگام می‌شوند.

سرور مرجع نهایی احراز هویت، نشست دستگاه، وضعیت حساب، نقش‌ها، اشتراک، حوزه‌های کاری، کاتالوگ مشترک و نسخه همگام‌شده داده‌هاست. PostgreSQL جای IndexedDB/OPFS را نمی‌گیرد.

فناوری‌های اصلی:

- Frontend: React 19، TypeScript، Vite، TanStack Router و Query، Radix Themes، Tailwind، React Hook Form، Zod، Dexie و Recharts.
- Backend: FastAPI، SQLAlchemy، Alembic، PostgreSQL، Pydantic، bcrypt و JWT با HS256.
- PWA: manifest، service worker، app-shell cache، نصب روی دستگاه و Background Sync در مرورگرهای پشتیبان.
- زبان و تجربه: فارسی، RTL، تاریخ/عدد با locale فارسی، responsive برای موبایل و دسکتاپ.

## 2. نقش‌ها و مدل دسترسی

دو نقش اصلی وجود دارد:

- `USER`: دسترسی‌هایش از قابلیت‌ها و محدودیت‌های طرح اشتراک می‌آید.
- `ADMIN`: تمام permissionهای مدیریتی را دارد و برای قابلیت‌ها و سقف‌های اشتراک bypass می‌شود.

Permissionهای مدیریتی سرور:

- `users.read`
- `users.manage`
- `plans.manage`
- `catalog.manage`
- `industry.manage`

فیلد قدیمی `is_admin` برای سازگاری حفظ شده و با `role` همگام می‌شود. `is_system_admin` مدیر دائمی و محافظت‌شده سیستم را مشخص می‌کند.

### مدیر دائمی سیستم

- با فرمان bootstrap و متغیر موقت `SYSTEM_ADMIN_PASSWORD` ایجاد می‌شود.
- رمز اولیه باید حداقل ۱۲ کاراکتر باشد.
- اجرای دوباره bootstrap رمز موجود را تغییر نمی‌دهد و وجود دقیقاً یک مدیر دائمی را تضمین می‌کند.
- قابل حذف، غیرفعال یا تنزل نقش نیست.
- مدیر نمی‌تواند حساب خودش را حذف/غیرفعال کند؛ مدیر غیردائمی نمی‌تواند خودش را از مدیریت تنزل دهد.

## 3. ورود، ثبت‌نام و احراز هویت

### ثبت‌نام

فرم ثبت‌نام شامل نام، نام خانوادگی، نام کاربری، شماره تماس، ایمیل اختیاری، رمز و تکرار رمز است. نام کاربری یکتا است. حساب تازه با طرح `free`، نقش `USER` و وضعیت فعال ایجاد می‌شود و همان لحظه JWT و نشست دستگاه دریافت می‌کند.

قواعد رمز در فرانت و برای تغییر رمز در بک‌اند:

- حداقل ۸ کاراکتر؛
- حداقل یک حرف بزرگ، یک حرف کوچک و یک رقم؛
- حداکثر ۷۲ بایت UTF-8، به دلیل محدودیت bcrypt؛
- تکرار رمز باید یکسان باشد.

نکته: schema ثبت‌نام بک‌اند فقط حداقل طول و سقف بایتی را الزام می‌کند، ولی فرانت رمز قوی‌تر را enforce می‌کند. schema تغییر رمز در هر دو سمت قواعد حرف بزرگ/کوچک/عدد را enforce می‌کند.

### ورود

- ورود با نام کاربری و رمز انجام می‌شود.
- حساب غیرفعال با `423 ACCOUNT_DISABLED` رد می‌شود.
- پاسخ شامل access token از نوع Bearer و مشخصات کاربر است.
- مدت پیش‌فرض JWT هفت روز (`10080` دقیقه) و قابل تنظیم است.
- token در localStorage نگهداری می‌شود و همه درخواست‌های محافظت‌شده هدر `Authorization: Bearer ...` دارند.

### اتصال نشست به دستگاه

- مرورگر یک UUID پایدار در localStorage با کلید `inventory_device_fingerprint` تولید می‌کند.
- signup/login آن را در payload می‌فرستد و درخواست‌های بعدی هدر `X-Device-Fingerprint` دارند.
- سرور علاوه بر صحت JWT، وجود نشست فعال همان کاربر/اثر انگشت و برابری token ذخیره‌شده نشست را بررسی می‌کند.
- ورود دوباره از همان دستگاه token نشست را تعویض و `last_seen` را به‌روز می‌کند.
- ورود از دستگاه جدید تابع سقف `devices` طرح است؛ مدیر سقف ندارد.
- هر درخواست authenticated زمان آخرین مشاهده نشست را ثبت می‌کند.

### خروج و تغییر رمز

- logout فقط نشست دستگاه جاری را غیرفعال و داده احراز هویت محلی را پاک می‌کند.
- تغییر رمز نیازمند رمز فعلی است؛ رمز جدید باید متفاوت باشد.
- پس از تغییر رمز، تمام نشست‌های دستگاه‌های دیگر غیرفعال می‌شوند و نشست جاری باقی می‌ماند.
- پروفایل قابل ویرایش است: نام، نام خانوادگی، نام کاربری، ایمیل و تلفن.

### رفتار مسیریابی

- `/` بر اساس وجود token به `/dashboard` یا `/auth/login` redirect می‌شود.
- کاربر دارای token از صفحات auth به dashboard هدایت می‌شود.
- layout برنامه و تنظیمات مسیر محافظت‌شده دارند.
- در حالت آفلاین، snapshot کاربر قبلی می‌تواند هویت نمایشی را نگه دارد؛ اعتبار دسترسی نوشتن جداگانه با entitlement سنجیده می‌شود.

## 4. انتخاب حوزه کاری و provisioning

هر کاربر می‌تواند یک `industry_id` داشته باشد. حوزه کاری تعیین می‌کند کدام محصولات کاتالوگ مشترک برای او provision شوند.

- کاربر از بین حوزه‌های فعال انتخاب می‌کند.
- endpoint انتخاب حوزه، حوزه را روی حساب ثبت و موجودی آن حوزه را provision می‌کند.
- محصولات فعال و مشترک کاتالوگ آن حوزه به‌صورت آیتم‌های catalog-backed وارد موجودی کاربر می‌شوند.
- برای ساخت محصول خصوصی از API محصولات، داشتن حوزه کاری الزامی است.
- مدیر می‌تواند حوزه‌ها را بسازد، ویرایش کند، فعال/غیرفعال کند و در صورت نبود وابستگی کاتالوگ حذف کند.

## 5. مدیریت موجودی و محصول

### مدل محصول

هر آیتم موجودی شامل این مفاهیم است:

- شناسه محلی/سرور و شناسه مالک؛
- ارتباط اجباری با `CatalogProduct`؛
- catalog-backed بودن یا محصول خصوصی کاربر؛
- دسته‌بندی اختیاری؛
- نام/لیبل سفارشی و یادداشت؛
- تعداد، قیمت واحد، حد هشدار و فعال بودن هشدار؛
- تصویر محلی یا URL سرور؛
- مخفی بودن، deleted/tombstone و version؛
- زمان ایجاد/ویرایش؛
- وضعیت مشتق‌شده `in_stock`، `low_stock` یا `out_of_stock`.

قاعده وضعیت:

- تعداد صفر یا کمتر: ناموجود؛
- تعداد مثبت و کمتر/مساوی حد هشدار مثبت: کم‌موجود؛
- در غیر این صورت: موجود.

مقادیر نامعتبر هنگام خواندن داده محلی sanitize می‌شوند: تعداد، قیمت و threshold منفی یا غیرعددی به مقدار امن تبدیل می‌شوند.

### افزودن و ویرایش

فرم محصول قابلیت‌های زیر را دارد:

- نام محصول یا لیبل سفارشی؛
- تعداد و قیمت به تومان؛
- دسته‌بندی؛
- یادداشت/توضیحات؛
- تصویر؛
- حد نصاب هشدار و کلید فعال‌سازی هشدار؛
- مخفی‌سازی؛
- metadata بسته‌بندی؛
- نمایش read-only تاریخ ایجاد و آخرین ویرایش در حالت edit؛
- برای مدیر، اطلاعات کاتالوگ مانند نام، برند و توضیحات نیز قابل مشاهده/کنترل است.

افزودن ابتدا در IndexedDB انجام می‌شود، بلافاصله UI را به‌روز می‌کند و عملیات `CREATE` در outbox قرار می‌گیرد. ویرایش نیز محلی و `UPDATE` صف‌شده است.

### حذف و مخفی‌سازی

- محصول خصوصی قابل حذف است؛ فایل تصویر محلی نیز پاک می‌شود و `DELETE` صف می‌شود.
- محصول catalog-backed توسط کاربر قابل حذف نیست و باید مخفی شود؛ این مانع هم در فرانت و هم سرور وجود دارد.
- سرور APIهایی برای soft delete/trash، restore، hide و force delete دارد.
- force delete محصول catalog-backed ممنوع است.
- حذف دائمی محصول کاتالوگ توسط مدیر، وابستگی‌ها و tombstoneهای sync را تراکنشی مدیریت می‌کند.

### فهرست محصولات

- جستجو در نام کاتالوگ و لیبل سفارشی؛
- فیلتر دسته‌بندی؛
- نمایش/پنهان کردن محصولات کاتالوگی؛
- مرتب‌سازی جدیدترین، قدیمی‌ترین، بیشترین/کمترین قیمت و بیشترین/کمترین تعداد؛
- سه نمای راحت، فشرده و شبکه فشرده؛
- virtual scrolling برای فهرست‌های طولانی؛
- نگهداری search، sort، category، view mode، scroll offset و anchor محصول و بازگشت به موقعیت قبلی بعد از edit؛
- preview تصویر با کلیک یا long-press؛
- placeholder در صورت نبود/خطای تصویر؛
- نمایش badge وضعیت موجودی و breakdown بسته‌ها.

### تغییر سریع موجودی

- دکمه مثبت/منفی روی کارت محصول؛
- نگه داشتن دکمه برای تکرار سریع؛
- preview تغییر و جلوگیری از موجودی منفی/عدد unsafe؛
- برای محصول بسته‌ای، انتخاب حالت «تعداد» یا «بسته»؛ هر بسته به delta واحد تبدیل می‌شود؛
- تغییر همیشه روی آخرین رکورد محلی اعمال می‌شود تا preview قدیمی مقدار جدیدتر را overwrite نکند.

## 6. بسته‌بندی محصول

بسته‌بندی metadata کاتالوگ است:

- `is_packaged` نشان می‌دهد محصول بسته‌ای عرضه می‌شود.
- `pack_size` تعداد واحد در هر بسته و یک عدد صحیح مثبت است.
- اگر بسته‌بندی خاموش باشد، `pack_size` به null تبدیل می‌شود.
- در محصولات کاتالوگ مشترک، کاربر عادی نمی‌تواند metadata بسته‌بندی را تغییر دهد؛ تحت کنترل مدیر کاتالوگ است.
- موجودی، قیمت، حد هشدار، تراکنش و آمار همیشه بر مبنای **واحد تکی** هستند.
- تعداد بسته کامل و باقی‌مانده صرفاً از تعداد واحد مشتق می‌شود.

## 7. تصاویر

### تصویر محصول

- فرمت‌های ورودی کلاینت: JPEG، PNG، WebP و AVIF.
- حداکثر ورودی محصول: ۱۲ MiB؛ resize تا 1280×1280؛ خروجی هدف حداکثر 2.5 MiB و عمدتاً WebP با کاهش تدریجی کیفیت.
- فایل پردازش‌شده در OPFS ذخیره و در IndexedDB فقط مرجع `local://...` ثبت می‌شود.
- hook نمایش، object URL می‌سازد و هنگام cleanup آن را revoke می‌کند.
- تعویض/حذف تصویر فایل قبلی را پاک می‌کند و orphan cleanup نیز وجود دارد.
- API مستقیم سرور تصاویر PNG/JPEG/WebP/AVIF/GIF تا ۵ MiB را در `/uploads` ذخیره می‌کند؛ فایل‌های upload عمومی از static mount سرو می‌شوند.

### تصویر پروفایل

- کاملاً محلی و آفلاین است و به سرور upload نمی‌شود.
- حداکثر ورودی ۶ MiB، resize تا 512×512 و خروجی حداکثر 700 KiB.
- کاربر می‌تواند فایل دلخواه، یکی از پنج آواتار کاری (انبار، فروشگاه، موجودی، تجارت، تحلیل) یا initials را انتخاب کند.
- انتخاب روی همان دستگاه است و با حساب/دستگاه دیگر sync نمی‌شود.

## 8. دسته‌بندی‌ها

- ساخت، ویرایش و حذف دسته‌بندی شخصی؛ نام در محدوده هر کاربر یکتا است.
- توضیحات اختیاری.
- stable client-generated ID برای ساخت آفلاین و idempotency.
- دسته‌ها نیز در IndexedDB و outbox ذخیره و sync می‌شوند.
- حذف دسته، ارجاع آن را از محصولات مرتبط برمی‌دارد.
- صفحه تنظیمات امکان «تازه‌سازی از سرور» با تأیید کاربر را دارد؛ فقط آنلاین.
- API آمار دسته شامل تعداد محصول و مجموع تعداد نیز وجود دارد.

## 9. داشبورد و هشدارها

داشبورد مستقیماً از وضعیت محلی محاسبه می‌شود و کارت‌های قابل کلیک زیر را دارد:

- مجموع کالاها؛
- محصولات افزوده‌شده امروز؛
- کمبود موجودی؛
- عدم موجودی؛
- ارزش موجودی (`price × quantity`)؛
- محصولات بدون تصویر؛
- محصولات بدون قیمت؛
- محصولات مخفی؛
- نیازمند خرید فوری (هشدار فعال و رسیدن به threshold).

هر کارت مسیر فهرست فیلترشده خودش را باز می‌کند. صفحه ارزش موجودی قیمت واحد، تعداد و ارزش هر ردیف را نشان می‌دهد.

پنل اعلان header، هشدارهای فعال را از داده محصول مشتق می‌کند:

- ناموجود: critical؛
- رسیدن به threshold با هشدار فعال: خرید فوری/critical؛
- low stock: warning.

محصول مخفی یا حذف‌شده اعلان ندارد. اعلان‌ها تا رفع وضعیت باقی می‌مانند و push notification سیستم‌عامل نیستند.

## 10. آفلاین، ذخیره محلی و همگام‌سازی

### ذخیره محلی

Dexie database با نام `inventory-db` شامل این tableهاست:

- `inventoryItems`
- `categories`
- `syncQueue`
- `syncMetadata`

نسخه schema فعلی ۵ است و migration برای statusهای قدیمی صف، operationId، cursor، دسته‌ها و owner user دارد. داده‌های محصول، دسته و صف به `local_user_id/ownerUserId` متصل‌اند تا کاربران یک دستگاه داده یکدیگر را نبینند.

برنامه از Storage API درخواست persistent storage می‌کند (در صورت پشتیبانی) و quota/usage را می‌تواند برآورد کند. اعطای persistence در اختیار مرورگر است.

### outbox

- هر entity در هر کاربر یک رکورد صف پایدار دارد.
- عملیات‌ها: `CREATE`، `UPDATE`، `DELETE`.
- چند update با هم merge می‌شوند؛ create سپس delete پیش از sync همدیگر را خنثی می‌کنند؛ delete غالب است؛ recreate پس از delete به update تبدیل می‌شود.
- `operationId` تا زمانی که mutation همان pending/retryable است ثابت می‌ماند تا server idempotency داشته باشد.
- mutation جدیدتر در حین request قدیمی با مقایسه `updatedAt` از حذف اشتباه محافظت می‌شود.
- retry با exponential backoff از ۵ ثانیه تا حداکثر ۵ دقیقه است.
- پس از ۵ شکست رکورد `dead_letter` می‌شود؛ خطاهای قطعی 4xx مناسب `fatal_error` می‌شوند.
- retry دستی failureها را دوباره pending می‌کند.

### push و pull

- push در batch حداکثر ۲۰۰ عملیات انجام می‌شود.
- سرور operationها را idempotent ثبت می‌کند.
- update/delete از `base_version` برای تشخیص conflict استفاده می‌کند.
- نتیجه هر عملیات یکی از `applied`، `conflict` یا `fatal_error` است.
- server change log دارای cursor و رویداد `UPSERT/DELETE` است؛ pull صفحه‌های حداکثر ۵۰۰ تغییر را تا پایان drain می‌کند.
- اولین pull، state سرور را با local reconcile می‌کند.
- تغییر محلی pending هنگام pull overwrite نمی‌شود.
- tombstone حذف سرور بر edit قدیمی محلی غلبه می‌کند و رکورد/تصویر محلی را حذف می‌کند.
- اگر منبع محصول در سرور دائماً حذف شده باشد، خطای مشخص stale mutation را از retry بی‌نهایت خارج و داده محلی را reconcile می‌کند.
- URL تصویر محلی هنگام دریافت رکورد سرور حفظ می‌شود؛ URL سرور جداگانه ثبت می‌شود.

### زمان اجرای sync

همگام‌سازی در startup، online/reconnect، focus، visible شدن صفحه، پیام Background Sync و اقدام تازه‌سازی اجرا می‌شود. engine single-flight است و اجرای همزمان دوم به promise جاری متصل می‌شود.

پیش از sync آنلاین، حساب و entitlement دوباره از سرور verify می‌شوند. اگر نوشتن مجاز نباشد، push متوقف می‌شود ولی pull خواندنی می‌تواند ادامه یابد. وضعیت header یکی از آفلاین، آنلاین، در حال همگام‌سازی، همگام، در انتظار یا خطادار است.

## 11. PWA و نصب

- manifest با نام Tanzim، زبان فارسی، RTL، `display: standalone` و start URL برابر `/dashboard`؛
- آیکن‌های معمول و maskable در 192/512؛
- دکمه و banner پیشنهاد نصب، با راهنمای fallback برای مرورگرهایی که install prompt ندارند؛
- service worker فقط در build production ثبت می‌شود؛
- app shell و assetهای manifest Vite cache می‌شوند؛ navigation در قطع شبکه به `index.html` fallback می‌کند؛
- `/api` و `/uploads` عمداً cache نمی‌شوند؛
- cache assetها cache-first است و shell هنگام نسخه جدید امن تعویض می‌شود؛
- Background Sync خودش به IndexedDB/token صفحه دسترسی نمی‌زند؛ به clientهای باز پیام می‌دهد تا engine مشترک صفحه sync را اجرا کند.

## 12. اشتراک و entitlement

قابلیت‌های تعریف‌شده:

- `inventory.read`
- `inventory.write`
- `categories.write`
- `export.local`
- `export.server`
- `backup`

طرح‌های built-in:

| طرح | سقف کالا | دستگاه | backup | انقضای پیش‌فرض |
|---|---:|---:|---|---|
| free | 50 | 1 | ندارد | بدون انقضا |
| starter | 500 | 2 | دارد | 30 روز |
| pro | 5000 | 3 | دارد | 30 روز |
| vip | نامحدود | نامحدود | دارد | 30 روز |

همه طرح‌های built-in در حال حاضر read/write/category/local export/server export دارند. قیمت starter/pro/vip در داده پیش‌فرض null است و مدیر می‌تواند آن‌ها را تنظیم کند.

### انقضا و آفلاین

- اشتراک پولی در timestamp انقضا منقضی می‌شود؛ free منقضی نمی‌شود.
- پس از انقضا فقط `inventory.read` حفظ و همه قابلیت‌های دیگر false می‌شوند.
- مدیر مستقل از اشتراک دسترسی کامل دارد.
- entitlement سرور شامل زمان سرور، زمان sync، شروع/انقضا، capabilityها و limitهاست.
- snapshot entitlement به شناسه کاربر متصل و در localStorage cache می‌شود.
- زمان آفلاین با بیشینه clock سیستم، آخرین زمان مشاهده‌شده و anchor زمان سرور/`performance.now()` محاسبه می‌شود تا rollback ساده ساعت سخت‌تر شود؛ این DRM نیست و سرور مرجع نهایی است.
- سه روز مانده به انقضا وضعیت `expiring` نمایش داده می‌شود.
- هنگام reconnect دسترسی‌های اشتراکی تا verify آنلاین gate می‌شوند؛ در قطع واقعی اتصال snapshot معتبر قبلی قابل استفاده است.
- انقضا یا غیرفعال شدن حساب IndexedDB، OPFS و صف تغییرات را پاک نمی‌کند؛ فقط دسترسی را تغییر می‌دهد.

### صفحه اشتراک

- نام و شناسه طرح، وضعیت فعال/نزدیک انقضا/منقضی/نیازمند تأیید؛
- تاریخ شروع و انقضا، زمان باقی‌مانده، قیمت؛
- capabilityهای فعال؛
- سقف کالا و دستگاه؛
- آخرین تأیید سرور؛
- توضیح ویژه مدیر و هشدار انقضا.

**خرید و درگاه پرداخت فعلاً وجود ندارد.** تمدید/تخصیص توسط مدیر انجام می‌شود.

## 13. مدیریت اشتراک توسط مدیر

- فهرست طرح‌ها با وضعیت، قیمت تومان، مدت، قابلیت‌ها و محدودیت‌ها؛
- ایجاد طرح با شناسه پایدار `[a-z0-9_-]`، نام، توضیح، قیمت، ارز، مدت روز/ماه/سال، active، feature و limit؛
- ویرایش طرح و اثر فوری بر entitlement مشترکان؛
- مشاهده مشترکان هر طرح؛
- حذف طرح سفارشی فقط وقتی مشترک ندارد؛ طرح‌های built-in حذف‌ناپذیرند؛
- inactive کردن طرح از تخصیص جدید جلوگیری می‌کند؛
- تخصیص طرح به کاربر start/expiration را خودکار از duration می‌سازد، مگر مقادیر صریح داده شوند.

## 14. مدیریت کاربران توسط مدیر

فهرست کاربران موارد زیر را نشان می‌دهد:

- هویت و اطلاعات تماس؛
- active/disabled و USER/ADMIN؛
- نشان مدیر دائمی؛
- طرح و active/expired بودن آن؛
- زمان شروع، پایان و روز باقی‌مانده؛
- تاریخ ثبت‌نام و آخرین فعالیت نشست؛
- جزئیات بیشتر در dialog.

عملیات‌ها:

- تغییر طرح؛
- اعطا/لغو نقش مدیریت؛
- غیرفعال/فعال کردن حساب؛
- حذف دائمی حساب و داده‌های وابسته.

غیرفعال‌سازی فوراً همه نشست‌های کاربر را باطل می‌کند. حذف کاربر sync operation/changeهای تاریخی وابسته را پاک، actor audit را null، audit هدف را حفظ، موجودی/داده وابسته و تصاویر upload خصوصی را حذف می‌کند.

## 15. حوزه‌ها و کاتالوگ مشترک (مدیریتی)

### حوزه کاری

- فهرست کارت‌ها با نام، توضیح و active state؛
- create/edit/delete؛
- نام trim و یکتا؛
- حذف حوزه دارای محصول کاتالوگ توسط constraint/service رد می‌شود.

### کاتالوگ

- create/edit محصول کاتالوگ با حوزه، نام، توضیح، برند، URL تصویر، بسته‌بندی و تعداد بسته؛
- جستجو در نام/برند/توضیح؛
- فیلتر حوزه و وضعیت active/archived؛
- مشاهده جزئیات؛
- archive، restore و permanent delete با dialog تأیید؛
- archive محصول را برای تخصیص جدید پنهان می‌کند؛ restore برمی‌گرداند؛
- حذف دائمی وابستگی موجودی کاربران را به‌صورت تراکنشی پاک و change/tombstone لازم را برای همگام‌سازی منتشر می‌کند؛ rollback در شکست حفظ می‌شود.

صفحات «کاربران»، «مدیریت اشتراک‌ها»، «حوزه کاری» و «کاتالوگ» در navigation فقط برای مدیر نمایش داده می‌شوند و API نیز مستقلاً permission را enforce می‌کند.

## 16. خروجی و backup

### خروجی رابط کاربری

منبع داده:

- Local: مستقیماً از IndexedDB و قابل استفاده آفلاین؛
- Server: snapshot سرور، فقط آنلاین.

scopeها:

- همه محصولات؛
- یک دسته خاص؛
- کم‌موجود و ناموجود؛
- محصولات انتخاب‌شده.

فرمت‌ها:

- CSV واقعی با BOM برای نمایش درست فارسی در Excel؛
- Excel-compatible HTML با پسوند `.xls` (OOXML واقعی نیست)؛
- چاپ/PDF از طریق print dialog مرورگر (فایل PDF مستقیم تولید نمی‌شود).

ستون‌ها: شناسه، نام، تعداد، بسته‌بندی، تعداد در بسته، قیمت، وضعیت، یادداشت و زمان به‌روزرسانی. اگر تغییر pending وجود داشته باشد UI هشدار می‌دهد خروجی local و server ممکن است متفاوت باشند.

### APIهای export

- `/export/inventory/json`
- `/export/inventory/csv`
- `/export/transactions/csv`

مالکیت user روی همه خروجی‌های سرور اعمال می‌شود.

### backup

- `GET /backup` snapshot موجودی غیرحذف‌شده کاربر را با capability `backup` می‌دهد.
- `POST /backup/restore` عمداً `501 BACKUP_RESTORE_NOT_IMPLEMENTED` است، چون ورودی snapshot/version امن ندارد.
- در UI فعلی workflow مستقل restore backup وجود ندارد.

## 17. APIهای جانبی موجود ولی نه لزوماً متصل به UI اصلی

- `/inventory`: فهرست صفحه‌بندی‌شده، trash، get/update، soft delete، transaction، hide/restore، force delete و bulk sync قدیمی.
- `/transactions`: ثبت stock-in/stock-out، تاریخچه یک محصول و تاریخچه کل کاربر.
- `/custom-products`: CRUD محصول سفارشی مستقل.
- `/products`: CRUD multipart، stats، low-stock alerts و count؛ بخشی از API آنلاین قدیمی/موازی است، در حالی که UI اصلی عملیات را از لایه offline-first و `/sync` عبور می‌دهد.
- `/dashboard`: آمار سرور؛ داشبورد فعلی فرانت آمار غنی‌تر را از IndexedDB محاسبه می‌کند.

ایجنت نباید بدون بررسی مصرف‌کننده، این endpointهای موازی را یکی فرض کند یا حذف کند.

## 18. تنظیمات ظاهری و تجربه کاربری

- تم `system`، `light` و `dark` با persistence و واکنش به تغییر تم سیستم؛
- navigation دسکتاپ و drawer موبایل؛
- header با عنوان مسیر، back، اعلان، وضعیت اتصال، نصب PWA و پروفایل/logout؛
- toast موفقیت/خطا و dialog تأیید برای عملیات حساس؛
- keyboard activation برای کارت‌ها، aria-labelها و کنترل‌های قابل فوکوس؛
- empty/loading/error state در صفحات اصلی؛
- responsive grid و فرم‌ها.

## 19. امنیت پیاده‌سازی‌شده

- hash رمز با bcrypt و salt؛ رمز plaintext ذخیره نمی‌شود.
- JWT امضاشده HS256 با expiration و secret محیطی.
- production با secret پیش‌فرض بالا نمی‌آید.
- PostgreSQL و `DATABASE_URL` اجباری‌اند؛ SQLite فقط در environment تست.
- احراز هر درخواست با JWT + نشست فعال + fingerprint + برابری token.
- RBAC و capability guard در backend، نه فقط مخفی‌سازی UI.
- tenant isolation: queryهای محصول/دسته/تراکنش با user ID محدود می‌شوند.
- validation Pydantic/Zod، جلوگیری از مقدار منفی و قواعد بسته‌بندی.
- upload با allow-list MIME، نام UUID و سقف حجم؛ حذف فایل فقط با basename از upload dir.
- CORS بر مبنای originهای پیکربندی‌شده.
- headerهای `X-Content-Type-Options: nosniff`، `X-Frame-Options: DENY`، Referrer Policy و Permissions Policy بدون camera/microphone/geolocation.
- audit log برای عملیات حساس مدیر؛ audit هدف پس از حذف کاربر باقی می‌ماند.
- Alembic migration صریح؛ startup schema را خودکار ایجاد/تغییر/seed نمی‌کند.
- حذف‌های حساس با confirmation UI و برخی عملیات کاتالوگ/کاربر به‌صورت تراکنشی.

## 20. محدودیت‌ها و مواردی که نباید به‌عنوان قابلیت موجود ادعا شوند

- پرداخت آنلاین، خرید یا تمدید خودکار وجود ندارد.
- بازیابی رمز، تأیید ایمیل/تلفن، MFA/OTP، SSO/Keycloak عملیاتی و refresh token وجود ندارد.
- restore واقعی backup پیاده‌سازی نشده است.
- اعلان‌ها محلی و داخل UI هستند؛ push notification سیستم‌عامل/ایمیل/SMS نیستند.
- تصویر پروفایل بین دستگاه‌ها sync نمی‌شود.
- Excel خروجی OOXML واقعی نیست و PDF از print dialog حاصل می‌شود.
- service worker پاسخ API یا uploads را cache نمی‌کند؛ آفلاین بودن از IndexedDB/OPFS می‌آید.
- کنترل ساعت آفلاین DRM-grade نیست و دستگاه تحت کنترل کاربر است.
- token در localStorage و token نشست در دیتابیس نگهداری می‌شود؛ HttpOnly cookie، rotation و token hashing پیاده نشده‌اند.
- rate limiting، lockout تلاش ورود و CSP در کد فعلی دیده نمی‌شود.
- static uploadها authentication ندارند و با URL قابل دریافت‌اند.
- credentialed E2E کامل، offline/reconnect واقعی مرورگر، Safari/WebKit OPFS و سفرهای کامل کاتالوگ/اشتراک هنوز ریسک تست‌شده‌نشده‌اند.
- dependency `keycloak-js` در package وجود دارد، اما جریان فعلی احراز هویت از آن استفاده نمی‌کند.

## 21. مدل‌های داده اصلی PostgreSQL

- `users`: هویت، رمز hash، نقش، وضعیت، اشتراک و حوزه.
- `user_sessions`: fingerprint، access token، active، created/last_seen.
- `categories`: دسته شخصی هر کاربر.
- `catalog_products`: محصول مرجع حوزه، shared/active، بسته‌بندی.
- `inventory_items`: موجودی متعلق به کاربر با catalog FK، version و وضعیت حذف/مخفی.
- `inventory_transactions`: stock in/out و before/after.
- `custom_products`: مدل محصول سفارشی جانبی.
- `sync_operations`: نتیجه operationهای idempotent.
- `sync_changes`: change log cursor-based.
- `subscription_plans`: ویژگی‌ها و limits به JSON.
- `admin_audit_logs`: رویدادهای مدیریتی.
- `industries`: حوزه‌های کاری.

constraintهای مهم شامل uniqueness نام دسته در user، uniqueness موجودی user/catalog، uniqueness operation ID در user و checkهای quantity/price/threshold/pack size است.

## 22. مسیرهای اصلی رابط

- `/auth/login`, `/auth/register`
- `/dashboard`
- `/dashboard/products/all|today|low-stock|out-of-stock|inventory-value|no-image|no-price|hidden|urgent-purchase`
- `/inventory/list`, `/inventory/add`, `/inventory/edit?id=...`
- `/industry` برای انتخاب حوزه کاربر
- `/setting/profile`
- `/setting/appearance`
- `/setting/categories`
- `/setting/export`
- `/setting/products` برای refresh/reconcile محلی
- `/setting/subscription`
- `/setting/industry`، `/setting/catalogs`، `/setting/users` و `/setting/subscription-management` برای مدیر

## 23. فهرست APIهای HTTP

تمام مسیرهای زیر زیر prefix `/api` هستند. به‌جز signup/login/health، همگی Bearer token و fingerprint دستگاه می‌خواهند.

| روش و مسیر | دسترسی | کارکرد |
|---|---|---|
| `GET /health` | عمومی | سلامت API و اتصال دیتابیس |
| `POST /auth/signup` | عمومی | ساخت حساب، نشست و token |
| `POST /auth/login` | عمومی | ورود و ساخت/تمدید نشست دستگاه |
| `GET /auth/me` | کاربر | مشخصات حساب جاری |
| `PATCH /auth/me` | کاربر | ویرایش پروفایل |
| `PATCH /auth/me/password` | کاربر | تغییر رمز و ابطال نشست‌های دیگر |
| `PATCH /auth/industry` | کاربر | انتخاب حوزه و provision کاتالوگ |
| `POST /auth/logout` | کاربر | غیرفعال‌کردن نشست جاری |
| `GET /plans` | کاربر | طرح‌های active قابل مشاهده |
| `GET /plans/current` | کاربر | entitlement و زمان معتبر سرور |
| `POST /sync/batch` | قابلیت write | push idempotent و version-aware |
| `GET /sync/changes` | کاربر | pull تغییرات بعد از cursor |
| `GET/POST/PATCH/DELETE /categories` | read/user یا categories.write | CRUD و فهرست دسته‌های مالک |
| `GET /categories/stats` | کاربر | آمار محصول و تعداد هر دسته |
| `GET/POST/PATCH/DELETE /products` | read یا inventory.write | CRUD آنلاین multipart و صفحه‌بندی |
| `GET /products/stats` | کاربر | آمار موجودی سرور |
| `GET /products/alerts/low-stock` | کاربر | محصولات مشمول هشدار |
| `GET /products/alerts/count` | کاربر | تعداد هشدارها |
| `GET /inventory` | کاربر | فهرست غیرمخفی/غیرحذف‌شده، صفحه 1 و limit 50 پیش‌فرض |
| `GET /inventory/trash` | کاربر | سطل حذف نرم |
| `GET/PATCH/DELETE /inventory/{id}` | کاربر/write | خواندن، ویرایش و حذف نرم |
| `POST /inventory/{id}/transaction` | write | ورود/خروج موجودی |
| `GET /inventory/{id}/transactions` | کاربر | تاریخچه آیتم |
| `PATCH /inventory/{id}/hide|restore` | write | مخفی یا بازیابی |
| `DELETE /inventory/{id}/force` | write | حذف دائمی محصول خصوصی |
| `POST /inventory/sync` | write | bulk sync قدیمی مقدار/قیمت/label/note |
| `GET/POST/PATCH/DELETE /custom-products` | user/write | CRUD مدل جانبی محصول سفارشی |
| `GET/POST /transactions/products/{id}` | user/write | تاریخچه یا ثبت تراکنش محصول |
| `GET /transactions` | کاربر | کل تراکنش‌های کاربر |
| `GET /dashboard` | کاربر | آمار خلاصه سرور |
| `GET /industries` | کاربر | حوزه‌ها |
| `POST/PATCH/DELETE /industries` | industry.manage | مدیریت حوزه |
| `GET /catalog-products` و `GET /{id}` | کاربر | کاتالوگ active، جستجو و فیلتر حوزه |
| `GET /catalog-products/archived` | catalog.manage | فهرست archive |
| `POST/PATCH /catalog-products` | catalog.manage | ساخت و ویرایش |
| `PATCH /catalog-products/{id}/archive|restore` | catalog.manage | چرخه بایگانی |
| `DELETE /catalog-products/{id}` | catalog.manage | حذف دائمی تراکنشی |
| `GET /export/inventory/json|csv` | export.server | خروجی موجودی سرور |
| `GET /export/transactions/csv` | export.server | خروجی تراکنش‌ها |
| `GET /backup` | backup | snapshot موجودی |
| `POST /backup/restore` | backup | فعلاً پاسخ 501 |
| `GET /admin/users` | users.read | کاربران و وضعیت اشتراک/فعالیت |
| `PATCH /admin/users/{id}/state|role|subscription` | users.manage | وضعیت، نقش و طرح |
| `DELETE /admin/users/{id}` | users.manage | حذف دائمی کاربر |
| `GET/POST/PATCH/DELETE /admin/plans` | plans.manage | مدیریت طرح‌ها |
| `GET /admin/plans/{id}/subscribers` | plans.manage | مشترکان طرح |
| `GET /admin/audit?limit=` | users.read | audit جدید به قدیم، limit بین 1 و 500 |

## 24. پیکربندی و اجرای سامانه

متغیرهای مهم محیطی:

- `ENVIRONMENT`: در production کنترل secret سخت‌گیرانه‌تر است.
- `SECRET_KEY`: کلید امضای JWT؛ مقدار development در production رد می‌شود.
- `ACCESS_TOKEN_EXPIRE_MINUTES`: پیش‌فرض 10080.
- `DATABASE_URL`: اجباری و باید PostgreSQL باشد، مگر تست.
- `CORS_ORIGINS`: originهای مجاز فرانت.
- `SYSTEM_ADMIN_PASSWORD`: فقط برای bootstrap مدیر دائمی و سپس باید از environment حذف شود.
- `VITE_API_URL`: آدرس API فرانت، پیش‌فرض `http://localhost:8000/api`.

راه‌اندازی محلی استاندارد: PostgreSQL با Docker Compose، migration با `alembic upgrade head`، bootstrap مدیر، سپس Uvicorn روی 8000 و Vite روی 5173. `run-dev.bat` این مسیر را برای Windows هماهنگ می‌کند. startup بک‌اند فقط readiness دیتابیس را می‌سنجد و در نبود دیتابیس fail-fast است.

## 25. نقشه کد برای ادامه توسعه

- bootstrap فرانت: `src/main.tsx`
- routeها: `src/routes`
- auth فرانت: `src/features/auth` و `src/shared/auth`
- access/RBAC/اشتراک آفلاین: `src/shared/access`
- موجودی: `src/features/app/inventory`
- داشبورد: `src/features/app/dashboard`
- تنظیمات: `src/features/setting`
- اعلان‌ها: `src/features/notifications`
- IndexedDB/OPFS/sync/PWA: `src/shared/lib/infrastructure`
- backend entry: `backend/app/main.py`
- مدل‌ها و schemaها: `backend/app/models.py`, `backend/app/schemas.py`
- API: `backend/app/routers`
- منطق دامنه: `backend/app/services`
- migration: `backend/alembic`
- تست‌ها: `tests` و `backend/tests`

## 26. قواعد حیاتی برای ایجنت بعدی

1. offline-first بودن را حفظ کند: mutation رابط باید ابتدا local و durable باشد، نه وابسته به پاسخ فوری API.
2. IndexedDB را source عملیاتی UI و PostgreSQL را authority حساب/مجوز/کاتالوگ و نسخه sync‌شده بداند.
3. هیچ write جدیدی را فقط با guard فرانت امن فرض نکند؛ backend capability/permission لازم است.
4. داده و entitlement را همیشه user-scoped نگه دارد؛ logout یا تعویض کاربر نباید داده کاربر دیگر را نمایش دهد.
5. quantity را واحد تکی نگه دارد؛ بسته فقط metadata و تبدیل نمایشی/action است.
6. محصول catalog-backed را از مسیر کاربر حذف دائمی نکند؛ hide راه عادی است.
7. operationId، version، tombstone، cursor و حفاظت mutation جدیدتر را در تغییر sync خراب نکند.
8. انقضا/disable نباید به حذف IndexedDB، OPFS یا outbox منجر شود.
9. endpointهای `/products`، `/inventory` و sync offline را بدون تحلیل migration یکپارچه نکند؛ مسیرهای موازی/legacy وجود دارند.
10. قابلیت‌های ناتمام بالا را در UI/مستندات محصول به‌عنوان آماده معرفی نکند.

## 27. وضعیت تست و اطمینان

طبق آخرین گزارش مخزن (2026-09-02):

- ۶۱ تست frontend unit/component پاس؛
- ۲۶ تست backend سریع/API پاس؛
- ۵ تست PostgreSQL/Alembic پاس؛
- lint و typecheck پاس؛
- PWA desktop/mobile Playwright پاس؛
- build در output جایگزین پاس (dist اصلی توسط process دیگری lock بوده)؛
- E2E احراز هویت credentialed به علت نبود credential اجرا نشده است.

پوشش و ریسک‌های باقیمانده در `TESTING_REPORT.md` و `TESTING_MATRIX.md` ثبت شده‌اند. قبل از تغییر sync، امنیت، کاتالوگ یا اشتراک باید تست‌های مرتبط و ترجیحاً journey واقعی offline/reconnect اجرا شوند.
