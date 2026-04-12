// ============================================================
// renderers/sales.js — صفحة المبيعات (نسخة السوق الحقيقي 🔥)
// ============================================================

// ================= تحميل البيانات =================

async function loadSalesPageData() {
  try {
    const [inv, sales] = await Promise.all([
      API.inventory.list(),
      API.sales.list()
    ]);

    store.set('inv', inv || []);
    store.set('sales', sales || []);
  } catch (e) {
    AppError.log('loadSalesPageData', e, true);
  }
}

// ================= الصفحة الرئيسية =================

async function renderSalesPage() {
  await loadSalesPageData();

  const batches = (store.inv || []).filter(b => parseFloat(b.remaining_qty) > 0);

  const container = document.getElementById('sales-page');
  if (!container) return;

  if (!batches.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:30px;color:#aaa">
        لا يوجد بضاعة حالياً
      </div>`;
    return;
  }

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${batches.map(b => renderBatchCard(b)).join('')}
    </div>
  `;
}

// ================= كارت الصنف =================

function renderBatchCard(batch) {
  const sales = (store.sales || []).filter(s => s.batch_id === batch.id);

  const totalAmount = sales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
  const totalQty    = sales.reduce((sum, s) => sum + parseFloat(s.quantity || s.weight_kg || 0), 0);

  return `
    <div class="card">

      <!-- Header -->
      <div style="padding:12px;background:#f0f7f0;display:flex;align-items:center;gap:10px;cursor:pointer"
           onclick="toggleBatch('${batch.id}')">

        <div>
          <div style="font-weight:900;font-size:1rem">${batch.product_name}</div>
          <div style="font-size:0.75rem;color:#777">${batch.supplier_name || ''}</div>
        </div>

        <div style="margin-right:auto;text-align:left">
          <div style="font-size:0.7rem;color:#777">المتبقي</div>
          <div style="font-weight:900;color:var(--green)">
            ${batch.remaining_qty}
          </div>
        </div>

      </div>

      <!-- Body -->
      <div id="batch-${batch.id}" style="display:none;padding:10px">

        ${renderSalesList(sales)}

        <!-- الإجمالي -->
        <div style="margin-top:10px;background:#e8f5e9;padding:8px;border-radius:8px;display:flex;justify-content:space-between">
          <span>الإجمالي</span>
          <strong>${totalQty} — ${totalAmount} جنيه</strong>
        </div>

        ${renderAddSaleForm(batch.id)}

      </div>

    </div>
  `;
}

// ================= عرض البيعات =================

function renderSalesList(sales) {
  if (!sales.length) {
    return `<div style="color:#aaa;padding:10px">لا توجد بيعات</div>`;
  }

  return `
    <div style="display:flex;flex-direction:column;gap:6px">
      ${sales.map(s => `
        <div style="display:flex;justify-content:space-between;background:#fafafa;padding:6px;border-radius:6px">

          <span>👤 ${s.customer_name || 'نقدي'}</span>

          <span>
            ${s.quantity || s.weight_kg}
          </span>

          <span style="font-weight:900">
            ${s.total_amount} ج
          </span>

        </div>
      `).join('')}
    </div>
  `;
}

// ================= فورم البيع =================

function renderAddSaleForm(batchId) {
  return `
    <div style="margin-top:12px;border-top:1px solid #eee;padding-top:10px;display:flex;flex-direction:column;gap:6px">

      <input type="number" id="qty-${batchId}" placeholder="عدد" />

      <input type="number" id="price-${batchId}" placeholder="سعر" />

      <select id="cust-${batchId}">
        <option value="">نقدي</option>
        ${(store.customers || []).map(c => `
          <option value="${c.id}">${c.name}</option>
        `).join('')}
      </select>

      <button class="btn btn-g" onclick="addSale('${batchId}')">
        ➕ بيع
      </button>

    </div>
  `;
}

// ================= تنفيذ البيع =================

async function addSale(batchId) {
  try {
    const qty   = parseFloat(document.getElementById(`qty-${batchId}`).value) || 0;
    const price = parseFloat(document.getElementById(`price-${batchId}`).value) || 0;
    const cust  = document.getElementById(`cust-${batchId}`).value;

    if (!qty || !price) return Toast.warning('أدخل الكمية والسعر');

    const batch = (store.inv || []).find(b => b.id === batchId);
    if (!batch) return;

    await API.sales.create({
      batch_id: batchId,
      product_id: batch.product_id,
      quantity: qty,
      unit_price: price,
      customer_id: cust || null,
      is_cash: !cust
    });

    Toast.success('تم البيع ✅');

    // تحديث البيانات
    await loadSalesPageData();

    renderSalesPage();

  } catch (e) {
    AppError.log('addSale', e, true);
  }
}

// ================= فتح / قفل =================

function toggleBatch(id) {
  const el = document.getElementById(`batch-${id}`);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}