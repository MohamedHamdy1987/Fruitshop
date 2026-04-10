-- ============================================================
-- 🥦 نظام إدارة تجارة الخضار والفواكه بالجملة
-- Schema الإنتاج الكامل — نسخة SaaS متعددة المستأجرين
-- ============================================================
-- ترتيب التنفيذ مهم جداً — نفّذ كل قسم بالترتيب
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0. Extensions المطلوبة
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- 1. جدول الشركات / المحلات (tenant isolation)
-- كل حساب يمثل شركة واحدة — المستخدمون يعملون داخل شركة
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name         text NOT NULL,
  owner_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription text DEFAULT 'trial' CHECK (subscription IN ('trial','monthly','yearly','expired')),
  trial_ends   timestamptz DEFAULT (now() + interval '14 days'),
  sub_ends     timestamptz,
  created_at   timestamptz DEFAULT now(),
  settings     jsonb DEFAULT '{}'::jsonb
);

-- ─────────────────────────────────────────────────────────────
-- 2. جدول المستخدمين الموسّع (يكمّل auth.users)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  company_id  uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  full_name   text,
  role        text DEFAULT 'worker' CHECK (role IN ('owner','admin','accountant','worker')),
  phone       text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 3. جدول الموردين
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id   uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name         text NOT NULL,
  phone        text,
  address      text,
  balance      numeric(12,2) DEFAULT 0,  -- موجب = نحن مدينون له
  notes        text,
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 4. جدول المنتجات / الكتالوج
-- منفصل عن المخزون — هذا تعريف المنتج فقط
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id      uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name            text NOT NULL,
  unit            text DEFAULT 'عداية' CHECK (unit IN ('عداية','شوال','سبت','برنيكة','صندوق خشب','كرتونة','كيلو')),
  category        text DEFAULT 'خضار' CHECK (category IN ('خضار','فاكهة','أخرى')),
  default_buy_price  numeric(10,2) DEFAULT 0,
  default_sell_price numeric(10,2) DEFAULT 0,
  low_stock_alert numeric(8,2) DEFAULT 5,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 5. جدول دفعات البضاعة الواردة (Incoming Batches)
-- كل مرة تيجي بضاعة = سجل هنا
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incoming_batches (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id      uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  product_id      uuid REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
  supplier_id     uuid REFERENCES suppliers(id) ON DELETE RESTRICT NOT NULL,
  batch_date      date DEFAULT CURRENT_DATE NOT NULL,
  quantity        numeric(10,2) NOT NULL CHECK (quantity > 0),
  remaining_qty   numeric(10,2) NOT NULL,  -- المتبقي من الدفعة دي
  buy_price       numeric(10,2) NOT NULL DEFAULT 0,
  noulon          numeric(10,2) DEFAULT 0,  -- نولون النقل
  mashal          numeric(10,2) DEFAULT 0,  -- مشال
  cost_per_unit   numeric(10,2) GENERATED ALWAYS AS (
    CASE WHEN quantity > 0 THEN (buy_price + noulon + mashal) / quantity ELSE 0 END
  ) STORED,
  carryover_from  uuid REFERENCES incoming_batches(id),  -- لو ترحيل
  notes           text,
  status          text DEFAULT 'active' CHECK (status IN ('active','sold_out','carried_over')),
  created_at      timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 6. جدول العملاء
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id   uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name         text NOT NULL,
  phone        text,
  address      text,
  balance      numeric(12,2) DEFAULT 0,  -- موجب = العميل مدين لنا
  credit_limit numeric(12,2) DEFAULT 0,
  notes        text,
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 7. جدول الفواتير
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id      uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  invoice_number  text NOT NULL,  -- رقم مولود تلقائياً: INV-2024-0001
  invoice_date    date DEFAULT CURRENT_DATE NOT NULL,
  invoice_type    text DEFAULT 'sale' CHECK (invoice_type IN ('sale','supplier')),
  customer_id     uuid REFERENCES customers(id) ON DELETE RESTRICT,
  supplier_id     uuid REFERENCES suppliers(id) ON DELETE RESTRICT,
  subtotal        numeric(12,2) DEFAULT 0,  -- المجموع قبل الخصومات
  commission_7pct numeric(12,2) DEFAULT 0,  -- عمولة 7%
  noulon_total    numeric(12,2) DEFAULT 0,
  mashal_total    numeric(12,2) DEFAULT 0,
  discount        numeric(12,2) DEFAULT 0,
  total_amount    numeric(12,2) DEFAULT 0,  -- الإجمالي بعد الخصومات
  paid_amount     numeric(12,2) DEFAULT 0,
  payment_status  text DEFAULT 'unpaid' CHECK (payment_status IN ('paid','partial','unpaid')),
  payment_method  text DEFAULT 'credit' CHECK (payment_method IN ('cash','credit','mixed')),
  notes           text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(company_id, invoice_number)
);

-- ─────────────────────────────────────────────────────────────
-- 8. جدول بنود الفاتورة
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id   uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  company_id   uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  product_id   uuid REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
  batch_id     uuid REFERENCES incoming_batches(id) ON DELETE RESTRICT,
  quantity     numeric(10,2) NOT NULL CHECK (quantity > 0),
  weight_kg    numeric(10,3) DEFAULT 0,
  unit_price   numeric(10,2) NOT NULL,
  total        numeric(12,2) GENERATED ALWAYS AS (
    CASE WHEN weight_kg > 0 THEN weight_kg * unit_price ELSE quantity * unit_price END
  ) STORED
);

-- ─────────────────────────────────────────────────────────────
-- 9. جدول المبيعات اليومية (بدلاً من tarhilLog)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_sales (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id   uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  sale_date    date DEFAULT CURRENT_DATE NOT NULL,
  customer_id  uuid REFERENCES customers(id) ON DELETE RESTRICT,
  product_id   uuid REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
  batch_id     uuid REFERENCES incoming_batches(id) ON DELETE RESTRICT,
  invoice_id   uuid REFERENCES invoices(id) ON DELETE SET NULL,
  quantity     numeric(10,2) DEFAULT 0,
  weight_kg    numeric(10,3) DEFAULT 0,
  unit_price   numeric(10,2) NOT NULL,
  total_amount numeric(12,2) NOT NULL,
  is_cash      boolean DEFAULT false,
  notes        text,
  created_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 10. جدول حركات الدفع والتحصيل
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id      uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  payment_date    date DEFAULT CURRENT_DATE NOT NULL,
  payment_type    text NOT NULL CHECK (payment_type IN ('collection','expense','supplier_payment','salary','other')),
  direction       text NOT NULL CHECK (direction IN ('in','out')),  -- in=دخل، out=خرج
  customer_id     uuid REFERENCES customers(id) ON DELETE SET NULL,
  supplier_id     uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  invoice_id      uuid REFERENCES invoices(id) ON DELETE SET NULL,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  discount_amount numeric(12,2) DEFAULT 0,
  method          text DEFAULT 'cash' CHECK (method IN ('cash','transfer','check','other')),
  reference       text,  -- رقم العملية أو الشيك
  description     text NOT NULL,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 11. جدول الموظفين
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id   uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name         text NOT NULL,
  role         text DEFAULT 'عامل',
  phone        text,
  salary       numeric(10,2) DEFAULT 0,
  hire_date    date DEFAULT CURRENT_DATE,
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 12. جدول سجل الغياب
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id   uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  employee_id  uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  absent_date  date NOT NULL,
  deduction    numeric(10,2) DEFAULT 0,
  notes        text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(employee_id, absent_date)
);

-- ─────────────────────────────────────────────────────────────
-- 13. جدول الشركاء
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partners (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id   uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name         text NOT NULL,
  phone        text,
  daily_rate   numeric(10,2) DEFAULT 0,
  profit_pct   numeric(5,2) DEFAULT 0,
  bank_account text,
  post_account text,
  vodafone_cash text,
  created_at   timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 14. جدول محلات التجزئة (shops)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shops (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id   uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name         text NOT NULL,
  phone        text,
  balance      numeric(12,2) DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 15. جدول حركات المحلات
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_transactions (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id   uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  shop_id      uuid REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  trans_date   date DEFAULT CURRENT_DATE,
  type         text CHECK (type IN ('lahu','alihi')),  -- له (أخذنا منه) / عليه (باعلنا)
  product_name text NOT NULL,
  quantity     numeric(10,2),
  weight_kg    numeric(10,3),
  unit         text,
  price        numeric(10,2),
  total        numeric(12,2) NOT NULL,
  target_name  text,  -- رُحّل إلى (عميل/موظف/شريك)
  created_at   timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 16. جدول اشتراكات SaaS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id      uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  plan            text CHECK (plan IN ('monthly','yearly')),
  amount          numeric(10,2) NOT NULL,
  payment_method  text CHECK (payment_method IN ('vodafone','instapay','bank','fawry')),
  transaction_id  text,
  extra_data      jsonb DEFAULT '{}'::jsonb,
  status          text DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  confirmed_at    timestamptz,
  confirmed_by    uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- VIEWS مفيدة
-- ─────────────────────────────────────────────────────────────

-- ملخص المخزون الحالي
CREATE OR REPLACE VIEW inventory_summary AS
SELECT
  ib.company_id,
  p.id            AS product_id,
  p.name          AS product_name,
  p.unit,
  p.category,
  p.low_stock_alert,
  s.id            AS supplier_id,
  s.name          AS supplier_name,
  ib.id           AS batch_id,
  ib.batch_date,
  ib.quantity     AS original_qty,
  ib.remaining_qty,
  ib.buy_price,
  ib.cost_per_unit,
  ib.noulon,
  ib.mashal,
  CASE WHEN ib.remaining_qty <= p.low_stock_alert THEN true ELSE false END AS is_low_stock
FROM incoming_batches ib
JOIN products  p ON ib.product_id  = p.id
JOIN suppliers s ON ib.supplier_id = s.id
WHERE ib.status = 'active';

-- ملخص حسابات العملاء
CREATE OR REPLACE VIEW customer_balances AS
SELECT
  c.company_id,
  c.id         AS customer_id,
  c.name,
  c.phone,
  c.balance    AS current_balance,
  COALESCE(SUM(CASE WHEN ds.is_cash = false THEN ds.total_amount ELSE 0 END), 0) AS total_sales,
  COALESCE(SUM(CASE WHEN p.payment_type = 'collection' THEN p.amount ELSE 0 END), 0) AS total_collected
FROM customers c
LEFT JOIN daily_sales ds ON ds.customer_id = c.id AND ds.company_id = c.company_id
LEFT JOIN payments   p  ON p.customer_id  = c.id AND p.company_id  = c.company_id
GROUP BY c.company_id, c.id, c.name, c.phone, c.balance;

-- ملخص مالي يومي
CREATE OR REPLACE VIEW daily_summary AS
SELECT
  ds.company_id,
  ds.sale_date,
  SUM(ds.total_amount)                              AS total_sales,
  SUM(CASE WHEN ds.is_cash THEN ds.total_amount ELSE 0 END)  AS cash_sales,
  SUM(CASE WHEN NOT ds.is_cash THEN ds.total_amount ELSE 0 END) AS credit_sales,
  COUNT(DISTINCT ds.customer_id)                    AS customers_count,
  COUNT(DISTINCT ds.product_id)                     AS products_count
FROM daily_sales ds
GROUP BY ds.company_id, ds.sale_date;

-- ─────────────────────────────────────────────────────────────
-- FUNCTIONS مفيدة
-- ─────────────────────────────────────────────────────────────

-- توليد رقم فاتورة تلقائي: INV-2024-0001
CREATE OR REPLACE FUNCTION generate_invoice_number(p_company_id uuid, p_type text DEFAULT 'INV')
RETURNS text AS $$
DECLARE
  v_year  text := to_char(CURRENT_DATE, 'YYYY');
  v_count int;
  v_num   text;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM invoices
  WHERE company_id = p_company_id
    AND extract(year FROM invoice_date) = extract(year FROM CURRENT_DATE);

  v_num := p_type || '-' || v_year || '-' || lpad(v_count::text, 4, '0');
  RETURN v_num;
END;
$$ LANGUAGE plpgsql;

-- تحديث رصيد العميل بعد كل عملية
CREATE OR REPLACE FUNCTION update_customer_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE customers
    SET balance = balance + NEW.total_amount
    WHERE id = NEW.customer_id AND NOT NEW.is_cash;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE customers
    SET balance = balance - OLD.total_amount
    WHERE id = OLD.customer_id AND NOT OLD.is_cash;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_customer_balance_on_sale
AFTER INSERT OR DELETE ON daily_sales
FOR EACH ROW EXECUTE FUNCTION update_customer_balance();

-- تحديث رصيد العميل عند التحصيل
CREATE OR REPLACE FUNCTION update_balance_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.payment_type = 'collection' AND NEW.customer_id IS NOT NULL THEN
      UPDATE customers SET balance = balance - NEW.amount - NEW.discount_amount
      WHERE id = NEW.customer_id;
    ELSIF NEW.payment_type = 'supplier_payment' AND NEW.supplier_id IS NOT NULL THEN
      UPDATE suppliers SET balance = balance - NEW.amount
      WHERE id = NEW.supplier_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.payment_type = 'collection' AND OLD.customer_id IS NOT NULL THEN
      UPDATE customers SET balance = balance + OLD.amount + OLD.discount_amount
      WHERE id = OLD.customer_id;
    ELSIF OLD.payment_type = 'supplier_payment' AND OLD.supplier_id IS NOT NULL THEN
      UPDATE suppliers SET balance = balance + OLD.amount
      WHERE id = OLD.supplier_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_balance_on_payment
AFTER INSERT OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION update_balance_on_payment();

-- تحديث المخزون عند البيع
CREATE OR REPLACE FUNCTION update_inventory_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.batch_id IS NOT NULL THEN
    UPDATE incoming_batches
    SET remaining_qty = remaining_qty - COALESCE(NEW.quantity, 0)
    WHERE id = NEW.batch_id;

    UPDATE incoming_batches SET status = 'sold_out'
    WHERE id = NEW.batch_id AND remaining_qty <= 0;
  ELSIF TG_OP = 'DELETE' AND OLD.batch_id IS NOT NULL THEN
    UPDATE incoming_batches
    SET remaining_qty = remaining_qty + COALESCE(OLD.quantity, 0),
        status = 'active'
    WHERE id = OLD.batch_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_inventory_on_sale
AFTER INSERT OR DELETE ON daily_sales
FOR EACH ROW EXECUTE FUNCTION update_inventory_on_sale();

-- إنشاء profile تلقائياً عند التسجيل
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id uuid;
  v_shop_name  text;
BEGIN
  v_shop_name := COALESCE(NEW.raw_user_meta_data->>'shop_name', 'محل جديد');

  INSERT INTO companies (name, owner_id)
  VALUES (v_shop_name, NEW.id)
  RETURNING id INTO v_company_id;

  INSERT INTO profiles (id, company_id, full_name, role)
  VALUES (NEW.id, v_company_id, v_shop_name, 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- INDEXES للأداء
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_incoming_batches_company_status ON incoming_batches(company_id, status);
CREATE INDEX IF NOT EXISTS idx_incoming_batches_date ON incoming_batches(company_id, batch_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_sales_date ON daily_sales(company_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_sales_customer ON daily_sales(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(company_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(company_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(company_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id, is_active);
