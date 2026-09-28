# AI YouTube 🎬⚡

**Local AI Video Generator for Windows Desktop (Windows 10 / 11)**  
*Stage 1: Hardware Scanner + Arabic/English Localization*

---

## 1. نظرة عامة وهدف المشروع (Project Overview & Goal)

**AI YouTube** هو تطبيق سطح مكتب حقيقي (Native Windows Desktop Application) لنظامي التشغيل **Windows 10** و **Windows 11**، مصمم لتوليد فيديوهات بالذكاء الاصطناعي **محلياً بالكامل على جهاز المستخدم**.

يعتمد النظام بالكامل على عتاد المستخدم، وخاصة بطاقات الرسومات **NVIDIA GPU**، لتشغيل نماذج توليد الفيديو دون الحاجة إلى اشتراكات سحابية مدفوعة، أو إرسال بيانات المستخدم إلى خوادم خارجية، أو الاعتماد على Cloud APIs أثناء الاستخدام الفعلي.

> **ملاحظة معمارية**: Google AI Studio ليس جزءاً من Runtime النهائي للتطبيق، بل يتم استخدامه كمساعد تطوير أثناء تأسيس المشروع. التطبيق النهائي مصمم ليعمل كـ Standalone Windows Desktop App.

---

## 2. الوضع الحالي: المرحلة 1 (Stage 1 — Hardware Scanner + Localization)

المرحلة الحالية هي **Stage 1 فقط**:
- ✅ **فاحص عتاد حقيقي (Hardware Scanner)**: قراءة مواصفات الجهاز الفعلية بدون أي بيانات وهمية (Zero Mock Data).
  - **CPU**: الاسم الحقيقي، عدد الأنوية الفعلية والمنطقية، المعمارية، والتردد.
  - **RAM**: الذاكرة الإجمالية، المتاحة، المستخدمة، ونسبة الاستهلاك بوحدة GB.
  - **NVIDIA GPU & VRAM**: استعلام مباشر عبر `nvidia-smi` لجميع البطاقات، قياس VRAM واستهلاك المعالج وإصدار المشغل.
  - **CUDA Diagnostic**: فحص توافر CUDA للمشغّل وللبيئة البرمجية.
  - **PyTorch Diagnostic**: فحص آمن لوجود PyTorch ودعمه لـ CUDA و cuDNN بدون أي انهيار للنظام عند غيابه.
  - **FFmpeg**: فحص وجود محرك الوسائط وإصداره ومسار تنفيذه.
  - **Storage Disk**: فحص مساحة القرص لمجلد النماذج (`models/`) وتنبيه انخفاض المساحة.
- ✅ **عزل الأخطاء (Error Isolation)**: فشل أي مكوّن لا يؤثر على بقية الفحوصات.
- ✅ **نظام توطين مركزي ثنائي اللغة (i18n)**:
  - دعم كامل للغة العربية (ar) والإنجليزية (en).
  - دعم اتجاه النصوص RTL للعربية و LTR للإنجليزية بتبديل فوري.
  - حفظ اللغة المختارة في `app_config.json` و `localStorage`.
- 🚫 **لا يوجد توليد فيديو زائف (No Mock AI / No Fake Generation)**.
- 🚫 **لا توجد ميزات مستقبلية غير مطلوبة (Wan 2.1 / LTX / Model Manager مخصصة للمراحل التالية)**.

---

## 3. المعمارية الفنية (System Architecture)

```
                    ┌────────────────────────────────────────────────────────┐
                    │                   AI YouTube Desktop                   │
                    │               (Windows 10 / 11 Runtime)                │
                    └────────────────────────────────────────────────────────┘
                                                │
                        ┌───────────────────────┴───────────────────────┐
                        ▼                                               ▼
     ┌────────────────────────────────────┐          ┌────────────────────────────────────┐
     │        Electron Desktop Shell      │          │       Python Native Sidecar        │
     │  - Window & Lifecycle Management   │◄────────►│  - Hardware Diagnostics Scanner   │
     │  - Context Isolation & Sandbox     │ Loopback │  - nvidia-smi / WMI / OS APIs      │
     │  - Process Supervision             │127.0.0.1 │  - Local Loopback REST API         │
     │  - Preload IPC Bridge              │  :8765   │  - System Hardware Profile JSON    │
     └────────────────────────────────────┘          └────────────────────────────────────┘
                        │                                               │
                        ▼                                               ▼
     ┌────────────────────────────────────┐          ┌────────────────────────────────────┐
     │           React Renderer           │          │          Storage & Paths           │
     │  - Centralized i18n (ar / en)      │          │  - models/  (Weights repository)   │
     │  - RTL / LTR Dynamic Layout        │          │  - outputs/ (Rendered MP4s)        │
     │  - Live Hardware Dashboard         │          │  - logs/    (app.log, engine.log)  │
     │  - One-Click Real Rescan Trigger   │          │  - cache/   (Tensors & temp data)  │
     └────────────────────────────────────┘          └────────────────────────────────────┘
```

### دور Electron (Role of Electron)
1. **غلاف سطح المكتب (Desktop Shell)**: نافذة Windows أصلية مع شريط تحكم وإعدادات أمان متقدمة (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`).
2. **إدارة دورة حياة الـ Sidecar (Sidecar Lifecycle Manager)**:
   - بدء تشغيل خادم Python Sidecar كعملية فرعية (Child Process) عند فتح التطبيق.
   - التحقق من جاهزية المحرك (Handshake Token `AI_YOUTUBE_SIDECAR_READY` & Health Polling).
   - رصد توقف أو انهيار العملية الفرعية تلقائياً.
   - إيقاف المحرك بطريقة نظيفة (Graceful Shutdown) عند إغلاق التطبيق عبر أوامر HTTP وإشارات النظام (`SIGTERM` / `SIGINT`).
3. **جسر التواصل الآمن (Preload IPC)**: تزويد واجهة المستخدم بدوال محددة عبر `window.electronAPI` دون تعريض النظام لأي ثغرات أمنية.

### دور Python Sidecar (Role of Python Sidecar)
1. **المحرك المحلي (Core AI Engine Foundation)**:
   - نقطة الدخول الرسمية: `engine/main.py`.
   - خادم Loopback خفيف وسريع جداً يستمع حصراً على `127.0.0.1:8765` (لا يفتح أي منفذ على الشبكة الخارجية).
   - توفير واجهات RESTful محلية للاستعلام عن الحالة (`/api/status`)، الفحص الدوري (`/api/health`)، وقراءة الإعدادات (`/api/config`).
   - الأساس المستقبلي لتشغيل نماذج توليد الفيديو (Wan 2.1, LTX) وفحص العتاد وتسريع الـ Tensor.

---

## 4. هيكل مجلدات المشروع (Directory Structure)

```text
AI-YouTube/
├── app/
│   ├── electron/
│   │   ├── main.ts              # نقطة دخول Electron الرئيسية وإدارة النوافذ
│   │   ├── preload.ts           # جسر الـ ContextBridge الآمن بين Electron و React
│   │   ├── sidecar.ts           # مدير عملية الـ Python Sidecar وتشغيله ومراقبته
│   │   └── logger.ts            # مسجل أحداث تطبيق Electron إلى logs/app.log
│   └── renderer/
│       ├── components/
│       │   ├── Header.tsx           # شريط العنوان والبيانات الرأسية
│       │   ├── StatusCard.tsx       # بطاقة الحالة الأساسية (Stage 0 Indicators)
│       │   ├── DiagnosticsPanel.tsx # فحص المسارات وإعدادات الأمان
│       │   └── LogsViewer.tsx       # عارض سجلات التشغيل الحية
│       ├── pages/
│       │   └── HomePage.tsx         # صفحة الداشبورد الرئيسية للمرحلة 0
│       ├── services/
│       │   └── engineApi.ts         # خدمة الاتصال بـ Electron IPC أو Loopback API
│       ├── App.tsx                  # جذر مكونات واجهة React
│       └── main.tsx                 # نقطة تركيب React DOM
├── engine/
│   ├── api/
│   │   ├── __init__.py
│   │   └── server.py            # خادم Loopback HTTP (127.0.0.1:8765)
│   ├── hardware/
│   │   ├── __init__.py
│   │   └── scanner.py           # واجهة فحص العتاد (مجهزة لـ Stage 1)
│   ├── generation/              # حزمة توليد الفيديو (مخصصة للمراحل القادمة)
│   ├── models/                  # حزمة إدارة أوزان النماذج المحلية
│   ├── jobs/                    # حزمة طوابير المهام المحلية
│   ├── tests/
│   │   └── test_sidecar.py      # اختبارات الوحدة للـ Sidecar و Loopback API
│   ├── config.py                # قراءة الإعدادات والتحقق من أمان المسارات
│   ├── logger.py                # تسجيل أحداث المحرك إلى engine.log و error.log
│   └── main.py                  # نقطة الدخول التنفيذية لمحرك الـ Python Sidecar
├── models/                      # مجلد حفظ أوزان نماذج الـ AI المحلية (Wan 2.1 / LTX)
├── outputs/                     # مجلد حفظ الفيديوهات المولدة محلياً
├── logs/                        # مجلد السجلات (app.log, engine.log, error.log)
├── cache/                       # مجلد الملفات المؤقتة والـ Tensors
├── config/
│   └── app_config.json          # ملف إعدادات التطبيق والمسارات والـ Sidecar
├── installer/
│   └── README.md                # مواصفات حزم التثبيت لـ Windows (NSIS)
├── package.json                 # تعريف الـ Dependencies والـ Scripts
├── tsconfig.json                # إعدادات TypeScript
├── vite.config.ts               # إعدادات Vite + Tailwind CSS + Proxy
└── README.md                    # هذا الملف
```

---

## 5. قواعد الأمان المطبقة (Security Standards)

1. **Loopback Only**: خادم الـ Sidecar يرفض تماماً الارتباط بـ `0.0.0.0` ويرتبط حصراً بـ `127.0.0.1`.
2. **No Path Traversal**: آلية التحقق في `config.py` تمنع استخدام `../` أو الوصول إلى ملفات خارج مسار المشروع.
3. **No Shell Injection**: تشغيل الـ Sidecar يتم عبر `spawn` بدون `shell: true` مع تمرير المعاملات كمصفوفة آمنة.
4. **Context Isolation**: نافذة Electron تعمل مع `contextIsolation: true` و `nodeIntegration: false` مع تفعيل وضع الحماية `sandbox: true`.
5. **No Hardcoded Secrets**: لا توجد مفاتيح سرية في الكود، والاتصال محلي بدون الحاجة لمفاتيح API سحابية.

---

## 6. أوامر التشغيل والتطوير (Development Scripts)

### تثبيت الاعتماديات (Install Dependencies)
```bash
npm install
```

### تشغيل وضع التطوير العام (Dev Mode - Web Preview)
```bash
npm run dev
```

### تشغيل خادم محرك Python Sidecar منفرداً (Test Engine Sidecar)
```bash
npm run dev:sidecar
# أو عبر بايثون مباشرة:
python3 engine/main.py --host 127.0.0.1 --port 8765
```

### تشغيل اختبارات وحدة محرك الـ Sidecar (Run Engine Unit Tests)
```bash
npm run test:engine
```

### بناء التطبيق بالكامل (Full Build: Renderer + Electron)
```bash
npm run build
```
يقوم هذا الأمر ببناء:
- واجهة React في `dist/` عبر `vite build`.
- ملفات Electron Main و Preload في `dist-electron/main.cjs` و `dist-electron/preload.cjs` عبر `esbuild`.

### تجهيز الحزمة للنشر على Windows (Package for Windows)
```bash
npm run package
```

---

## 7. متطلبات بيئة التشغيل لـ Windows

- **نظام التشغيل**: Windows 10 أو Windows 11 (64-bit).
- **البيئة البرمجية**: Node.js 20+ و Python 3.10+.
- **المعالج الرسومي (للمراحل القادمة)**: بطاقة NVIDIA GPU تدعم CUDA مع 8GB+ VRAM على الأقل لتشغيل نماذج توليد الفيديو محلياً.

---

## 8. خريطة الطريق والمراحل القادمة (Roadmap)

| المرحلة | الوصف | الحالة |
|:---|:---|:---:|
| **Stage 0** | **Project Foundation** (Electron Shell + React UI + Python Sidecar Base + Logging + Safe Config) | ✅ **مكتملة** |
| **Stage 1** | **Hardware Scanner & Diagnostics** (NVIDIA GPU, CUDA, VRAM, RAM, Thermal & Compute Detection) | ⏳ قيد الانتظار |
| **Stage 2** | **Model Weight Manager & Quantization** (Local HuggingFace/Direct download, checksum verification, FP8/BF16) | ⏳ قيد الانتظار |
| **Stage 3** | **Text-to-Video Core Pipeline** (Wan 2.1 / LTX integration on local CUDA) | ⏳ قيد الانتظار |
| **Stage 4** | **Generation Queue & Job Management** (Prompt management, steps, CFG, seed, resolution, preview) | ⏳ قيد الانتظار |
| **Stage 5** | **Standalone Windows Installer & Packaging** (NSIS / Portable executable with bundled engine) | ⏳ قيد الانتظار |
