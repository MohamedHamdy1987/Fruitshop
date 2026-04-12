// ============================================================
// js/api.js — طبقة الـ API الكاملة
// كل عمليات قاعدة البيانات تمر من هنا فقط
// لا يوجد استدعاء Supabase مباشر خارج هذا الملف
// ============================================================

// ─────────────────────────────────────────────────────────────
// الحالة الأساسية — يُحمَّل من data.js قبل هذا الملف
// ─────────────────────────────────────────────────────────────
// sb, currentUser, AppError, syncUI — متاحة من data.js

// ─────────────────────────────────────────────────────────────
// Helper: إضافة company_id تلقائياً لكل العمليات
// ─────────────────────────────────────────────────────────────
async delete(saleId) {
  const { error } = await sb.from('daily_sales').delete().eq('id', saleId).eq('company_id', currentUser.company_id);
  if (error) throw error;
},
function withCompany(data) {
  const companyId = currentUser?.company_id;
  if (!companyId) {
    console.error('withCompany: no company_id!', currentUser);
    throw new Error('لا يوجد شركة — تأكد من تنفيذ schema.sql في Supabase Dashboard');
  }
  return { ...data, company_id: companyId };
}

// Helper: تحقق من company_id قبل أي عملية
function _requireCompany() {
  if (!currentUser?.company_id) {
    Toast.error('لا يوجد شركة مرتبطة — يرجى تسجيل الخروج والدخول مجدداً');
    throw new Error('no company_id');
  }
}

// ─────────────────────────────────────────────────────────────
// Generic CRUD — تُستخدم من كل الوحدات
// ─────────────────────────────────────────────────────────────
const API = {

  // ─── المخزون (incoming_batches) ───────────────────────────
  inventory: {
    async list() {
      const { data, error } = await sb
        .from('inventory_summary')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .order('batch_date', { ascending: false });
      if (error) throw error;
      return data;
    },

    async add(batch) {
      const payload = withCompany({
        product_id:    batch.productId,
        supplier_id:   batch.supplierId,
        batch_date:    batch.date || new Date().toISOString().slice(0,10),
        quantity:      batch.quantity,
        remaining_qty: batch.quantity,
        buy_price:     batch.buyPrice || 0,
        noulon:        batch.noulon || 0,
        mashal:        batch.mashal || 0,
        notes:         batch.notes || null,
        status:        'active'
      });
      const { data, error } = await sb.from('incoming_batches').insert(payload).select().single();
      if (error) throw error;
      return data;
    },

    async carryOver(batchId, remainingQty, newDate) {
      // إغلاق الدفعة القديمة
      await sb.from('incoming_batches')
        .update({ status: 'carried_over' })
        .eq('id', batchId);

      // استرجاع بيانات الدفعة
      const { data: old } = await sb.from('incoming_batches')
        .select('*').eq('id', batchId).single();

      // إنشاء دفعة جديدة بالمتبقي
      const { data, error } = await sb.from('incoming_batches').insert(withCompany({
        product_id:    old.product_id,
        supplier_id:   old.supplier_id,
        batch_date:    newDate,
        quantity:      remainingQty,
        remaining_qty: remainingQty,
        buy_price:     old.buy_price,
        noulon:        old.noulon,
        mashal:        old.mashal,
        carryover_from: batchId,
        status:        'active'
      })).select().single();
      if (error) throw error;
      return data;
    },

    async getLowStock() {
      const { data, error } = await sb
        .from('inventory_summary')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .eq('is_low_stock', true);
      if (error) throw error;
      return data;
    }
  },

  // ─── المبيعات ──────────────────────────────────────────────
  sales: {
    async list(date) {
      let q = sb.from('daily_sales')
        .select(`*, product:products(name,unit), customer:customers(name), batch:incoming_batches(remaining_qty)`)
        .eq('company_id', currentUser.company_id)
        .order('created_at', { ascending: false });
      if (date) q = q.eq('sale_date', date);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },

    async add(sale) {
      const payload = withCompany({
        sale_date:    sale.date || new Date().toISOString().slice(0,10),
        customer_id:  sale.customerId || null,
        product_id:   sale.productId,
        batch_id:     sale.batchId,
        invoice_id:   sale.invoiceId || null,
        quantity:     sale.quantity || 0,
        weight_kg:    sale.weightKg || 0,
        unit_price:   sale.unitPrice,
        total_amount: sale.total,
        is_cash:      sale.isCash || false,
        notes:        sale.notes || null,
        created_by:   currentUser.id
      });
      const { data, error } = await sb.from('daily_sales').insert(payload).select().single();
      if (error) throw error;
      return data;
    },

    async delete(saleId) {
      const { error } = await sb.from('daily_sales').delete().eq('id', saleId);
      if (error) throw error;
    },

    async getDailySummary(date) {
      const { data, error } = await sb
        .from('daily_summary')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .eq('sale_date', date)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  },

  // ─── العملاء ───────────────────────────────────────────────
  customers: {
    async list() {
      const { data, error } = await sb
        .from('customers')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },

    async getWithBalance() {
      const { data, error } = await sb
        .from('customer_balances')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .order('current_balance', { ascending: false });
      if (error) throw error;
      return data;
    },

    async add(cust) {
      const { data, error } = await sb.from('customers').insert(withCompany({
        name:         cust.name,
        phone:        cust.phone || null,
        address:      cust.address || null,
        balance:      cust.initialBalance || 0,
        credit_limit: cust.creditLimit || 0,
        notes:        cust.notes || null
      })).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, updates) {
      const { data, error } = await sb.from('customers')
        .update(updates).eq('id', id)
        .eq('company_id', currentUser.company_id)
        .select().single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await sb.from('customers')
        .update({ is_active: false }).eq('id', id)
        .eq('company_id', currentUser.company_id);
      if (error) throw error;
    },

    async getLedger(customerId) {
      const { data, error } = await sb
        .from('daily_sales')
        .select('sale_date,total_amount,is_cash,product:products(name),notes')
        .eq('company_id', currentUser.company_id)
        .eq('customer_id', customerId)
        .order('sale_date', { ascending: false });
      if (error) throw error;

      const { data: pData, error: pError } = await sb
        .from('payments')
        .select('payment_date,amount,discount_amount,description,payment_type')
        .eq('company_id', currentUser.company_id)
        .eq('customer_id', customerId)
        .order('payment_date', { ascending: false });
      if (pError) throw pError;

      return { sales: data, payments: pData };
    }
  },

  // ─── الموردون ──────────────────────────────────────────────
  suppliers: {
    async list() {
      const { data, error } = await sb
        .from('suppliers')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },

    async add(sup) {
      const { data, error } = await sb.from('suppliers').insert(withCompany({
        name:    sup.name,
        phone:   sup.phone || null,
        address: sup.address || null,
        balance: 0
      })).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, updates) {
      const { data, error } = await sb.from('suppliers')
        .update(updates).eq('id', id)
        .eq('company_id', currentUser.company_id)
        .select().single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await sb.from('suppliers')
        .update({ is_active: false }).eq('id', id)
        .eq('company_id', currentUser.company_id);
      if (error) throw error;
    }
  },

  // ─── المنتجات ──────────────────────────────────────────────
  products: {
    async list() {
      const { data, error } = await sb
        .from('products')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },

    async add(prod) {
      const { data, error } = await sb.from('products').insert(withCompany({
        name:               prod.name,
        unit:               prod.unit || 'عداية',
        category:           prod.category || 'خضار',
        default_buy_price:  prod.buyPrice || 0,
        default_sell_price: prod.sellPrice || 0,
        low_stock_alert:    prod.lowStockAlert || 5
      })).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, updates) {
      const { data, error } = await sb.from('products')
        .update(updates).eq('id', id)
        .eq('company_id', currentUser.company_id)
        .select().single();
      if (error) throw error;
      return data;
    }
  },

  // ─── الفواتير ──────────────────────────────────────────────
  invoices: {
    async list(type = null) {
      let q = sb.from('invoices')
        .select(`*, customer:customers(name,phone), supplier:suppliers(name), items:invoice_items(*, product:products(name,unit))`)
        .eq('company_id', currentUser.company_id)
        .order('invoice_date', { ascending: false });
      if (type) q = q.eq('invoice_type', type);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },

    async create(invoice) {
      // توليد رقم الفاتورة
      const { data: numData, error: numErr } = await sb
        .rpc('generate_invoice_number', {
          p_company_id: currentUser.company_id,
          p_type: invoice.type === 'supplier' ? 'SUP' : 'INV'
        });
      if (numErr) throw numErr;

      const { data: inv, error } = await sb.from('invoices').insert(withCompany({
        invoice_number:  numData,
        invoice_date:    invoice.date || new Date().toISOString().slice(0,10),
        invoice_type:    invoice.type || 'sale',
        customer_id:     invoice.customerId || null,
        supplier_id:     invoice.supplierId || null,
        subtotal:        invoice.subtotal,
        commission_7pct: invoice.commission || 0,
        noulon_total:    invoice.noulon || 0,
        mashal_total:    invoice.mashal || 0,
        discount:        invoice.discount || 0,
        total_amount:    invoice.total,
        paid_amount:     invoice.paidAmount || 0,
        payment_status:  invoice.paidAmount >= invoice.total ? 'paid'
                        : invoice.paidAmount > 0 ? 'partial' : 'unpaid',
        payment_method:  invoice.paymentMethod || 'credit',
        notes:           invoice.notes || null,
        created_by:      currentUser.id
      })).select().single();
      if (error) throw error;

      // إضافة بنود الفاتورة
      if (invoice.items?.length) {
        const items = invoice.items.map(item => ({
          invoice_id:  inv.id,
          company_id:  currentUser.company_id,
          product_id:  item.productId,
          batch_id:    item.batchId || null,
          quantity:    item.quantity || 0,
          weight_kg:   item.weightKg || 0,
          unit_price:  item.unitPrice
        }));
        const { error: itemErr } = await sb.from('invoice_items').insert(items);
        if (itemErr) throw itemErr;
      }

      // تحديث رصيد المورد لو كانت فاتورة مورد
      if (invoice.type === 'supplier' && invoice.supplierId) {
        await sb.from('suppliers')
          .update({ balance: sb.rpc('get_supplier_balance', { p_supplier_id: invoice.supplierId }) })
          .eq('id', invoice.supplierId);
      }

      return inv;
    },

    async updateDeductions(invId, deductions) {
      const total = (deductions.subtotal || 0) -
                    (deductions.commission || 0) -
                    (deductions.noulon || 0) -
                    (deductions.mashal || 0) -
                    (deductions.discount || 0);
      const { data, error } = await sb.from('invoices').update({
        commission_7pct: deductions.commission || 0,
        noulon_total:    deductions.noulon || 0,
        mashal_total:    deductions.mashal || 0,
        discount:        deductions.discount || 0,
        total_amount:    total
      }).eq('id', invId)
        .eq('company_id', currentUser.company_id)
        .select().single();
      if (error) throw error;
      return data;
    },

    async delete(invId) {
      const { error } = await sb.from('invoices').delete()
        .eq('id', invId)
        .eq('company_id', currentUser.company_id);
      if (error) throw error;
    }
  },

  // ─── المدفوعات والتحصيلات ──────────────────────────────────
  payments: {
    async list(date = null) {
      let q = sb.from('payments')
        .select(`*, customer:customers(name), supplier:suppliers(name)`)
        .eq('company_id', currentUser.company_id)
        .order('payment_date', { ascending: false });
      if (date) q = q.eq('payment_date', date);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },

    async addCollection(payment) {
      const { data, error } = await sb.from('payments').insert(withCompany({
        payment_date:    payment.date || new Date().toISOString().slice(0,10),
        payment_type:    'collection',
        direction:       'in',
        customer_id:     payment.customerId,
        invoice_id:      payment.invoiceId || null,
        amount:          payment.amount,
        discount_amount: payment.discount || 0,
        method:          payment.method || 'cash',
        reference:       payment.reference || null,
        description:     payment.description || 'تحصيل',
        created_by:      currentUser.id
      })).select().single();
      if (error) throw error;
      return data;
    },

    async addExpense(expense) {
      const { data, error } = await sb.from('payments').insert(withCompany({
        payment_date:  expense.date || new Date().toISOString().slice(0,10),
        payment_type:  expense.type || 'expense',
        direction:     'out',
        supplier_id:   expense.supplierId || null,
        amount:        expense.amount,
        method:        expense.method || 'cash',
        description:   expense.description,
        created_by:    currentUser.id
      })).select().single();
      if (error) throw error;
      return data;
    },

    async delete(paymentId) {
      const { error } = await sb.from('payments').delete()
        .eq('id', paymentId)
        .eq('company_id', currentUser.company_id);
      if (error) throw error;
    },

    async getDaySummary(date) {
      const { data, error } = await sb
        .from('payments')
        .select('direction, payment_type, amount, discount_amount')
        .eq('company_id', currentUser.company_id)
        .eq('payment_date', date);
      if (error) throw error;
      return data;
    }
  },

  // ─── الموظفون ──────────────────────────────────────────────
  employees: {
    async list() {
      const { data, error } = await sb
        .from('employees')
        .select(`*, absences:attendance(absent_date, deduction)`)
        .eq('company_id', currentUser.company_id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },

    async add(emp) {
      const { data, error } = await sb.from('employees').insert(withCompany({
        name:      emp.name,
        role:      emp.role || 'عامل',
        phone:     emp.phone || null,
        salary:    emp.salary || 0,
        hire_date: emp.hireDate || new Date().toISOString().slice(0,10)
      })).select().single();
      if (error) throw error;
      return data;
    },

    async addAbsence(empId, date, deduction) {
      const { data, error } = await sb.from('attendance').insert(withCompany({
        employee_id: empId,
        absent_date: date,
        deduction:   deduction || 0
      })).select().single();
      if (error) throw error;
      return data;
    },

    async deleteAbsence(absenceId) {
      const { error } = await sb.from('attendance').delete()
        .eq('id', absenceId)
        .eq('company_id', currentUser.company_id);
      if (error) throw error;
    },

    async delete(empId) {
      const { error } = await sb.from('employees')
        .update({ is_active: false }).eq('id', empId)
        .eq('company_id', currentUser.company_id);
      if (error) throw error;
    }
  },

  // ─── الشركاء ───────────────────────────────────────────────
  partners: {
    async list() {
      const { data, error } = await sb
        .from('partners')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .order('name');
      if (error) throw error;
      return data;
    },

    async add(partner) {
      const { data, error } = await sb.from('partners').insert(withCompany({
        name:          partner.name,
        phone:         partner.phone || null,
        daily_rate:    partner.dailyRate || 0,
        profit_pct:    partner.profitPct || 0,
        bank_account:  partner.bankAccount || null,
        post_account:  partner.postAccount || null,
        vodafone_cash: partner.vodafoneCash || null
      })).select().single();
      if (error) throw error;
      return data;
    }
  },

  // ─── المحلات ───────────────────────────────────────────────
  shops: {
    async list() {
      const { data, error } = await sb
        .from('shops')
        .select(`*, transactions:shop_transactions(*)`)
        .eq('company_id', currentUser.company_id)
        .order('name');
      if (error) throw error;
      return data;
    },

    async add(shop) {
      const { data, error } = await sb.from('shops').insert(withCompany({
        name:  shop.name,
        phone: shop.phone || null
      })).select().single();
      if (error) throw error;
      return data;
    },

    async addTransaction(shopId, tx) {
      const { data, error } = await sb.from('shop_transactions').insert(withCompany({
        shop_id:      shopId,
        trans_date:   tx.date || new Date().toISOString().slice(0,10),
        type:         tx.type,
        product_name: tx.productName,
        quantity:     tx.quantity || null,
        weight_kg:    tx.weightKg || null,
        unit:         tx.unit || null,
        price:        tx.price || 0,
        total:        tx.total,
        target_name:  tx.targetName || null
      })).select().single();
      if (error) throw error;
      return data;
    }
  },

  // ─── Dashboard ─────────────────────────────────────────────
  dashboard: {
    async getSummary() {
      const today = new Date().toISOString().slice(0, 10);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      const [salesRes, paymentsRes, inventoryRes, customersRes] = await Promise.all([
        sb.from('daily_summary')
          .select('*')
          .eq('company_id', currentUser.company_id)
          .gte('sale_date', thirtyDaysAgo)
          .order('sale_date', { ascending: false }),

        sb.from('payments')
          .select('direction, payment_type, amount')
          .eq('company_id', currentUser.company_id)
          .eq('payment_date', today),

        sb.from('inventory_summary')
          .select('product_name, remaining_qty, unit, is_low_stock, supplier_name')
          .eq('company_id', currentUser.company_id),

        sb.from('customers')
          .select('name, balance')
          .eq('company_id', currentUser.company_id)
          .eq('is_active', true)
          .gt('balance', 0)
          .order('balance', { ascending: false })
          .limit(5)
      ]);

      return {
        salesHistory:   salesRes.data   || [],
        todayPayments:  paymentsRes.data || [],
        inventory:      inventoryRes.data || [],
        topDebtors:     customersRes.data || []
      };
    }
  },

  // ─── إعدادات الشركة ────────────────────────────────────────
  company: {
    async getProfile() {
      const { data, error } = await sb
        .from('profiles')
        .select('*, company:companies(*)')
        .eq('id', currentUser.id)
        .maybeSingle();
      if (error) throw error;
      return data; // null لو مفيش — معالجة في loadUserProfile
    },

    async updateSettings(settings) {
      const { error } = await sb.from('companies')
        .update({ settings })
        .eq('id', currentUser.company_id);
      if (error) throw error;
    },

    async getTeam() {
      const { data, error } = await sb
        .from('profiles')
        .select('id, full_name, role, phone, is_active, created_at')
        .eq('company_id', currentUser.company_id)
        .order('role');
      if (error) throw error;
      return data;
    }
  },

  // ─── اشتراكات SaaS ─────────────────────────────────────────
  subscriptions: {
    async submit(sub) {
      const { data, error } = await sb.from('subscriptions').insert(withCompany({
        plan:           sub.plan,
        amount:         sub.amount,
        payment_method: sub.method,
        transaction_id: sub.transactionId || null,
        extra_data:     sub.extraData || {}
      })).select().single();
      if (error) throw error;
      return data;
    },

    async getAll() {
      const { data, error } = await sb
        .from('subscriptions')
        .select('*, company:companies(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    async confirm(subId, companyId, plan, endsAt) {
      await sb.from('subscriptions')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), confirmed_by: currentUser.id })
        .eq('id', subId);

      await sb.from('companies').update({
        subscription: plan,
        sub_ends:     endsAt
      }).eq('id', companyId);
    },

    async reject(subId) {
      await sb.from('subscriptions')
        .update({ status: 'rejected' })
        .eq('id', subId);
    }
  }
};

// ─────────────────────────────────────────────────────────────
// Cache بسيط في الذاكرة لتفادي طلبات متكررة
// ─────────────────────────────────────────────────────────────
const Cache = {
  _store: new Map(),
  _ttl:   60000, // مليون millisecond = دقيقة واحدة

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this._ttl) { this._store.delete(key); return null; }
    return entry.data;
  },

  set(key, data) {
    this._store.set(key, { data, ts: Date.now() });
  },

  invalidate(pattern) {
    for (const key of this._store.keys()) {
      if (key.startsWith(pattern)) this._store.delete(key);
    }
  },

  clear() { this._store.clear(); }
};

// ─────────────────────────────────────────────────────────────
// Wrapper مع Cache للـ API calls الثقيلة
// ─────────────────────────────────────────────────────────────
async function cachedAPI(key, fn, ttlOverride = null) {
  const cached = Cache.get(key);
  if (cached) return cached;
  const data = await fn();
  Cache.set(key, data);
  return data;
}
