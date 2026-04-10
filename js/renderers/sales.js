// ============================================================
// renderers/sales.js — المبيعات (محدّث للتوافق مع API الجديد)
// ملاحظة: هذا الملف يعمل مع كلٍّ من النظام القديم (S) والجديد (store)
// ============================================================

// Bridge: نضمن التوافق مع كلا النظامين
function _getSaleProducts() {
  // النظام الجديد: المخزون من store
  if (store.inv && store.inv.length) return store.inv;
  // النظام القديم: من S.products
  return S.products || [];
}

function _getSaleCustomers() {
  return store.custs?.length ? store.custs : (S.customers || []);
}

function _getSaleSuppliers() {
  return store.supps?.length ? store.supps : (S.suppliers || []);
}


// --- دوال مساعدة للترحيل (تُستخدم من sales و customers) ---
function addToTarhil(custId, pName, qty, unit, wt, price, total) {
  if (!custId) return;
  if (!S.tarhilLog[S.date]) S.tarhilLog[S.date] = {};
  if (!S.tarhilLog[S.date][custId]) S.tarhilLog[S.date][custId] = [];
  S.tarhilLog[S.date][custId].push({ productName: pName, qty, unit, weight: wt, price, total });
}

function removeFromTarhil(custId, date, total) {
  if (!custId || !S.tarhilLog[date] || !S.tarhilLog[date][custId]) return;
  const idx = S.tarhilLog[date][custId].findIndex(t => t.total === total);
  if (idx >= 0) S.tarhilLog[date][custId].splice(idx, 1);
  postDailyTotal(custId, date);
}

function postDailyTotal(custId, date) {
  const cust = S.customers.find(c => c.id == custId);
  if (!cust) return;
  cust.ledger = cust.ledger.filter(e => !(e.type === 'order' && e.isTarhil && e.date === date));
  const items = (S.tarhilLog[date] && S.tarhilLog[date][custId]) || [];
  if (!items.length) return;
  const dayTotal = items.reduce((s, t) => s + t.total, 0);
  cust.ledger.push({ date, type: 'order', amount: dayTotal, ref: 'يومية', isTarhil: true, tarhilDate: date });
}

// --- جدول المبيعات ---
function goToProduct(idx) {
  xProd = idx;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
  document.getElementById('page-sales').classList.add('active');
  document.querySelectorAll('nav.tabs button')[2].classList.add('active');
  renderAll();
  setTimeout(() => {
    const r = document.getElementById('pr-' + idx);
    if (r) r.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 150);
}

function toggleProd(i) { xProd = xProd === i ? null : i; renderSalesTable(); }

function updateDayTotal() {
  const t = S.products.reduce((s, p) => s + p.salesLog.reduce((ss, x) => ss + x.total, 0), 0);
  document.getElementById('day-total').textContent = N(t) + ' جنيه';
}

function delProduct(i) {
  if (!confirm('حذف هذا الصنف؟')) return;
  S.products.splice(i, 1);
  if (xProd === i) xProd = null;
  else if (xProd > i) xProd--;  // تصحيح index بعد الحذف
  save(); renderNazilList(); renderSalesTable(); renderBaqi(); refreshDropdowns();
}

function renderSalesTable() {
  const tbody = document.getElementById('sales-tbody');
  if (!S.products.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="color:#aaa;padding:22px;text-align:center">لا توجد أصناف</td></tr>';
    updateDayTotal(); return;
  }
  let html = '';
  S.products.forEach((p, i) => {
    const rem  = p.totalQty - p.sold;
    const sup  = S.suppliers.find(s => s.id == p.supplierId);
    const done = rem <= 0;
    const tot  = p.salesLog.reduce((s, x) => s + x.total, 0);
    const isX  = xProd === i;
    html += `<tr style="cursor:pointer;${isX ? 'background:#eafaf1;font-weight:700;' : ''}" id="pr-${i}" onclick="toggleProd(${i})">
      <td style="padding:6px 5px;text-align:center;font-size:0.76rem;color:var(--gray)">${i + 1}</td>
      <td style="padding:6px 5px;text-align:center"><strong style="color:var(--orange);font-size:0.79rem">${sup ? sup.name : '-'}</strong></td>
      <td style="padding:6px 5px;text-align:center"><strong>${p.name}</strong></td>
      <td style="padding:6px 5px;text-align:center">${p.totalQty}</td>
      <td style="padding:6px 5px;text-align:center;color:var(--green);font-weight:800">${p.sold}</td>
      <td style="padding:6px 5px;text-align:center;color:${done ? 'var(--red)' : 'var(--blue)'};font-weight:800">${rem}${done ? ' ✅' : ''}</td>
      <td style="padding:6px 5px;text-align:center;font-weight:900;color:var(--green)">${N(tot)} جنيه</td>
      <td style="padding:6px 5px;text-align:center">${isX ? '▲' : '▼'}</td>
      <td style="padding:6px 5px;" onclick="event.stopPropagation()"><button class="btn btn-r btn-xs" onclick="delProduct(${i})">🗑️</button></td>
    </tr>`;
    if (isX) {
      const salesRows = p.salesLog.map((sl, si) => {
        const cust   = S.customers.find(c => c.id == sl.custId);
        const isCash = !sl.custId;
        return `<tr>
          <td style="padding:4px 5px">${sl.qty || '-'}</td>
          <td style="padding:4px 5px;font-weight:700">${isCash ? '<span style="background:#d5f5e3;color:var(--green);border-radius:4px;padding:1px 5px;font-size:0.69rem">نقدي</span>' : (cust ? cust.name : '-')}</td>
          <td style="padding:4px 5px">${sl.weight || '-'}</td>
          <td style="padding:4px 5px">${sl.price} جنيه</td>
          <td style="padding:4px 5px;font-weight:900;color:var(--green)">${N(sl.total)} جنيه</td>
          <td style="padding:4px 5px"><button class="btn btn-y btn-xs" style="background:#d4ac0d;color:#fff;" onclick="event.stopPropagation();openEditSale(${i},${si})">✏️</button></td>
          <td style="padding:4px 5px"><button class="btn btn-r btn-xs" onclick="event.stopPropagation();delSaleLine(${i},${si})">🗑️</button></td>
        </tr>`;
      }).join('');
      html += `<tr style="background:#f8fff8"><td colspan="9" style="padding:0">
        <div style="padding:8px 12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
            <strong style="color:var(--green);font-size:0.86rem">مبيعات ${p.name}</strong>
            <button class="btn btn-g btn-sm" onclick="event.stopPropagation();openSaleForm(${i})">+ بيعة</button>
          </div>
          ${p.salesLog.length
            ? `<table style="width:100%;border-collapse:collapse;font-size:0.79rem">
                <thead><tr style="background:#e8f8ee"><th>عدد</th><th>العميل</th><th>وزن(ك)</th><th>سعر</th><th>المبلغ</th><th>✏️</th><th>🗑️</th></tr></thead>
                <tbody>${salesRows}</tbody>
                <tfoot><tr style="background:#eafaf1;font-weight:900">
                  <td colspan="4" style="text-align:right;padding:5px">الإجمالي</td>
                  <td style="padding:5px;color:var(--green)">${N(tot)} جنيه</td>
                  <td colspan="2"></td>
                </tr></tfoot>
              </table>`
            : '<p style="color:#aaa;text-align:center;padding:10px">لا توجد مبيعات</p>'}
          <div id="sf-${i}"></div>
        </div>
      </td></tr>`;
    }
  });
  tbody.innerHTML = html;
  updateDayTotal();
}

// --- نموذج البيع ---
function openSaleForm(i) {
  const d = document.getElementById('sf-' + i);
  if (!d) return;
  if (d.innerHTML.trim()) { d.innerHTML = ''; return; }
  d.innerHTML = buildSaleForm(i, null);
}

function openEditSale(pi, si) {
  const d = document.getElementById('sf-' + pi);
  if (!d) return;
  d.innerHTML = buildSaleForm(pi, si);
}

function buildSaleForm(pi, editIdx) {
  const p    = S.products[pi];
  const sl   = editIdx !== null ? p.salesLog[editIdx] : null;
  const custOpts = '<option value="">نقدي</option>' +
    S.customers.map(c => `<option value="${c.id}" ${sl && sl.custId == c.id ? 'selected' : ''}>${c.name}</option>`).join('');
  return `<div style="background:#f0faf5;border-radius:8px;padding:10px;margin-top:8px;border:1.5px solid var(--border)">
    <div style="font-weight:800;color:var(--green);margin-bottom:7px;font-size:0.85rem">${editIdx !== null ? '✏️ تعديل' : '+ بيعة جديدة'}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(75px,1fr));gap:6px;margin-bottom:7px">
      <div><label class="lbl">عدد</label><input type="number" id="sf-qty-${pi}" value="${sl && sl.qty || ''}" placeholder="0" min="0" oninput="calcSF(${pi})"></div>
      <div><label class="lbl">العميل</label><select id="sf-cust-${pi}">${custOpts}</select></div>
      <div><label class="lbl">وزن(ك)</label><input type="number" id="sf-wt-${pi}" value="${sl && sl.weight || ''}" placeholder="0" step="0.01" min="0" oninput="calcSF(${pi})"></div>
      <div><label class="lbl">سعر</label><input type="number" id="sf-price-${pi}" value="${sl ? sl.price : ''}" placeholder="0" min="0" oninput="calcSF(${pi})"></div>
      <div><label class="lbl">المبلغ</label><input type="number" id="sf-tot-${pi}" readonly placeholder="0" value="${sl ? sl.total : ''}"></div>
    </div>
    <div style="display:flex;gap:6px">
      <button class="btn btn-g btn-sm" onclick="${editIdx !== null ? `saveEditSale(${pi},${editIdx})` : `confirmSale(${pi})`}">✅ ${editIdx !== null ? 'حفظ' : 'تأكيد'}</button>
      <button class="btn btn-gr btn-sm" onclick="document.getElementById('sf-${pi}').innerHTML=''">إلغاء</button>
    </div>
  </div>`;
}

function calcSF(i) {
  const qty   = parseFloat(document.getElementById(`sf-qty-${i}`).value)   || 0;
  const wt    = parseFloat(document.getElementById(`sf-wt-${i}`).value)    || 0;
  const price = parseFloat(document.getElementById(`sf-price-${i}`).value) || 0;
  document.getElementById(`sf-tot-${i}`).value = (wt > 0 ? wt : qty) * price || '';
}

function confirmSale(i) {
  const p      = S.products[i];
  const qty    = parseFloat(document.getElementById(`sf-qty-${i}`).value)   || 0;
  const wt     = parseFloat(document.getElementById(`sf-wt-${i}`).value)    || 0;
  const price  = parseFloat(document.getElementById(`sf-price-${i}`).value) || 0;
  const custId = document.getElementById(`sf-cust-${i}`).value;
  const units  = wt > 0 ? wt : qty;
  if (!units || !price) return alert('أدخل الكمية والسعر');
  if (qty > 0 && qty > (p.totalQty - p.sold)) return alert('الكمية أكبر من المتبقي!');
  const total  = units * price;
  const isCash = !custId;
  const colId  = isCash ? (Date.now() + Math.random()) : null;
  S.products[i].sold        += qty || 0;
  S.products[i].totalWeight  = (p.totalWeight || 0) + (wt || 0);
  S.products[i].salesLog.push({ date: S.date, qty: qty || null, weight: wt || null, price, total, custId, collectionId: colId });
  if (isCash) {
    S.collections.push({ id: colId, date: S.date, custId: null, amount: total, note: `نقدية — ${p.name} ${qty || wt} ${qty ? p.unit : 'ك'} × ${price}`, isCash: true, isDiscount: false });
  } else {
    addToTarhil(custId, p.name, qty || null, p.unit, wt || null, price, total);
    postDailyTotal(custId, S.date);
  }
  save(); renderAll(); checkAutoInvoice(p.supplierId);
}

function saveEditSale(pi, si) {
  const p   = S.products[pi];
  const old = p.salesLog[si];
  if (old.custId) removeFromTarhil(old.custId, old.date, old.total);
  if (!old.custId && old.collectionId) S.collections = S.collections.filter(c => c.id !== old.collectionId);
  S.products[pi].sold        -= (old.qty    || 0);
  S.products[pi].totalWeight  = (p.totalWeight || 0) - (old.weight || 0);
  const qty    = parseFloat(document.getElementById(`sf-qty-${pi}`).value)   || 0;
  const wt     = parseFloat(document.getElementById(`sf-wt-${pi}`).value)    || 0;
  const price  = parseFloat(document.getElementById(`sf-price-${pi}`).value) || 0;
  const custId = document.getElementById(`sf-cust-${pi}`).value;
  const units  = wt > 0 ? wt : qty;
  if (!units || !price) return alert('أدخل الكمية والسعر');
  const total  = units * price;
  const isCash = !custId;
  const colId  = isCash ? (Date.now() + Math.random()) : null;
  p.salesLog[si] = { date: S.date, qty: qty || null, weight: wt || null, price, total, custId, collectionId: colId };
  S.products[pi].sold        += qty || 0;
  S.products[pi].totalWeight  = (p.totalWeight || 0) + (wt || 0);
  if (isCash) {
    S.collections.push({ id: colId, date: S.date, custId: null, amount: total, note: `نقدية — ${p.name}`, isCash: true, isDiscount: false });
  } else {
    addToTarhil(custId, p.name, qty || null, p.unit, wt || null, price, total);
    postDailyTotal(custId, S.date);
  }
  save(); renderAll();
}

function delSaleLine(pi, si) {
  const p  = S.products[pi];
  const sl = p.salesLog[si];
  if (sl.custId) removeFromTarhil(sl.custId, sl.date, sl.total);
  if (!sl.custId && sl.collectionId) S.collections = S.collections.filter(c => c.id !== sl.collectionId);
  p.sold        -= (sl.qty    || 0);
  p.totalWeight  = (p.totalWeight || 0) - (sl.weight || 0);
  p.salesLog.splice(si, 1);
  save(); renderAll();
}

function closeDay() {
  const rem = S.products.filter(p => (p.totalQty - p.sold) > 0);
  if (!rem.length)                           { alert('لا توجد بضاعة للترحيل!'); return; }
  if (!confirm(`ترحيل ${rem.length} صنف للغد؟`)) return;
  S.products = S.products.map(p => {
    if ((p.totalQty - p.sold) <= 0) return null;
    return { ...p, totalQty: p.totalQty - p.sold, sold: 0, salesLog: [], carryoverFrom: S.date };
  }).filter(Boolean);
  xProd = null;
  const nd = new Date(); nd.setDate(nd.getDate() + 1);
  S.date = fmtDate(nd);
  save(); updateDates(); renderAll();
  alert('✅ تم إغلاق اليوم!');
}

function checkAutoInvoice(supplierId) {
  const sp = S.products.filter(p => p.supplierId == supplierId);
  if (sp.length && sp.every(p => (p.totalQty - p.sold) <= 0) &&
      !S.invoices.some(inv => inv.supplierId == supplierId && inv.date === S.date))
    generateInvoiceFor(supplierId, true);
}
