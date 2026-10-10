# NAVO HSE

منصة HSE: بلاغات من الموقع، Actions، تفتيشات، Activity log، وسكور كارد لكل مشروع بيتحسب أوتوماتيك من الداتا، مع مراجعة الأدمن وصلاحيات لكل مشروع.

- **الواجهة:** `public/` (موقع ثابت، مفيش Build)
- **قاعدة البيانات والدخول:** Supabase (PostgreSQL)
- **الصلاحيات:** Row Level Security في `supabase/schema.sql`، متطبقة من قاعدة البيانات نفسها

---

## 1. Supabase (مرة واحدة، 10 دقايق)

1. ادخل https://supabase.com ← **New project**
   - الاسم: `navo-hse`
   - **Database password**: احفظه عندك
   - **Region**: اختار أقرب منطقة متاحة للسعودية
2. **SQL Editor ← New query**: الصق محتوى `supabase/schema.sql` كله ← **Run**
3. **Authentication ← Providers ← Email**: سيبه مفعّل
   - للتجربة بس: تقدر تقفل **Confirm email** عشان الناس تدخل على طول من غير إيميل تأكيد
4. **Project Settings ← API**: انسخ
   - **Project URL**
   - **anon public key** (المفتاح ده معمول عشان يبقى ظاهر في الموقع، والحماية من الـ RLS)
5. حطهم في `public/supabase-config.js`، أو ابعتهم لـ Claude يحطهم ويعمل Push

> ⚠️ ما تحطش ولا تبعت الـ **service_role key** لأي حد. ده مفتاح بيعدّي كل الصلاحيات.

## 2. رفع الموقع (مجاني، 5 دقايق)

أي واحد من دول، كلهم بيتربطوا بالـ Repo ويرفعوا أوتوماتيك مع كل Push:

**Cloudflare Pages** (الأسهل):
1. https://dash.cloudflare.com ← **Workers & Pages ← Create ← Pages ← Connect to Git**
2. اختار `hsescct-sudo/navo-hse`
3. **Build command**: سيبه فاضي ← **Build output directory**: `public`
4. **Save and Deploy** ← هيديك لينك زي `navo-hse.pages.dev`

(أو **Vercel**: Import ← Framework: Other ← Output directory: `public`)

بعد ما ياخد اللينك: في Supabase ← **Authentication ← URL Configuration ← Site URL** حط لينك الموقع (عشان إيميلات تأكيد الحساب ونسيت الباسورد ترجع للموقع الصح).

## 3. أول تشغيل

1. **إنت أول واحد يعمل حساب ويدخل.** أول حساب بيبقى صاحب النظام (Owner) ومش بيتغير.
2. **Projects & access**: ضيف المشاريع، وحط لكل مشروع عدد العمال وخطة التفتيشات والزيارات الشهرية.
3. ابعت اللينك للناس، كل واحد يعمل حساب.
4. ارجع **Projects & access**، دوّر على اسمه، واديله دور ومشاريع.

## الصلاحيات

| الدور | يقدر |
|---|---|
| Owner / HSE Admin | كل المشاريع، المشاريع والصلاحيات، مراجعة السكور كارد والـ Override |
| HSE Engineer | مشاريعه: بلاغات، يقفل بلاغات، Actions، تفتيشات، Activity log |
| Supervisor | مشاريعه: بلاغات، Actions، تفتيشات، Activity log |
| Site Worker | يبلّغ في مشاريعه ويشوف بلاغاتها |

اللي مش متضاف على مشروع **مايقدرش يقرا ولا يكتب** في داتا المشروع ده، حتى لو استخدم الـ API مباشرة.

## التعديلات بعد كده
أي Push على `main` بيتنشر على الموقع لوحده. الداتا في Supabase مش بتتأثر.
