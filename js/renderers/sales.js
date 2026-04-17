// ============================================================
// js/renderers/sales.js — نظام الوساطة
// ✅ البيع من الدفعة
// ✅ عرض المبيعات مع المورد والصنف والكمية والسعر والإجمالي
// ✅ فاتورة تلقائية فقط عند remaining_qty = 0
// ✅ لا تختفي الدفعة إلا عند انتهاء الكمية
// ============================================================

let _activeBatchId = null;

async function renderSalesTable() {
  const tbody = document.getElementById('sales-tbody');
  if (!tbody) return;

  try {
    const [inv, sales] = await Promise.all([
      API.inventory.list(),
      API.sales.list(store._state.currentDate)
    ]);
    store.set('inventory', inv);
    store.set('sales', sales);

    if (!inv.length && !sales.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#888;padding:32px">
        📦 لا يوجد نازل — أضف دفعة من صفحة النازل أولاً
      </td></tr>`;
      _updateDayTotal(sales);
      return;
    }

    // بناء Map من الدفعات
    const batchMap = new Map();
    inv.forEach(b => batchMap.set(b.id, b));

    // إضافة الدفعات المنتهية من المبيعات (للدفعات المصفاة)
    const batchIdsInSales = [...new Set(sales.map(s => s.batch_id).filter(Boolean))];
    const missingIds = batchIdsInSales.filter(id => !batchMap.has(id));
    if (missingIds.length) {
      const { data: finishedBatches } = await sb.from('incoming_batches')
        .select('*, product:products(name,unit), supplier:suppliers(name)')
        .in('id', missingIds)
        .eq('company_id', currentUser.company_id);
      (finishedBatches || []).forEach(b => {
        batchMap.set(b.id, {
          ...b,
          batch_id: b.id,
          product_name: b.product?.name || 'منتج',
          supplier_name: b.supplier?.name || 'غير محدد',
          unit: b.product?.unit || 'وحدة'
        });
      });
    }

    const allBatches = Array.from(batchMap.values());
    let html = '';

    for (const batch of allBatches) {
      const batchId = batch.id || batch.batch_id;
      const batchSales = sales.filter(s => s.batch_id === batchId);
      const soldQty = batchSales.reduce((s, x) => s + parseFloat(x.quantity || 0), 0);
      const soldWt = batchSales.reduce((s, x) => s + parseFloat(x.weight_kg || 0), 0);
      const batchTotal = batchSales.reduce((s, x) => s + parseFloat(x.total_amount || 0), 0);
      const remQty = parseFloat(batch.remaining_qty || 0);
      const origQty = parseFloat(batch.quantity || remQty + soldQty);
      const isOpen = (_activeBatchId === batchId);
      const isDone = remQty <= 0 || batch.status === 'finished';
      const date = new Date(batch.batch_date || batch.created_at || new Date())
        .toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });

      html += `
      <tr onclick="toggleBatch('${batchId}')" style="cursor:pointer; ${isDone ? 'background:#f9f9f9;opacity:.85' : ''}">
        <td>${date}</td>
        <td><strong>${batch.supplier_name || 'غير محدد'}</strong></td>
        <td><strong>${batch.product_name}</strong><br><small>${batch.unit}</small></td>
        <td>${N(origQty)}</td>
        <td>${N(soldQty)}${soldWt > 0 ? `<br><small>${N(soldWt)}ك</small>` : ''}</td>
        <td style="color:${isDone ? 'var(--green)' : 'inherit'}">
          ${isDone ? '✅ نفد' : N(remQty) + ' ' + batch.unit}
        </td>
        <td><strong>${N(batchTotal)} ج</strong></td>
        <td>${isOpen ? '▲' : '▼'}</td>
        <td>
          <button onclick="event.stopPropagation();deleteBatchSales('${batchId}')"
            style="background:none;border:none;cursor:pointer;color:var(--red);font-size:16px">🗑️</button>
        </td>
      </tr>`;

      if (isOpen) {
        // عرض تفاصيل المبيعات
        const salesRows = batchSales.map(sl => {
          const custName = sl.customer?.name || (store.custs||[]).find(c=>c.id===sl.customer_id)?.name;
          const isCash = sl.is_cash || !sl.customer_id;
          return `
          <tr style="background:#fafff8;font-size:13px" id="sale-row-${sl.id}">
            <td style="padding:5px">${sl.quantity > 0 ? N(sl.quantity) : '—'}</td>
            <td>${isCash
              ? '<span style="color:var(--green)">نقدي 💵</span>'
              : `<span style="color:var(--blue)">${custName || 'عميل'}</span>`}
            </td>
            <td>${sl.weight_kg > 0 ? N(sl.weight_kg) + 'ك' : '—'}</td>
            <td>${N(sl.unit_price)} ج</td>
            <td><strong>${N(sl.total_amount)} ج</strong></td>
            <td>
              <button onclick="openSaleEdit('${sl.id}','${batchId}')"
                style="background:var(--blue);color:#fff;border:none;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:11px">✏️</button>
              <button onclick="deleteSale('${sl.id}','${batchId}')"
                style="background:var(--red);color:#fff;border:none;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:11px;margin-right:3px">🗑️</button>
            </td>
           </tr>`;
        }).join('');

        html += `
        <tr>
          <td colspan="9" style="padding:0;background:#f0faf5">
            <div style="padding:12px 16px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <strong style="color:var(--green)">📋 مبيعات: ${batch.product_name} (${batchSales.length} بيعة)</strong>
                ${!isDone ? `
                <button onclick="openInlineSaleForm('${batchId}', ${remQty})"
                  style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:7px 16px;cursor:pointer;font-weight:700">
                  + بيعة جديدة
                </button>` : '<span style="color:var(--green);font-weight:700">✅ الدفعة منتهية</span>'}
              </div>

              ${batchSales.length ? `
              <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead><tr style="background:#e8f8f0;color:#0e6655">
                  <th style="padding:6px;text-align:right">عدد</th>
                  <th>العميل</th><th>وزن</th><th>سعر</th><th>المبلغ</th><th>إجراء</th>
                </tr></thead>
                <tbody>${salesRows}</tbody>
                <tfoot><tr style="background:#d5f5e3;font-weight:700">
                  <td colspan="4" style="padding:6px;text-align:right">إجمالي الدفعة</td>
                  <td>${N(batchTotal)} ج</td>
                  <td></td>
                </tr></tfoot>
              </table>` : '<p style="color:#888;text-align:center;padding:10px">لا توجد مبيعات بعد</p>'}

              <div id="sf-${batchId}" style="margin-top:8px"></div>
              <div id="se-${batchId}" style="margin-top:8px"></div>
            </div>
          </td>
        </tr>`;
      }
    }

    tbody.innerHTML = html || `<tr><td colspan="9" style="text-align:center;color:#888;padding:20px">لا توجد دفعات</td></tr>`;
    _updateDayTotal(sales);

  } catch(e) {
    AppError.log('renderSalesTable', e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="color:var(--red);text-align:center;padding:20px">
      ❌ خطأ: ${e.message}
    </td></tr>`;
  }
}

function toggleBatch(batchId) {
  _activeBatchId = _activeBatchId === batchId ? null : batchId;
  renderSalesTable();
}

// ─── نموذج بيعة جديدة ────────────────────────────────────────
function openInlineSaleForm(batchId, maxQty) {
  const container = document.getElementById(`sf-${batchId}`);
  if (!container) return;
  if (container.innerHTML.trim()) { container.innerHTML = ''; return; }

  const batch = (store.inv || []).find(b => b.id === batchId || b.batch_id === batchId);
  const unit  = batch?.unit || 'وحدة';

  const custOpts = '<option value="">نقدي 💵</option>' +
    (store.custs || []).map(c =>
      `<option value="${c.id}">${c.name}${c.balance > 0 ? ` (${N(c.balance)} ج)` : ''}</option>`
    ).join('');

  container.innerHTML = `
  <div style="background:#fff;border:2px solid var(--green);border-radius:10px;padding:14px">
    <div style="font-weight:700;color:var(--green);margin-bottom:10px">+ بيعة جديدة</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px">
      <div>
        <label style="font-size:12px;color:#666">عدد (${unit})</label>
        <input id="sf-qty-${batchId}" type="number" step="0.01" min="0"
          oninput="calcSF('${batchId}')" placeholder="0"
          style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px">
      </div>
      <div>
        <label style="font-size:12px;color:#666">وزن (كيلو)</label>
        <input id="sf-wt-${batchId}" type="number" step="0.01" min="0"
          oninput="calcSF('${batchId}')" placeholder="0"
          style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px">
      </div>
      <div>
        <label style="font-size:12px;color:#666">سعر الوحدة</label>
        <input id="sf-price-${batchId}" type="number" step="0.01" min="0"
          oninput="calcSF('${batchId}')" placeholder="0"
          style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px">
      </div>
      <div>
        <label style="font-size:12px;color:#666">الإجمالي</label>
        <input id="sf-tot-${batchId}" type="number" step="0.01" readonly placeholder="0"
          style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px;background:#f5f5f5">
      </div>
      <div>
        <label style="font-size:12px;color:#666">العميل</label>
        <select id="sf-cust-${batchId}" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px">${custOpts}</select>
      </div>
    </div>
    <div style="font-size:12px;color:#888;margin:6px 0">متبقي: ${N(maxQty)} ${unit}</div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button onclick="confirmSale('${batchId}', ${maxQty})"
        style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:9px 20px;cursor:pointer;font-weight:700;flex:1">✅ تأكيد</button>
      <button onclick="document.getElementById('sf-${batchId}').innerHTML=''"
        style="background:#eee;border:none;border-radius:8px;padding:9px 16px;cursor:pointer">إلغاء</button>
    </div>
  </div>`;
}

function calcSF(batchId) {
  const qty   = parseFloat(document.getElementById(`sf-qty-${batchId}`)?.value)   || 0;
  const wt    = parseFloat(document.getElementById(`sf-wt-${batchId}`)?.value)    || 0;
  const price = parseFloat(document.getElementById(`sf-price-${batchId}`)?.value) || 0;
  const tot   = document.getElementById(`sf-tot-${batchId}`);
  if (tot) tot.value = Number(((wt > 0 ? wt : qty) * price).toFixed(2)) || '';
}

// ─── تأكيد البيعة ────────────────────────────────────────────
async function confirmSale(batchId, maxQty) {
  const batch = (store.inv || []).find(b => b.id === batchId || b.batch_id === batchId);
  if (!batch) return Toast.error('الدفعة غير موجودة');

  const qty    = parseFloat(document.getElementById(`sf-qty-${batchId}`)?.value)   || 0;
  const wt     = parseFloat(document.getElementById(`sf-wt-${batchId}`)?.value)    || 0;
  const price  = parseFloat(document.getElementById(`sf-price-${batchId}`)?.value) || 0;
  const custId = document.getElementById(`sf-cust-${batchId}`)?.value || '';
  const units  = wt > 0 ? wt : qty;

  if (!units || !price) return Toast.warning('أدخل الكمية والسعر');
  if (qty > 0 && qty > maxQty) return Toast.warning(`الكمية (${N(qty)}) أكبر من المتبقي (${N(maxQty)})`);

  const isCash = !custId;
  const total  = parseFloat((units * price).toFixed(2));

  const btn = document.querySelector(`#sf-${batchId} button`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  try {
    // 1. تسجيل البيعة
    await API.sales.add({
      productId:  batch.product_id,
      batchId,
      customerId: custId || null,
      quantity:   qty,
      weightKg:   wt,
      unitPrice:  price,
      total,
      isCash,
      date: store._state.currentDate
    });

    // 2. لو نقدي → خزنة
    if (isCash) {
      await API.payments.addCashSaleCollection({
        amount:      total,
        productName: batch.product_name,
        date:        store._state.currentDate
      });
    }

    Toast.success(`✅ ${N(total)} ج — ${batch.product_name}`);
    document.getElementById(`sf-${batchId}`).innerHTML = '';

    // 3. جلب الدفعة المحدّثة للتحقق من remaining_qty
    const { data: updatedBatch } = await sb.from('incoming_batches')
      .select('remaining_qty, noulon, mashal, supplier_id, product_id')
      .eq('id', batchId)
      .single();

    const newRem = parseFloat(updatedBatch?.remaining_qty || 0);

    // 4. لو نفد → فاتورة تصفية تلقائية
    if (newRem <= 0) {
      await _settleBatch(batchId, batch, updatedBatch);
    }

    // 5. إعادة رسم
    await renderSalesTable();
    if (typeof renderDaySummary === 'function') renderDaySummary();
    if (typeof renderCollections === 'function') renderCollections();

  } catch(e) {
    AppError.log('confirmSale', e, true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✅ تأكيد'; }
  }
}

// ─── تصفية الدفعة عند النفاد ─────────────────────────────────
async function _settleBatch(batchId, batch, updatedBatch) {
  try {
    const batchSales = await API.sales.listByBatch(batchId);
    if (!batchSales.length) return;

    const totalSales = batchSales.reduce((s, x) => s + parseFloat(x.total_amount || 0), 0);
    const commission = Math.round(totalSales * 0.07);
    const noulon     = parseFloat(updatedBatch?.noulon || batch.noulon || 0);
    const mashal     = parseFloat(updatedBatch?.mashal || batch.mashal || 0);
    const net        = totalSales - commission - noulon - mashal;

    await API.invoices.createSettlement(batchId, {
      ...batch,
      noulon, mashal,
      supplier_id: updatedBatch?.supplier_id || batch.supplier_id
    }, batchSales);

    const updatedSupps = await API.suppliers.list();
    store.set('suppliers', updatedSupps);

    Toast.success(
      `🧾 تصفية تلقائية!\n` +
      `${batch.product_name} — ${batch.supplier_name}\n` +
      `إجمالي: ${N(totalSales)} ج\n` +
      `عمولة 7٪: ${N(commission)} ج | نولون: ${N(noulon)} | مشال: ${N(mashal)}\n` +
      `صافي المورد: ${N(net)} ج`,
      8000
    );

  } catch(e) {
    AppError.log('_settleBatch', e);
    Toast.warning('⚠️ تم تسجيل البيعة لكن فشلت التصفية التلقائية');
  }
}

// ─── تعديل بيعة ──────────────────────────────────────────────
function openSaleEdit(saleId, batchId) {
  const container = document.getElementById(`se-${batchId}`);
  if (!container) return;
  if (container.dataset.editId === String(saleId) && container.innerHTML.trim()) {
    container.innerHTML = ''; container.dataset.editId = ''; return;
  }
  container.dataset.editId = saleId;

  const sale = (store.sales || []).find(s => s.id === saleId || s.id == saleId);

  const custOpts = '<option value="">نقدي 💵</option>' +
    (store.custs || []).map(c =>
      `<option value="${c.id}" ${c.id === sale?.customer_id ? 'selected' : ''}>${c.name}</option>`
    ).join('');

  container.innerHTML = `
  <div style="background:#fff8e1;border:2px solid var(--orange);border-radius:10px;padding:12px">
    <div style="font-weight:700;color:var(--orange);margin-bottom:8px">✏️ تعديل بيعة</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px">
      <div><label style="font-size:12px;color:#666">عدد</label>
        <input id="se-qty-${saleId}" type="number" step="0.01" value="${sale?.quantity||''}"
          oninput="calcSE('${saleId}')" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px"></div>
      <div><label style="font-size:12px;color:#666">وزن</label>
        <input id="se-wt-${saleId}" type="number" step="0.01" value="${sale?.weight_kg||''}"
          oninput="calcSE('${saleId}')" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px"></div>
      <div><label style="font-size:12px;color:#666">سعر</label>
        <input id="se-price-${saleId}" type="number" step="0.01" value="${sale?.unit_price||''}"
          oninput="calcSE('${saleId}')" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px"></div>
      <div><label style="font-size:12px;color:#666">إجمالي</label>
        <input id="se-tot-${saleId}" type="number" step="0.01" value="${sale?.total_amount||''}" readonly
          style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px;background:#f5f5f5"></div>
      <div><label style="font-size:12px;color:#666">العميل</label>
        <select id="se-cust-${saleId}" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px">${custOpts}</select></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button onclick="saveSaleEdit('${saleId}','${batchId}')"
        style="background:var(--orange);color:#fff;border:none;border-radius:8px;padding:8px 20px;cursor:pointer;font-weight:700;flex:1">💾 حفظ</button>
      <button onclick="document.getElementById('se-${batchId}').innerHTML=''"
        style="background:#eee;border:none;border-radius:8px;padding:8px 16px;cursor:pointer">إلغاء</button>
    </div>
  </div>`;
}

function calcSE(saleId) {
  const qty   = parseFloat(document.getElementById(`se-qty-${saleId}`)?.value)   || 0;
  const wt    = parseFloat(document.getElementById(`se-wt-${saleId}`)?.value)    || 0;
  const price = parseFloat(document.getElementById(`se-price-${saleId}`)?.value) || 0;
  const tot   = document.getElementById(`se-tot-${saleId}`);
  if (tot) tot.value = Number(((wt > 0 ? wt : qty) * price).toFixed(2)) || '';
}

async function saveSaleEdit(saleId, batchId) {
  const qty    = parseFloat(document.getElementById(`se-qty-${saleId}`)?.value)   || 0;
  const wt     = parseFloat(document.getElementById(`se-wt-${saleId}`)?.value)    || 0;
  const price  = parseFloat(document.getElementById(`se-price-${saleId}`)?.value) || 0;
  const custId = document.getElementById(`se-cust-${saleId}`)?.value || null;
  const units  = wt > 0 ? wt : qty;
  const total  = parseFloat((units * price).toFixed(2));
  if (!units || !price) return Toast.warning('أدخل الكمية والسعر');
  try {
    await API.sales.update(saleId, {
      quantity: qty, weight_kg: wt, unit_price: price,
      total_amount: total, customer_id: custId || null, is_cash: !custId
    });
    document.getElementById(`se-${batchId}`).innerHTML = '';
    Toast.success('✅ تم التعديل');
    await renderSalesTable();
    if (typeof renderDaySummary === 'function') renderDaySummary();
  } catch(e) { AppError.log('saveSaleEdit', e, true); }
}

// ─── حذف بيعة ────────────────────────────────────────────────
async function deleteSale(saleId, batchId) {
  if (!confirm('حذف هذه البيعة؟')) return;
  try {
    await API.sales.delete(saleId);
    Toast.success('تم الحذف');
    await renderSalesTable();
    if (typeof renderDaySummary === 'function') renderDaySummary();
    if (typeof renderCollections === 'function') renderCollections();
  } catch(e) { AppError.log('deleteSale', e, true); }
}

async function deleteBatchSales(batchId) {
  const batch = (store.inv||[]).find(b => b.id === batchId || b.batch_id === batchId);
  if (!confirm(`حذف دفعة ${batch?.product_name || ''} وجميع مبيعاتها؟`)) return;
  try {
    // حذف المبيعات المرتبطة أولاً
    const salesToDelete = (store.sales || []).filter(s => s.batch_id === batchId);
    for (const sale of salesToDelete) {
      await API.sales.delete(sale.id);
    }
    // ثم حذف الدفعة
    await API.inventory.delete(batchId);
    Toast.success('تم الحذف');
    await renderSalesTable();
  } catch(e) { AppError.log('deleteBatchSales', e, true); }
}

// ─── إجمالي اليوم ─────────────────────────────────────────────
function _updateDayTotal(sales) {
  const total = (sales || []).reduce((s, x) => s + parseFloat(x.total_amount || 0), 0);
  const el = document.getElementById('day-total');
  if (el) el.textContent = `إجمالي اليوم: ${N(total)} جنيه`;
}

// ─── إغلاق اليوم (ترحيل) ─────────────────────────────────────
async function closeDay() {
  if (!confirm('إغلاق اليوم؟ الدفعات المتبقية ستُرحَّل للغد.')) return;
  const today    = store._state.currentDate;
  const tomorrow = new Date(new Date(today).getTime() + 86400000).toISOString().slice(0,10);

  const inv    = await API.inventory.list();
  const active = inv.filter(b => parseFloat(b.remaining_qty || 0) > 0);

  if (!active.length) return Toast.info('لا توجد دفعات لترحيلها');

  try {
    for (const batch of active) {
      const rem = parseFloat(batch.remaining_qty);
      // أغلق الدفعة القديمة
      await sb.from('incoming_batches').update({ status: 'carried_over' }).eq('id', batch.id);
      // أنشئ دفعة جديدة بنفس البيانات
      await sb.from('incoming_batches').insert({
        company_id:     currentUser.company_id,
        product_id:     batch.product_id,
        supplier_id:    batch.supplier_id,
        batch_date:     tomorrow,
        quantity:       rem,
        remaining_qty:  rem,
        noulon:         batch.noulon || 0,
        mashal:         batch.mashal || 0,
        status:         'active',
        carryover_from: batch.id
      });
    }

    store.set('currentDate', tomorrow);
    await renderSalesTable();
    updateDates();
    Toast.success(`✅ تم ترحيل ${active.length} دفعة ليوم ${tomorrow}`);
  } catch(e) { AppError.log('closeDay', e, true); }
}