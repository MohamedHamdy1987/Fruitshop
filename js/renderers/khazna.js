// ============================================================
// renderers/khazna.js — محدَّث
// ✅ زر تعديل ومسح على كل حركة تحصيل ومصروف
// ✅ البيعات النقدية تظهر تلقائياً في التحصيلات
// ✅ إصلاح مشكلة القطعية (لا تخصم الرصيد مرتين)
// ============================================================

// ─── تسجيل تحصيل ────────────────────────────────────────────
async function addCollection() {
  const custId   = document.getElementById('col-cust-sel').value;
  const amount   = parseFloat(document.getElementById('col-amount').value)   || 0;
  const discount = parseFloat(document.getElementById('col-discount').value) || 0;
  const note     = document.getElementById('col-note').value.trim();
  if (!custId)                  return Toast.warning('اختر العميل');
  if (amount<=0 && discount<=0) return Toast.warning('أدخل مبلغاً أو قطعية');

  const cust = (store.custs||[]).find(c => c.id===custId||c.id==custId);
  const btn = event.target; btn.disabled=true; btn.textContent='...';
  try {
    // تسجيل الدفعة الأساسية (بدون discount_amount لتجنب الخصم المزدوج)
    if (amount > 0) {
      await API.payments.addCollection({
        customerId: custId, amount, discount: 0,
        description: note || 'تحصيل', date: store._state.currentDate
      });
    }
    // تسجيل القطعية: نعتبرها مبلغاً إضافياً مخفضاً (discount = 0)
    // حتى لا يخصم trigger الرصيد مرتين
    if (discount > 0) {
      await API.payments.addCollection({
        customerId: custId, amount: discount, discount: 0,
        description: note ? `قطعية — ${note}` : 'قطعية', date: store._state.currentDate
      });
    }
    const [custs, pays] = await Promise.all([API.customers.list(), API.payments.list(store._state.currentDate)]);
    store.set('customers', custs);
    store.set('payments',  pays);
    ['col-amount','col-discount','col-note'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    if (amount>0)   Toast.success(`✅ تحصيل ${N(amount)} ج من ${cust?.name||'-'}`);
    if (discount>0) Toast.success(`✅ قطعية ${N(discount)} ج`);
    renderCollections(); renderDaySummary(); refreshDropdowns();
  } catch(e) { AppError.log('addCollection', e, true); }
  finally { btn.disabled=false; btn.textContent='✅'; }
}

// ─── عرض التحصيلات ──────────────────────────────────────────
function renderCollections() {
  const el = document.getElementById('col-body');
  if (!el) return;
  const today = (store.pays||[]).filter(p => p.direction==='in');
  if (!today.length) { el.innerHTML='لا توجد تحصيلات اليوم'; _updateColTotal(0); return; }

  const cash  = today.filter(p => !p.customer_id || p.payment_type === 'cash_sale');
  const creds = today.filter(p => p.customer_id && p.payment_type !== 'cash_sale');

  let html = '';

  if (cash.length) {
    html += `<div style="font-weight:700;margin:8px 0 4px;color:var(--green)">💵 نقديات وبيعات نقدية</div>`;
    cash.forEach(p => {
      html += _paymentRow(p, null);
    });
  }

  if (creds.length) {
    html += `<div style="font-weight:700;margin:12px 0 4px;color:var(--blue)">📋 تسديدات العملاء</div>`;
    creds.forEach(p => {
      const cust = (store.custs||[]).find(c => c.id===p.customer_id);
      html += _paymentRow(p, cust);
    });
  }

  el.innerHTML = html;
  _updateColTotal(today.reduce((s,p)=>s+parseFloat(p.amount||0),0));
}

// ─── صف حركة مع تعديل ومسح ─────────────────────────────────
function _paymentRow(p, cust) {
  const label = cust ? `${cust.name} — ${p.description||''}` :
                (p.payment_type==='cash_sale' ? `🛒 ${p.description||'بيعة نقدية'}` : p.description||'-');
  return `
  <div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;margin-bottom:6px;overflow:hidden">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px">
      <div>
        <div style="font-weight:600;font-size:13px">${label}</div>
        <div style="font-size:11px;color:#888">${new Date(p.payment_date).toLocaleDateString('ar-EG')}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <strong style="color:var(--green)">${N(p.amount)} ج</strong>
        <button onclick="openPaymentEdit('${p.id}','${p.direction}')" style="background:var(--blue);color:#fff;border:none;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:11px">✏️</button>
        <button onclick="delPayment('${p.id}')" style="background:var(--red);color:#fff;border:none;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:11px">🗑️</button>
      </div>
    </div>
    <div id="pay-edit-${p.id}" style="display:none;padding:10px;border-top:1px solid #eee;background:#fffde7">
      <div style="display:flex;gap:8px;align-items:center">
        <div style="flex:1"><label style="font-size:11px">المبلغ</label><input id="pe-amt-${p.id}" value="${p.amount}" type="number" step="0.01" style="width:100%;padding:5px;border-radius:5px;border:1px solid #ddd"></div>
        <div style="flex:2"><label style="font-size:11px">البيان</label><input id="pe-desc-${p.id}" value="${p.description||''}" style="width:100%;padding:5px;border-radius:5px;border:1px solid #ddd"></div>
        <div><button onclick="savePaymentEdit('${p.id}')" style="background:var(--orange);color:#fff;border:none;border-radius:5px;padding:6px 12px;cursor:pointer">💾 حفظ</button></div>
        <div><button onclick="openPaymentEdit('${p.id}')" style="background:#eee;border:none;border-radius:5px;padding:6px 12px;cursor:pointer">إلغاء</button></div>
      </div>
    </div>
  </div>`;
}

function openPaymentEdit(id, dir) {
  const el = document.getElementById(`pay-edit-${id}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function savePaymentEdit(id) {
  const amount = parseFloat(document.getElementById(`pe-amt-${id}`)?.value) || 0;
  const desc   = document.getElementById(`pe-desc-${id}`)?.value.trim() || '';
  if (!amount) return Toast.warning('أدخل المبلغ');
  try {
    await API.payments.update(id, { amount, description: desc });
    const [pays, custs] = await Promise.all([
      API.payments.list(store._state.currentDate),
      API.customers.list()
    ]);
    store.set('payments', pays);
    store.set('customers', custs);
    document.getElementById(`pay-edit-${id}`).style.display = 'none';
    Toast.success('✅ تم التعديل');
    renderCollections(); renderExpenses(); renderDaySummary(); refreshDropdowns();
  } catch(e) { AppError.log('savePaymentEdit', e, true); }
}

function _updateColTotal(total) {
  const el = document.getElementById('col-total');
  if (el) el.textContent = N(total) + ' جنيه';
}

// ─── تسجيل مصروف ────────────────────────────────────────────
async function addExpense() {
  const desc   = document.getElementById('exp-desc').value.trim();
  const suppId = document.getElementById('exp-supp-sel').value;
  const amount = parseFloat(document.getElementById('exp-amount').value);
  if (!desc)          return Toast.warning('أدخل البيان');
  if (!amount||amount<=0) return Toast.warning('أدخل المبلغ');

  const btn = event.target; btn.disabled=true; btn.textContent='...';
  try {
    await API.payments.addExpense({
      supplierId:  suppId||null, amount,
      description: desc,
      type:        suppId ? 'supplier_payment' : 'expense',
      date:        store._state.currentDate
    });
    const [supps, pays] = await Promise.all([API.suppliers.list(), API.payments.list(store._state.currentDate)]);
    store.set('suppliers', supps);
    store.set('payments',  pays);
    ['exp-desc','exp-amount'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    Toast.success(`✅ مصروف ${N(amount)} ج`);
    renderExpenses(); renderDaySummary();
  } catch(e) { AppError.log('addExpense', e, true); }
  finally { btn.disabled=false; btn.textContent='✅'; }
}

// ─── عرض المصروفات (مع تعديل ومسح) ─────────────────────────
function renderExpenses() {
  const el = document.getElementById('exp-body');
  if (!el) return;
  const today = (store.pays||[]).filter(p => p.direction==='out');
  if (!today.length) { el.innerHTML='لا توجد مصروفات اليوم'; _updateExpTotal(0); return; }

  el.innerHTML = today.map(e => {
    const supp = (store.supps||[]).find(s => s.id===e.supplier_id);
    return `
    <div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;margin-bottom:6px;overflow:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px">
        <div>
          <div style="font-weight:600;font-size:13px">${e.description||'-'}</div>
          <div style="font-size:11px;color:#888">${e.supplier?.name||supp?.name ? `🚛 ${e.supplier?.name||supp?.name}` : ''} · ${new Date(e.payment_date).toLocaleDateString('ar-EG')}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <strong style="color:var(--red)">${N(e.amount)} ج</strong>
          <button onclick="openPaymentEdit('${e.id}','out')" style="background:var(--blue);color:#fff;border:none;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:11px">✏️</button>
          <button onclick="delPayment('${e.id}')" style="background:var(--red);color:#fff;border:none;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:11px">🗑️</button>
        </div>
      </div>
      <div id="pay-edit-${e.id}" style="display:none;padding:10px;border-top:1px solid #eee;background:#fffde7">
        <div style="display:flex;gap:8px;align-items:center">
          <div style="flex:1"><label style="font-size:11px">المبلغ</label><input id="pe-amt-${e.id}" value="${e.amount}" type="number" step="0.01" style="width:100%;padding:5px;border-radius:5px;border:1px solid #ddd"></div>
          <div style="flex:2"><label style="font-size:11px">البيان</label><input id="pe-desc-${e.id}" value="${e.description||''}" style="width:100%;padding:5px;border-radius:5px;border:1px solid #ddd"></div>
          <div><button onclick="savePaymentEdit('${e.id}')" style="background:var(--orange);color:#fff;border:none;border-radius:5px;padding:6px 12px;cursor:pointer">💾 حفظ</button></div>
          <div><button onclick="openPaymentEdit('${e.id}')" style="background:#eee;border:none;border-radius:5px;padding:6px 12px;cursor:pointer">إلغاء</button></div>
        </div>
      </div>
    </div>`;
  }).join('');

  _updateExpTotal(today.reduce((s,e)=>s+parseFloat(e.amount||0),0));
}

function _updateExpTotal(total) {
  const el = document.getElementById('exp-total');
  if (el) el.textContent = N(total) + ' جنيه';
}

// ─── حذف حركة ───────────────────────────────────────────────
async function delPayment(id) {
  if (!confirm('حذف هذه الحركة؟')) return;
  try {
    await API.payments.delete(id);
    const [pays, custs, supps] = await Promise.all([
      API.payments.list(store._state.currentDate),
      API.customers.list(),
      API.suppliers.list()
    ]);
    store.set('payments',  pays);
    store.set('customers', custs);
    store.set('suppliers', supps);
    Toast.success('تم الحذف');
    renderCollections(); renderExpenses(); renderDaySummary(); refreshDropdowns();
  } catch(e) { AppError.log('delPayment', e, true); }
}

// ─── ملخص الخزنة ────────────────────────────────────────────
function renderDaySummary() {
  const pays   = store.pays || [];
  const sales  = store.sales || [];
  const colTot = pays.filter(p=>p.direction==='in').reduce((s,p)=>s+parseFloat(p.amount||0),0);
  const expTot = pays.filter(p=>p.direction==='out').reduce((s,p)=>s+parseFloat(p.amount||0),0);
  const salTot = sales.reduce((s,x)=>s+parseFloat(x.total_amount||0),0);
  const net    = colTot - expTot;

  const set = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  set('sum-col',   N(colTot) + ' جنيه');
  set('sum-exp',   N(expTot) + ' جنيه');
  set('sum-sales', N(salTot) + ' جنيه');
  set('sum-net',   N(net)    + ' جنيه');
  const netBox = document.querySelector('.netbox');
  if (netBox) netBox.style.background = net>=0 ? 'var(--green)' : 'var(--red)';
}

// ─── للتوافق مع الكود القديم ─────────────────────────────────
function delCollection(id) { delPayment(id); }
function delExpense(id)    { delPayment(id); }