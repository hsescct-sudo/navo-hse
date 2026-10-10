# NAVO HSE: رفع الموقع على Firebase

## مرة واحدة: تجهيز المشروع (10 دقايق)

1. ادخل https://console.firebase.google.com واعمل **Add project**، سمّيه مثلاً `navo-hse`.
2. **Build ← Authentication ← Get started**، وفعّل:
   - Email/Password
   - Google
3. **Build ← Firestore Database ← Create database**
   - اختار **Production mode**
   - المكان: **me-central2 (Dammam)** عشان الداتا تفضل في السعودية
4. **Project settings (الترس) ← Your apps ← Web (</>)**، سجّل App باسم NAVO، وانسخ الـ `firebaseConfig`.
5. افتح الملف `public/firebase-config.js` وحط القيم مكان `PASTE_HERE`.

## الرفع

من الـ Terminal جوه فولدر `navo-firebase`:

```
npm install -g firebase-tools
firebase login
firebase use --add        (اختار navo-hse)
firebase deploy
```

هيطلعلك لينك زي: `https://navo-hse.web.app`

## أول تشغيل (مهم)

1. **إنت أول واحد يسجّل دخول.** أول حساب بيدخل بيبقى صاحب النظام (Owner) ومش بيتغير.
2. من **Projects & access**: ضيف المشاريع، وحط لكل مشروع عدد العمال وخطة التفتيشات والزيارات الشهرية.
3. ابعت اللينك للناس. كل واحد يعمل حساب بإيميله.
4. ارجع **Projects & access**، دوّر على اسمه، اديله دور ومشاريع.

## الصلاحيات (متطبقة من السيرفر في firestore.rules)

| الدور | يقدر |
|---|---|
| HSE Admin | كل المشاريع، المشاريع والصلاحيات، مراجعة السكور كارد والـ Override |
| HSE Engineer | مشاريعه بس: بلاغات، يقفل بلاغات، Actions، تفتيشات، Activity log |
| Supervisor | مشاريعه بس: بلاغات، Actions، تفتيشات، Activity log |
| Site Worker | يبلّغ في مشاريعه ويشوفها بس |

أي حد مش متضاف على مشروع **مش هيقدر يقرا داتا المشروع ده خالص**، حتى لو فتح الكود.

## لو عدّلت حاجة بعدين
عدّل الملفات وشغّل `firebase deploy` تاني. الداتا مش بتتمسح.
