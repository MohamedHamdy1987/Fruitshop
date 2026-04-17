// ============================================================
// renderers/customers.js — محدَّث
// ✅ Inline Edit على العملاء
// ✅ رصيد مبدئي موجود بالفعل
// ============================================================

function getCustBal(id) {
  const c = (store.custs || []).find(x => x.id === id || x.id == id);
  return parseFloat(c?.balance || 0);
}

// ─── إضافة عميل ────────────────────────────────────────────
async function addCustomer() {
  const name  = document.getElementById('nc-name').value.trim();
  const phone = document.getElementById('nc-phone').value.trim();
  const bal   = parseFloat(document.getElementById('nc-balance').value) || 0;
  if (!name) return Toast.warning('أدخل اسم العميل');

  const btn = event.target;
  btn.disabled = true; btn.textContent = '...';
  try {
    await API.customers.add({ name, phone, initialBalance: bal });
    const updated = await API.customers.list();
    store.set('customers', updated);
    ['nc-name','nc-phone','nc-balance'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    Toast.success(`✅ تم إضافة ${name}`);
    renderCustList();
    refreshDropdowns();
  } catch(e) { AppError.log('addCustomer', e, true); }
  finally { btn.disabled = false; btn.textContent = '➕ إضافة'; }
}

// ─── حذف عميل ──────────────────────────────────────────────
async function delCustomer(id) {
  const c = (store.custs||[]).find(x => x.id === id || x.id == id);
  if (!confirm(`حذف العميل "${c?.name}"؟`)) return;
  try {
    await API.customers.delete(id);
    store.set('customers', (store.custs||[]).filter(c => c.id !== id && c.id != id));
    Toast.success('تم الحذف');
    renderCustList();
    refreshDropdowns();
  } catch(e) { AppError.log('delCustomer', e, true); }
}

// ─── عرض قائمة العملاء ─────────────────────────────────────
function renderCustList() {
  const container = document.getElementById('cust-list-cont');
  if (!container) return;
  const custs = store.custs || [];
  if (!custs.length) {
    container.innerHTML = `
      👤
      لا يوجد عملاء بعد
      أضف أول عميل لتبدأ
    `;
    return;
  }
  container.innerHTML = custs.map(cust => {
    const bal = parseFloat(cust.balance || 0);
    return `
    
      
      
        
          👤
          
            ${cust.name}
            ${cust.phone || 'لا يوجد هاتف'}
          
        
        
          
            الرصيد
            ${N(bal)} جنيه
          
          ✏️
          🗑️
        
      

      
      
        ✏️ تعديل بيانات العميل
        
          الاسم
            
          الهاتف
            
          الرصيد
            
        
        
          💾 حفظ
          إلغاء
        
      
    `;
  }).join('');

  const kw = document.getElementById('searchCustomerInput')?.value.trim().toLowerCase();
  if (kw) filterCustomersList();
}

function toggleCustEdit(id) {
  const el = document.getElementById(`cust-edit-${id}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function saveCustEdit(id) {
  const name    = document.getElementById(`ce-name-${id}`)?.value.trim();
  const phone   = document.getElementById(`ce-phone-${id}`)?.value.trim();
  const balance = parseFloat(document.getElementById(`ce-balance-${id}`)?.value) || 0;
  if (!name) return Toast.warning('أدخل الاسم');
  try {
    await API.customers.update(id, { name, phone: phone || null, balance });
    const updated = await API.customers.list();
    store.set('customers', updated);
    Toast.success('✅ تم تعديل بيانات العميل');
    renderCustList();
    refreshDropdowns();
  } catch(e) { AppError.log('saveCustEdit', e, true); }
}

// ─── بحث ───────────────────────────────────────────────────
function filterCustomersList() {
  const kw = document.getElementById('searchCustomerInput')?.value.trim().toLowerCase() || '';
  document.querySelectorAll('#cust-list-cont .customer-card').forEach(card => {
    const match = (card.getAttribute('data-name')||'').includes(kw) ||
                  (card.getAttribute('data-phone')||'').includes(kw);
    card.style.display = match ? '' : 'none';
  });
}

// ─── تفاصيل العميل ──────────────────────────────────────────
async function openCustDetail(id) {
  const c = (store.custs||[]).find(x => x.id === id || x.id == id);
  if (!c) return;
  document.getElementById('cust-list-view').style.display   = 'none';
  document.getElementById('cust-detail-view').style.display = 'block';
  document.getElementById('cd-name').textContent = c.name;
  document.getElementById('cd-bal').textContent  = N(parseFloat(c.balance||0)) + ' جنيه';
  document.getElementById('cd-body').innerHTML   = '';

  try {
    const { sales, payments } = await API.customers.getLedger(id);
    _renderCustLedger(c, sales, payments);
  } catch(e) {
    AppError.log('openCustDetail', e);
    document.getElementById('cd-body').innerHTML = 'خطأ في تحميل البيانات';
  }
}

function _renderCustLedger(cust, sales, payments) {
  const entries = [
    ...(sales||[]).map(s => ({
      date: s.sale_date, type: 'sale',
      amount: parseFloat(s.total_amount), ref: s.product?.name || '-', is_cash: s.is_cash
    })),
    ...(payments||[]).map(p => ({
      date: p.payment_date, type: 'payment',
      amount: parseFloat(p.amount) + parseFloat(p.discount_amount||0), ref: p.description || '-'
    }))
  ].sort((a,b) => a.date.localeCompare(b.date));

  if (!entries.length) {
    document.getElementById('cd-body').innerHTML = `📋 لا توجد حركات`;
    return;
  }

  let running = 0;
  let html = entries.map(e => {
    const isSale = e.type === 'sale';
    if (isSale) running += e.amount; else running -= e.amount;
    const dateStr = new Date(e.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    return `
    
      ${dateStr}
      ${isSale ? '📦' : '✅'} ${e.ref}
      ${isSale?'+':'-'}${N(e.amount)} ج
      باقي: ${N(Math.abs(running))} ج
    `;
  }).join('');

  const finalBal = parseFloat(cust.balance || 0);
  html += `
  
    إجمالي الحساب
    ${N(finalBal)} جنيه
  
  
    💵 تسجيل دفعة
    📱
  `;

  document.getElementById('cd-body').innerHTML = html;
}

function showCustList() {
  document.getElementById('cust-list-view').style.display   = 'block';
  document.getElementById('cust-detail-view').style.display = 'none';
}

// ─── مودال تسجيل دفعة ──────────────────────────────────────
function openAddPaymentModal(custId, custName) {
  const modal = document.getElementById('add-payment-modal');
  if (!modal) return;
  document.getElementById('apm-cust-name').textContent = custName;
  document.getElementById('apm-cust-id').value = custId;
  ['apm-amount','apm-discount','apm-note'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  modal.classList.add('open');
}

async function submitPaymentModal() {
  const custId   = document.getElementById('apm-cust-id').value;
  const amount   = parseFloat(document.getElementById('apm-amount').value) || 0;
  const discount = parseFloat(document.getElementById('apm-discount').value) || 0;
  const note     = document.getElementById('apm-note').value.trim();
  if (amount <= 0 && discount <= 0) return Toast.warning('أدخل مبلغ أو قطعية');

  const btn = event.target;
  btn.disabled = true; btn.textContent = '...';
  try {
    if (amount > 0) {
      await API.payments.addCollection({
        customerId: custId, amount, discount: 0,
        description: note || 'تحصيل', date: store._state.currentDate
      });
    }
    if (discount > 0) {
      await API.payments.addCollection({
        customerId: custId, amount: discount, discount,
        description: note ? `قطعية — ${note}` : 'قطعية', date: store._state.currentDate
      });
    }
    const [custs, pays] = await Promise.all([API.customers.list(), API.payments.list(store._state.currentDate)]);
    store.set('customers', custs);
    store.set('payments', pays);
    closeModal('add-payment-modal');
    Toast.success('✅ تم تسجيل الدفعة');
    const cust = custs.find(c => c.id === custId);
    if (cust) openCustDetail(custId);
    if (typeof renderCollections === 'function') renderCollections();
    if (typeof renderDaySummary === 'function') renderDaySummary();
  } catch(e) { AppError.log('submitPaymentModal', e, true); }
  finally { btn.disabled = false; btn.textContent = '✅ تأكيد'; }
}

// ─── واتساب ────────────────────────────────────────────────
async function shareCustomerWhatsApp(custId) {
  const cust = (store.custs||[]).find(c => c.id === custId || c.id == custId);
  if (!cust?.phone) return Toast.warning('لا يوجد رقم هاتف');
  const bal = parseFloat(cust.balance || 0);
  const msg = `السلام عليكم ${cust.name}\nرصيدك الحالي: ${N(Math.abs(bal))} جنيه ${bal > 0 ? '(مديون)' : '(دائن)'}`;
  window.open(`https://wa.me/${cust.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
}
