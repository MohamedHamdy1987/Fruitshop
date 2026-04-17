// ============================================================
// renderers/invoices.js — محدَّث
// ✅ زر تعديل على كل فاتورة (Inline Edit)
// ✅ إصلاح حساب paid_amount
// ✅ فاتورة تلقائية مُستقبَلة من sales.js
// ============================================================

function renderInvoicesPage() {
  const c = document.getElementById('invoices-cont');
  if (!c) return;
  const invs = store.invs || [];
  if (!invs.length) {
    c.innerHTML = `
      🧾
      لا توجد فواتير
      الفواتير تُنشأ تلقائياً عند نفاد الصنف
    `;
    return;
  }
  c.innerHTML = invs.map(inv => _renderInvoiceCard(inv)).join('');
}

function _renderInvoiceCard(inv) {
  const gross    = parseFloat(inv.subtotal         || 0);
  const cm       = parseFloat(inv.commission_7pct  || 0);
  const noulon   = parseFloat(inv.noulon_total      || 0);
  const mashal   = parseFloat(inv.mashal_total      || 0);
  const disc     = parseFloat(inv.discount          || 0);
  const total    = parseFloat(inv.total_amount      || 0);
  const paid     = parseFloat(inv.paid_amount       || 0);
  const remaining = Math.max(0, total - paid);

  const statusColors = { paid:'var(--green)', partial:'var(--orange)', unpaid:'var(--red)' };
  const statusText   = { paid:'مدفوعة ✅', partial:'جزئية ⏳', unpaid:'غير مدفوعة ❌' };
  const statusColor  = statusColors[inv.payment_status] || 'var(--gray)';
  const statusLabel  = statusText[inv.payment_status]   || '-';

  const items    = inv.items || [];
  const suppName = inv.supplier?.name || '-';
  const dateStr  = inv.invoice_date || '-';

  return `
  
    
    
      
        🧾 ${inv.invoice_number || 'فاتورة'}
        🚛 ${suppName} · 📅 ${new Date(dateStr).toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'})}
      
      
        ${statusLabel}
        ✏️ تعديل
        🖨️
        🗑️
      
    

    
    
      ✏️ تعديل الفاتورة
      
        الإجمالي الخام
          
        العمولة 7٪
          
        النولون
          
        المشال
          
        خصم إضافي
          
        الصافي المحسوب
          
        المبلغ المدفوع
          
        حالة الدفع
          
            غير مدفوعة
            جزئية
            مدفوعة
          
      
      
        💾 حفظ التعديلات
        إلغاء
      
    

    
    ${items.length ? `
    
      
        
          الصنف
          الوحدةالكميةالوزنالسعرالإجمالي
        
        
          ${items.map(item => `
          
            ${item.product?.name||'-'}
            ${item.product?.unit||'-'}
            ${N(item.quantity||0)}
            ${item.weight_kg>0?N(item.weight_kg)+' ك':'-'}
            ${N(item.unit_price)} ج
            ${N(item.total)} ج
          `).join('')}
        
        
          الإجمالي الخام
          ${N(gross)} ج
        
      
    ` : ''}

    
    
      ✂️ الخصومات
      
        ${_dedRow(inv.id, 'commission_7pct', 'العمولة 7٪', cm)}
        ${_dedRow(inv.id, 'noulon_total', 'النولون', noulon)}
        ${_dedRow(inv.id, 'mashal_total', 'المشال', mashal)}
        ${_dedRow(inv.id, 'discount', 'خصم إضافي', disc)}
      
      
        إجمالي الخصومات: ${N(cm+noulon+mashal+disc)} ج
      
    

    
    
      💰 الصافي المستحق
      ${N(total)} جنيه
    

    ${paid > 0 && paid < total ? `
    
      المدفوع: ${N(paid)} ج
      المتبقي: ${N(remaining)} ج
    ` : ''}

    ${remaining > 0 ? `
    
      
        💵 تسجيل دفعة
      
    ` : ''}
  `;
}

function _dedRow(invId, field, label, val) {
  return `
  
    ${label}
    
      
      ج
    
  `;
}

// ─── Inline Edit للفاتورة ────────────────────────────────────
function toggleInvoiceEdit(invId) {
  const el = document.getElementById(`inv-edit-${invId}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function recalcInvEdit(invId) {
  const sub    = parseFloat(document.getElementById(`ie-subtotal-${invId}`)?.value) || 0;
  const comm   = parseFloat(document.getElementById(`ie-comm-${invId}`)?.value)     || 0;
  const noulon = parseFloat(document.getElementById(`ie-noulon-${invId}`)?.value)   || 0;
  const mashal = parseFloat(document.getElementById(`ie-mashal-${invId}`)?.value)   || 0;
  const disc   = parseFloat(document.getElementById(`ie-disc-${invId}`)?.value)     || 0;
  const net    = document.getElementById(`ie-net-${invId}`);
  if (net) net.value = sub - comm - noulon - mashal - disc;
}

async function saveInvoiceEdit(invId) {
  const sub      = parseFloat(document.getElementById(`ie-subtotal-${invId}`)?.value) || 0;
  const comm     = parseFloat(document.getElementById(`ie-comm-${invId}`)?.value)     || 0;
  const noulon   = parseFloat(document.getElementById(`ie-noulon-${invId}`)?.value)   || 0;
  const mashal   = parseFloat(document.getElementById(`ie-mashal-${invId}`)?.value)   || 0;
  const disc     = parseFloat(document.getElementById(`ie-disc-${invId}`)?.value)     || 0;
  const paid     = parseFloat(document.getElementById(`ie-paid-${invId}`)?.value)     || 0;
  const status   = document.getElementById(`ie-status-${invId}`)?.value || 'unpaid';
  const net      = sub - comm - noulon - mashal - disc;

  try {
    await API.invoices.update(invId, {
      subtotal:        sub,
      commission_7pct: comm,
      noulon_total:    noulon,
      mashal_total:    mashal,
      discount:        disc,
      total_amount:    net,
      paid_amount:     paid,
      payment_status:  status
    });
    const updated = await API.invoices.list();
    store.set('invoices', updated);
    Toast.success('✅ تم تعديل الفاتورة');
    renderInvoicesPage();
  } catch(e) { AppError.log('saveInvoiceEdit', e, true); }
}

// ─── تحديث خصم فاتورة (quick edit) ─────────────────────────
let _dedTimer = {};
async function updateInvDed(invId, field, val) {
  const inv = (store.invs||[]).find(i => i.id===invId||i.id==invId);
  if (!inv) return;
  inv[field] = parseFloat(val)||0;
  const ded = (inv.commission_7pct||0)+(inv.noulon_total||0)+(inv.mashal_total||0)+(inv.discount||0);
  inv.total_amount = (inv.subtotal||0) - ded;
  const netEl = document.getElementById('net-'+invId);
  if (netEl) netEl.textContent = N(inv.total_amount) + ' جنيه';

  clearTimeout(_dedTimer[invId]);
  _dedTimer[invId] = setTimeout(async () => {
    try {
      await API.invoices.updateDeductions(invId, {
        subtotal:   inv.subtotal||0, commission: inv.commission_7pct||0,
        noulon:     inv.noulon_total||0, mashal: inv.mashal_total||0,
        discount:   inv.discount||0
      });
    } catch(e) { AppError.log('updateInvDed', e); }
  }, 1200);
}

// ─── حذف فاتورة ─────────────────────────────────────────────
async function delInvoice(id) {
  if (!confirm('حذف هذه الفاتورة؟')) return;
  try {
    await API.invoices.delete(id);
    store.set('invoices', (store.invs||[]).filter(i => i.id!==id&&i.id!=id));
    Toast.success('تم الحذف');
    renderInvoicesPage();
  } catch(e) { AppError.log('delInvoice', e, true); }
}

// ─── تسجيل دفعة على فاتورة ──────────────────────────────────
async function recordInvoicePayment(invId, remaining, invType, suppId, custId) {
  const amount = parseFloat(prompt(`أدخل المبلغ المدفوع (المتبقي: ${N(remaining)} ج):`, remaining));
  if (!amount || amount <= 0) return;
  if (amount > remaining) return Toast.error('المبلغ أكبر من المتبقي!');

  try {
    if (invType==='supplier' && suppId) {
      await API.payments.addExpense({ supplierId:suppId, amount, description:'دفعة مورد — فاتورة', type:'supplier_payment', date: store._state.currentDate });
    } else if (custId) {
      await API.payments.addCollection({ customerId:custId, amount, description:'دفعة فاتورة', date: store._state.currentDate });
    }

    const inv = (store.invs||[]).find(i => i.id===invId||i.id==invId);
    if (inv) {
      // ✅ الحساب الصحيح: paid_amount القديم + المبلغ الجديد
      const newPaid   = parseFloat(inv.paid_amount||0) + amount;
      const newTotal  = parseFloat(inv.total_amount||0);
      const newStatus = newPaid >= newTotal ? 'paid' : 'partial';

      await API.invoices.update(invId, {
        paid_amount:    newPaid,
        payment_status: newStatus
      });
    }

    const [invs, pays] = await Promise.all([API.invoices.list(), API.payments.list(store._state.currentDate)]);
    store.set('invoices', invs);
    store.set('payments', pays);
    Toast.success(`✅ تم تسجيل ${N(amount)} ج`);
    renderInvoicesPage();
    if (typeof renderDaySummary === 'function') renderDaySummary();
  } catch(e) { AppError.log('recordInvoicePayment', e, true); }
}

// ─── طباعة فاتورة ───────────────────────────────────────────
function printInvoice(invId) {
  const card = document.getElementById('inv-'+invId);
  if (!card) return;
  const w = window.open('','_blank');
  w.document.write(`
    فاتورة
    
      body{font-family:Cairo,Arial,sans-serif;padding:20px;color:#111;direction:rtl}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:8px;text-align:right}
      th{background:#f0f7f0}
      .netbox{background:#1a6b38;color:#fff;padding:12px;border-radius:8px;display:flex;justify-content:space-between;font-weight:900;margin-top:10px}
      button{display:none}
      [id^="inv-edit"]{display:none!important}
    
    ${card.innerHTML}`);
  w.document.close();
  setTimeout(() => w.print(), 500);
}
