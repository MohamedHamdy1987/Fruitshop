// ============================================================
// renderers/invoices.js — محدَّث
// ✅ زر تعديل على كل فاتورة (Inline Edit)
// ✅ إصلاح حساب paid_amount
// ✅ فاتورة تلقائية مُستقبَلة من sales.js
// ✅ إزالة updateInvDed غير الموجودة (استبدال بحساب مباشر)
// ============================================================

function renderInvoicesPage() {
  const c = document.getElementById('invoices-cont');
  if (!c) return;
  const invs = store.invs || [];
  if (!invs.length) {
    c.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🧾</div>
        <div class="empty-title">لا توجد فواتير</div>
        <div class="empty-sub">الفواتير تُنشأ تلقائياً عند نفاد الصنف</div>
      </div>`;
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
  <div class="card" style="margin-bottom:12px" id="inv-${inv.id}">
    <div style="background:#f8f8f8;padding:10px 14px;border-bottom:2px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
      <div>
        <span style="font-weight:900;font-size:1rem;">🧾 ${inv.invoice_number || 'فاتورة'}</span>
        <span style="margin-right:12px;font-size:0.8rem;">🚛 ${suppName} · 📅 ${new Date(dateStr).toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'})}</span>
      </div>
      <div style="display:flex;gap:8px;">
        <span style="background:${statusColor};color:#fff;border-radius:20px;padding:2px 10px;font-size:0.75rem;">${statusLabel}</span>
        <button onclick="toggleInvoiceEdit('${inv.id}')" style="background:var(--blue);color:#fff;border:none;border-radius:6px;padding:3px 10px;cursor:pointer;">✏️ تعديل</button>
        <button onclick="printInvoice('${inv.id}')" style="background:var(--gray);color:#fff;border:none;border-radius:6px;padding:3px 10px;cursor:pointer;">🖨️</button>
        <button onclick="delInvoice('${inv.id}')" style="background:var(--red);color:#fff;border:none;border-radius:6px;padding:3px 10px;cursor:pointer;">🗑️</button>
      </div>
    </div>

    <!-- تعديل Inline -->
    <div id="inv-edit-${inv.id}" style="display:none;padding:12px;background:#fffde7;border-bottom:1px solid #eee;">
      <div style="font-weight:700;margin-bottom:8px;">✏️ تعديل الفاتورة</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
        <div><label>الإجمالي الخام</label><input id="ie-subtotal-${inv.id}" type="number" step="0.01" value="${gross}" oninput="recalcInvNet('${inv.id}')"></div>
        <div><label>العمولة 7٪</label><input id="ie-comm-${inv.id}" type="number" step="0.01" value="${cm}" oninput="recalcInvNet('${inv.id}')"></div>
        <div><label>النولون</label><input id="ie-noulon-${inv.id}" type="number" step="0.01" value="${noulon}" oninput="recalcInvNet('${inv.id}')"></div>
        <div><label>المشال</label><input id="ie-mashal-${inv.id}" type="number" step="0.01" value="${mashal}" oninput="recalcInvNet('${inv.id}')"></div>
        <div><label>خصم إضافي</label><input id="ie-disc-${inv.id}" type="number" step="0.01" value="${disc}" oninput="recalcInvNet('${inv.id}')"></div>
        <div><label>الصافي المحسوب</label><input id="ie-net-${inv.id}" type="number" step="0.01" readonly style="background:#f0f0f0"></div>
        <div><label>المبلغ المدفوع</label><input id="ie-paid-${inv.id}" type="number" step="0.01" value="${paid}"></div>
        <div><label>حالة الدفع</label>
          <select id="ie-status-${inv.id}">
            <option value="unpaid" ${inv.payment_status==='unpaid'?'selected':''}>غير مدفوعة</option>
            <option value="partial" ${inv.payment_status==='partial'?'selected':''}>جزئية</option>
            <option value="paid" ${inv.payment_status==='paid'?'selected':''}>مدفوعة</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button onclick="saveInvoiceEdit('${inv.id}')" style="background:var(--orange);color:#fff;border:none;border-radius:8px;padding:8px 20px;cursor:pointer;">💾 حفظ التعديلات</button>
        <button onclick="toggleInvoiceEdit('${inv.id}')" style="background:#eee;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;">إلغاء</button>
      </div>
    </div>

    <!-- بنود الفاتورة -->
    ${items.length ? `
    <div style="padding:12px;">
      <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
        <thead><tr style="background:#f0f7f0;"><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>الوزن</th><th>السعر</th><th>الإجمالي</th></tr></thead>
        <tbody>
          ${items.map(item => `
          <tr>
            <td>${item.product?.name||'-'}</td>
            <td>${item.product?.unit||'-'}</td>
            <td>${N(item.quantity||0)}</td>
            <td>${item.weight_kg>0?N(item.weight_kg)+'ك':'-'}</td>
            <td>${N(item.unit_price)} ج</td>
            <td>${N(item.total)} ج</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr style="background:#eafaf1;"><td colspan="5" style="text-align:left">الإجمالي الخام</td><td>${N(gross)} ج</td></tr></tfoot>
      </table>
    </div>` : ''}

    <!-- ملخص الخصومات -->
    <div style="padding:8px 12px;background:#fef9e7;border-top:1px solid #f0d080;border-bottom:1px solid #f0d080;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;">
        <span>العمولة 7%: <strong>${N(cm)} ج</strong></span>
        <span>النولون: <strong>${N(noulon)} ج</strong></span>
        <span>المشال: <strong>${N(mashal)} ج</strong></span>
        ${disc>0?`<span>خصم إضافي: <strong>${N(disc)} ج</strong></span>`:''}
        <span style="color:var(--green);font-weight:900;">الصافي المستحق: ${N(total)} جنيه</span>
      </div>
    </div>

    <!-- المدفوعات والمتبقي -->
    ${paid > 0 ? `
    <div style="padding:8px 12px;background:#e8f8f0;">
      <div style="display:flex;justify-content:space-between;">
        <span>المدفوع: <strong>${N(paid)} ج</strong></span>
        <span style="color:${remaining>0?'var(--orange)':'var(--green)'}">المتبقي: ${N(remaining)} ج</span>
      </div>
    </div>` : ''}

    ${remaining > 0 ? `
    <div style="padding:12px;">
      <button onclick="recordInvoicePayment('${inv.id}', ${remaining}, '${inv.invoice_type}', '${inv.supplier_id||''}', '${inv.customer_id||''}')" 
        style="width:100%;background:var(--green);color:#fff;border:none;border-radius:8px;padding:8px;cursor:pointer;">💵 تسجيل دفعة</button>
    </div>` : ''}
  </div>`;
}

// إعادة حساب صافي الفاتورة أثناء التعديل
function recalcInvNet(invId) {
  const sub    = parseFloat(document.getElementById(`ie-subtotal-${invId}`)?.value) || 0;
  const comm   = parseFloat(document.getElementById(`ie-comm-${invId}`)?.value)   || 0;
  const noulon = parseFloat(document.getElementById(`ie-noulon-${invId}`)?.value) || 0;
  const mashal = parseFloat(document.getElementById(`ie-mashal-${invId}`)?.value) || 0;
  const disc   = parseFloat(document.getElementById(`ie-disc-${invId}`)?.value)   || 0;
  const net    = sub - comm - noulon - mashal - disc;
  const netField = document.getElementById(`ie-net-${invId}`);
  if (netField) netField.value = net.toFixed(2);
}

function toggleInvoiceEdit(invId) {
  const el = document.getElementById(`inv-edit-${invId}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function saveInvoiceEdit(invId) {
  const sub    = parseFloat(document.getElementById(`ie-subtotal-${invId}`)?.value) || 0;
  const comm   = parseFloat(document.getElementById(`ie-comm-${invId}`)?.value)   || 0;
  const noulon = parseFloat(document.getElementById(`ie-noulon-${invId}`)?.value) || 0;
  const mashal = parseFloat(document.getElementById(`ie-mashal-${invId}`)?.value) || 0;
  const disc   = parseFloat(document.getElementById(`ie-disc-${invId}`)?.value)   || 0;
  const paid   = parseFloat(document.getElementById(`ie-paid-${invId}`)?.value)   || 0;
  const status = document.getElementById(`ie-status-${invId}`)?.value || 'unpaid';
  const net    = sub - comm - noulon - mashal - disc;

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

async function delInvoice(id) {
  if (!confirm('حذف هذه الفاتورة؟')) return;
  try {
    await API.invoices.delete(id);
    store.set('invoices', (store.invs||[]).filter(i => i.id!==id && i.id!=id));
    Toast.success('تم الحذف');
    renderInvoicesPage();
  } catch(e) { AppError.log('delInvoice', e, true); }
}

async function recordInvoicePayment(invId, remaining, invType, suppId, custId) {
  const amount = parseFloat(prompt(`أدخل المبلغ المدفوع (المتبقي: ${N(remaining)} ج):`, remaining));
  if (!amount || amount <= 0) return;
  if (amount > remaining) return Toast.error('المبلغ أكبر من المتبقي!');

  try {
    if (invType === 'supplier' && suppId) {
      await API.payments.addExpense({
        supplierId: suppId,
        amount,
        description: 'دفعة مورد — فاتورة',
        type: 'supplier_payment',
        date: store._state.currentDate
      });
    } else if (custId) {
      await API.payments.addCollection({
        customerId: custId,
        amount,
        discount: 0,
        description: 'دفعة فاتورة',
        date: store._state.currentDate
      });
    }

    const inv = (store.invs||[]).find(i => i.id === invId || i.id == invId);
    if (inv) {
      const newPaid   = parseFloat(inv.paid_amount || 0) + amount;
      const newTotal  = parseFloat(inv.total_amount || 0);
      const newStatus = newPaid >= newTotal ? 'paid' : 'partial';
      await API.invoices.update(invId, {
        paid_amount: newPaid,
        payment_status: newStatus
      });
    }

    const [invs, pays] = await Promise.all([
      API.invoices.list(),
      API.payments.list(store._state.currentDate)
    ]);
    store.set('invoices', invs);
    store.set('payments', pays);
    Toast.success(`✅ تم تسجيل ${N(amount)} ج`);
    renderInvoicesPage();
    if (typeof renderDaySummary === 'function') renderDaySummary();
  } catch(e) { AppError.log('recordInvoicePayment', e, true); }
}

function printInvoice(invId) {
  const card = document.getElementById(`inv-${invId}`);
  if (!card) return;
  const w = window.open('', '_blank');
  w.document.write(`
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>فاتورة</title>
      <style>
        body{font-family:Cairo,Arial,sans-serif;padding:20px;color:#111;direction:rtl}
        table{width:100%;border-collapse:collapse;margin:10px 0}
        th,td{border:1px solid #ddd;padding:8px;text-align:right}
        th{background:#f0f7f0}
        .netbox{background:#1a6b38;color:#fff;padding:12px;border-radius:8px;display:flex;justify-content:space-between;font-weight:900;margin-top:10px}
        button, .no-print{display:none}
        [id^="inv-edit"]{display:none!important}
      </style>
    </head>
    <body>
      ${card.innerHTML}
    </body>
    </html>
  `);
  w.document.close();
  setTimeout(() => w.print(), 500);
}