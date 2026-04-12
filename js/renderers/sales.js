// ============================================================
// renderers/sales.js — نظام المبيعات (نسخة القديم)
// ============================================================

let xProd = null;  // المنتج المفتوح حالياً

async function renderSalesTable() {
  const tbody = document.getElementById('sales-tbody');
  if (!tbody) return;
  const batches = store.inv || [];
  if (!batches.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#aaa;padding:22px">لا توجد أصناف</td></tr>';
    updateDayTotal();
    return;
  }

  let html = '';
  for (let i = 0; i < batches.length; i++) {
    const b = batches[i];
    const rem = b.remaining_qty;
    const sold = b.original_qty - rem;
    const supplier = store.supps.find(s => s.id === b.supplier_id);
    const totSales = (store.sales || []).filter(s => s.batch_id === b.batch_id).reduce((sum, s) => sum + s.total_amount, 0);
    const isOpen = (xProd === i);
    html += `<tr style="cursor:pointer;${isOpen ? 'background:#eafaf1;font-weight:700;' : ''}" onclick="toggleProd(${i})">
      <td style="padding:6px 5px;text-align:center;font-size:0.76rem;color:var(--gray)">${i+1}</td>
      <td style="padding:6px 5px;text-align:center"><strong style="color:var(--orange);font-size:0.79rem">${supplier ? supplier.name : '-'}</strong></td>
      <td style="padding:6px 5px;text-align:center"><strong>${b.product_name}</strong></td>
      <td style="padding:6px 5px;text-align:center">${N(b.original_qty)}</td>
      <td style="padding:6px 5px;text-align:center;color:var(--green);font-weight:800">${N(sold)}</td>
      <td style="padding:6px 5px;text-align:center;color:${rem<=0?'var(--red)':'var(--blue)'};font-weight:800">${N(rem)}${rem<=0?' ✅':''}</td>
      <td style="padding:6px 5px;text-align:center;font-weight:900;color:var(--green)">${N(totSales)} جنيه</td>
      <td style="padding:6px 5px;text-align:center">${isOpen ? '▲' : '▼'}</td>
      <td style="padding:6px 5px;" onclick="event.stopPropagation()"><button class="btn btn-r btn-xs" onclick="deleteBatch('${b.batch_id}')">🗑️</button></td>
    </tr>`;

    if (isOpen) {
      const sales = (store.sales || []).filter(s => s.batch_id === b.batch_id);
      const salesRows = sales.map(sl => {
        const cust = store.custs.find(c => c.id === sl.customer_id);
        const isCash = !sl.customer_id;
        return `<tr>
          <td style="padding:4px 5px">${sl.quantity || '-'}</td>
          <td style="padding:4px 5px;font-weight:700">${isCash ? '<span style="background:#d5f5e3;color:var(--green);border-radius:4px;padding:1px 5px;font-size:0.69rem">نقدي</span>' : (cust ? cust.name : '-')}</td>
          <td style="padding:4px 5px">${sl.weight_kg || '-'}</td>
          <td style="padding:4px 5px">${N(sl.unit_price)} جنيه</td>
          <td style="padding:4px 5px;font-weight:900;color:var(--green)">${N(sl.total_amount)} جنيه</td>
          <td style="padding:4px 5px"><button class="btn btn-r btn-xs" onclick="event.stopPropagation();deleteSale('${sl.id}')">🗑️</button></td>
        </tr>`;
      }).join('');

      html += `<tr style="background:#f8fff8"><td colspan="9" style="padding:0">
        <div style="padding:8px 12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
            <strong style="color:var(--green);font-size:0.86rem">مبيعات ${b.product_name}</strong>
            <button class="btn btn-g btn-sm" onclick="event.stopPropagation();openSaleForm('${b.batch_id}','${b.product_id}','${b.product_name}','${b.unit}')">+ بيعة</button>
          </div>
          ${sales.length ? `<table style="width:100%;border-collapse:collapse;font-size:0.79rem">
            <thead><tr style="background:#e8f8ee"><th>عدد</th><th>العميل</th><th>وزن(ك)</th><th>سعر</th><th>المبلغ</th><th>🗑️</th></tr></thead>
            <tbody>${salesRows}</tbody>
            <tfoot><tr style="background:#eafaf1;font-weight:900">
              <td colspan="4" style="text-align:right;padding:5px">الإجمالي</td>
              <td style="padding:5px;color:var(--green)">${N(totSales)} جنيه</td>
              <td></td>
            </tr></tfoot>
          </table>` : '<p style="color:#aaa;text-align:center;padding:10px">لا توجد مبيعات</p>'}
          <div id="sf-${b.batch_id}"></div>
        </div>
      </td></tr>`;
    }
  }
  tbody.innerHTML = html;
  updateDayTotal();
}

function toggleProd(idx) {
  xProd = (xProd === idx) ? null : idx;
  renderSalesTable();
}

function openSaleForm(batchId, productId, productName, unit) {
  const container = document.getElementById(`sf-${batchId}`);
  if (!container) return;
  if (container.innerHTML.trim()) { container.innerHTML = ''; return; }
  const custOptions = '<option value="">نقدي</option>' + (store.custs || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  container.innerHTML = `
    <div style="background:#f0faf5;border-radius:8px;padding:10px;margin-top:8px;border:1.5px solid var(--border)">
      <div style="font-weight:800;color:var(--green);margin-bottom:7px;font-size:0.85rem">+ بيعة جديدة</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(75px,1fr));gap:6px;margin-bottom:7px">
        <div><label class="lbl">عدد</label><input type="number" id="qty-${batchId}" min="0" step="0.01" oninput="calcSaleTotal('${batchId}')"></div>
        <div><label class="lbl">العميل</label><select id="cust-${batchId}">${custOptions}</select></div>
        <div><label class="lbl">وزن(ك)</label><input type="number" id="wt-${batchId}" min="0" step="0.01" oninput="calcSaleTotal('${batchId}')"></div>
        <div><label class="lbl">سعر</label><input type="number" id="price-${batchId}" min="0" oninput="calcSaleTotal('${batchId}')"></div>
        <div><label class="lbl">المبلغ</label><input type="number" id="total-${batchId}" readonly placeholder="0"></div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-g btn-sm" onclick="confirmSale('${batchId}','${productId}','${productName}','${unit}')">✅ تأكيد</button>
        <button class="btn btn-gr btn-sm" onclick="document.getElementById('sf-${batchId}').innerHTML=''">إلغاء</button>
      </div>
    </div>`;
}

function calcSaleTotal(batchId) {
  const qty = parseFloat(document.getElementById(`qty-${batchId}`).value) || 0;
  const wt = parseFloat(document.getElementById(`wt-${batchId}`).value) || 0;
  const price = parseFloat(document.getElementById(`price-${batchId}`).value) || 0;
  const units = wt > 0 ? wt : qty;
  document.getElementById(`total-${batchId}`).value = (units * price) || '';
}

async function confirmSale(batchId, productId, productName, unit) {
  const qty = parseFloat(document.getElementById(`qty-${batchId}`).value) || 0;
  const wt = parseFloat(document.getElementById(`wt-${batchId}`).value) || 0;
  const price = parseFloat(document.getElementById(`price-${batchId}`).value) || 0;
  const custId = document.getElementById(`cust-${batchId}`).value;
  const units = wt > 0 ? wt : qty;
  if (!units || !price) return Toast.warning('أدخل الكمية والسعر');
  const total = units * price;
  const isCash = !custId;
  try {
    await API.sales.add({
      batchId, productId, customerId: custId || null,
      quantity: qty, weightKg: wt, unitPrice: price, total,
      isCash, date: store._state.currentDate
    });
    // تحديث البيانات المحلية
    const [inventory, sales, customers] = await Promise.all([
      API.inventory.list(),
      API.sales.list(store._state.currentDate),
      API.customers.list()
    ]);
    store.set('inventory', inventory);
    store.set('sales', sales);
    store.set('customers', customers);
    Toast.success(`✅ تم تسجيل البيع: ${N(total)} ج`);
    renderSalesTable();
    // تحديث صفحة الترحيلات إذا كانت مفتوحة
    if (document.getElementById('page-tarhil').classList.contains('active')) renderTarhil();
    // فاتورة تلقائية إذا انتهت الدفعة
    const batch = inventory.find(b => b.batch_id === batchId);
    if (batch && batch.remaining_qty <= 0) autoGenerateSupplierInvoice(batchId);
  } catch(e) { AppError.log('confirmSale', e, true); }
}

async function autoGenerateSupplierInvoice(batchId) {
  const batch = store.inv.find(b => b.batch_id === batchId);
  if (!batch) return;
  const sales = (store.sales || []).filter(s => s.batch_id === batchId);
  if (!sales.length) return;
  const subtotal = sales.reduce((s, x) => s + x.total_amount, 0);
  const commission = Math.round(subtotal * 0.07);
  const noulon = batch.noulon || 0;
  const mashal = batch.mashal || 0;
  const total = subtotal - commission - noulon - mashal;
  try {
    const newInv = await API.invoices.create({
      type: 'supplier',
      supplierId: batch.supplier_id,
      date: store._state.currentDate,
      subtotal, commission, noulon, mashal, discount: 0, total,
      items: sales.map(s => ({
        productId: s.product_id,
        batchId: s.batch_id,
        quantity: s.quantity || 0,
        weightKg: s.weight_kg || 0,
        unitPrice: s.unit_price
      }))
    });
    const invs = await API.invoices.list();
    store.set('invoices', invs);
    Toast.success(`🧾 فاتورة ${newInv.invoice_number} — الصافي: ${N(total)} ج`);
    if (document.getElementById('page-invoices').classList.contains('active')) renderInvoicesPage();
  } catch(e) { AppError.log('autoGenerateSupplierInvoice', e); }
}

function updateDayTotal() {
  const total = (store.sales || []).reduce((s, x) => s + x.total_amount, 0);
  const el = document.getElementById('day-total');
  if (el) el.textContent = N(total) + ' جنيه';
}

async function deleteSale(saleId) {
  if (!confirm('حذف هذه البيعة؟')) return;
  try {
    await API.sales.delete(saleId);
    const [inventory, sales] = await Promise.all([
      API.inventory.list(),
      API.sales.list(store._state.currentDate)
    ]);
    store.set('inventory', inventory);
    store.set('sales', sales);
    Toast.success('تم الحذف');
    renderSalesTable();
    if (document.getElementById('page-tarhil').classList.contains('active')) renderTarhil();
  } catch(e) { AppError.log('deleteSale', e, true); }
}

// دالة مساعدة لحذف الدفعة (مشاركة مع nazil)
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