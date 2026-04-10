# 🔐 إعداد RLS (Row Level Security) في Supabase

## لماذا RLS مهم؟

الـ `anon key` في Supabase مصمم ليكون عاماً في الـ frontend — هذا طبيعي.
الحماية الحقيقية تأتي من RLS التي تضمن أن كل مستخدم يرى ويعدّل بياناته فقط.

---

## الجداول المطلوبة

### جدول `shop_data`
```sql
CREATE TABLE shop_data (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  data       text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
```

### جدول `payments`
```sql
CREATE TABLE payments (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount         integer NOT NULL,
  method         text NOT NULL,
  transaction_id text,
  notes          text,
  status         text DEFAULT 'pending',
  confirmed_at   timestamptz,
  created_at     timestamptz DEFAULT now()
);
```

---

## تفعيل RLS

### 1. تفعيل على الجدولين
```sql
ALTER TABLE shop_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments  ENABLE ROW LEVEL SECURITY;
```

### 2. سياسات جدول `shop_data`
```sql
-- كل مستخدم يقدر يقرأ بياناته فقط
CREATE POLICY "user reads own data"
  ON shop_data FOR SELECT
  USING (auth.uid() = user_id);

-- كل مستخدم يقدر يضيف سجل باسمه فقط
CREATE POLICY "user inserts own data"
  ON shop_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- كل مستخدم يقدر يعدّل سجله فقط
CREATE POLICY "user updates own data"
  ON shop_data FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 3. سياسات جدول `payments`
```sql
-- كل مستخدم يقرأ مدفوعاته فقط
CREATE POLICY "user reads own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

-- كل مستخدم يضيف دفعة باسمه فقط
CREATE POLICY "user inserts own payment"
  ON payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- المشرف يقدر يقرأ كل المدفوعات (للوحة الإدارة)
-- استبدل 'your-admin-uuid' بالـ UUID الحقيقي لحساب المشرف
CREATE POLICY "admin reads all payments"
  ON payments FOR SELECT
  USING (
    auth.uid() = 'your-admin-uuid'::uuid
    OR auth.uid() = user_id
  );

-- المشرف يقدر يعدّل حالة المدفوعات
CREATE POLICY "admin updates payment status"
  ON payments FOR UPDATE
  USING (auth.uid() = 'your-admin-uuid'::uuid);
```

---

## كيف تطبّق هذا؟

1. افتح **Supabase Dashboard** → مشروعك
2. من القائمة الجانبية اختر **SQL Editor**
3. انسخ كل block SQL وشغّله بالترتيب:
   - أولاً: إنشاء الجداول (لو مش موجودة)
   - ثانياً: تفعيل RLS
   - ثالثاً: إضافة السياسات

---

## التحقق من أن RLS شغّال

```sql
-- يجب أن يظهر rls_enabled = true
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('shop_data', 'payments');
```

---

## ملاحظة على `upsert` في الكود

الكود يستخدم:
```js
await sb.from('shop_data').upsert(payload, { onConflict: 'user_id' });
```

لكي يعمل `upsert` بشكل صحيح مع RLS، تأكد أن عمود `user_id` عليه `UNIQUE` constraint
(موجود بالفعل في تعريف الجدول أعلاه).

