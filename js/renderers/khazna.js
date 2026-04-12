// ============================================================
// renderers/khazna.js — الخزنة: تحصيلات + مصروفات + ملخص
// ============================================================

// ─── تسجيل تحصيل ────────────────────────────────────────────
async function addCollection() {
  const custId   = document.getElementById('col-cust-sel').value;
  const amount   = parseFloat(document.getElementById('col-amount').value)   || 0;
  const discount = parseFloat(document.getElementById('col-discount').value) || 0;
  const note     = document.getElementById('col-note').value.trim();
  if (!custId)                    return Toast.warning('اختر العميل');
  if (amount<=0 && discount<=0)   return Toast.warning('أدخل مبلغاً أو قطعية');

  const cust = (store.custs||[]).find(c => c.id===custId||c.id==custId);
  const btn = event.target;
  btn.disabled=true; btn.textContent='...';
  try {
    if (amount > 0) {
      await API.payments.addCollection({
        customerId:  custId,
        amount,
        discount:    0,
        description: note || 'تحصيل',
        date:        store._state.currentDate
      });
    }
    if (discount > 0) {
      await API.payments.addCollection({
        customerId:  custId,
        amount:      discount,
        discount,
        description: note ? `قطعية — ${note}` : 'قطعية',
        date:        store._state.currentDate
      });
    }
    // تحديث محلي
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
  if (!today.length) { el.innerHTML='<p style="text-align:center;color:#aaa;padding:16px">لا توجد تحصيلات اليوم</p>'; _updateColTotal(0); return; }

  const cash  = today.filter(p => p.customer_id === null);
  const creds = today.filter(p => p.customer_id !== null);
  let html = '';

  if (cash.length) {
    html += '<div style="font-size:0.78rem;font-weight:800;color:var(--green);margin:8px 0 5px">💵 نقديات</div>';
    cash.forEach(p => {
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f0f0f0;font-size:0.83rem">
        <span style="flex:1;color:#444">${p.description||'-'}</span>
        <span style="font-weight:900;color:var(--green)">${N(p.amount)} ج</span>
        <button class="btn btn-r btn-xs" style="margin-right:6px" onclick="delPayment('${p.id}')">🗑️</button>
      </div>`;
    });
  }
  if (creds.length) {
    html += '<div style="font-size:0.78rem;font-weight:800;color:var(--blue);margin:10px 0 5px">📋 تسديدات العملاء</div>';
    creds.forEach(p => {
      const cust = (store.custs||[]).find(c => c.id===p.customer_id);
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f0f0f0;font-size:0.83rem">
        <span style="font-weight:700">${p.customer?.name||cust?.name||'عميل'}</span>
        <span style="font-size:0.79rem;color:var(--gray);flex:1;margin:0 8px">${p.description||'-'}</span>
        <span style="font-weight:900;color:var(--blue)">${N(p.amount)} ج</span>
        <button class="btn btn-r btn-xs" style="margin-right:6px" onclick="delPayment('${p.id}')">🗑️</button>
      </div>`;
    });
  }

  el.innerHTML = html;
  _updateColTotal(today.reduce((s,p)=>s+parseFloat(p.amount||0),0));
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

  const btn = event.target;
  btn.disabled=true; btn.textContent='...';
  try {
    await API.payments.addExpense({
      supplierId:  suppId||null,
      amount,
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

// ─── عرض المصروفات ──────────────────────────────────────────
function renderExpenses() {
  const el = document.getElementById('exp-body');
  if (!el) return;
  const today = (store.pays||[]).filter(p => p.direction==='out');
  if (!today.length) { el.innerHTML='<p style="text-align:center;color:#aaa;padding:16px">لا توجد مصروفات اليوم</p>'; _updateExpTotal(0); return; }

  el.innerHTML = today.map(e => {
    const supp = (store.supps||[]).find(s => s.id===e.supplier_id);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f0f0f0;font-size:0.83rem">
      <span style="font-weight:700;flex:1">${e.description||'-'}</span>
      <span style="font-size:0.79rem;color:var(--gray);margin:0 8px">${e.supplier?.name||supp?.name||'-'}</span>
      <span style="font-weight:900;color:var(--red)">${N(e.amount)} ج</span>
      <button class="btn btn-r btn-xs" style="margin-right:6px" onclick="delPayment('${e.id}')">🗑️</button>
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

// للتوافق مع الكود القديم
function delCollection(id) { delPayment(id); }
function delExpense(id)    { delPayment(id); }