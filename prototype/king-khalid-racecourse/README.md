# King Khalid Racecourse — Scene Prototype (V2)

نموذج مستقل لمشهد ميدان الملك خالد، مبني بـ Three.js (منسوخة محلياً في `vendor/` —
بلا build وبلا إنترنت). **لا يحتوي أي منطق لعبة أو Mobile Controller.**

النسخة الحالية **V2** معاد بناؤها هندسياً وبصرياً بالمعايرة على الصورة الجوية
المرجعية. النسخة القديمة محفوظة كاملة كـ **legacy** خلف Feature Toggle.

## التشغيل

```bash
cd prototype/king-khalid-racecourse
python3 -m http.server 8000     # أو: npm start
# http://localhost:8000            → V2 (الافتراضي)
# http://localhost:8000/?variant=legacy → النسخة القديمة V1
```

- الكاميرات: أزرار الواجهة أو المفاتيح `1`–`6`
  (ReferenceMatch / TopOrthographic / AerialHero / Trackside / Grandstand / IntegrationOverview).
- **REFERENCE ALIGNMENT MODE**: زر `REF` أو مفتاح `R` — كاميرا Orthographic علوية +
  طبقة المرجع بشفافية قابلة للضبط + تحريك/تدوير/تحجيم + شبكة 50م + علامات
  Landmarks + تصدير إعدادات المحاذاة JSON. انظر `reference/README.md`.
- زر التبديل legacy/V2 في أعلى الواجهة.

## البنية

| المسار | الدور |
|---|---|
| `src/kkrc_reference_definition.js` | **مصدر الحقيقة V2**: نقاط تحكم الـ centerline (Catmull-Rom مغلق معاير على المرجع)، العروض والإزاحات، الطرق الخدمية، مناطق المباني والزراعة، تخطيط الوسط، مراسي الكاميرات والعوائق — رياضيات وبيانات صرفة |
| `src/geometry_v2.js` | أسطح V2: المضمار، مضمار التدريب، الطريق المحيطي، الامتداد (chute)، الممرات |
| `src/materials_v2.js` | خامات V2: تربة طينية دافئة متعددة المقاييس (تلوّن واسع + حبيبات + آثار تسوية + تآكل حواف) |
| `src/props_v2.js` | سياج سباق حقيقي (أعمدة + عارضتان)، نخيل بمناطق (Zones)، مبانٍ من مناطق التعريف، وسط داخلي من التعريف، أفق ناعم ومدينة غير منتظمة |
| `src/reference_overlay.js` | وضع REFERENCE ALIGNMENT |
| `src/cameras.js` | منصة الكاميرات (perspective + orthographic، تُمرَّر لها المراسي) |
| `src/environment.js` | الإضاءة النهارية (مشتركة، قابلة للضبط) |
| `src/main.js` | نقطة الدخول + التبديل legacy/V2 |
| `src/track_definition.js`, `geometry.js`, `materials.js`, `props.js` | **legacy V1** — محفوظة كما هي |
| `reference/reference_landmarks.json` | نقاط المرجع المرقمنة + تحويل صورة↔نموذج |
| `metadata/kkrc_track_metadata.json` | **Metadata V2 القابلة للنقل** (انظر أدناه) |
| `metadata/kkrc_track_metadata.v1.legacy.json` | نسخة احتياطية من metadata V1 |
| `tools/export_metadata.mjs` | مولّد الـ metadata — حتمي، `npm run export-metadata` |

## الـ Metadata (V2)

`metadata/kkrc_track_metadata.json`: نقاط التحكم والـ centerline (256 عينة)،
حدود المضمارين، حدود الطريق الخدمي وطرق الوصول، اتجاه السباق، بوابات البداية (8)،
خط النهاية، `gameplay_obstacle_anchors` (3 معتمدة: arc-length/position/tangent/
normal/rotation/takeoff/landing/رؤية الكاميرا) و`candidate_obstacle_anchors`
(8 غير معتمدة)، مراسي الكاميرات الست، مناطق المباني والزراعة، تخطيط الوسط،
والـ reference landmarks.

## نظام الإحداثيات

يمين-اليد، Y للأعلى، الأرض XZ، الوحدة متر، الأصل مركز الحلبة.
`s` = المسافة القوسية (s=0 غرب المستقيم الرئيسي الجنوبي، عكس عقارب الساعة).
`o` موجب نحو الداخل. ربط الصورة: أعلى الصورة = -X، يسار الصورة = +Z.

## الأداء (مقاس)

V2: **77 draw calls، ~55 ألف مثلث، 7 خامات نسيجية** (اللقطة الجوية) —
ضمن ميزانية &lt;120 / &lt;100k. كل المتكررات instanced.
