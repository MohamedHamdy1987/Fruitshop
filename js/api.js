// ============================================================
// js/api.js — نظام الوسيط (Commission-based)
// لا شراء، لا بيع بسعر مدخل — فقط وساطة
// ============================================================

function withCompany(data) {
  const companyId = currentUser?.company_id;
  if (!companyId) throw new Error('لا يوجد company_id — سجّل خروج ودخول مجدداً');
  return { ...data, company_id: companyId };
}

const API = {

  // ─── النازل (incoming_batches) ────────────────────────────
  inventory: {
    async list() {
      const { data, error } = await sb
        .from('incoming_batches')
        .select(`
          id,
          company_id,
          product_id,
          supplier_id,
          batch_date,
          quantity,
          remaining_qty,
          noulon,
          mashal,
          status,
          carryover_from,
          created_at,
          product:products(id, name, unit),
          supplier:suppliers(id, name)
        `)
        .eq('company_id', currentUser.company_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;

      return (data || []).map(b => ({
        ...b,
        batch_id:      b.id,
        product_name:  b.product?.name  || '—',
        supplier_name: b.supplier?.name || 'غير محدد',
        unit:          b.product?.unit  || 'وحدة',
        cost_per_unit: 0,
        is_low_stock:  (b.remaining_qty || 0) <= 5
      }));
    },

    async add(batch) {
      const { data, error } = await sb.from('incoming_batches')
        .insert(withCompany({
          product_id:    batch.productId,
          supplier_id:   batch.supplierId,
          batch_date:    batch.date || new Date().toISOString().slice(0,10),
          quantity:      batch.quantity,
          remaining_qty: batch.quantity,
          noulon:        batch.noulon || 0,
          mashal:        batch.mashal || 0,
          status:        'active'
        })).select().single();
      if (error) throw error;
      return data;
    },

    async update(batchId, updates) {
      const { data, error } = await sb.from('incoming_batches')
        .update(updates)
        .eq('id', batchId)
        .eq('company_id', currentUser.company_id)
        .select().single();
      if (error) throw error;
      return data;
    },

    async delete(batchId) {
      const { error } = await sb.from('incoming_batches')
        .delete()
        .eq('id', batchId)
        .eq('company_id', currentUser.company_id);
      if (error) throw error;
    },

    async markFinished(batchId) {
      const { error } = await sb.from('incoming_batches')
        .update({ status: 'finished' })
        .eq('id', batchId)
        .eq('company_id', currentUser.company_id);
      if (error) throw error;
    }
  },

  // ─── المبيعات (daily_sales) ───────────────────────────────
  sales: {
    async list(date) {
      let q = sb.from('daily_sales')
        .select(`
          id, company_id, sale_date,
          product_id, batch_id, customer_id,
          quantity, weight_kg, unit_price, total_amount, is_cash, notes,
          created_at,
          product:products(name, unit),
          customer:customers(name, phone),
          batch:incoming_batches!batch_id(supplier_id)
        `)
        .eq('company_id', currentUser.company_id)
        .order('created_at', { ascending: false });
      if (date) q = q.eq('sale_date', date);
      const { data, error } = await q;
      if (error) throw error;

      // إضافة اسم المورد من خلال batch
      const enriched = await Promise.all((data || []).map(async (sale) => {
        let supplierName = null;
        if (sale.batch && sale.batch.supplier_id) {
          const { data: supp } = await sb.from('suppliers')
            .select('name')
            .eq('id', sale.batch.supplier_id)
            .maybeSingle();
          supplierName = supp?.name;
        }
        return { ...sale, supplier_name: supplierName };
      }));
      return enriched;
    },

    async listByBatch(batchId) {
      const { data, error } = await sb.from('daily_sales')
        .select(`
          id, quantity, weight_kg, unit_price, total_amount,
          is_cash, sale_date, customer_id,
          customer:customers(name)
        `)
        .eq('company_id', currentUser.company_id)
        .eq('batch_id', batchId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async listByDate(date) {
      const { data, error } = await sb.from('daily_sales')
        .select(`
          id, batch_id, sale_date,
          quantity, weight_kg, unit_price, total_amount, is_cash,
          product:products(name, unit),
          customer:customers(name, phone)
        `)
        .eq('company_id', currentUser.company_id)
        .eq('sale_date', date)
        .order('customer_id', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async add(sale) {
      const { data, error } = await sb.from('daily_sales')
        .insert(withCompany({
          sale_date:    sale.date     || new Date().toISOString().slice(0,10),
          customer_id:  sale.customerId || null,
          product_id:   sale.productId,
          batch_id:     sale.batchId,
          quantity:     sale.quantity  || 0,
          weight_kg:    sale.weightKg  || 0,
          unit_price:   sale.unitPrice || 0,
          total_amount: sale.total,
          is_cash:      sale.isCash   || false,
          notes:        sale.notes    || null
        })).select().single();
      if (error) throw error;
      return data;
    },

    async update(saleId, updates) {
      const { data, error } = await sb.from('daily_sales')
        .update(updates)
        .eq('id', saleId)
        .eq('company_id', currentUser.company_id)
        .select().single();
      if (error) throw error;
      return data;
    },

    async delete(saleId) {
      const { error } = await sb.from('daily_sales')
        .delete()
        .eq('id', saleId)
        .eq('company_id', currentUser.company_id);
      if (error) throw error;
    }
  },

  // ─── الفواتير ─────────────────────────────────────────────
  invoices: {
    async list() {
      const { data, error } = await sb.from('invoices')
        .select(`
          *,
          supplier:suppliers(name),
          items:invoice_items(*, product:products(name, unit))
        `)
        .eq('company_id', currentUser.company_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async createSettlement(batchId, batch, batchSales) {
      const totalSales = batchSales.reduce((s, x) => s + parseFloat(x.total_amount || 0), 0);
      const commission = Math.round(totalSales * 0.07);
      const noulon     = parseFloat(batch.noulon || 0);
      const mashal     = parseFloat(batch.mashal || 0);
      const net        = totalSales - commission - noulon - mashal;

      const { data: inv, error } = await sb.from('invoices').insert(withCompany({
        invoice_number:  `INV-${Date.now()}`,
        invoice_type:    'supplier',
        supplier_id:     batch.supplier_id,
        invoice_date:    new Date().toISOString().slice(0,10),
        subtotal:        totalSales,
        commission_7pct: commission,
        noulon_total:    noulon,
        mashal_total:    mashal,
        discount:        0,
        total_amount:    net,
        paid_amount:     0,
        payment_status:  'unpaid'
      })).select().single();
      if (error) throw error;

      if (batchSales.length) {
        await sb.from('invoice_items').insert(
          batchSales.map(s => ({
            invoice_id: inv.id,
            product_id: s.product_id || batch.product_id,
            batch_id:   batchId,
            quantity:   parseFloat(s.quantity   || 0),
            weight_kg:  parseFloat(s.weight_kg  || 0),
            unit_price: parseFloat(s.unit_price || 0),
            total:      parseFloat(s.total_amount || 0)
          }))
        );
      }

      // تحديث رصيد المورد
      const { data: supp } = await sb.from('suppliers')
        .select('balance').eq('id', batch.supplier_id).single();
      const currentBalance = parseFloat(supp?.balance || 0);
      await sb.from('suppliers')
        .update({ balance: currentBalance + net })
        .eq('id', batch.supplier_id);

      await sb.from('incoming_batches')
        .update({ status: 'finished' })
        .eq('id', batchId);

      return { inv, totalSales, commission, noulon, mashal, net };
    },

    async update(id, updates) {
      const { data, error } = await sb.from('invoices')
        .update(updates).eq('id', id)
        .eq('company_id', currentUser.company_id).select().single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      await sb.from('invoice_items').delete().eq('invoice_id', id);
      const { error } = await sb.from('invoices').delete().eq('id', id)
        .eq('company_id', currentUser.company_id);
      if (error) throw error;
    }
  },

  // ─── العملاء ───────────────────────────────────────────────
  customers: {
    async list() {
      const { data, error } = await sb.from('customers').select('*')
        .eq('company_id', currentUser.company_id)
        .eq('is_active', true).order('name');
      if (error) throw error;
      return data || [];
    },

    async add(cust) {
      // التحقق من وجود نفس رقم الهاتف
      if (cust.phone && cust.phone.trim()) {
        const { data: existing, error: findErr } = await sb.from('customers')
          .select('*')
          .eq('company_id', currentUser.company_id)
          .eq('phone', cust.phone.trim())
          .maybeSingle();
        if (findErr) throw findErr;
        if (existing) {
          // موجود: نحدث الرصيد إذا لزم الأمر ونعيد العميل الموجود
          if (cust.initialBalance && cust.initialBalance !== 0) {
            const newBalance = parseFloat(existing.balance || 0) + parseFloat(cust.initialBalance);
            await sb.from('customers')
              .update({ balance: newBalance })
              .eq('id', existing.id);
            existing.balance = newBalance;
          }
          return existing;
        }
      }
      // غير موجود: أنشئ جديداً
      const { data, error } = await sb.from('customers').insert(withCompany({
        name: cust.name,
        phone: cust.phone || null,
        balance: cust.initialBalance || 0,
        is_active: true
      })).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, updates) {
      const { data, error } = await sb.from('customers').update(updates)
        .eq('id', id).eq('company_id', currentUser.company_id).select().single();
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
      const { data: sales, error: se } = await sb.from('daily_sales')
        .select('sale_date, total_amount, is_cash, product:products(name), notes')
        .eq('company_id', currentUser.company_id)
        .eq('customer_id', customerId)
        .order('sale_date', { ascending: false });
      if (se) throw se;

      const { data: pays, error: pe } = await sb.from('payments')
        .select('payment_date, amount, discount_amount, description, payment_type')
        .eq('company_id', currentUser.company_id)
        .eq('customer_id', customerId)
        .order('payment_date', { ascending: false });
      if (pe) throw pe;
      return { sales: sales || [], payments: pays || [] };
    }
  },

  // ─── الموردون ──────────────────────────────────────────────
  suppliers: {
    async list() {
      const { data, error } = await sb.from('suppliers').select('*')
        .eq('company_id', currentUser.company_id)
        .eq('is_active', true).order('name');
      if (error) throw error;
      return data || [];
    },

    async add(sup) {
      const { data, error } = await sb.from('suppliers').insert(withCompany({
        name: sup.name, phone: sup.phone || null, balance: 0, is_active: true
      })).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, updates) {
      const { data, error } = await sb.from('suppliers').update(updates)
        .eq('id', id).eq('company_id', currentUser.company_id).select().single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await sb.from('suppliers')
        .update({ is_active: false }).eq('id', id)
        .eq('company_id', currentUser.company_id);
      if (error) throw error;
    },

    async getInvoices(supplierId) {
      const { data, error } = await sb.from('invoices')
        .select('*, items:invoice_items(*, product:products(name,unit))')
        .eq('company_id', currentUser.company_id)
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async getBatches(supplierId) {
      const { data, error } = await sb.from('incoming_batches')
        .select('*, product:products(name, unit)')
        .eq('company_id', currentUser.company_id)
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  },

  // ─── المنتجات ──────────────────────────────────────────────
  products: {
    async list() {
      const { data, error } = await sb.from('products').select('*')
        .eq('company_id', currentUser.company_id)
        .eq('is_active', true).order('name');
      if (error) throw error;
      return data || [];
    },
    async add(p) {
      const { data, error } = await sb.from('products').insert(withCompany({
        name: p.name, unit: p.unit || 'عداية',
        category: 'خضار', is_active: true
      })).select().single();
      if (error) throw error;
      return data;
    }
  },

  // ─── الموظفون ──────────────────────────────────────────────
  employees: {
    async list() {
      const { data, error } = await sb.from('employees')
        .select('*, absences:employee_absences(*)')
        .eq('company_id', currentUser.company_id)
        .eq('is_active', true).order('name');
      if (error) throw error;
      return data || [];
    },
    async add(e) {
      const { data, error } = await sb.from('employees').insert(withCompany({
        name: e.name, role: e.role || 'عامل', salary: e.salary || 0, phone: e.phone || null
      })).select().single();
      if (error) throw error;
      return data;
    },
    async update(id, updates) {
      const { data, error } = await sb.from('employees').update(updates).eq('id', id)
        .eq('company_id', currentUser.company_id).select().single();
      if (error) throw error;
      return data;
    },
    async delete(id) {
      const { error } = await sb.from('employees')
        .update({ is_active: false }).eq('id', id)
        .eq('company_id', currentUser.company_id);
      if (error) throw error;
    },
    async addAbsence(empId, date, deduction) {
      const { error } = await sb.from('employee_absences')
        .insert({ employee_id: empId, absent_date: date, deduction_amount: deduction || 0 });
      if (error) throw error;
    },
    async deleteAbsence(absId) {
      const { error } = await sb.from('employee_absences').delete().eq('id', absId);
      if (error) throw error;
    }
  },

  // ─── الشركاء ───────────────────────────────────────────────
  partners: {
    async list() {
      const { data, error } = await sb.from('partners')
        .select('*, absences:partner_absences(*), payments:partner_payments(*), profits:partner_profits(*)')
        .eq('company_id', currentUser.company_id).eq('is_active', true).order('name');
      if (error) throw error;
      return data || [];
    },
    async add(p) {
      const { data, error } = await sb.from('partners').insert(withCompany({
        name: p.name, phone: p.phone || null, daily_expense: p.daily || 0,
        profit_pct: p.profit || 0, bank_account: p.bank || null,
        post_account: p.post || null, vodafone_cash: p.voda || null
      })).select().single();
      if (error) throw error;
      return data;
    },
    async update(id, updates) {
      const { data, error } = await sb.from('partners').update(updates).eq('id', id)
        .eq('company_id', currentUser.company_id).select().single();
      if (error) throw error;
      return data;
    },
    async delete(id) {
      const { error } = await sb.from('partners')
        .update({ is_active: false }).eq('id', id)
        .eq('company_id', currentUser.company_id);
      if (error) throw error;
    },
    async addAbsence(pid, date) {
      const { error } = await sb.from('partner_absences').insert({ partner_id: pid, absent_date: date });
      if (error) throw error;
    },
    async deleteAbsence(id) {
      const { error } = await sb.from('partner_absences').delete().eq('id', id);
      if (error) throw error;
    },
    async addPayment(pid, amount, note, date) {
      const { error } = await sb.from('partner_payments')
        .insert({ partner_id: pid, amount, note: note || '', payment_date: date });
      if (error) throw error;
    },
    async deletePayment(id) {
      const { error } = await sb.from('partner_payments').delete().eq('id', id);
      if (error) throw error;
    },
    async addProfit(pid, amount, note, date) {
      const { error } = await sb.from('partner_profits')
        .insert({ partner_id: pid, amount, note: note || '', profit_date: date });
      if (error) throw error;
    },
    async deleteProfit(id) {
      const { error } = await sb.from('partner_profits').delete().eq('id', id);
      if (error) throw error;
    }
  },

  // ─── المحلات ───────────────────────────────────────────────
  shops: {
    async list() {
      const { data, error } = await sb.from('shops')
        .select('*, lahu:shop_lahu(*)')
        .eq('company_id', currentUser.company_id).eq('is_active', true).order('name');
      if (error) throw error;
      return (data || []).map(s => ({ ...s, alihi: [] }));
    },
    async add(s) {
      const { data, error } = await sb.from('shops')
        .insert(withCompany({ name: s.name, phone: s.phone || null })).select().single();
      if (error) throw error;
      return data;
    },
    async update(id, updates) {
      const { data, error } = await sb.from('shops').update(updates).eq('id', id)
        .eq('company_id', currentUser.company_id).select().single();
      if (error) throw error;
      return data;
    },
    async delete(id) {
      const { error } = await sb.from('shops').update({ is_active: false }).eq('id', id)
        .eq('company_id', currentUser.company_id);
      if (error) throw error;
    },
    async addLahu(shopId, item) {
      const { error } = await sb.from('shop_lahu').insert({ shop_id: shopId, ...item });
      if (error) throw error;
    },
    async deleteLahu(id) {
      const { error } = await sb.from('shop_lahu').delete().eq('id', id);
      if (error) throw error;
    }
  },

  // ─── الخزنة (payments) ────────────────────────────────────
  payments: {
    async list(date) {
      let q = sb.from('payments')
        .select('*, customer:customers(name), supplier:suppliers(name)')
        .eq('company_id', currentUser.company_id)
        .order('created_at', { ascending: false });
      if (date) q = q.eq('payment_date', date);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    async addCollection(p) {
      const { data, error } = await sb.from('payments').insert(withCompany({
        payment_date:    p.date        || new Date().toISOString().slice(0,10),
        customer_id:     p.customerId  || null,
        amount:          p.amount,
        discount_amount: p.discount    || 0,
        description:     p.description || 'تحصيل',
        payment_type:    'collection',
        direction:       'in'
      })).select().single();
      if (error) throw error;
      return data;
    },

    async addCashSaleCollection(p) {
      const { data, error } = await sb.from('payments').insert(withCompany({
        payment_date:    p.date        || new Date().toISOString().slice(0,10),
        customer_id:     null,
        amount:          p.amount,
        discount_amount: 0,
        description:     `بيعة نقدية — ${p.productName || ''}`,
        payment_type:    'cash_sale',
        direction:       'in'
      })).select().single();
      if (error) throw error;
      return data;
    },

    async addExpense(p) {
      const { data, error } = await sb.from('payments').insert(withCompany({
        payment_date:    p.date        || new Date().toISOString().slice(0,10),
        supplier_id:     p.supplierId  || null,
        amount:          p.amount,
        discount_amount: 0,
        description:     p.description || 'مصروف',
        payment_type:    p.type        || 'expense',
        direction:       'out'
      })).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, updates) {
      const { data, error } = await sb.from('payments').update(updates).eq('id', id)
        .eq('company_id', currentUser.company_id).select().single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await sb.from('payments').delete().eq('id', id)
        .eq('company_id', currentUser.company_id);
      if (error) throw error;
    }
  },

  // ─── الاشتراكات ────────────────────────────────────────────
  subscriptions: {
    async submit(p) {
      const { data, error } = await sb.from('subscriptions').insert(withCompany({
        plan: p.plan, amount: p.amount, payment_method: p.method,
        transaction_id: p.transactionId,
        extra_data: JSON.stringify(p.extraData || {}), status: 'pending'
      })).select().single();
      if (error) throw error;
      return data;
    },
    async getAll() {
      // تقييد للمشرفين فقط (يتم التحقق في admin.js)
      const { data, error } = await sb.from('subscriptions')
        .select('*, company:companies(name)').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async confirm(subId, companyId, plan, endsAt) {
      await sb.from('subscriptions').update({ status: 'confirmed' }).eq('id', subId);
      await sb.from('companies').update({ subscription: plan, sub_ends: endsAt }).eq('id', companyId);
    },
    async reject(subId) {
      await sb.from('subscriptions').update({ status: 'rejected' }).eq('id', subId);
    }
  },

  // ─── الملف الشخصي ─────────────────────────────────────────
  company: {
    async getProfile() {
      const { data, error } = await sb.from('profiles')
        .select('*, company:companies(*)')
        .eq('id', currentUser.id).maybeSingle();
      if (error) throw error;
      return data;
    }
  }
};