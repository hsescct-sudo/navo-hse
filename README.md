# NAVO HSE

منصة HSE: بلاغات من الموقع، Actions، تفتيشات، Activity log، وسكور كارد لكل مشروع بيتحسب أوتوماتيك من الداتا، مع مراجعة الأدمن وصلاحيات لكل مشروع.

- **الواجهة:** `public/` (موقع ثابت، مفيش Build)
- **قاعدة البيانات والدخول:** Supabase (PostgreSQL)
- **الصلاحيات:** Row Level Security في `supabase/schema.sql`، متطبقة من قاعدة البيانات نفسها

---

## 1. إعداد Supabase

1. ادخل https://supabase.com ← **New project**
   - الاسم: `navo-hse`
   - **Database password**: احفظه عندك
   - **Region**: اختار أقرب منطقة متاحة للسعودية
2. شغّل ملفات قاعدة البيانات بالترتيب التالي، كل ملف في Query منفصل في **SQL Editor**. تشغيل `schema.sql` وحده لا ينشئ كل الجداول التي يستخدمها الموقع:
   1. `supabase/schema.sql`
   2. `supabase/002_dashboards.sql`
   3. `supabase/003_clusters.sql`
   4. `supabase/004_settings.sql`
   5. `supabase/005_ai_reporting.sql`
   6. `supabase/006_hsse_dashboard.sql`
   7. `supabase/007_exec_kpis.sql`
   8. `supabase/008_workflows.sql`
   9. `supabase/017_project_locations.sql`
   10. `supabase/018_project_location_visibility.sql`
   11. `supabase/019_connected_record_links.sql`
   12. `supabase/020_sector_forms_and_rca_review.sql`
   13. ملفات `supabase/migrations/` بالترتيب الزمني من الأقدم للأحدث.
3. **Authentication ← Providers ← Email**: سيبه مفعّل
   - عطّل التسجيل العام في إعدادات Auth، وادعُ المستخدمين من لوحة Supabase.
   - ادعُ حساب مسؤول النظام المقصود، ثم بعد إنشاء الحساب شغّل الاستعلام التالي في SQL Editor مع استبدال البريد:
     ```sql
     insert into public.owner (user_id)
     select id from auth.users where lower(email) = lower('admin@example.com')
     on conflict (id) do nothing;
     ```
   - لا تمنح ملكية النظام لأول شخص يسجّل؛ المالك يجب أن يُضاف من قناة إدارية موثوقة.
4. **Project Settings ← API**: انسخ
   - **Project URL**
   - **anon public key** (المفتاح ده معمول عشان يبقى ظاهر في الموقع، والحماية من الـ RLS)
5. حطهم في `public/supabase-config.js`، أو ابعتهم لـ Claude يحطهم ويعمل Push

> ⚠️ ما تحطش ولا تبعت الـ **service_role key** لأي حد. ده مفتاح بيعدّي كل الصلاحيات.

للمشروعات الموجودة، طبّق فقط الملفات التي لم تُطبّق من القوائم أعلاه، بترتيبها. يشمل آخر تحديث إزالة تعيين المالك العام وتقييد قراءة بيانات الأشخاص والمشاريع والمراجعات حسب صلاحيات المشروع؛ لا يحذف البيانات أو المالك الحالي. بعد كل ملف، تأكد أن SQL Editor يعرض نجاح التنفيذ.

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

1. **المسؤول ينشئ حساب المالك ويدخله في جدول `owner` من SQL Editor** كما في الخطوة السابقة. لا يتحول أول حساب مسجل تلقائيًا إلى مالك.
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
