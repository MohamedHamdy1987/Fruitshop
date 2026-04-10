// ============================================================
// renderers/invoices.js — نظام الفواتير الاحترافي
// ============================================================

// ─── عرض صفحة الفواتير ──────────────────────────────────────
function renderInvoicesPage() {
  const c = document.getElementById('invoices-cont');
  if (!c) return;
  const invs = store.invs || [];
  if (!invs.length) {
    c.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🧾</div>
      <div class="empty-title">لا توجد فواتير</div>
      <div class="empty-sub">ستُنشأ الفواتير تلقائياً عند اكتمال بيع دفعة مورد</div>
    </div>`;
    return;
  }
  c.innerHTML = invs.map(inv => _renderInvoiceCard(inv)).join('');
}

function _renderInvoiceCard(inv) {
  const gross  = parseFloat(inv.subtotal       || 0);
  const cm     = parseFloat(inv.commission_7pct || 0);
  const noulon = parseFloat(inv.noulon_total    || 0);
  const mashal = parseFloat(inv.mashal_total    || 0);
  const disc   = parseFloat(inv.discount        || 0);
  const total  = parseFloat(inv.total_amount    || 0);
  const paid   = parseFloat(inv.paid_amount     || 0);
  const remaining = total - paid;

  const statusColors = { paid:'var(--green)', partial:'var(--orange)', unpaid:'var(--red)' };
  const statusText   = { paid:'مدفوعة ✅', partial:'جزئية ⏳', unpaid:'غير مدفوعة ❌' };
  const statusColor  = statusColors[inv.payment_status] || 'var(--gray)';
  const statusLabel  = statusText[inv.payment_status]   || '-';

  const items = inv.items || [];
  const suppName = inv.supplier?.name || inv.supplierName || '-';
  const custName = inv.customer?.name || inv.customerName || null;
  const entityName = inv.invoice_type==='supplier' ? suppName : (custName||'-');
  const entityIcon = inv.invoice_type==='supplier' ? '🚛' : '👤';
  const dateStr = inv.invoice_date || inv.date || '-';

  return `<div class="card" id="inv-${inv.id}">
    <div class="ch g" style="justify-content:space-between">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <h2 style="font-size:0.95rem">🧾 ${inv.invoice_number || 'فاتورة'}</h2>
          <span style="background:${statusColor};color:#fff;border-radius:6px;padding:2px 8px;font-size:0.72rem;font-weight:700">${statusLabel}</span>
        </div>
        <div style="font-size:0.76rem;color:var(--gray);margin-top:3px">
          ${entityIcon} ${entityName} · 📅 ${new Date(dateStr).toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'})}
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center" class="no-print">
        <button class="btn btn-b btn-sm" onclick="printInvoice('${inv.id}')">🖨️</button>
        <button class="btn btn-r btn-sm" onclick="delInvoice('${inv.id}')">🗑️</button>
      </div>
    </div>
    <div class="cb">
      ${items.length ? `
      <div style="overflow-x:auto;margin-bottom:10px">
        <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
          <thead><tr style="background:#f0f7f0">
            <th style="padding:6px">الصنف</th><th>الوحدة</th>
            <th>الكمية</th><th>الوزن</th><th>السعر</th><th>الإجمالي</th>
          </tr></thead>
          <tbody>
            ${items.map(item => `<tr>
              <td style="padding:5px;font-weight:700">${item.product?.name||'-'}</td>
              <td style="padding:5px">${item.product?.unit||'-'}</td>
              <td style="padding:5px">${N(item.quantity||0)}</td>
              <td style="padding:5px">${item.weight_kg>0?N(item.weight_kg)+' ك':'-'}</td>
              <td style="padding:5px">${N(item.unit_price)} ج</td>
              <td style="padding:5px;font-weight:900;color:var(--green)">${N(item.total)} ج</td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr style="background:#eafaf1;font-weight:900">
            <td colspan="5" style="text-align:right;padding:6px">الإجمالي الخام</td>
            <td style="padding:6px">${N(gross)} ج</td>
          </tr></tfoot>
        </table>
      </div>` : ''}

      <!-- الخصومات -->
      <div style="background:#fef9e7;border:1.5px solid #f0d080;border-radius:9px;padding:11px;margin-bottom:10px">
        <div style="font-size:0.84rem;font-weight:800;color:#7a5c00;margin-bottom:8px">✂️ الخصومات</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:7px">
          ${_dedRow(inv.id,'commission_7pct','العمولة 7٪',cm)}
          ${_dedRow(inv.id,'noulon_total','النولون',noulon)}
          ${_dedRow(inv.id,'mashal_total','المشال',mashal)}
          ${_dedRow(inv.id,'discount','خصم إضافي',disc)}
        </div>
        <div style="margin-top:8px;font-size:0.83rem;color:#7a5c00;font-weight:700">
          إجمالي الخصومات: <strong id="ded-${inv.id}">${N(cm+noulon+mashal+disc)} ج</strong>
        </div>
      </div>

      <!-- الصافي والدفع -->
      <div class="netbox">
        <span>💰 الصافي المستحق</span>
        <span id="net-${inv.id}">${N(total)} جنيه</span>
      </div>
      ${remaining > 0 && remaining < total ? `
      <div style="display:flex;justify-content:space-between;background:var(--red-light);border-radius:8px;padding:8px 12px;margin-top:8px;font-size:0.83rem;font-weight:700">
        <span>المدفوع: ${N(paid)} ج</span>
        <span style="color:var(--red)">المتبقي: ${N(remaining)} ج</span>
      </div>` : ''}
      ${remaining > 0 ? `
      <button class="btn btn-g btn-sm" style="margin-top:10px" onclick="recordInvoicePayment('${inv.id}',${remaining},'${inv.invoice_type}','${inv.supplier_id||''}','${inv.customer_id||''}')">
        💵 تسجيل دفعة
      </button>` : ''}
    </div>
  </div>`;
}

function _dedRow(invId, field, label, val) {
  return `<div>
    <label style="font-size:0.75rem;font-weight:700;display:block;margin-bottom:3px;color:#7a5c00">${label}</label>
    <div style="display:flex;align-items:center;gap:4px">
      <input type="number" value="${val}" min="0" style="width:80px;text-align:center"
        oninput="updateInvDed('${invId}','${field}',this.value)">
      <span style="font-size:0.75rem">ج</span>
    </div>
  </div>`;
}

// ─── تحديث خصم فاتورة ───────────────────────────────────────
let _dedTimer = {};
async function updateInvDed(invId, field, val) {
  // تحديث محلي فوري
  const inv = (store.invs||[]).find(i => i.id===invId||i.id==invId);
  if (!inv) return;
  inv[field] = parseFloat(val)||0;
  const ded = (inv.commission_7pct||0)+(inv.noulon_total||0)+(inv.mashal_total||0)+(inv.discount||0);
  inv.total_amount = (inv.subtotal||0) - ded;
  const dedEl = document.getElementById('ded-'+invId);
  const netEl = document.getElementById('net-'+invId);
  if (dedEl) dedEl.textContent = N(ded) + ' ج';
  if (netEl) netEl.textContent = N(inv.total_amount) + ' جنيه';

  // حفظ على السحابة بعد توقف الكتابة
  clearTimeout(_dedTimer[invId]);
  _dedTimer[invId] = setTimeout(async () => {
    try {
      await API.invoices.updateDeductions(invId, {
        subtotal:    inv.subtotal||0,
        commission:  inv.commission_7pct||0,
        noulon:      inv.noulon_total||0,
        mashal:      inv.mashal_total||0,
        discount:    inv.discount||0
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
    renderSuppList();
  } catch(e) { AppError.log('delInvoice', e, true); }
}

// ─── تسجيل دفعة على فاتورة ──────────────────────────────────
async function recordInvoicePayment(invId, remaining, invType, suppId, custId) {
  const amount = parseFloat(prompt(`أدخل المبلغ المدفوع (المتبقي: ${N(remaining)} ج):`, remaining));
  if (!amount || amount <= 0) return;
  if (amount > remaining) return Toast.error('المبلغ أكبر من المتبقي!');
  try {
    if (invType==='supplier' && suppId) {
      await API.payments.addExpense({ supplierId:suppId, amount, description:'دفعة مورد — فاتورة', type:'supplier_payment' });
    } else if (custId) {
      await API.payments.addCollection({ customerId:custId, amount, description:'دفعة فاتورة', invoiceId:invId });
    }
    // تحديث paid_amount في الفاتورة
    await sb.from('invoices')
      .update({ paid_amount: sb.rpc ? undefined : parseFloat(remaining) + amount })
      .eq('id', invId)
      .eq('company_id', currentUser.company_id);

    const updated = await API.invoices.list();
    store.set('invoices', updated);
    Toast.success(`✅ تم تسجيل ${N(amount)} ج`);
    renderInvoicesPage();
  } catch(e) { AppError.log('recordInvoicePayment', e, true); }
}

// ─── طباعة فاتورة ───────────────────────────────────────────
function printInvoice(invId) {
  const card = document.getElementById('inv-'+invId);
  if (!card) return;
  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl">
    <head><meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
    <style>
      body{font-family:Cairo,sans-serif;padding:20px;color:#111}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:8px;text-align:right}
      th{background:#f0f7f0}
      .netbox{background:#1a6b38;color:#fff;padding:12px;border-radius:8px;display:flex;justify-content:space-between;font-weight:900;margin-top:10px}
    </style></head>
    <body>${card.outerHTML}</body></html>`);
  w.document.close();
  w.print();
}

// ─── إنشاء فاتورة تلقائية عند انتهاء دفعة مورد ─────────────
async function autoInvoiceForBatch(batchId) {
  try {
    const batch = (store.inv||[]).find(b => b.batch_id===batchId);
    if (!batch) return;
    const todaySales = (store.sales||[]).filter(s => s.batch_id===batchId);
    if (!todaySales.length) return;

    const subtotal   = todaySales.reduce((s,x) => s+parseFloat(x.total_amount||0), 0);
    const commission = Math.round(subtotal * 0.07);
    const noulon     = parseFloat(batch.noulon||0);
    const mashal     = parseFloat(batch.mashal||0);
    const net        = subtotal - commission - noulon - mashal;

    const inv = await API.invoices.create({
      type:       'supplier',
      supplierId: batch.supplier_id,
      date:       store._state.currentDate,
      subtotal,
      commission,
      noulon,
      mashal,
      discount:   0,
      total:      net,
      items:      todaySales.map(s => ({
        productId: s.product_id,
        batchId:   batchId,
        quantity:  parseFloat(s.quantity||0),
        weightKg:  parseFloat(s.weight_kg||0),
        unitPrice: parseFloat(s.unit_price||0)
      }))
    });

    const updated = await API.invoices.list();
    store.set('invoices', updated);
    Toast.success(`✅ فاتورة ${inv.invoice_number} — الصافي: ${N(net)} ج`);
  } catch(e) { AppError.log('autoInvoiceForBatch', e); }
}

// للتوافق مع الكود القديم
function generateInvoice() { Toast.info('ستُنشأ الفواتير تلقائياً عند اكتمال بيع الدفعة'); }
function generateInvoiceFor() { generateInvoice(); }
function goToInvoice(invId) {
  showPage('invoices', document.querySelector('[data-page="invoices"]'));
  setTimeout(() => {
    const el = document.getElementById('inv-'+invId);
    if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
  }, 200);
}
