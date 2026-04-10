-- ============================================================
-- RLS Policies — Row Level Security الكاملة
-- نفّذ هذا الملف بعد schema.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Helper Function: استخراج company_id من المستخدم الحالي
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS uuid AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: التحقق من الدور
CREATE OR REPLACE FUNCTION user_has_role(required_roles text[])
RETURNS boolean AS $$
  SELECT role = ANY(required_roles)
  FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- تفعيل RLS على كل الجداول
-- ─────────────────────────────────────────────────────────────
ALTER TABLE companies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE incoming_batches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance         ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners           ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops              ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions      ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- COMPANIES
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "company_select_own"
  ON companies FOR SELECT
  USING (id = get_user_company_id());

CREATE POLICY "company_update_owner"
  ON companies FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "profiles_select_same_company"
  ON profiles FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_insert_owner"
  ON profiles FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND user_has_role(ARRAY['owner','admin']));

-- ─────────────────────────────────────────────────────────────
-- SUPPLIERS — كل مستخدمي الشركة يقدروا يشوفوا، owner/admin/accountant يعدّلوا
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "suppliers_select"
  ON suppliers FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "suppliers_insert"
  ON suppliers FOR INSERT
  WITH CHECK (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin','accountant']));

CREATE POLICY "suppliers_update"
  ON suppliers FOR UPDATE
  USING (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin','accountant']));

CREATE POLICY "suppliers_delete"
  ON suppliers FOR DELETE
  USING (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin']));

-- ─────────────────────────────────────────────────────────────
-- PRODUCTS
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "products_select"
  ON products FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "products_insert"
  ON products FOR INSERT
  WITH CHECK (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin','accountant']));

CREATE POLICY "products_update"
  ON products FOR UPDATE
  USING (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin','accountant']));

CREATE POLICY "products_delete"
  ON products FOR DELETE
  USING (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin']));

-- ─────────────────────────────────────────────────────────────
-- INCOMING BATCHES
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "batches_select"
  ON incoming_batches FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "batches_insert"
  ON incoming_batches FOR INSERT
  WITH CHECK (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin','accountant','worker']));

CREATE POLICY "batches_update"
  ON incoming_batches FOR UPDATE
  USING (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin','accountant']));

CREATE POLICY "batches_delete"
  ON incoming_batches FOR DELETE
  USING (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin']));

-- ─────────────────────────────────────────────────────────────
-- CUSTOMERS
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "customers_select"
  ON customers FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "customers_insert"
  ON customers FOR INSERT
  WITH CHECK (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin','accountant','worker']));

CREATE POLICY "customers_update"
  ON customers FOR UPDATE
  USING (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin','accountant']));

CREATE POLICY "customers_delete"
  ON customers FOR DELETE
  USING (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin']));

-- ─────────────────────────────────────────────────────────────
-- INVOICES
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "invoices_select"
  ON invoices FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "invoices_insert"
  ON invoices FOR INSERT
  WITH CHECK (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin','accountant']));

CREATE POLICY "invoices_update"
  ON invoices FOR UPDATE
  USING (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin','accountant']));

CREATE POLICY "invoices_delete"
  ON invoices FOR DELETE
  USING (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin']));

-- ─────────────────────────────────────────────────────────────
-- INVOICE ITEMS
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "invoice_items_select"
  ON invoice_items FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "invoice_items_insert"
  ON invoice_items FOR INSERT
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "invoice_items_delete"
  ON invoice_items FOR DELETE
  USING (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin','accountant']));

-- ─────────────────────────────────────────────────────────────
-- DAILY SALES
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "sales_select"
  ON daily_sales FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "sales_insert"
  ON daily_sales FOR INSERT
  WITH CHECK (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin','accountant','worker']));

CREATE POLICY "sales_update"
  ON daily_sales FOR UPDATE
  USING (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin','accountant']));

CREATE POLICY "sales_delete"
  ON daily_sales FOR DELETE
  USING (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin','accountant']));

-- ─────────────────────────────────────────────────────────────
-- PAYMENTS
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "payments_select"
  ON payments FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "payments_insert"
  ON payments FOR INSERT
  WITH CHECK (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin','accountant']));

CREATE POLICY "payments_update"
  ON payments FOR UPDATE
  USING (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin']));

CREATE POLICY "payments_delete"
  ON payments FOR DELETE
  USING (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin']));

-- ─────────────────────────────────────────────────────────────
-- EMPLOYEES
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "employees_select"
  ON employees FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "employees_write"
  ON employees FOR ALL
  USING (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin']));

-- ─────────────────────────────────────────────────────────────
-- ATTENDANCE
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "attendance_select"
  ON attendance FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "attendance_write"
  ON attendance FOR ALL
  USING (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner','admin','accountant']));

-- ─────────────────────────────────────────────────────────────
-- PARTNERS, SHOPS, SHOP_TRANSACTIONS
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "partners_all"
  ON partners FOR ALL
  USING (company_id = get_user_company_id());

CREATE POLICY "shops_all"
  ON shops FOR ALL
  USING (company_id = get_user_company_id());

CREATE POLICY "shop_transactions_all"
  ON shop_transactions FOR ALL
  USING (company_id = get_user_company_id());

-- ─────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS — المستخدم يشوف اشتراكاته فقط، Super Admin يشوف الكل
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "subscriptions_select_own"
  ON subscriptions FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "subscriptions_insert"
  ON subscriptions FOR INSERT
  WITH CHECK (company_id = get_user_company_id()
    AND user_has_role(ARRAY['owner']));

-- Super Admin يشوف ويعدّل كل الاشتراكات
-- استبدل 'super-admin-uuid' بـ UUID حساب المشرف الأعلى
CREATE POLICY "subscriptions_admin_all"
  ON subscriptions FOR ALL
  USING (auth.uid() = 'super-admin-uuid'::uuid);

CREATE POLICY "subscriptions_update_status"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = 'super-admin-uuid'::uuid);
