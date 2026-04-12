// ============================================================
// js/renderers/sales.js — المبيعات وإغلاق اليوم (مدمج)
// ============================================================

// متغير لتتبع الصف المفتوح (للتوافق مع التصميم القديم)
let _expandedBatchId = null;

async function renderSalesTable() {
  const tbody = document.getElementById('sales-tbody');
  if (!tbody) return;

  // عرض Skeleton
  tbody.innerHTML = '<tr><td colspan="9"><div class="skeleton" style="height:100px"></div></td></tr>';

  try {
    // نستخدم store.inv (المخزون النشط) كمصدر للبيانات
    const batches = store.inv || [];
    // فلترة: النشط فقط والذي لم ينفد
    const activeBatches = batches.filter(b => b.status === 'active' && b.remaining_qty > 0);

    if (!activeBatches.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="color:#aaa;padding:22px;text-align:center">لا توجد أصناف في المخزون</td></tr>';
      updateDayTotal(); return;
    }

    let html = '';
    activeBatches.forEach((b, i) => {
      const sold = b.original_qty - b.remaining_qty;
      const totalValue = sold * (b.buy_price || 0); // قيمة تقريبية
      const isX = _expandedBatchId === b.batch_id;
      
      html += `<tr style="cursor:pointer;${isX ? 'background:#eafaf1;font-weight:700;' : ''}" id="pr-${i}" onclick="toggleProduct('${b.batch_id}')">
        <td style="padding:6px 5px;text-align:center;font-size:0.76rem;color:var(--gray)">${i + 1}</td>
        <td style="padding:6px 5px;text-align:center"><strong style="color:var(--orange);font-size:0.79rem">${b.supplier_name || '-'}</strong></td>
        <td style="padding:6px 5px;text-align:center"><strong>${b.product_name}</strong></td>
        <td style="padding:6px 5px;text-align:center">${N(b.original_qty)}</td>
        <td style="padding:6px 5px;text-align:center;color:var(--green);font-weight:800">${N(sold)}</td>
        <td style="padding:6px 5px;text-align:center;color:var(--blue);font-weight:800">${N(b.remaining_qty)}</td>
        <td style="padding:6px 5px;text-align:center;font-weight:900;color:var(--green)">${N(totalValue)} جنيه</td>
        <td style="padding:6px 5px;text-align:center">${isX ? '▲' : '▼'}</td>
        <td style="padding:6px 5px;" onclick="event.stopPropagation()"><button class="btn btn-r btn-xs" onclick="deleteInventoryBatch('${b.batch_id}')">🗑️</button></td>
      </tr>`;
      
      if (isX) {
        html += `<tr style="background:#f8fff8"><td colspan="9" style="padding:0">
          <div style="padding:8px 12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
              <strong style="color:var(--green);font-size:0.86rem">تسجيل بيع — ${b.product_name}</strong>
              <button class="btn btn-g btn-sm" onclick="event.stopPropagation();openSaleModal('${b.batch_id}', '${b.product_id}', '${b.product_name}', '${b.unit}', ${b.remaining_qty})">+ بيع</button>
            </div>            <div id="sf-${b.batch_id}"></div>
          </div>
        </td></tr>`;
      }
    });

    tbody.innerHTML = html;
    updateDayTotal();

  } catch (e) {
    AppError.log('renderSalesTable', e);
    tbody.innerHTML = '<tr><td colspan="9" style="color:red;padding:20px">خطأ في التحميل</td></tr>';
  }
}

function toggleProduct(batchId) {
  _expandedBatchId = (_expandedBatchId === batchId) ? null : batchId;
  renderSalesTable();
}

function updateDayTotal() {
  // حساب إجمالي المبيعات من جدول daily_sales في store
  const todaySales = store.sales || [];
  const total = todaySales.reduce((s, sale) => s + (parseFloat(sale.total_amount) || 0), 0);
  document.getElementById('day-total').textContent = N(total) + ' جنيه';
}

// ============================================================
// إغلاق اليوم وترحيل المتبقي — نسخة Supabase المتكاملة
// ============================================================
async function closeDay() {
  // 1. جلب الأصناف المتبقية فعلياً من المخزون النشط
  const remainingBatches = store.inv.filter(b => 
    b.remaining_qty > 0 && b.status === 'active'
  );

  if (!remainingBatches.length) {
    Toast.info('✅ لا توجد بضاعة متبقية — اليوم مغلق بالفعل');
    return;
  }

  if (!confirm(`ترحيل ${remainingBatches.length} صنف متبقي لليوم التالي؟`)) return;

  // واجهة تحميل
  syncUI.setStatus('saving', 'جاري إغلاق اليوم وترحيل المتبقي...');
  const btn = document.querySelector('.btn-o'); // زر إغلاق اليوم
  if(btn) { btn.disabled = true; btn.textContent = 'جاري الإغلاق...'; }

  try {
    // 2. حساب تاريخ الغد    const today = new Date(store._state.currentDate);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const nextDateStr = tomorrow.toISOString().slice(0, 10);

    // 3. ترحيل كل دفعة متبقية واحدة تلو الأخرى
    for (const batch of remainingBatches) {
      await API.inventory.carryOver(batch.batch_id, batch.remaining_qty, nextDateStr);
    }

    // 4. تحديث التاريخ في الواجهة والمخزن المحلي
    store.set('currentDate', nextDateStr);
    updateDates();

    // 5. إعادة تحميل بيانات اليوم الجديد
    await loadTodayData();

    // 6. تحديث الواجهات فوراً
    await renderBaqi();      // المتبقي سيظهر هنا
    await renderNazilList(); // النازل الجديد سيظهر هنا (فارغ حالياً)
    await renderSalesTable();
    await renderDashboard(); // تحديث الإحصائيات

    Toast.success('✅ تم إغلاق اليوم وترحيل المتبقي بنجاح');

  } catch (e) {
    AppError.log('closeDay', e, true);
  } finally {
    syncUI.setStatus('', 'محفوظ على السحابة ✓');
    if(btn) { btn.disabled = false; btn.textContent = '🌙 إغلاق اليوم'; }
  }
}

// دالة مساعدة لفتح مودال البيع السريع (لتحسين تجربة المستخدم)
function openSaleModal(batchId, productId, productName, unit, maxQty) {
  const modal = document.getElementById('quick-sale-modal');
  if (!modal) return;
  
  const custOpts = '<option value="">نقدي</option>' +
    (store.custs||[]).map(c=>`<option value="${c.id}">${c.name}</option>`).join('');

  modal.innerHTML = `
    <div class="modal-box">
      <button class="cx" onclick="closeModal('quick-sale-modal')">✕</button>
      <h3>🛒 بيع — ${productName}</h3>
      <div class="frow"><label>العميل</label><select id="qs-cust">${custOpts}</select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="frow"><label>الكمية (${unit})</label><input type="number" id="qs-qty" placeholder="0" min="0" max="${maxQty}" step="0.01" oninput="calcQS()"></div>
        <div class="frow"><label>سعر الوحدة</label><input type="number" id="qs-price" placeholder="0" min="0" oninput="calcQS()"></div>
      </div>      <div class="frow"><label>الإجمالي</label><input type="number" id="qs-total" readonly style="background:#f0f0f0"></div>
      <button class="btn btn-g" style="width:100%" onclick="confirmQuickSale('${batchId}','${productId}','${productName}','${unit}',${maxQty})">✅ تأكيد البيع</button>
    </div>`;
  modal.classList.add('open');
}

function calcQS() {
  const qty   = parseFloat(document.getElementById('qs-qty')?.value)   || 0;
  const price = parseFloat(document.getElementById('qs-price')?.value) || 0;
  const tot   = document.getElementById('qs-total');
  if (tot) tot.value = (qty * price) || '';
}

async function confirmQuickSale(batchId, productId, productName, unit, maxQty) {
  const custId = document.getElementById('qs-cust').value;
  const qty    = parseFloat(document.getElementById('qs-qty').value)   || 0;
  const price  = parseFloat(document.getElementById('qs-price').value) || 0;

  if (!qty || !price) return Toast.warning('أدخل الكمية والسعر');
  if (qty > maxQty) return Toast.error('الكمية أكبر من المتبقي!');

  const total = qty * price;
  try {
    await API.sales.add({
      customerId: custId || null,
      productId,
      batchId,
      quantity: qty,
      unitPrice: price,
      total,
      isCash: !custId,
      date: store._state.currentDate
    });

    closeModal('quick-sale-modal');
    Toast.success(`✅ تم تسجيل البيع: ${N(total)} جنيه`);
    
    // تحديث البيانات
    const [inv, sales] = await Promise.all([
      API.inventory.list(),
      API.sales.list(store._state.currentDate)
    ]);
    store.set('inventory', inv);
    store.set('sales', sales);
    
    renderSalesTable();
    renderDashboard(); // تحديث فوري للإحصائيات

  } catch(e) { AppError.log('confirmQuickSale', e, true); }
}
// حذف دفعة
async function deleteInventoryBatch(batchId) {
  if (!confirm('حذف هذه الدفعة نهائياً؟')) return;
  try {
    await sb.from('incoming_batches').delete().eq('id', batchId).eq('company_id', currentUser.company_id);
    const updated = await API.inventory.list();
    store.set('inventory', updated);
    Toast.success('تم الحذف');
    renderSalesTable(); renderNazilList(); renderBaqi();
  } catch(e) { AppError.log('deleteInventoryBatch', e, true); }
}