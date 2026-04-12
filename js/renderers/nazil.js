// ===================== renderers/nazil.js — الأصناف النازلة (نسخة معدلة للعمل مع store و API) =====================

async function addProduct() {
  const name       = document.getElementById('np-name').value.trim();
  const qty        = parseFloat(document.getElementById('np-qty').value);
  const unit       = document.getElementById('np-unit').value;
  const noulon     = parseFloat(document.getElementById('np-noulon').value) || 0;
  const mashal     = parseFloat(document.getElementById('np-mashal').value) || 0;
  const supplierId = document.getElementById('np-supplier').value;

  if (!name || !qty)   return Toast.warning('أدخل الصنف والكمية');
  if (!supplierId)     return Toast.warning('اختر المورد');

  // البحث عن المنتج في الكتالوج أو إنشاؤه
  let product = (store.prods || []).find(p => p.name === name && p.unit === unit);
  if (!product) {
    // إنشاء منتج جديد
    try {
      product = await API.products.add({ name, unit, buyPrice: 0, sellPrice: 0, lowStockAlert: 5 });
      const updatedProds = await API.products.list();
      store.set('products', updatedProds);
    } catch(e) { AppError.log('addProduct-createProduct', e, true); return; }
  }

  try {
    await API.inventory.add({
      productId:   product.id,
      supplierId:  supplierId,
      quantity:    qty,
      buyPrice:    0,   // سعر الشراء سيُحدد لاحقاً أو يمكن إضافته كحقل
      noulon:      noulon,
      mashal:      mashal,
      date:        store._state.currentDate
    });
    const updatedInv = await API.inventory.list();
    store.set('inventory', updatedInv);
    Toast.success(`✅ تم إضافة ${name}`);
    // مسح الحقول
    ['np-name', 'np-qty', 'np-noulon', 'np-mashal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    renderNazilList();
    renderSalesTable();  // لتحديث جدول المبيعات
  } catch(e) { AppError.log('addProduct', e, true); }
}

function renderNazilList() {
  // الأصناف النازلة = الدفعات النشطة التي لم تُباع بالكامل
  const batches = (store.inv || []).filter(b => b.remaining_qty > 0);
  const container = document.getElementById('nazil-list');
  if (!container) return;

  if (!batches.length) {
    container.innerHTML = '<p style="text-align:center;color:#aaa;padding:18px">لا توجد أصناف</p>';
    return;
  }

  container.innerHTML = batches.map((batch, i) => {
    const supplier = (store.supps || []).find(s => s.id === batch.supplier_id);
    // العثور على index الدفعة في المصفوفة لاستخدامه في goToProduct (اختياري)
    const idx = store.inv.findIndex(b => b.batch_id === batch.batch_id);
    return `<div style="background:#fff;border:1.5px solid var(--border);border-radius:10px;margin-bottom:8px;overflow:hidden;">
      <div style="padding:10px 12px;display:flex;align-items:center;gap:8px;cursor:pointer;background:#e8f8f5;" onclick="goToProduct(${idx})">
        <div style="background:#0e6655;color:#fff;border-radius:50%;width:25px;height:25px;display:flex;align-items:center;justify-content:center;font-size:0.77rem;font-weight:900;">${i + 1}</div>
        <div>
          <div style="font-weight:800;font-size:0.93rem;color:#0e6655">${batch.product_name}</div>
          <div style="font-size:0.74rem;color:var(--gray)">المورد: ${supplier ? supplier.name : '-'} | ${batch.unit}</div>
        </div>
        <div style="margin-right:auto;font-weight:900;color:#0e6655">${batch.remaining_qty} ${batch.unit}</div>
        <button class="btn btn-r btn-xs" onclick="event.stopPropagation();deleteBatch('${batch.batch_id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

async function deleteBatch(batchId) {
  if (!confirm('حذف هذه الدفعة؟')) return;
  try {
    await sb.from('incoming_batches').delete().eq('id', batchId).eq('company_id', currentUser.company_id);
    const updated = await API.inventory.list();
    store.set('inventory', updated);
    Toast.success('تم الحذف');
    renderNazilList();
    renderSalesTable();
  } catch(e) { AppError.log('deleteBatch', e, true); }
}