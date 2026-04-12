# VegERP — هيكل المشروع المحدَّث

## 📁 هيكل الملفات

```
/
├── index.html                   ← الصفحة الرئيسية (محدَّثة)
├── css/
│   └── style.css                ← الأنماط (محدَّثة)
├── js/
│   ├── utils.js                 ← دوال مساعدة (محدَّثة)
│   ├── data.js                  ← الحالة المركزية + store
│   ├── api.js                   ← طبقة API الكاملة
│   ├── api_tarhil_addon.js      ← [جديد] API.tarhil + API.sales.listByBatch
│   ├── auth.js                  ← تسجيل الدخول والتسجيل
│   ├── app.js                   ← النقطة الرئيسية (محدَّثة)
│   └── renderers/
│       ├── inventory.js         ← [محدَّث] النازل + الباقي معاً
│       ├── sales.js             ← [محدَّث] workflow السوق الحقيقي
│       ├── tarhil.js            ← [محدَّث] من daily_sales مباشرة
│       ├── customers.js         ← العملاء + كشف الحساب
│       ├── suppliers.js         ← الموردون
│       ├── invoices.js          ← الفواتير
│       ├── employees.js         ← الموظفون
│       ├── partners.js          ← الشركاء
│       ├── shops.js             ← المحلات
│       ├── khazna.js            ← الخزنة
│       ├── subscription.js      ← الاشتراك
│       ├── admin.js             ← لوحة المشرف
│       └── dashboard.js         ← لوحة التحكم
```

---

## ✅ ما تغيّر

### 1. sales.js — المبيعات (الأهم)
**قبل:** كان يعمل على S.products (localStorage)
**بعد:** يعمل على `store.inv` (incoming_batches من Supabase)

- كل صف في الجدول = دفعة واحدة من `incoming_batches`
- الضغط على الصف يفتح مبيعاتها من `daily_sales`
- نموذج البيع مدمج داخل الصف مباشرة
- بعد البيع: يُحدَّث المخزون عبر DB trigger تلقائياً
- **إغلاق اليوم:** يستخدم `API.inventory.carryOver()` بدلاً من S

### 2. inventory.js — المخزون
**قبل:** كان ملف منفصل بلا علاقة بـ nazil/baqi
**بعد:** يعرض القسمين معاً في صفحة واحدة:

- **النازل:** دفعات اليوم الجديدة (`carryover_from IS NULL`)
- **الباقي:** دفعات مرحَّلة من الأيام السابقة (`carryover_from IS NOT NULL`)
- كل بطاقة لها زر "بيع" يحوّلك لصفحة المبيعات مع الدفعة مفتوحة

### 3. tarhil.js — الترحيلات
**قبل:** كان يقرأ من `S.tarhilLog` (localStorage)
**بعد:** يجلب من `daily_sales` مباشرة:

- يفلتر المبيعات الآجلة (`is_cash = false`)
- يجمعها حسب `customer_id`
- يعرض إجمالي كل عميل مع تفاصيل الأصناف
- يتيح تسجيل دفعة مباشرة من بطاقة الترحيل
- يدعم عرض ترحيلات تاريخ محدد

### 4. api_tarhil_addon.js — [جديد]
ملف صغير يضيف:
- `API.tarhil.getByDate(date)` — جلب مبيعات آجل يوم محدد
- `API.tarhil.getDayTotal(date)` — إجمالي الترحيلات
- `API.sales.listByBatch(batchId)` — مبيعات دفعة واحدة

### 5. app.js — النقطة الرئيسية
- `PAGE_RENDERS.baqi` و `PAGE_RENDERS.nazil` يشيران لـ `renderInventory`
- `showPage('baqi')` تفتح صفحة inventory
- `closeDay()` الآن في sales.js يستخدم Supabase

---

## 🗺️ تدفق البيانات

```
إضافة صنف نازل
  → API.inventory.add()
  → incoming_batches (DB)
  → store.inv يُحدَّث
  → يظهر فوراً في المخزون والمبيعات

تسجيل بيعة
  → API.sales.add()
  → daily_sales (DB)
  → DB trigger يُحدَّث remaining_qty في incoming_batches
  → DB trigger يُحدَّث balance في customers
  → store يُحدَّث من DB
  → UI يُعاد رسمه

إغلاق اليوم
  → API.inventory.carryOver() لكل دفعة متبقية
  → الدفعة القديمة تُغلق (status = 'carried_over')
  → دفعة جديدة تُنشأ بنفس البيانات (carryover_from = الدفعة القديمة)
  → تظهر في قسم "الباقي" في اليوم الجديد

الترحيل (Tarhil)
  → API.tarhil.getByDate(date)
  → daily_sales مفلترة بـ is_cash=false
  → مجمعة حسب customer_id
  → تعرض الأصناف والإجمالي لكل عميل
```

---

## ⚠️ ملاحظات للتركيب

1. ضع `api_tarhil_addon.js` بعد `api.js` مباشرة في index.html
2. لا حاجة لـ `baqi.js` أو `nazil.js` القديمين — `inventory.js` يحل محلهما
3. جدول `inventory_summary` في Supabase يجب أن يكون view يجمع:
   - `incoming_batches`
   - `products`
   - `suppliers`
   - مع حساب `remaining_qty` و `cost_per_unit`
4. الـ DB triggers مسؤولة عن تحديث:
   - `remaining_qty` بعد كل بيعة
   - `balance` في جدول `customers`

---

## 🚀 ترتيب تحميل الـ Scripts في index.html

```html
<script src="js/utils.js"></script>
<script src="js/data.js"></script>
<script src="js/api.js"></script>
<script src="js/api_tarhil_addon.js"></script>   <!-- جديد -->
<script src="js/auth.js"></script>
<script src="js/renderers/inventory.js"></script>  <!-- يحل محل baqi+nazil -->
<script src="js/renderers/sales.js"></script>
<script src="js/renderers/tarhil.js"></script>
<script src="js/renderers/customers.js"></script>
<!-- ... باقي الـ renderers -->
<script src="js/app.js"></script>
```
