// ============================================================
// api.js — طبقة البيانات الكاملة (نسخة إنتاج مستقرة)
// كل عمليات قاعدة البيانات تمر من هنا فقط
// ============================================================

// ─── Helper: إضافة company_id تلقائياً ──────────────────────
function withCompany(data) {
  const cid = currentUser?.company_id;
  if (!cid) throw new Error('لا يوجد company_id — سجّل خروج ودخول مجدداً');
  return { ...data, company_id: cid };
}

// ─── Helper: تحقق مختصر ─────────────────────────────────────
function _cid() {
  const cid = currentUser?.company_id;
  if (!cid) throw new Error('no company_id');
  return cid;
}

// ─── Helper: تنفيذ query مع معالجة خطأ موحّدة ───────────────
async function _q(label, queryFn) {
  try {
    const result = await queryFn();
    if (result.error) {
      console.error(`[API:${label}]`, result.error.message);
      throw result.error;
    }
    return result.data;
  } catch (e) {
    console.error(`[API:${label}]`, e.message || e);
    throw e;
  }
}

// ============================================================
const API = {

  // ─── المخزون ────────────────────────────────────────────────
  inventory: {

    async list() {
      return _q('inventory.list', () =>
        sb.from('inventory_summary')
          .select('*')
          .eq('company_id', _cid())
          .order('batch_date', { ascending: false })
      );
    },

    async add(batch) {
      const qty = parseFloat(batch.quantity);
      if (!qty || qty <= 0) throw new Error('الكمية يجب أن تكون أكبر من صفر');
      return _q('inventory.add', () =>
        sb.from('incoming_batches')
          .insert(withCompany({
            product_id:    batch.productId,
            supplier_id:   batch.supplierId,
            batch_date:    batch.date || today(),
            quantity:      qty,
            remaining_qty: qty,
            buy_price:     parseFloat(batch.buyPrice) || 0,
            noulon:        parseFloat(batch.noulon)   || 0,
            mashal:        parseFloat(batch.mashal)   || 0,
            notes:         batch.notes || null,
            status:        'active'
          }))
          .select()
          .single()
      );
    },

    async updateRemaining(batchId, newQty) {
      const status = newQty <= 0 ? 'sold_out' : 'active';
      return _q('inventory.updateRemaining', () =>
        sb.from('incoming_batches')
          .update({ remaining_qty: Math.max(0, newQty), status })
          .eq('id', batchId)
          .eq('company_id', _cid())
          .select()
          .single()
      );
    },

    async carryOver(batchId, remainingQty, newDate) {
      const old = await _q('inventory.carryOver.get', () =>
        sb.from('incoming_batches').select('*').eq('id', batchId).single()
      );
      await _q('inventory.carryOver.close', () =>
        sb.from('incoming_batches')
          .update({ status: 'carried_over' })
          .eq('id', batchId)
      );
      return _q('inventory.carryOver.new', () =>
        sb.from('incoming_batches')
          .insert(withCompany({
            product_id:     old.product_id,
            supplier_id:    old.supplier_id,
            batch_date:     newDate || today(),
            quantity:       remainingQty,
            remaining_qty:  remainingQty,
            buy_price:      old.buy_price,
            noulon:         old.noulon,
            mashal:         old.mashal,
            carryover_from: batchId,
            status:         'active'
          }))
          .select()
          .single()
      );
    },

    async delete(batchId) {
      return _q('inventory.delete', () =>
        sb.from('incoming_batches')
          .delete()
          .eq('id', batchId)
          .eq('company_id', _cid())
      );
    },

    async getLowStock() {
      return _q('inventory.getLowStock', () =>
        sb.from('inventory_summary')
          .select('*')
          .eq('company_id', _cid())
          .eq('is_low_stock', true)
      );
    }
  },

  // ─── المبيعات ────────────────────────────────────────────────
  sales: {

    async list(date) {
      const q = sb.from('daily_sales')
        .select('*, product:products(name,unit), customer:customers(name,phone)')
        .eq('company_id', _cid())
        .order('created_at', { ascending: false });
      return _q('sales.list', () => date ? q.eq('sale_date', date) : q);
    },

    async add(sale) {
      const qty   = parseFloat(sale.quantity) || 0;
      const wt    = parseFloat(sale.weightKg) || 0;
      const price = parseFloat(sale.unitPrice);
      const total = parseFloat(sale.total);
      if (!price || !total) throw new Error('أدخل السعر والمبلغ');

      // ١. تسجيل البيع في daily_sales
      const record = await _q('sales.add', () =>
        sb.from('daily_sales')
          .insert(withCompany({
            sale_date:    sale.date || today(),
            customer_id:  sale.customerId || null,
            product_id:   sale.productId  || null,
            batch_id:     sale.batchId    || null,
            quantity:     qty,
            weight_kg:    wt,
            unit_price:   price,
            total_amount: total,
            is_cash:      sale.isCash || false,
            notes:        sale.notes || null,
            created_by:   currentUser.id
          }))
          .select()
          .single()
      );

      // ٢. تحديث المخزون يدوياً (لأن الـ Trigger غير موثوق)
      if (sale.batchId && qty > 0) {
        try {
          const { data: batch } = await sb.from('incoming_batches')
            .select('remaining_qty')
            .eq('id', sale.batchId)
            .single();
          if (batch) {
            const newQty = parseFloat(batch.remaining_qty) - qty;
            await API.inventory.updateRemaining(sale.batchId, newQty);
          }
        } catch (e) {
          console.warn('inventory update warning:', e.message);
          // لا نوقف العملية لو المخزون فشل في التحديث
        }
      }

      // ٣. تحديث رصيد العميل يدوياً
      if (sale.customerId && !sale.isCash) {
        try {
          await _q('sales.updateBalance', () =>
            sb.rpc('increment_customer_balance', {
              p_customer_id: sale.customerId,
              p_amount:      total,
              p_company_id:  _cid()
            })
          );
        } catch (e) {
          // Fallback: update مباشر
          try {
            const { data: cust } = await sb.from('customers')
              .select('balance').eq('id', sale.customerId).single();
            if (cust) {
              await sb.from('customers')
                .update({ balance: parseFloat(cust.balance || 0) + total })
                .eq('id', sale.customerId)
                .eq('company_id', _cid());
            }
          } catch (e2) {
            console.warn('customer balance update warning:', e2.message);
          }
        }
      }

      return record;
    },

    async delete(saleId) {
      // جلب بيانات البيع قبل الحذف لعكس التأثير
      const sale = await _q('sales.delete.get', () =>
        sb.from('daily_sales').select('*').eq('id', saleId).single()
      );

      await _q('sales.delete', () =>
        sb.from('daily_sales').delete().eq('id', saleId)
      );

      // عكس تأثير المخزون
      if (sale?.batch_id && sale?.quantity > 0) {
        try {
          const { data: batch } = await sb.from('incoming_batches')
            .select('remaining_qty').eq('id', sale.batch_id).single();
          if (batch) {
            await API.inventory.updateRemaining(
              sale.batch_id,
              parseFloat(batch.remaining_qty) + parseFloat(sale.quantity)
            );
          }
        } catch (e) { console.warn('inventory reverse warning:', e.message); }
      }

      // عكس تأثير رصيد العميل
      if (sale?.customer_id && !sale?.is_cash) {
        try {
          const { data: cust } = await sb.from('customers')
            .select('balance').eq('id', sale.customer_id).single();
          if (cust) {
            await sb.from('customers')
              .update({ balance: Math.max(0, parseFloat(cust.balance||0) - parseFloat(sale.total_amount||0)) })
              .eq('id', sale.customer_id)
              .eq('company_id', _cid());
          }
        } catch (e) { console.warn('balance reverse warning:', e.message); }
      }

      return true;
    },

    async getDailySummary(date) {
      return _q('sales.getDailySummary', () =>
        sb.from('daily_summary')
          .select('*')
          .eq('company_id', _cid())
          .eq('sale_date', date || today())
          .maybeSingle()
      );
    }
  },

  // ─── العملاء ─────────────────────────────────────────────────
  customers: {

    async list() {
      return _q('customers.list', () =>
        sb.from('customers')
          .select('*')
          .eq('company_id', _cid())
          .eq('is_active', true)
          .order('name')
      );
    },

    async add(cust) {
      if (!cust.name?.trim()) throw new Error('أدخل اسم العميل');
      return _q('customers.add', () =>
        sb.from('customers')
          .insert(withCompany({
            name:         cust.name.trim(),
            phone:        cust.phone || null,
            address:      cust.address || null,
            balance:      parseFloat(cust.initialBalance) || 0,
            credit_limit: parseFloat(cust.creditLimit)    || 0,
            notes:        cust.notes || null
          }))
          .select()
          .single()
      );
    },

    async update(id, updates) {
      return _q('customers.update', () =>
        sb.from('customers')
          .update(updates)
          .eq('id', id)
          .eq('company_id', _cid())
          .select()
          .single()
      );
    },

    async delete(id) {
      return _q('customers.delete', () =>
        sb.from('customers')
          .update({ is_active: false })
          .eq('id', id)
          .eq('company_id', _cid())
      );
    },

    async getLedger(customerId) {
      const [salesRes, paymentsRes] = await Promise.all([
        sb.from('daily_sales')
          .select('sale_date, total_amount, is_cash, notes, product:products(name)')
          .eq('company_id', _cid())
          .eq('customer_id', customerId)
          .order('sale_date', { ascending: true }),
        sb.from('payments')
          .select('payment_date, amount, discount_amount, description, payment_type')
          .eq('company_id', _cid())
          .eq('customer_id', customerId)
          .order('payment_date', { ascending: true })
      ]);
      if (salesRes.error)    throw salesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      return { sales: salesRes.data || [], payments: paymentsRes.data || [] };
    },

    async refreshBalance(customerId) {
      // إعادة حساب الرصيد من الصفر من المبيعات والمدفوعات
      const { data: sales } = await sb.from('daily_sales')
        .select('total_amount').eq('customer_id', customerId).eq('is_cash', false);
      const { data: pays } = await sb.from('payments')
        .select('amount, discount_amount').eq('customer_id', customerId).eq('payment_type', 'collection');
      const totalSales = (sales||[]).reduce((s,x)=>s+parseFloat(x.total_amount||0),0);
      const totalPaid  = (pays||[]).reduce((s,x)=>s+parseFloat(x.amount||0)+parseFloat(x.discount_amount||0),0);
      const balance    = Math.max(0, totalSales - totalPaid);
      await sb.from('customers').update({ balance }).eq('id', customerId);
      return balance;
    }
  },

  // ─── الموردون ─────────────────────────────────────────────────
  suppliers: {

    async list() {
      return _q('suppliers.list', () =>
        sb.from('suppliers')
          .select('*')
          .eq('company_id', _cid())
          .eq('is_active', true)
          .order('name')
      );
    },

    async add(sup) {
      if (!sup.name?.trim()) throw new Error('أدخل اسم المورد');
      return _q('suppliers.add', () =>
        sb.from('suppliers')
          .insert(withCompany({
            name:    sup.name.trim(),
            phone:   sup.phone   || null,
            address: sup.address || null,
            balance: 0
          }))
          .select()
          .single()
      );
    },

    async update(id, updates) {
      return _q('suppliers.update', () =>
        sb.from('suppliers')
          .update(updates)
          .eq('id', id)
          .eq('company_id', _cid())
          .select()
          .single()
      );
    },

    async delete(id) {
      return _q('suppliers.delete', () =>
        sb.from('suppliers')
          .update({ is_active: false })
          .eq('id', id)
          .eq('company_id', _cid())
      );
    }
  },

  // ─── المنتجات ─────────────────────────────────────────────────
  products: {

    async list() {
      return _q('products.list', () =>
        sb.from('products')
          .select('*')
          .eq('company_id', _cid())
          .eq('is_active', true)
          .order('name')
      );
    },

    async add(prod) {
      if (!prod.name?.trim()) throw new Error('أدخل اسم المنتج');
      return _q('products.add', () =>
        sb.from('products')
          .insert(withCompany({
            name:               prod.name.trim(),
            unit:               prod.unit     || 'عداية',
            category:           prod.category || 'خضار',
            default_buy_price:  parseFloat(prod.buyPrice)      || 0,
            default_sell_price: parseFloat(prod.sellPrice)     || 0,
            low_stock_alert:    parseFloat(prod.lowStockAlert) || 5
          }))
          .select()
          .single()
      );
    },

    async update(id, updates) {
      return _q('products.update', () =>
        sb.from('products')
          .update(updates)
          .eq('id', id)
          .eq('company_id', _cid())
          .select()
          .single()
      );
    },

    async delete(id) {
      return _q('products.delete', () =>
        sb.from('products')
          .update({ is_active: false })
          .eq('id', id)
          .eq('company_id', _cid())
      );
    }
  },

  // ─── الفواتير ─────────────────────────────────────────────────
  invoices: {

    async list(type = null) {
      const q = sb.from('invoices')
        .select('*, customer:customers(name,phone), supplier:suppliers(name), items:invoice_items(*, product:products(name,unit))')
        .eq('company_id', _cid())
        .order('invoice_date', { ascending: false });
      return _q('invoices.list', () => type ? q.eq('invoice_type', type) : q);
    },

    async create(invoice) {
      // توليد رقم الفاتورة
      let invNumber = 'INV-0000';
      try {
        const { data: num } = await sb.rpc('generate_invoice_number', {
          p_company_id: _cid(),
          p_type:       invoice.type === 'supplier' ? 'SUP' : 'INV'
        });
        if (num) invNumber = num;
      } catch (e) {
        // Fallback للرقم
        invNumber = (invoice.type === 'supplier' ? 'SUP' : 'INV')
          + '-' + new Date().getFullYear()
          + '-' + String(Date.now()).slice(-4);
      }

      const subtotal   = parseFloat(invoice.subtotal)    || 0;
      const commission = parseFloat(invoice.commission)  || Math.round(subtotal * 0.07);
      const noulon     = parseFloat(invoice.noulon)      || 0;
      const mashal     = parseFloat(invoice.mashal)      || 0;
      const discount   = parseFloat(invoice.discount)    || 0;
      const total      = subtotal - commission - noulon - mashal - discount;
      const paid       = parseFloat(invoice.paidAmount)  || 0;

      const inv = await _q('invoices.create', () =>
        sb.from('invoices')
          .insert(withCompany({
            invoice_number:  invNumber,
            invoice_date:    invoice.date || today(),
            invoice_type:    invoice.type || 'sale',
            customer_id:     invoice.customerId || null,
            supplier_id:     invoice.supplierId || null,
            subtotal,
            commission_7pct: commission,
            noulon_total:    noulon,
            mashal_total:    mashal,
            discount,
            total_amount:    total,
            paid_amount:     paid,
            payment_status:  paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
            payment_method:  invoice.paymentMethod || 'credit',
            notes:           invoice.notes || null,
            created_by:      currentUser.id
          }))
          .select()
          .single()
      );

      // إضافة بنود الفاتورة
      if (invoice.items?.length) {
        const items = invoice.items.map(item => {
          const iq    = parseFloat(item.quantity) || 0;
          const iwt   = parseFloat(item.weightKg) || 0;
          const iprice = parseFloat(item.unitPrice) || 0;
          const itotal = (iwt > 0 ? iwt : iq) * iprice;
          return {
            invoice_id: inv.id,
            company_id: _cid(),
            product_id: item.productId,
            batch_id:   item.batchId || null,
            quantity:   iq,
            weight_kg:  iwt,
            unit_price: iprice,
            total:      itotal   // نحسبه يدوياً لأن العمود مش GENERATED
          };
        });
        await _q('invoices.items', () => sb.from('invoice_items').insert(items));
      }

      // تحديث رصيد المورد يدوياً
      if (invoice.type === 'supplier' && invoice.supplierId) {
        try {
          const { data: sup } = await sb.from('suppliers')
            .select('balance').eq('id', invoice.supplierId).single();
          if (sup) {
            await sb.from('suppliers')
              .update({ balance: parseFloat(sup.balance||0) + total })
              .eq('id', invoice.supplierId)
              .eq('company_id', _cid());
          }
        } catch (e) { console.warn('supplier balance:', e.message); }
      }

      return inv;
    },

    async updateDeductions(invId, deductions) {
      const sub  = parseFloat(deductions.subtotal)    || 0;
      const cm   = parseFloat(deductions.commission)  || 0;
      const n    = parseFloat(deductions.noulon)      || 0;
      const m    = parseFloat(deductions.mashal)      || 0;
      const d    = parseFloat(deductions.discount)    || 0;
      const total = sub - cm - n - m - d;
      return _q('invoices.updateDeductions', () =>
        sb.from('invoices')
          .update({ commission_7pct: cm, noulon_total: n, mashal_total: m, discount: d, total_amount: total })
          .eq('id', invId)
          .eq('company_id', _cid())
          .select()
          .single()
      );
    },

    async delete(invId) {
      return _q('invoices.delete', () =>
        sb.from('invoices').delete().eq('id', invId).eq('company_id', _cid())
      );
    }
  },

  // ─── المدفوعات والتحصيلات ─────────────────────────────────────
  payments: {

    async list(date = null) {
      const q = sb.from('payments')
        .select('*, customer:customers(name), supplier:suppliers(name)')
        .eq('company_id', _cid())
        .order('payment_date', { ascending: false });
      return _q('payments.list', () => date ? q.eq('payment_date', date) : q);
    },

    async addCollection(payment) {
      const amount   = parseFloat(payment.amount);
      const discount = parseFloat(payment.discount) || 0;
      if (!amount || amount <= 0) throw new Error('أدخل مبلغاً صحيحاً');

      const record = await _q('payments.addCollection', () =>
        sb.from('payments')
          .insert(withCompany({
            payment_date:    payment.date || today(),
            payment_type:    'collection',
            direction:       'in',
            customer_id:     payment.customerId || null,
            invoice_id:      payment.invoiceId  || null,
            amount,
            discount_amount: discount,
            method:          payment.method      || 'cash',
            reference:       payment.reference   || null,
            description:     payment.description || 'تحصيل',
            created_by:      currentUser.id
          }))
          .select()
          .single()
      );

      // تحديث رصيد العميل يدوياً
      if (payment.customerId) {
        try {
          const { data: cust } = await sb.from('customers')
            .select('balance').eq('id', payment.customerId).single();
          if (cust) {
            const newBal = Math.max(0, parseFloat(cust.balance||0) - amount - discount);
            await sb.from('customers')
              .update({ balance: newBal })
              .eq('id', payment.customerId)
              .eq('company_id', _cid());
          }
        } catch (e) { console.warn('balance update:', e.message); }
      }

      return record;
    },

    async addExpense(expense) {
      const amount = parseFloat(expense.amount);
      if (!amount || amount <= 0) throw new Error('أدخل مبلغاً صحيحاً');
      if (!expense.description?.trim()) throw new Error('أدخل البيان');

      const record = await _q('payments.addExpense', () =>
        sb.from('payments')
          .insert(withCompany({
            payment_date:  expense.date || today(),
            payment_type:  expense.type || 'expense',
            direction:     'out',
            supplier_id:   expense.supplierId || null,
            amount,
            method:        expense.method      || 'cash',
            description:   expense.description.trim(),
            created_by:    currentUser.id
          }))
          .select()
          .single()
      );

      // تحديث رصيد المورد يدوياً
      if (expense.supplierId && expense.type === 'supplier_payment') {
        try {
          const { data: sup } = await sb.from('suppliers')
            .select('balance').eq('id', expense.supplierId).single();
          if (sup) {
            await sb.from('suppliers')
              .update({ balance: Math.max(0, parseFloat(sup.balance||0) - amount) })
              .eq('id', expense.supplierId)
              .eq('company_id', _cid());
          }
        } catch (e) { console.warn('supplier balance:', e.message); }
      }

      return record;
    },

    async delete(paymentId) {
      // جلب البيانات قبل الحذف لعكس التأثير
      const pay = await _q('payments.delete.get', () =>
        sb.from('payments').select('*').eq('id', paymentId).single()
      );

      await _q('payments.delete', () =>
        sb.from('payments').delete().eq('id', paymentId).eq('company_id', _cid())
      );

      // عكس تأثير رصيد العميل
      if (pay?.customer_id && pay?.payment_type === 'collection') {
        try {
          const { data: cust } = await sb.from('customers')
            .select('balance').eq('id', pay.customer_id).single();
          if (cust) {
            await sb.from('customers')
              .update({ balance: parseFloat(cust.balance||0) + parseFloat(pay.amount||0) + parseFloat(pay.discount_amount||0) })
              .eq('id', pay.customer_id)
              .eq('company_id', _cid());
          }
        } catch (e) { console.warn('balance reverse:', e.message); }
      }

      return true;
    }
  },

  // ─── الموظفون ─────────────────────────────────────────────────
  employees: {

    async list() {
      return _q('employees.list', () =>
        sb.from('employees')
          .select('*, absences:attendance(id, absent_date, deduction)')
          .eq('company_id', _cid())
          .eq('is_active', true)
          .order('name')
      );
    },

    async add(emp) {
      if (!emp.name?.trim())             throw new Error('أدخل اسم الموظف');
      if (!parseFloat(emp.salary) > 0)   console.warn('راتب الموظف صفر');
      return _q('employees.add', () =>
        sb.from('employees')
          .insert(withCompany({
            name:      emp.name.trim(),
            role:      emp.role  || 'عامل',
            phone:     emp.phone || null,
            salary:    parseFloat(emp.salary) || 0,
            hire_date: emp.hireDate || today()
          }))
          .select()
          .single()
      );
    },

    async addAbsence(empId, date, deduction) {
      return _q('employees.addAbsence', () =>
        sb.from('attendance')
          .insert(withCompany({
            employee_id: empId,
            absent_date: date || today(),
            deduction:   parseFloat(deduction) || 0
          }))
          .select()
          .single()
      );
    },

    async deleteAbsence(absenceId) {
      // نحذف بالـ id فقط بدون company_id لأن attendance لا يحتوي على company_id مباشرة
      return _q('employees.deleteAbsence', () =>
        sb.from('attendance').delete().eq('id', absenceId)
      );
    },

    async delete(empId) {
      return _q('employees.delete', () =>
        sb.from('employees')
          .update({ is_active: false })
          .eq('id', empId)
          .eq('company_id', _cid())
      );
    }
  },

  // ─── الشركاء ──────────────────────────────────────────────────
  partners: {

    async list() {
      return _q('partners.list', () =>
        sb.from('partners')
          .select('*')
          .eq('company_id', _cid())
          .order('name')
      );
    },

    async add(p) {
      if (!p.name?.trim()) throw new Error('أدخل اسم الشريك');
      return _q('partners.add', () =>
        sb.from('partners')
          .insert(withCompany({
            name:          p.name.trim(),
            phone:         p.phone         || null,
            daily_rate:    parseFloat(p.dailyRate)   || 0,
            profit_pct:    parseFloat(p.profitPct)   || 0,
            bank_account:  p.bankAccount   || null,
            post_account:  p.postAccount   || null,
            vodafone_cash: p.vodafoneCash  || null
          }))
          .select()
          .single()
      );
    },

    async delete(id) {
      return _q('partners.delete', () =>
        sb.from('partners').delete().eq('id', id).eq('company_id', _cid())
      );
    }
  },

  // ─── المحلات ──────────────────────────────────────────────────
  shops: {

    async list() {
      return _q('shops.list', () =>
        sb.from('shops')
          .select('*, transactions:shop_transactions(*)')
          .eq('company_id', _cid())
          .order('name')
      );
    },

    async add(shop) {
      if (!shop.name?.trim()) throw new Error('أدخل اسم المحل');
      return _q('shops.add', () =>
        sb.from('shops')
          .insert(withCompany({ name: shop.name.trim(), phone: shop.phone || null }))
          .select()
          .single()
      );
    },

    async delete(id) {
      return _q('shops.delete', () =>
        sb.from('shops').delete().eq('id', id).eq('company_id', _cid())
      );
    },

    async addTransaction(shopId, tx) {
      return _q('shops.addTx', () =>
        sb.from('shop_transactions')
          .insert(withCompany({
            shop_id:      shopId,
            trans_date:   tx.date        || today(),
            type:         tx.type,
            product_name: tx.productName,
            quantity:     parseFloat(tx.quantity) || null,
            weight_kg:    parseFloat(tx.weightKg) || null,
            unit:         tx.unit        || null,
            price:        parseFloat(tx.price)    || 0,
            total:        parseFloat(tx.total),
            target_name:  tx.targetName  || null
          }))
          .select()
          .single()
      );
    },

    async deleteTransaction(txId) {
      return _q('shops.deleteTx', () =>
        sb.from('shop_transactions').delete().eq('id', txId).eq('company_id', _cid())
      );
    }
  },

  // ─── Dashboard ────────────────────────────────────────────────
  dashboard: {
    async getSummary() {
      const todayStr      = today();
      const thirtyAgoStr  = new Date(Date.now() - 30*864e5).toISOString().slice(0,10);
      const cid           = _cid();

      const [s, p, inv, c] = await Promise.allSettled([
        sb.from('daily_summary').select('*').eq('company_id', cid)
          .gte('sale_date', thirtyAgoStr).order('sale_date', { ascending: false }),
        sb.from('payments').select('direction,payment_type,amount')
          .eq('company_id', cid).eq('payment_date', todayStr),
        sb.from('inventory_summary').select('product_name,remaining_qty,unit,is_low_stock,supplier_name')
          .eq('company_id', cid),
        sb.from('customers').select('name,balance').eq('company_id', cid)
          .eq('is_active', true).gt('balance', 0).order('balance', { ascending: false }).limit(5)
      ]);

      return {
        salesHistory:  s.value?.data   || [],
        todayPayments: p.value?.data   || [],
        inventory:     inv.value?.data || [],
        topDebtors:    c.value?.data   || []
      };
    }
  },

  // ─── الشركة والمستخدمين ───────────────────────────────────────
  company: {
    async getProfile() {
      return _q('company.getProfile', () =>
        sb.from('profiles')
          .select('*, company:companies(*)')
          .eq('id', currentUser.id)
          .maybeSingle()
      );
    },

    async updateSettings(settings) {
      return _q('company.updateSettings', () =>
        sb.from('companies').update({ settings }).eq('id', _cid())
      );
    },

    async getTeam() {
      return _q('company.getTeam', () =>
        sb.from('profiles')
          .select('id, full_name, role, phone, is_active, created_at')
          .eq('company_id', _cid())
          .order('role')
      );
    }
  },

  // ─── الاشتراكات ───────────────────────────────────────────────
  subscriptions: {
    async submit(sub) {
      return _q('subscriptions.submit', () =>
        sb.from('subscriptions')
          .insert(withCompany({
            plan:           sub.plan,
            amount:         parseFloat(sub.amount),
            payment_method: sub.method,
            transaction_id: sub.transactionId || null,
            extra_data:     sub.extraData || {}
          }))
          .select()
          .single()
      );
    },

    async getAll() {
      return _q('subscriptions.getAll', () =>
        sb.from('subscriptions')
          .select('*, company:companies(name)')
          .order('created_at', { ascending: false })
      );
    },

    async confirm(subId, companyId, plan, endsAt) {
      await _q('subscriptions.confirm', () =>
        sb.from('subscriptions')
          .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), confirmed_by: currentUser.id })
          .eq('id', subId)
      );
      await _q('subscriptions.activateCompany', () =>
        sb.from('companies').update({ subscription: plan, sub_ends: endsAt }).eq('id', companyId)
      );
    },

    async reject(subId) {
      return _q('subscriptions.reject', () =>
        sb.from('subscriptions').update({ status: 'rejected' }).eq('id', subId)
      );
    }
  }
};

// ─── Cache ────────────────────────────────────────────────────
const Cache = {
  _store: new Map(),
  _ttl:   60000,
  get(k)    { const e=this._store.get(k); if(!e)return null; if(Date.now()-e.ts>this._ttl){this._store.delete(k);return null;} return e.data; },
  set(k,d)  { this._store.set(k,{data:d,ts:Date.now()}); },
  invalidate(p){ for(const k of this._store.keys()) if(k.startsWith(p)) this._store.delete(k); },
  clear()   { this._store.clear(); }
};

// ─── Helper: تاريخ اليوم ISO ─────────────────────────────────
function today() {
  return new Date().toISOString().slice(0,10);
}
