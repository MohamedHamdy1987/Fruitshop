// ============================================================
// js/renderers/inventory.js — نظام المخزون الكامل
// يحل محل baqi.js و nazil.js القديمين
// ============================================================

// ─────────────────────────────────────────────────────────────
// الصفحة الرئيسية للمخزون
// ─────────────────────────────────────────────────────────────
async function renderInventory() {
  const container = document.getElementById('inventory-content');
  if (!container) return;

  const inv = store.inv || [];

  // فرز: النشطة أولاً، ثم الأقدم تاريخاً
  const active   = inv.filter(b => b.status === 'active' || !b.status);
  const lowStock = active.filter(b => b.is_low_stock);

  container.innerHTML = `
    <!-- شريط الإضافة -->
    <div class="card">
      <div class="ch" style="background:#e8f8f5;border-bottom-color:#a2d9ce;">
        <span>➕</span><h2 style="color:#0e6655">إضافة دفعة جديدة</h2>
      </div>
      <div class="cb">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin-bottom:10px">
          <div>
            <label class="lbl">المنتج</label>
            <select id="inv-product-sel">
              <option value="">-- اختر --</option>
              ${(store.prods||[]).map(p=>`<option value="${p.id}">${p.name} (${p.unit})</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="lbl">المورد</label>
            <select id="inv-supplier-sel">
              <option value="">-- اختر --</option>
              ${(store.supps||[]).map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="lbl">الكمية</label>
            <input type="number" id="inv-qty" placeholder="0" min="0.01" step="0.01">
          </div>
          <div>
            <label class="lbl">سعر الشراء</label>
            <input type="number" id="inv-buyprice" placeholder="0" min="0">
          </div>
          <div>
            <label class="lbl">النولون</label>
            <input type="number" id="inv-noulon" placeholder="0" min="0">
          </div>
          <div>
            <label class="lbl">المشال</label>
            <input type="number" id="inv-mashal" placeholder="0" min="0">
          </div>
        </div>
        <button class="btn btn-g" onclick="addInventoryBatch()">➕ إضافة دفعة</button>
        <button class="btn btn-b btn-sm" onclick="showAddProductModal()" style="margin-right:8px">📦 منتج جديد</button>
      </div>
    </div>

    <!-- تنبيه المخزون المنخفض -->
    ${lowStock.length ? `
    <div class="card" style="border:2px solid #ff9800">
      <div class="ch" style="background:#fff3e0;border-bottom-color:#ffe082">
        <span>⚠️</span><h2 style="color:#e65100">تنبيه: مخزون منخفض (${lowStock.length} صنف)</h2>
      </div>
      <div class="cb">
        ${lowStock.map(b=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #ffe082">
            <div>
              <strong>${b.product_name}</strong>
              <span style="font-size:0.75rem;color:var(--gray);margin-right:8px">من: ${b.supplier_name}</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <span class="low-stock-badge">⚠️ ${N(b.remaining_qty)} ${b.unit}</span>
              <span style="font-size:0.72rem;color:var(--gray)">حد التنبيه: ${N(b.low_stock_alert)}</span>
            </div>
          </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- قائمة المخزون -->
    <div class="card">
      <div class="ch g">
        <span>📦</span><h2>المخزون الحالي</h2>
        <span class="cbadge g">${active.length} دفعة</span>
      </div>
      <div class="cb" id="inventory-list">
        ${active.length ? _renderBatchList(active) : _emptyInventory()}
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
function _renderBatchList(batches) {
  return batches.map(b => {
    const pct = b.original_qty > 0 ? Math.round((b.remaining_qty / b.original_qty) * 100) : 0;
    const barColor = pct > 50 ? 'var(--green)' : pct > 20 ? 'var(--orange)' : 'var(--red)';
    const date = new Date(b.batch_date).toLocaleDateString('ar-EG',{month:'short',day:'numeric'});

    return `<div class="batch-card">
      <div class="batch-header">
        <div style="display:flex;align-items:center;gap:9px">
          <span style="font-size:1.2rem">📦</span>
          <div>
            <div style="font-weight:800;color:#0e6655">${b.product_name}</div>
            <div style="font-size:0.72rem;color:var(--gray)">
              ${b.supplier_name} · ${date}
              ${b.carryover_from ? '<span style="background:#e3f2fd;color:var(--blue);border-radius:4px;padding:1px 5px;font-size:0.68rem">ترحيل</span>' : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="text-align:left">
            <div style="font-weight:900;color:#0e6655;font-size:1rem">${N(b.remaining_qty)} ${b.unit}</div>
            <div style="font-size:0.7rem;color:var(--gray)">من أصل ${N(b.original_qty)}</div>
          </div>
          <button class="btn btn-r btn-xs" onclick="deleteInventoryBatch('${b.batch_id}')">🗑️</button>
        </div>
      </div>
      <div class="batch-body">
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--gray);margin-bottom:5px">
          <span>تكلفة الوحدة: ${N(b.cost_per_unit)} ج/${b.unit}</span>
          <span>المتبقي: ${pct}%</span>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          <button class="btn btn-g btn-sm" onclick="openSaleFromInventory('${b.batch_id}','${b.product_id}','${b.product_name}','${b.unit}',${b.remaining_qty})">
            🛒 بيع
          </button>
          ${b.remaining_qty > 0 ? `
          <button class="btn btn-b btn-sm" onclick="showPage('sales',document.querySelector('[data-page=sales]'))">
            📋 تفاصيل
          </button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function _emptyInventory() {
  return `<div class="empty-state">
    <div class="empty-icon">📦</div>
    <div class="empty-title">لا يوجد مخزون حالياً</div>
    <div class="empty-sub">أضف دفعة جديدة من البضاعة لتبدأ</div>
  </div>`;
}

// ─────────────────────────────────────────────────────────────
// إضافة دفعة مخزون
// ─────────────────────────────────────────────────────────────
async function addInventoryBatch() {
  const productId  = document.getElementById('inv-product-sel').value;
  const supplierId = document.getElementById('inv-supplier-sel').value;
  const qty        = parseFloat(document.getElementById('inv-qty').value) || 0;
  const buyPrice   = parseFloat(document.getElementById('inv-buyprice').value) || 0;
  const noulon     = parseFloat(document.getElementById('inv-noulon').value) || 0;
  const mashal     = parseFloat(document.getElementById('inv-mashal').value) || 0;

  if (!productId)  return Toast.warning('اختر المنتج');
  if (!supplierId) return Toast.warning('اختر المورد');
  if (qty <= 0)    return Toast.warning('أدخل الكمية');

  const btn = event.target;
  btn.disabled = true; btn.textContent = 'جاري الإضافة...';

  try {
    const batch = await API.inventory.add({
      productId, supplierId, quantity: qty,
      buyPrice, noulon, mashal,
      date: store._state.currentDate
    });

    // تحديث المخزون المحلي
    const updated = await API.inventory.list();
    store.set('inventory', updated);
    Cache.invalidate('inventory');

    // مسح الحقول
    ['inv-qty','inv-buyprice','inv-noulon','inv-mashal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    Toast.success('✅ تم إضافة الدفعة بنجاح');
    renderInventory();
  } catch (e) {
    AppError.log('addInventoryBatch', e, true);
  } finally {
    btn.disabled = false; btn.textContent = '➕ إضافة دفعة';
  }
}

// ─────────────────────────────────────────────────────────────
async function deleteInventoryBatch(batchId) {
  if (!confirm('حذف هذه الدفعة؟')) return;
  try {
    await sb.from('incoming_batches').delete()
      .eq('id', batchId)
      .eq('company_id', currentUser.company_id);
    const updated = await API.inventory.list();
    store.set('inventory', updated);
    Toast.success('تم الحذف');
    renderInventory();
  } catch(e) { AppError.log('deleteInventoryBatch', e, true); }
}

// ─────────────────────────────────────────────────────────────
// Modal إضافة منتج جديد
// ─────────────────────────────────────────────────────────────
function showAddProductModal() {
  const modal = document.getElementById('add-product-modal');
  if (modal) modal.classList.add('open');
}

async function saveNewProduct() {
  const name      = document.getElementById('pm-name').value.trim();
  const unit      = document.getElementById('pm-unit').value;
  const category  = document.getElementById('pm-category').value;
  const buyPrice  = parseFloat(document.getElementById('pm-buyprice').value) || 0;
  const sellPrice = parseFloat(document.getElementById('pm-sellprice').value) || 0;
  const lowAlert  = parseFloat(document.getElementById('pm-lowalert').value) || 5;

  if (!name) return Toast.warning('أدخل اسم المنتج');

  try {
    const prod = await API.products.add({ name, unit, category, buyPrice, sellPrice, lowStockAlert: lowAlert });
    const updated = await API.products.list();
    store.set('products', updated);
    closeModal('add-product-modal');
    Toast.success(`✅ تم إضافة ${name}`);
    renderInventory();
  } catch(e) { AppError.log('saveNewProduct', e, true); }
}

// ─────────────────────────────────────────────────────────────
// فتح نموذج البيع من المخزون
// ─────────────────────────────────────────────────────────────
function openSaleFromInventory(batchId, productId, productName, unit, maxQty) {
  const custOpts = '<option value="">نقدي</option>' +
    (store.custs||[]).map(c=>`<option value="${c.id}">${c.name}</option>`).join('');

  const modal = document.getElementById('quick-sale-modal');
  if (!modal) return;

  modal.innerHTML = `
    <div class="modal-box">
      <button class="cx" onclick="closeModal('quick-sale-modal')">✕</button>
      <h3>🛒 بيع — ${productName}</h3>
      <div class="frow">
        <label>العميل</label>
        <select id="qs-cust">${custOpts}</select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="frow">
          <label>الكمية (${unit})</label>
          <input type="number" id="qs-qty" placeholder="0" min="0" max="${maxQty}" step="0.01" oninput="calcQS()">
        </div>
        <div class="frow">
          <label>وزن (كيلو)</label>
          <input type="number" id="qs-wt" placeholder="0" min="0" step="0.01" oninput="calcQS()">
        </div>
        <div class="frow">
          <label>سعر الوحدة</label>
          <input type="number" id="qs-price" placeholder="0" min="0" oninput="calcQS()">
        </div>
        <div class="frow">
          <label>الإجمالي</label>
          <input type="number" id="qs-total" readonly style="background:#f0f0f0">
        </div>
      </div>
      <div style="font-size:0.79rem;color:var(--gray);margin-bottom:12px">المتبقي في المخزون: <strong>${N(maxQty)} ${unit}</strong></div>
      <button class="btn btn-g" style="width:100%" onclick="confirmQuickSale('${batchId}','${productId}','${productName}','${unit}',${maxQty})">
        ✅ تأكيد البيع
      </button>
    </div>`;
  modal.classList.add('open');
}

function calcQS() {
  const qty   = parseFloat(document.getElementById('qs-qty')?.value)   || 0;
  const wt    = parseFloat(document.getElementById('qs-wt')?.value)    || 0;
  const price = parseFloat(document.getElementById('qs-price')?.value) || 0;
  const tot   = document.getElementById('qs-total');
  if (tot) tot.value = ((wt > 0 ? wt : qty) * price) || '';
}

async function confirmQuickSale(batchId, productId, productName, unit, maxQty) {
  const custId = document.getElementById('qs-cust').value;
  const qty    = parseFloat(document.getElementById('qs-qty').value)   || 0;
  const wt     = parseFloat(document.getElementById('qs-wt').value)    || 0;
  const price  = parseFloat(document.getElementById('qs-price').value) || 0;
  const units  = wt > 0 ? wt : qty;

  if (!units || !price) return Toast.warning('أدخل الكمية والسعر');
  if (qty > 0 && qty > maxQty) return Toast.error(`الكمية أكبر من المتبقي (${N(maxQty)} ${unit})`);

  const total = units * price;

  try {
    await API.sales.add({
      customerId: custId || null,
      productId,
      batchId,
      quantity:   qty || 0,
      weightKg:   wt  || 0,
      unitPrice:  price,
      total,
      isCash:     !custId,
      date:       store._state.currentDate
    });

    // تحديث البيانات المحلية
    const [inventory, sales] = await Promise.all([
      API.inventory.list(),
      API.sales.list(store._state.currentDate)
    ]);
    store.set('inventory', inventory);
    store.set('sales', sales);

    if (!custId) {
      // نقدي — تحديث العملاء مش ضروري
    } else {
      // آجل — تحديث رصيد العميل محلياً
      const custIdx = store.custs.findIndex(c => c.id === custId);
      if (custIdx >= 0) store.custs[custIdx].balance = (store.custs[custIdx].balance || 0) + total;
    }

    closeModal('quick-sale-modal');
    Toast.success(`✅ تم تسجيل البيع: ${N(total)} جنيه`);
    renderInventory();

    // إنشاء فاتورة تلقائية لو المخزون خلص
    const updatedBatch = inventory.find(b => b.batch_id === batchId);
    if (!updatedBatch || updatedBatch.remaining_qty <= 0) {
      _autoGenerateInvoice(batchId, productId, productName);
    }
  } catch(e) { AppError.log('confirmQuickSale', e, true); }
}

// ─────────────────────────────────────────────────────────────
async function _autoGenerateInvoice(batchId, productId, productName) {
  Toast.info('🧾 جاري إنشاء الفاتورة تلقائياً...');
  // منطق الفاتورة التلقائية — يُنفَّذ في invoices.js
  if (typeof autoInvoiceForBatch === 'function') {
    await autoInvoiceForBatch(batchId);
  }
}

// ─────────────────────────────────────────────────────────────
// للتوافق مع الكود القديم
// ─────────────────────────────────────────────────────────────
function renderBaqi()     { renderInventory(); }
function renderNazilList() { renderInventory(); }
