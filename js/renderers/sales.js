// ============================================================
// js/renderers/sales.js — صفحة المبيعات
// workflow السوق الحقيقي: عرض الدفعات + بيع مباشر من كل دفعة
// يعتمد على: incoming_batches (store.inv) + daily_sales (API)
// ============================================================

// ─────────────────────────────────────────────────────────────
// حالة الصفحة المحلية (UI فقط)
// ─────────────────────────────────────────────────────────────
let _activeBatchId = null;

// ─────────────────────────────────────────────────────────────
// renderSalesTable — نقطة الدخول الرئيسية (مُحسّنة)
// ─────────────────────────────────────────────────────────────
async function renderSalesTable() {
  const tbody = document.getElementById('sales-tbody');
  if (!tbody) return;

  const sales = store.sales || [];
  
  // 1️⃣ نجيب كل الـ batch IDs الفريدة من المبيعات
  const batchIdsFromSales = [...new Set(sales.map(s => s.batch_id).filter(Boolean))];
  
  // 2️⃣ نجيب الدفعات من المخزون
  const inv = store.inv || [];
  
  // 3️⃣ نبني قاموس (Map) للدفعات المتاحة
  const batchMap = new Map();
  inv.forEach(b => batchMap.set(b.batch_id, b));
  
  // 4️⃣ لو فيه دفعات في المبيعات مش موجودة في المخزون (خلصت)، نبني بيانات مؤقتة
  batchIdsFromSales.forEach(bid => {
    if (!batchMap.has(bid)) {
      const batchSales = sales.filter(s => s.batch_id === bid);
      const firstSale = batchSales[0];
      const totalQty = batchSales.reduce((sum, s) => sum + parseFloat(s.quantity || 0), 0);
      const totalWeight = batchSales.reduce((sum, s) => sum + parseFloat(s.weight_kg || 0), 0);
      
      batchMap.set(bid, {
        batch_id: bid,
        product_name: firstSale?.product?.name || 'منتج',
        supplier_name: '-',
        unit: firstSale?.product?.unit || 'وحدة',
        remaining_qty: 0,
        original_qty: totalQty + totalWeight,
        batch_date: firstSale?.sale_date || store._state.currentDate,
        carryover_from: null,
        cost_per_unit: 0
      });
    }  });
  
  // 5️⃣ نحول الـ Map لقائمة
  const displayBatches = Array.from(batchMap.values());

  if (!displayBatches.length && !sales.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="color:#aaa;padding:22px;text-align:center">
      لا توجد بضاعة — أضف دفعة من تبويب المخزون
    </td></tr>`;
    _updateDayTotal(sales);
    return;
  }

  let html = '';
  displayBatches.forEach(batch => {
    const batchSales  = sales.filter(s => s.batch_id === batch.batch_id);
    const soldQty     = batchSales.reduce((s, x) => s + parseFloat(x.quantity  || 0), 0);
    const soldWt      = batchSales.reduce((s, x) => s + parseFloat(x.weight_kg || 0), 0);
    const batchTotal  = batchSales.reduce((s, x) => s + parseFloat(x.total_amount || 0), 0);
    const remQty      = parseFloat(batch.remaining_qty || 0);
    const origQty     = parseFloat(batch.original_qty  || batch.quantity || remQty + soldQty);
    const isOpen      = _activeBatchId === batch.batch_id;
    const isDone      = remQty <= 0;
    const isCarry     = !!batch.carryover_from;
    const date        = new Date(batch.batch_date).toLocaleDateString('ar-EG',{month:'short',day:'numeric'});

    html += `
    <tr style="cursor:pointer;${isOpen ? 'background:#eafaf1;font-weight:700;' : isDone ? 'background:#fafafa;opacity:.75;' : ''}"
        id="br-${batch.batch_id}" onclick="toggleBatch('${batch.batch_id}')">
      <td style="padding:7px 5px;text-align:center;font-size:0.76rem;color:var(--gray)">
        ${isCarry ? '<span title="باقي من يوم سابق" style="color:#8e24aa">🔄</span>' : ''}
        ${date}
      </td>
      <td style="padding:7px 5px;text-align:center">
        <strong style="color:var(--orange);font-size:0.8rem">${batch.supplier_name || '-'}</strong>
      </td>
      <td style="padding:7px 5px;text-align:center">
        <strong style="color:#0e6655">${batch.product_name}</strong>
        <div style="font-size:0.7rem;color:var(--gray)">${batch.unit}</div>
      </td>
      <td style="padding:7px 5px;text-align:center;color:var(--gray)">
        ${N(origQty)}
      </td>
      <td style="padding:7px 5px;text-align:center;color:var(--green);font-weight:800">
        ${N(soldQty)}${soldWt > 0 ? `<div style="font-size:.69rem;color:var(--gray)">${N(soldWt)}ك</div>` : ''}
      </td>
      <td style="padding:7px 5px;text-align:center;font-weight:800;color:${isDone ? 'var(--red)' : 'var(--blue)'}">
        ${N(remQty)} ${isDone ? '✅' : ''}
      </td>
      <td style="padding:7px 5px;text-align:center;font-weight:900;color:var(--green)">        ${N(batchTotal)} ج
      </td>
      <td style="padding:7px 5px;text-align:center">
        ${isOpen ? '▲' : '▼'}
      </td>
      <td style="padding:7px 5px" onclick="event.stopPropagation()">
        <button class="btn btn-r btn-xs" onclick="deleteBatchFromSales('${batch.batch_id}')">🗑️</button>
      </td>
    </tr>`;

    if (isOpen) {
      const salesRows = batchSales.map(sl => {
        const cust   = sl.customer?.name || (store.custs||[]).find(c=>c.id===sl.customer_id)?.name;
        const isCash = sl.is_cash || !sl.customer_id;
        return `<tr style="background:#f8fff8;font-size:.79rem">
          <td style="padding:4px 6px">${sl.quantity > 0 ? N(sl.quantity) : '-'}</td>
          <td style="padding:4px 6px">
            ${isCash
              ? '<span style="background:#d5f5e3;color:var(--green);border-radius:4px;padding:1px 6px;font-size:.69rem;font-weight:800">نقدي</span>'
              : `<span style="font-weight:700">${cust || 'عميل'}</span>`}
          </td>
          <td style="padding:4px 6px">${sl.weight_kg > 0 ? N(sl.weight_kg) + 'ك' : '-'}</td>
          <td style="padding:4px 6px">${N(sl.unit_price)} ج</td>
          <td style="padding:4px 6px;font-weight:900;color:var(--green)">${N(sl.total_amount)} ج</td>
          <td style="padding:4px 6px">
            <button class="btn btn-r btn-xs"
              onclick="event.stopPropagation();deleteSaleLine('${sl.id}','${batch.batch_id}')">🗑️</button>
          </td>
        </tr>`;
      }).join('');

      html += `
      <tr style="background:#f0faf5"><td colspan="9" style="padding:0">
        <div style="padding:10px 14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong style="color:var(--green);font-size:.86rem">
              📋 مبيعات: ${batch.product_name}
              <span style="font-weight:400;font-size:.75rem;color:var(--gray);margin-right:6px">${batchSales.length} بيعة</span>
            </strong>
            <button class="btn btn-g btn-sm" onclick="event.stopPropagation();openInlineSaleForm('${batch.batch_id}')">
              + بيعة جديدة
            </button>
          </div>

          ${batchSales.length ? `
          <table style="width:100%;border-collapse:collapse;font-size:.79rem;margin-bottom:8px">
            <thead>
              <tr style="background:#e8f8ee">
                <th style="padding:4px 6px">عدد</th>
                <th style="padding:4px 6px">العميل</th>                <th style="padding:4px 6px">وزن</th>
                <th style="padding:4px 6px">سعر</th>
                <th style="padding:4px 6px">المبلغ</th>
                <th style="padding:4px 6px"></th>
              </tr>
            </thead>
            <tbody>${salesRows}</tbody>
            <tfoot>
              <tr style="background:#eafaf1;font-weight:900">
                <td colspan="4" style="text-align:right;padding:5px;color:var(--green)">الإجمالي</td>
                <td style="padding:5px;color:var(--green)">${N(batchTotal)} ج</td>
                <td></td>
              </tr>
            </tfoot>
          </table>` : '<p style="color:#aaa;text-align:center;padding:8px 0">لا توجد مبيعات على هذه الدفعة</p>'}

          <div id="sf-${batch.batch_id}"></div>
        </div>
      </td></tr>`;
    }
  });

  tbody.innerHTML = html;
  _updateDayTotal(sales);
}

// ─────────────────────────────────────────────────────────────
// goToProduct — الانتقال للمبيعات وفتح دفعة محددة
// ─────────────────────────────────────────────────────────────
function goToProduct(batchId) {
  // ✅ رسالة فورية تخبرك إن الزرار اشتغل
  Toast.info('🔄 جاري فتح الدفعة: ' + batchId);

  if (!batchId) {
    Toast.error('❌ خطأ: رقم الدفعة مفقود');
    return;
  }

  // ✅ بحث آمن يعمل حتى لو الأرقام كنصوص
  const batch = (store.inv || []).find(b => String(b.batch_id) === String(batchId));
  if (!batch) {
    Toast.error('❌ الدفعة غير موجودة في المخزون');
    return;
  }

  // ✅ تأكد إن دالة التنقل موجودة قبل الاستدعاء
  if (typeof showPage !== 'function') {
    Toast.error('❌ خطأ في النظام: ملف app.js غير محمّل');
    return;
  }

  // ✅ التنفيذ الفعلي
  _activeBatchId = batchId;
  showPage('sales', document.querySelector('[data-page="sales"]'));

  // ✅ فتح التفاصيل بعد رندر الصفحة
  setTimeout(() => {
    if (typeof toggleBatch === 'function') {
      toggleBatch(batchId);
      Toast.success('✅ تم فتح الدفعة بنجاح');
    }
  }, 300);
}

// ─────────────────────────────────────────────────────────────// toggleBatch — فتح/إغلاق تفاصيل الدفعة
// ─────────────────────────────────────────────────────────────
function toggleBatch(batchId) {
  _activeBatchId = _activeBatchId === batchId ? null : batchId;
  renderSalesTable();
}

// ─────────────────────────────────────────────────────────────
// openInlineSaleForm — نموذج البيع المدمج في الصف
// ─────────────────────────────────────────────────────────────
function openInlineSaleForm(batchId) {
  const d = document.getElementById('sf-' + batchId);
  if (!d) return;

  if (d.innerHTML.trim()) { d.innerHTML = ''; return; }

  const batch = (store.inv||[]).find(b => b.batch_id === batchId);
  const maxQty = batch ? parseFloat(batch.remaining_qty||0) : 0;
  const unit   = batch?.unit || '';

  const custOpts = '<option value="">نقدي 💵</option>' +
    (store.custs||[]).map(c =>
      `<option value="${c.id}">${c.name}${c.balance>0?` (${N(c.balance)} ج)`  :''}</option>`
    ).join('');

  d.innerHTML = `
  <div style="background:#f0faf5;border-radius:9px;padding:11px;margin-top:8px;border:1.5px solid #a2d9ce">
    <div style="font-weight:800;color:var(--green);margin-bottom:8px;font-size:.85rem">+ بيعة جديدة</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:7px;margin-bottom:8px">
      <div>
        <label class="lbl">عدد (${unit})</label>
        <input type="number" id="sf-qty-${batchId}" placeholder="0" min="0" max="${maxQty}"
          step="0.01" oninput="calcSF('${batchId}')">
      </div>
      <div>
        <label class="lbl">وزن (كيلو)</label>
        <input type="number" id="sf-wt-${batchId}" placeholder="0" min="0"