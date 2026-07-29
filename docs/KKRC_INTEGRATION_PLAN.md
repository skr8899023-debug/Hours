# خطة دمج مشهد ميدان الملك خالد (V2) في مشروع اللعبة الرئيسي

**مصدر الدمج:** `prototype/king-khalid-racecourse/` — نسخة **V2** المعايرة على المرجع
**الحالة:** `KKRC V2 READY FOR VISUAL APPROVAL`

> ملاحظة: هذا المستودع لا يحتوي بعد على مشروع اللعبة الرئيسي. الأقسام المشيرة
> إلى "ملفات المشروع الرئيسي" قالب يُملأ بالمسارات الفعلية فور تحديد موقعه.

---

## 1. ما الذي سيُنقل

| الأصل | النوع | الاعتماديات |
|---|---|---|
| `src/kkrc_reference_definition.js` | **مصدر الحقيقة V2**: نقاط تحكم spline، محرك arc-length، عروض/إزاحات، مناطق مبانٍ وزراعة، تخطيط وسط، مراسي كاميرات وعوائق | **صفر** — رياضيات وبيانات صرفة |
| `metadata/kkrc_track_metadata.json` | Metadata v2 جاهزة الاستهلاك (لأي محرك) | صفر — JSON |
| `reference/reference_landmarks.json` | نقاط المعايرة + تحويل صورة↔نموذج | صفر |
| `src/geometry_v2.js` | أسطح: مضماران + chute + طرق + ممرات | Three.js + التعريف |
| `src/materials_v2.js` | خامات إجرائية متعددة المقاييس | Three.js |
| `src/props_v2.js` | سياج/نخيل/مبانٍ/وسط/أفق (instanced) | Three.js + geometry_v2 + التعريف |
| `src/environment.js` | إضاءة نهارية معلمّة | Three.js |
| `src/cameras.js` | منصة كاميرات (perspective+ortho) تستقبل المراسي | Three.js + OrbitControls |
| `src/reference_overlay.js` | أداة معايرة (اختيارية للنقل — مفيدة كأداة تطوير) | Three.js |
| `tools/export_metadata.mjs` | إعادة توليد حتمية للـ metadata | Node |

**لن يُنقل:** `index.html`، `main.js`، `vendor/`، وملفات legacy V1
(`track_definition.js`, `geometry.js`, `materials.js`, `props.js`,
`metadata/kkrc_track_metadata.v1.legacy.json`) — تبقى في النموذج للمقارنة فقط.

## 2. كيف سيُنقل

1. **مشروع Three.js/JS**: تُنسخ وحدات V2 إلى `<main>/scenes/kkrc/` ويستدعي
   مشهد اللعبة `buildSurfaces(materials)` + `buildPropsV2(materials)` +
   `setupEnvironment(scene, opts)`، والكاميرات من `CAMERA_ANCHORS` الست.
2. **محرك آخر**: يُستهلك JSON الـ metadata مباشرة — يحمل نقاط التحكم
   والـ centerline المعيّنة وكل الحدود والمناطق بالمتر وبنظام إحداثيات موثق.
3. **منطق السباق** يقرأ حصراً من الـ metadata:
   - الحركة: `centerline` + `track_boundaries.main_track.lane_center_offsets`
   - البداية/النهاية: `start_points.gates` (8) و`finish_line`
   - الحواجز: `gameplay_obstacle_anchors` **الثلاث المعتمدة فقط** (كل مرساة:
     arc_length, position, tangent, normal, obstacle_rotation_y, takeoff_point,
     landing_point, safe_camera_visibility) — أما `candidate_obstacle_anchors`
     فليست نقاط لعب حتى تُعتمد يدوياً.
   - كاميرات البث: `camera_anchors` (بما فيها `referenceMatch` و`integrationOverview`).
4. **Mobile Controller** يُربط آخر خطوة عبر إحداثي (s, o) — الدوال
   `pointAt/offsetPointAt/placementAt` جاهزة في ملف التعريف.
5. أي معايرة لاحقة للشكل = تحريك `CONTROL_POINTS` (أو ثوابت العروض) ثم
   `npm run export-metadata` — كل الهندسة والـ metadata تشتق تلقائياً.

## 3. الملفات المتأثرة في المشروع الرئيسي (قالب)

| الملف/المسار المتوقع | التغيير |
|---|---|
| `<main>/scenes/kkrc/` | إضافة وحدات V2 |
| سجل المشاهد | تسجيل مشهد KKRC-V2 |
| إعداد الحلبات | الإشارة إلى `kkrc_track_metadata.json` (version: 2) |
| نظام الحواجز | القراءة من `gameplay_obstacle_anchors` (3) |
| نظام الكاميرات | استهلاك المراسي الست |
| نظام السباق/الحركة | القراءة من centerline/gates/finish |
| `package.json` | لا جديد إن وُجد three؛ وإلا إضافة `three@0.160` |

## 4. المخاطر

| الخطر | الأثر | التخفيف |
|---|---|---|
| اختلاف نظام إحداثيات اللعبة | انقلاب/تحجيم خاطئ | النظام موثق داخل JSON؛ مصفوفة تحويل واحدة تُختبر بنقطتي البداية/النهاية والـ landmarks |
| اختلاف نسخة Three.js | كسر API (ألوان/إضاءة r150–r160) | الوحدات على r160؛ مراجعة colorSpace/toneMapping/lights عند الدمج |
| تعديل الشكل دون إعادة تصدير | تباعد المرئي عن المنطقي | مصدر واحد + تصدير حتمي (تحقق مرتين بلا فرق)؛ يوصى بخطوة CI |
| افتراض أن الأبعاد مساحية | فروق عن الميدان الحقيقي | موثق صراحة أنها بصرية؛ المعايرة عبر REFERENCE ALIGNMENT MODE عند توفر قياسات |
| ميزانية موبايل أضيق | هبوط FPS | مقاس 77 calls/55k tris؛ خفض جاهز عبر ثوابت المناطق (نخيل/شجيرات/مدينة) وتعطيل الظلال |
| اعتماد اللعبة على مراسي V1 القديمة | كسر مواضع | metadata V1 محفوظة في `kkrc_track_metadata.v1.legacy.json` للمقارنة والترحيل التدريجي |
| استخدام المرشحات كنقاط لعب | حواجز في مواضع غير آمنة للكاميرا | مفصولة صراحة تحت `candidate_obstacle_anchors` مع `safe_camera_visibility: false` |

## 5. خطوات الدمج

1. تثبيت مسارات المشروع الرئيسي في جدول القسم 3.
2. نقل `kkrc_reference_definition.js` + `kkrc_track_metadata.json` أولاً وربط منطق السباق بها (يكفي لبدء العمل قبل المرئيات).
3. نقل وحدات المرئيات V2 وإنشاء ملف تجميع للمشهد داخل اللعبة (مكافئ `main.js` بلا HUD وبلا وضع المحاذاة).
4. مطابقة بصرية ضد لقطات `reports/kkrc-v2/` (نفس المراسي الست = مقارنة مباشرة).
5. اختبار لفة كاملة لكيان اختباري على `centerline` والتحقق من البوابات وخط النهاية والمراسي الثلاث.
6. ربط طور الحواجز بالمراسي الثلاث المعتمدة واختبار رؤية الكاميرا فعلياً.
7. ربط Mobile Controller (أخيراً).
8. قياس الأداء على الجهاز المستهدف؛ الخفض عبر ثوابت المناطق عند الحاجة.

## 6. معيار القبول

- تطابق بصري مع لقطات V2 الست.
- لفة كاملة سليمة + توقف صحيح عند خط النهاية.
- الحواجز الثلاثة مرئية بالكامل من كاميرات اللعب.
- FPS مستقر على الجهاز المستهدف ضمن ميزانية ≤120 draw calls.
