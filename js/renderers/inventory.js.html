// ============================================================
// js/renderers/inventory.js — المخزون الكامل
// يجمع "النازل" (incoming_batches جديدة) و"الباقي" (carryover_from != null)
// يحل محل baqi.js و nazil.js القديمين بالكامل
// ============================================================

// ─────────────────────────────────────────────────────────────
// renderInventory — نقطة الدخول الرئيسية
// ─────────────────────────────────────────────────────────────
async function renderInventory() {
  const container = document.getElementById('inventory-content');
  if (!container) return;

  const inv      = store.inv || [];
  const active   = inv.filter(b => (b.status === 'active' || !b.status));
  const nazil    = active.filter(b => !b.carryover_from);   // اليوم الجديد
  const baqi     = active.filter(b => !!b.carryover_from);  // مرحّل من يوم سابق
  const lowStock = active.filter(b => b.is_low_stock);

  container.innerHTML = `

  <!-- ═══ إضافة صنف نازل ══════════════════════════════════ -->
  <div class="card">
    <div class="ch" style="background:#e8f8f5;border-bottom-color:#a2d9ce;">
      <span>➕</span><h2 style="color:#0e6655">إضافة صنف نازل</h2>
    </div>
    <div class="cb">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:10px">
        <div>
          <label class="lbl">الصنف</label>
          <select id="inv-product-sel" style="width:100%">
            <option value="">-- اختر --</option>
            ${(store.prods||[]).map(p=>`<option value="${p.id}">${p.name} (${p.unit})</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="lbl">المورد</label>
          <select id="inv-supplier-sel" style="width:100%">
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
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-g" onclick="addInventoryBatch()">➕ إضافة صنف</button>
        <button class="btn btn-b btn-sm" onclick="showAddProductModal()">📦 منتج جديد</button>
      </div>
    </div>
  </div>

  <!-- ═══ تنبيه مخزون منخفض ═══════════════════════════════ -->
  ${lowStock.length ? `
  <div class="card" style="border:2px solid #ff9800">
    <div class="ch" style="background:#fff3e0;border-bottom-color:#ffe082">
      <span>⚠️</span><h2 style="color:#e65100">مخزون منخفض (${lowStock.length} صنف)</h2>
    </div>
    <div class="cb">
      ${lowStock.map(b=>`
      <div style="display:flex;justify-content:space-between;align-items:center;
        padding:7px 0;border-bottom:1px solid #ffe082">
        <div>
          <strong>${b.product_name}</strong>
          <span style="font-size:.74rem;color:var(--gray);margin-right:8px">من: ${b.supplier_name}</span>
        </div>
        <span class="low-stock-badge">⚠️ ${N(b.remaining_qty)} ${b.unit}</span>
      </div>`).join('')}
    </div>
  </div>` : ''}

  <!-- ═══ الأصناف النازلة (اليوم) ═════════════════════════ -->
  <div class="card">
    <div class="ch" style="background:#e8f8f5;border-bottom-color:#a2d9ce;">
      <span>📋</span>
      <h2 style="color:#0e6655">الأصناف النازلة</h2>
      <span class="cbadge" style="background:#0e6655">${nazil.length} صنف</span>
    </div>
    <div class="cb" id="nazil-list">
      ${nazil.length ? _renderBatchCards(nazil, 'nazil') : _emptyState('النازل', 'لا توجد أصناف نازلة اليوم')}
    </div>
  </div>

  <!-- ═══ الباقي (مرحّل من الأيام السابقة) ════════════════ -->
  <div class="card">
    <div class="ch" style="background:#f3e5f5;border-bottom-color:#ce93d8;">
      <span>🔄</span>
      <h2 style="color:#6c3483">الباقي في المحل</h2>
      <span class="cbadge" style="background:#6c3483">${baqi.length} صنف</span>
    </div>
    <div class="cb" id="baqi-body">
      ${baqi.length ? _renderBatchCards(baqi, 'baqi') : _emptyState('الباقي', 'لا توجد متبقيات من الأيام السابقة')}
    </div>
  </div>`;
}

// ─────────────────────────────────────────────────────────────
// _renderBatchCards — بطاقات الدفعات
// ─────────────────────────────────────────────────────────────
function _renderBatchCards(batches, section) {
  return batches.map((b, i) => {
    const remQty  = parseFloat(b.remaining_qty || 0);
    const origQty = parseFloat(b.original_qty  || b.quantity || remQty);
    const pct     = origQty > 0 ? Math.round((remQty / origQty) * 100) : 0;
    const barClr  = pct > 50 ? 'var(--green)' : pct > 20 ? 'var(--orange)' : 'var(--red)';
    const date    = new Date(b.batch_date).toLocaleDateString('ar-EG',{month:'short',day:'numeric'});
    const isCarry = !!b.carryover_from;
    const bgClr   = section === 'baqi' ? '#f9f0ff' : '#f0faf5';
    const brdClr  = section === 'baqi' ? '#d2b4de'  : 'var(--border)';
    const hdrBg   = section === 'baqi' ? '#f3e5f5'  : '#e8f8f5';
    const txtClr  = section === 'baqi' ? '#6c3483'  : '#0e6655';

    return `
    <div style="background:${bgClr};border:1.5px solid ${brdClr};border-radius:10px;
      margin-bottom:9px;overflow:hidden;">
      <!-- رأس البطاقة -->
      <div style="padding:10px 13px;background:${hdrBg};
        display:flex;align-items:center;justify-content:space-between;
        cursor:pointer;" onclick="goToProduct('${b.batch_id}')">
        <div style="display:flex;align-items:center;gap:9px">
          <div style="background:${txtClr};color:#fff;border-radius:50%;
            width:26px;height:26px;display:flex;align-items:center;justify-content:center;
            font-size:.78rem;font-weight:900">${i + 1}</div>
          <div>
            <div style="font-weight:800;color:${txtClr};font-size:.93rem">${b.product_name}</div>
            <div style="font-size:.72rem;color:var(--gray)">
              ${b.supplier_name} · ${date}
              ${isCarry ? `<span style="background:#e3f2fd;color:var(--blue);border-radius:4px;
                padding:1px 5px;font-size:.66rem;margin-right:4px">مرحّل</span>` : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="text-align:left">
            <div style="font-weight:900;color:${txtClr};font-size:1rem">${N(remQty)} ${b.unit}</div>
            <div style="font-size:.7rem;color:var(--gray)">من أصل ${N(origQty)}</div>
          </div>
          <button class="btn btn-r btn-xs" style="z-index:1"
            onclick="event.stopPropagation();deleteInventoryBatch('${b.batch_id}')">🗑️</button>
        </div>
      </div>

      <!-- شريط الكمية -->
      <div style="padding:8px 13px">
        <div style="display:flex;justify-content:space-between;font-size:.74rem;color:var(--gray);margin-bottom:4px">
          <span>تكلفة الوحدة: ${N(b.cost_per_unit || 0)} ج/${b.unit}</span>
          <span>متبقي: ${pct}%</span>
        </div>
        <div style="background:#e8e8e8;border-radius:4px;height:7px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${barClr};border-radius:4px;transition:width .4s"></div>
        </div>
        <!-- زر البيع السريع -->
        <div style="margin-top:8px">
          <button class="btn btn-g btn-sm"
            onclick="goToProduct('${b.batch_id}')">
            🛒 بيع من هذا الصنف
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function _emptyState(type, msg) {
  return `<p style="text-align:center;color:#aaa;padding:18px">${msg}</p>`;
}

// ─────────────────────────────────────────────────────────────
// addInventoryBatch — إضافة دفعة جديدة
// ─────────────────────────────────────────────────────────────
async function addInventoryBatch() {
  const productId  = document.getElementById('inv-product-sel')?.value;
  const supplierId = document.getElementById('inv-supplier-sel')?.value;
  const qty        = parseFloat(document.getElementById('inv-qty')?.value) || 0;
  const buyPrice   = parseFloat(document.getElementById('inv-buyprice')?.value) || 0;
  const noulon     = parseFloat(document.getElementById('inv-noulon')?.value)   || 0;
  const mashal     = parseFloat(document.getElementById('inv-mashal')?.value)   || 0;

  if (!productId)  return Toast.warning('اختر الصنف');
  if (!supplierId) return Toast.warning('اختر المورد');
  if (qty <= 0)    return Toast.warning('أدخل الكمية');

  const btn = event.target;
  btn.disabled = true; btn.textContent = 'جاري الإضافة...';

  try {
    await API.inventory.add({
      productId, supplierId, quantity: qty,
      buyPrice, noulon, mashal,
      date: store._state.currentDate
    });

    // تحديث المخزون فوراً
    const updated = await API.inventory.list();
    store.set('inventory', updated);
    Cache.invalidate('inventory');

    // مسح الحقول
    ['inv-qty','inv-buyprice','inv-noulon','inv-mashal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    const prodName = (store.prods||[]).find(p=>p.id===productId)?.name || '';
    Toast.success(`✅ تم إضافة ${qty} ${prodName}`);
    renderInventory();

    // تحديث صفحة المبيعات لو مفتوحة
    if (typeof renderSalesTable === 'function') renderSalesTable();

  } catch(e) { AppError.log('addInventoryBatch', e, true); }
  finally { btn.disabled = false; btn.textContent = '➕ إضافة صنف'; }
}

// ─────────────────────────────────────────────────────────────
// deleteInventoryBatch — حذف دفعة
// ─────────────────────────────────────────────────────────────
async function deleteInventoryBatch(batchId) {
  if (!confirm('حذف هذه الدفعة من المخزون؟')) return;
  try {
    await sb.from('incoming_batches')
      .delete()
      .eq('id', batchId)
      .eq('company_id', currentUser.company_id);
    const updated = await API.inventory.list();
    store.set('inventory', updated);
    Toast.success('تم الحذف');
    renderInventory();
  } catch(e) { AppError.log('deleteInventoryBatch', e, true); }
}

// ─────────────────────────────────────────────────────────────
// showAddProductModal / saveNewProduct — إضافة منتج جديد
// ─────────────────────────────────────────────────────────────
function showAddProductModal() {
  const modal = document.getElementById('add-product-modal');
  if (modal) modal.classList.add('open');
}

async function saveNewProduct() {
  const name      = document.getElementById('pm-name')?.value.trim();
  const unit      = document.getElementById('pm-unit')?.value;
  const category  = document.getElementById('pm-category')?.value;
  const buyPrice  = parseFloat(document.getElementById('pm-buyprice')?.value)  || 0;
  const sellPrice = parseFloat(document.getElementById('pm-sellprice')?.value) || 0;
  const lowAlert  = parseFloat(document.getElementById('pm-lowalert')?.value)  || 5;

  if (!name) return Toast.warning('أدخل اسم المنتج');

  try {
    await API.products.add({ name, unit, category, buyPrice, sellPrice, lowStockAlert: lowAlert });
    const updated = await API.products.list();
    store.set('products', updated);
    closeModal('add-product-modal');
    ['pm-name','pm-buyprice','pm-sellprice','pm-lowalert'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    Toast.success(`✅ تم إضافة المنتج: ${name}`);
    renderInventory();
  } catch(e) { AppError.log('saveNewProduct', e, true); }
}

// ─────────────────────────────────────────────────────────────
// للتوافق مع الكود القديم
// ─────────────────────────────────────────────────────────────
function renderBaqi()      { renderInventory(); }
function renderNazilList() { renderInventory(); }

// فتح البيع من بطاقة مخزون (legacy compat)
function openSaleFromInventory(batchId, productId, productName, unit, maxQty) {
  goToProduct(batchId);
}