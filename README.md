# Vokabelmonster

اپلیکیشن شخصی و آفلاین یادگیری لغات آلمانی (PWA) برای آیفون.

## نصب روی آیفون
1. آدرس اپ را در **Safari** باز کنید:
   `https://farzaneh-alimhmmdi.github.io/Vokabelmonster/`
2. دکمه **Share** را بزنید و **Add to Home Screen** را انتخاب کنید.
3. همیشه از آیکون نصب‌شده روی صفحه اصلی استفاده کنید (حافظه Safari و اپ نصب‌شده جدا هستند).

## امکانات
- **Search**: جستجوی لغت در دیکشنری آلمانی (Wiktionary + MyMemory) همراه با کش آفلاین.
- **Words**: افزودن، ویرایش، حذف، تگ‌گذاری و تلفظ (`🔊`) کلمات.
- **Review**: مرور هوشمند با الگوریتم SM-2 در ۵ حالت (`Flashcard`، `Type`، `Multiple Choice`، `Cloze`، `Article`).
- **Stats**: آمار پیشرفت روزانه، Streak، نمودار ۷ روزه و کلمات دشوار.
- **Settings**: بکاپ کامل JSON/CSV و اشتراک‌گذاری لیست لغات بین دو گوشی.

## توسعه محلی
```bash
python3 -m http.server 8000
node --test tests/*.test.mjs
```
