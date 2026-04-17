// ============================================================
// js/renderers/inventory.js — صفحة "النازل"
// نظام الوساطة: لا سعر شراء، فقط المنتج + المورد + الكمية + نولون + مشال
// ✅ منع إضافة دفعة بمنتج افتراضي (DEFAULT_PRODUCTS)
// ✅ إصلاح مشكلة event.target
// ✅ استخدام API.inventory.update بدلاً من sb.from مباشرة
// ============================================================

// قائمة ثابتة بالمنتجات الشائعة (تُستخدم كـ fallback فقط للعرض، وليس للإضافة)
const DEFAULT_PRODUCTS = [
  { name: 'طماطم', unit: 'عداية' },
  { name: 'بطاطس', unit: 'شوال' },
  { name: 'بصل',   unit: 'شوال' },
  { name: 'ثوم',   unit: 'كيلو' },
  { name: 'خيار',  unit: 'عداية' },
  { name: 'فلفل',  unit: 'عداية' },
  { name: 'كوسة',  unit: 'عداية' },
  { name: 'باذنجان','unit': 'عداية' },
  { name: 'ملوخية', unit: 'كيلو' },
  { name: 'سبانخ', unit: 'كيلو' },
  { name: 'تفاح',  unit: 'كيلو' },
  { name: 'برتقال', unit: 'كيلو' },
  { name: 'موز',   unit: 'إيد' },
  { name: 'عنب',   unit: 'كيلو' },
  { name: 'مانجو', unit: 'كيلو' },
  { name: 'جوافة', unit: 'كيلو' },
  { name: 'رمان',  unit: 'كيلو' },
  { name: 'فراولة', unit: 'كيلو' },
];

async function renderInventory() {
  const container = document.getElementById('inventory-content');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:20px;color:#888">جاري التحميل...</div>';

  try {
    const [inv, products, suppliers] = await Promise.all([
      API.inventory.list(),
      API.products.list(),
      API.suppliers.list()
    ]);

    store.set('inventory', inv);
    store.set('products', products);
    store.set('suppliers', suppliers);

    // استخدم المنتجات الحقيقية فقط للإضافة، والافتراضية فقط إذا لم توجد منتجات
    const prods = products.length ? products : DEFAULT_PRODUCTS.map((p,i) => ({...p, id: `default_${i}`, is_default: true}));
    const supps = suppliers;

    const prodOpts = prods.map(p =>
      `<option value="${p.id}" ${p.is_default ? 'data-default="true"' : ''}>${p.name} (${p.unit})</option>`
    ).join('');
    const suppOpts = supps.map(s =>
      `<option value="${s.id}">${s.name}</option>`
    ).join('');

    const activeCount = inv.length;

    container.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header" style="cursor:pointer;display:flex;justify-content:space-between;padding:12px 14px;background:#f0faf5;border-radius:12px 12px 0 0" onclick="toggleNazilForm()">
        <span>➕ إضافة نازل جديد</span>
        <span id="nazil-form-toggle">▼</span>
      </div>
      <div id="nazil-form" style="padding:14px;display:block">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>
            <label class="lbl">الصنف</label>
            <select id="inv-product-sel" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;font-size:14px">
              <option value="">— اختر صنف —</option>
              ${prodOpts}
            </select>
          </div>
          <div>
            <label class="lbl">المورد</label>
            <select id="inv-supplier-sel" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;font-size:14px">
              <option value="">— اختر مورد —</option>
              ${suppOpts}
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
          <div>
            <label class="lbl">الكمية</label>
            <input id="inv-qty" type="number" step="0.01" min="0" placeholder="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px">
          </div>
          <div>
            <label class="lbl">النولون</label>
            <input id="inv-noulon" type="number" step="0.01" min="0" placeholder="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px">
          </div>
          <div>
            <label class="lbl">المشال</label>
            <input id="inv-mashal" type="number" step="0.01" min="0" placeholder="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px">
          </div>
        </div>
        <button id="inv-add-btn" onclick="addInventoryBatch(event)"
          style="width:100%;background:var(--green);color:#fff;border:none;border-radius:8px;padding:12px;font-size:15px;font-weight:700;cursor:pointer">
          ➕ إضافة نازل
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:#f0faf5">
        <span>📦 النازل الحالي</span>
        <span style="background:var(--green);color:#fff;border-radius:20px;padding:2px 12px;font-size:13px">${activeCount} دفعة</span>
      </div>
      <div id="nazil-list" style="padding:8px">
        ${activeCount ? _renderNazilCards(inv) : _nazilEmpty()}
      </div>
    </div>`;

  } catch(e) {
    AppError.log('renderInventory', e);
    container.innerHTML = `<div style="color:var(--red);text-align:center;padding:32px">
      ❌ خطأ في التحميل: ${e.message}<br>
      <button onclick="renderInventory()" style="margin-top:12px;padding:8px 20px;background:var(--green);color:#fff;border:none;border-radius:8px;cursor:pointer">🔄 إعادة المحاولة</button>
    </div>`;
  }
}

function toggleNazilForm() {
  const form = document.getElementById('nazil-form');
  const icon = document.getElementById('nazil-form-toggle');
  if (!form) return;
  const isOpen = form.style.display !== 'none';
  form.style.display = isOpen ? 'none' : 'block';
  if (icon) icon.textContent = isOpen ? '▼' : '▲';
}

function _renderNazilCards(batches) {
  return batches.map((b, i) => {
    const remQty  = parseFloat(b.remaining_qty || 0);
    const origQty = parseFloat(b.quantity || remQty);
    const pct     = origQty > 0 ? Math.round((remQty / origQty) * 100) : 0;
    const barClr  = pct > 50 ? 'var(--green)' : pct > 20 ? 'var(--orange)' : 'var(--red)';
    const date    = new Date(b.batch_date || b.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    const noulon  = parseFloat(b.noulon || 0);
    const mashal  = parseFloat(b.mashal || 0);

    return `
    <div id="batch-card-${b.id}" style="background:#fff;border:1px solid #e0e0e0;border-radius:10px;margin-bottom:10px;overflow:hidden">
      <div style="background:#f0faf5;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700;font-size:15px;color:#0e6655">${i+1}. ${b.product_name}</div>
          <div style="font-size:12px;color:#888">🚛 ${b.supplier_name || 'غير محدد'} · 📅 ${date}</div>
        </div>
        <div style="text-align:left;display:flex;align-items:center;gap:8px">
          <div><div style="font-weight:700;font-size:16px;color:#0e6655">${N(remQty)} ${b.unit}</div><div style="font-size:11px;color:#888">من ${N(origQty)}</div></div>
          <button onclick="openBatchEditNazil('${b.id}')" style="background:var(--blue);color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px">✏️</button>
          <button onclick="deleteNazilBatch('${b.id}')" style="background:var(--red);color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px">🗑️</button>
        </div>
      </div>

      <div style="padding:6px 14px">
        <div style="background:#e0e0e0;border-radius:4px;height:5px"><div style="background:${barClr};width:${pct}%;height:5px;border-radius:4px;transition:.3s"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#999;margin-top:2px">
          <span>متبقي ${pct}%</span>
          ${noulon || mashal ? `<span>نولون: ${N(noulon)} | مشال: ${N(mashal)}</span>` : ''}
        </div>
      </div>

      <div id="batch-edit-nazil-${b.id}" style="display:none;padding:12px 14px;border-top:1px solid #eee;background:#fffde7">
        <div style="font-weight:700;color:var(--orange);margin-bottom:8px">✏️ تعديل الدفعة</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <div><label style="font-size:12px;color:#666">الكمية</label><input id="be-qty-${b.id}" type="number" step="0.01" value="${origQty}" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px"></div>
          <div><label style="font-size:12px;color:#666">المتبقي</label><input id="be-rem-${b.id}" type="number" step="0.01" value="${remQty}" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px"></div>
          <div><label style="font-size:12px;color:#666">النولون</label><input id="be-noulon-${b.id}" type="number" step="0.01" value="${noulon}" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px"></div>
          <div><label style="font-size:12px;color:#666">المشال</label><input id="be-mashal-${b.id}" type="number" step="0.01" value="${mashal}" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px"></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button onclick="saveNazilBatchEdit('${b.id}')" style="background:var(--orange);color:#fff;border:none;border-radius:8px;padding:8px 20px;cursor:pointer;font-weight:700;flex:1">💾 حفظ</button>
          <button onclick="openBatchEditNazil('${b.id}')" style="background:#eee;border:none;border-radius:8px;padding:8px 16px;cursor:pointer">إلغاء</button>
        </div>
      </div>

      <div style="padding:8px 14px">
        <button onclick="goToProduct('${b.id}')" style="width:100%;background:var(--green);color:#fff;border:none;border-radius:8px;padding:9px;cursor:pointer;font-weight:700">🛒 بيع من هذه الدفعة</button>
      </div>
    </div>`;
  }).join('');
}

function _nazilEmpty() {
  return `<div style="text-align:center;color:#888;padding:40px">
    <div style="font-size:48px">📦</div>
    <div style="font-weight:700;margin:8px 0">لا يوجد نازل اليوم</div>
    <div style="font-size:13px">أضف دفعة جديدة من الفورم أعلاه</div>
  </div>`;
}

// ─── إضافة نازل (مع منع المنتجات الافتراضية) ─────────────────
async function addInventoryBatch(event) {
  const btn = event?.target || document.getElementById('inv-add-btn');
  const productId  = document.getElementById('inv-product-sel')?.value;
  const supplierId = document.getElementById('inv-supplier-sel')?.value;
  const qty        = parseFloat(document.getElementById('inv-qty')?.value)    || 0;
  const noulon     = parseFloat(document.getElementById('inv-noulon')?.value) || 0;
  const mashal     = parseFloat(document.getElementById('inv-mashal')?.value) || 0;

  if (!productId)  return Toast.warning('اختر الصنف');
  if (!supplierId) return Toast.warning('اختر المورد');
  if (qty <= 0)    return Toast.warning('أدخل الكمية');

  // التحقق من أن المنتج ليس من القائمة الافتراضية
  const selectedOption = document.querySelector('#inv-product-sel option:checked');
  if (selectedOption && selectedOption.getAttribute('data-default') === 'true') {
    return Toast.warning('هذا المنتج من القائمة الافتراضية. أضف المنتج أولاً من قائمة المنتجات (قريباً) أو استخدم منتجاً موجوداً.');
  }

  if (btn) btn.disabled = true;
  const originalText = btn?.textContent || '➕ إضافة نازل';
  if (btn) btn.textContent = '⏳ جاري الإضافة...';

  try {
    await API.inventory.add({
      productId, supplierId,
      quantity: qty,
      noulon, mashal,
      date: store._state.currentDate
    });

    ['inv-qty','inv-noulon','inv-mashal'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });

    Toast.success('✅ تم إضافة النازل');
    await renderInventory();

  } catch(e) { AppError.log('addInventoryBatch', e, true); }
  finally {
    if (btn) { btn.disabled = false; btn.textContent = originalText; }
  }
}

// ─── تعديل دفعة ─────────────────────────────────────────────
function openBatchEditNazil(batchId) {
  const el = document.getElementById(`batch-edit-nazil-${batchId}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function saveNazilBatchEdit(batchId) {
  const qty    = parseFloat(document.getElementById(`be-qty-${batchId}`)?.value)    || 0;
  const rem    = parseFloat(document.getElementById(`be-rem-${batchId}`)?.value)    || 0;
  const noulon = parseFloat(document.getElementById(`be-noulon-${batchId}`)?.value) || 0;
  const mashal = parseFloat(document.getElementById(`be-mashal-${batchId}`)?.value) || 0;

  try {
    await API.inventory.update(batchId, { quantity: qty, remaining_qty: rem, noulon, mashal });
    Toast.success('✅ تم التعديل');
    await renderInventory();
  } catch(e) { AppError.log('saveNazilBatchEdit', e, true); }
}

// ─── حذف دفعة ───────────────────────────────────────────────
async function deleteNazilBatch(batchId) {
  if (!confirm('حذف هذه الدفعة؟')) return;
  try {
    await API.inventory.delete(batchId);
    Toast.success('تم الحذف');
    await renderInventory();
  } catch(e) { AppError.log('deleteNazilBatch', e, true); }
}

// للتوافق مع الكود القديم
function renderBaqi()      { renderInventory(); }
function renderNazilList() { renderInventory(); }
async function deleteInventoryBatch(id) { await deleteNazilBatch(id); }

function goToProduct(batchId) {
  window._activeBatchId = batchId;
  showPage('sales', document.querySelector('[data-page="sales"]'));
  setTimeout(() => {
    if (typeof toggleBatch === 'function') toggleBatch(batchId);
  }, 300);
}