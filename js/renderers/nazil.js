// ============================================================
// js/renderers/nazil.js — الأصناف النازلة (مدمج مع Supabase)
// ============================================================

async function addProduct() {
  const name       = document.getElementById('np-name')?.value.trim();
  const qty        = parseFloat(document.getElementById('np-qty')?.value);
  const unit       = document.getElementById('np-unit')?.value;
  const noulon     = parseFloat(document.getElementById('np-noulon')?.value) || 0;
  const mashal     = parseFloat(document.getElementById('np-mashal')?.value) || 0;
  const supplierId = document.getElementById('np-supplier')?.value;

  if (!name || !qty)   return Toast.warning('أدخل الصنف والكمية');
  if (!supplierId)     return Toast.warning('اختر المورد');

  const btn = event.target;
  btn.disabled = true; btn.textContent = 'جاري الإضافة...';

  try {
    // 1. البحث عن المنتج أو إنشاؤه
    let productId = null;
    const existingProd = (store.prods || []).find(p => p.name.toLowerCase() === name.toLowerCase());
    
    if (existingProd) {
      productId = existingProd.id;
    } else {
      // إذا لم يوجد، ننشئه في جدول المنتجات أولاً
      const newProd = await API.products.add({
        name, unit, category: 'خضار', buyPrice: 0, sellPrice: 0, lowStockAlert: 5
      });
      productId = newProd.id;
      // تحديث القائمة المحلية
      const updatedProds = await API.products.list();
      store.set('products', updatedProds);
    }

    // 2. إضافة الدفعة للمخزون (تظهر فوراً في النازل)
    await API.inventory.add({
      productId,
      supplierId,
      quantity: qty,
      buyPrice: 0, // يمكن تعديله لاحقاً
      noulon,
      mashal,
      date: store._state.currentDate
    });

    // تنظيف الحقول
    ['np-name', 'np-qty', 'np-noulon', 'np-mashal'].forEach(id => {
      const el = document.getElementById(id); if(el) el.value = '';    });

    Toast.success(`✅ تم إضافة ${name}`);
    
    // تحديث الواجهات
    const updatedInv = await API.inventory.list();
    store.set('inventory', updatedInv);
    renderNazilList();
    renderSalesTable(); // تحديث جدول المبيعات أيضاً
    refreshDropdowns();

  } catch (e) {
    AppError.log('addProduct', e, true);
  } finally {
    btn.disabled = false; btn.textContent = '➕ إضافة';
  }
}

async function renderNazilList() {
  const container = document.getElementById('nazil-list');
  if (!container) return;

  container.innerHTML = '<div class="skeleton" style="height:150px"></div>';

  try {
    // فلترة: دفعات نشطة ولم يتم ترحيلها (نازلة اليوم)
    const nazilItems = store.inv.filter(b => 
      !b.carryover_from && b.status === 'active' && b.remaining_qty > 0
    );

    if (!nazilItems.length) {
      container.innerHTML = '<p style="text-align:center;color:#aaa;padding:18px">لا توجد أصناف نازلة اليوم</p>';
      return;
    }

    container.innerHTML = nazilItems.map((b, i) => {
      const pct = b.original_qty > 0 ? Math.round((b.remaining_qty / b.original_qty) * 100) : 0;
      return `<div style="background:#fff;border:1.5px solid var(--border);border-radius:10px;margin-bottom:8px;overflow:hidden;">
        <div style="padding:10px 12px;display:flex;align-items:center;gap:8px;cursor:pointer;background:#e8f8f5;" onclick="goToProduct('${b.batch_id}')">
          <div style="background:#0e6655;color:#fff;border-radius:50%;width:25px;height:25px;display:flex;align-items:center;justify-content:center;font-size:0.77rem;font-weight:900;">${i + 1}</div>
          <div style="flex:1">
            <div style="font-weight:800;font-size:0.93rem;color:#0e6655">${b.product_name}</div>
            <div style="font-size:0.74rem;color:var(--gray)">المورد: ${b.supplier_name || '-'} | ${b.unit}</div>
          </div>
          <div style="text-align:left">
            <div style="font-weight:900;color:#0e6655">${N(b.remaining_qty)} ${b.unit}</div>
          </div>
          <button class="btn btn-r btn-xs" onclick="event.stopPropagation();deleteInventoryBatch('${b.batch_id}')">🗑️</button>
        </div>
      </div>`;    }).join('');

  } catch (e) {
    AppError.log('renderNazilList', e);
  }
}