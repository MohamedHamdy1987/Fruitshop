// ============================================================
// renderers/customers.js — إدارة العملاء (نسخة القديم + ربط بالترحيلات)
// ============================================================

function getCustBal(id) {
  const c = (store.custs || []).find(x => x.id === id || x.id == id);
  return parseFloat(c?.balance || 0);
}

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

function renderCustList() {
  const container = document.getElementById('cust-list-cont');
  if (!container) return;
  const custs = store.custs || [];
  if (!custs.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">👤</div>
      <div class="empty-title">لا يوجد عملاء بعد</div>
      <div class="empty-sub">أضف أول عميل لتبدأ</div>
    </div>`;
    return;
  }
  container.innerHTML = custs.map(cust => {
    const bal = parseFloat(cust.balance || 0);
    return `<div class="card customer-card" style="cursor:pointer"
      data-name="${cust.name.toLowerCase()}" data-phone="${(cust.phone||'').toLowerCase()}"
      onclick="openCustDetail('${cust.id}')">
      <div style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;background:var(--blue-light);border-bottom:2px solid #c5d8e8">
        <div style="display:flex;align-items:center;gap:9px">
          <span>👤</span>
          <div>
            <div style="font-weight:800;color:var(--blue)">${cust.name}</div>
            <div style="font-size:0.74rem;color:var(--gray)">${cust.phone || 'لا يوجد هاتف'}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="text-align:left">
            <div style="font-size:0.74rem;color:var(--gray)">الرصيد</div>
            <div style="font-weight:900;color:${bal > 0 ? 'var(--red)' : 'var(--green)'}">${N(bal)} جنيه</div>
          </div>
          <button class="btn btn-r btn-xs no-print" onclick="event.stopPropagation();delCustomer('${cust.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
  const kw = document.getElementById('searchCustomerInput')?.value.trim().toLowerCase();
  if (kw) filterCustomersList();
}

function filterCustomersList() {
  const kw = document.getElementById('searchCustomerInput')?.value.trim().toLowerCase() || '';
  document.querySelectorAll('#cust-list-cont .customer-card').forEach(card => {
    const match = (card.getAttribute('data-name')||'').includes(kw) ||
                  (card.getAttribute('data-phone')||'').includes(kw);
    card.style.display = match ? '' : 'none';
  });
}

async function openCustDetail(id) {
  const cust = (store.custs||[]).find(x => x.id === id || x.id == id);
  if (!cust) return;
  document.getElementById('cust-list-view').style.display   = 'none';
  document.getElementById('cust-detail-view').style.display = 'block';
  document.getElementById('cd-name').textContent = cust.name;
  document.getElementById('cd-bal').textContent  = N(parseFloat(cust.balance||0)) + ' جنيه';
  document.getElementById('cd-body').innerHTML   = '<div class="skeleton" style="height:200px"></div>';

  try {
    const { sales, payments } = await API.customers.getLedger(id);
    // تجميع الحركات (مبيعات + مدفوعات)
    const entries = [];
    (sales || []).forEach(s => {
      entries.push({
        date: s.sale_date,
        type: 'order',
        amount: parseFloat(s.total_amount),
        ref: s.product?.name || '-',
        isTarhil: true,
        tarhilDate: s.sale_date
      });
    });
    (payments || []).forEach(p => {
      entries.push({
        date: p.payment_date,
        type: 'payment',
        amount: parseFloat(p.amount) + parseFloat(p.discount_amount||0),
        ref: p.description || 'دفعة',
        isTarhil: false
      });
    });
    entries.sort((a,b) => a.date.localeCompare(b.date));
    let running = 0;
    let html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.83rem"><thead><tr style="background:#f0f7f0"><th>التاريخ</th><th>البيان</th><th>المبلغ</th><th>الرصيد</th></tr></thead><tbody>';
    for (const e of entries) {
      if (e.type === 'order') running += e.amount;
      else running -= e.amount;
      let desc = '';
      if (e.type === 'order' && e.isTarhil) {
        desc = `<span style="color:#784212;cursor:pointer;text-decoration:underline" onclick="goToTarhilDate('${e.tarhilDate}')">يومية ${e.date}</span>`;
      } else {
        desc = e.ref;
      }
      const amtColor = e.type === 'order' ? 'var(--blue)' : 'var(--red)';
      const balColor = running > 0 ? 'var(--red)' : 'var(--green)';
      html += `<tr>
        <td style="padding:6px 5px;font-size:0.78rem">${e.date}</td>
        <td style="padding:6px 5px">${desc}</td>
        <td style="padding:6px 5px;font-weight:900;color:${amtColor}">${e.type==='order'?'+':'-'}${N(e.amount)} جنيه</td>
        <td style="padding:6px 5px;font-weight:900;color:${balColor}">${N(Math.abs(running))} جنيه</td>
      </tr>`;
    }
    html += `</tbody></table></div><div class="netbox"><span>إجمالي الحساب</span><span>${N(cust.balance)} جنيه</span></div>`;
    // زر تسجيل دفعة
    html += `<div style="margin-top:12px"><button class="btn btn-g btn-sm" onclick="openAddPaymentModal('${cust.id}','${cust.name}')">💵 تسجيل دفعة</button></div>`;
    document.getElementById('cd-body').innerHTML = html;
  } catch(e) {
    AppError.log('openCustDetail', e);
    document.getElementById('cd-body').innerHTML = '<p style="color:var(--red);padding:16px">خطأ في تحميل البيانات</p>';
  }
}

function showCustList() {
  document.getElementById('cust-list-view').style.display   = 'block';
  document.getElementById('cust-detail-view').style.display = 'none';
}

// مودال تسجيل دفعة
function openAddPaymentModal(custId, custName) {
  const modal = document.getElementById('add-payment-modal');
  if (!modal) return;
  document.getElementById('apm-cust-name').textContent = custName;
  document.getElementById('apm-cust-id').value = custId;
  ['apm-amount','apm-discount','apm-note'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
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
    const updated = await API.customers.list();
    store.set('customers', updated);
    closeModal('add-payment-modal');
    Toast.success('✅ تم تسجيل الدفعة');
    openCustDetail(custId);
  } catch(e) { AppError.log('submitPaymentModal', e, true); }
  finally { btn.disabled = false; btn.textContent = '✅ تأكيد'; }
}

// واتساب
async function shareCustomerWhatsApp(custId) {
  const cust = (store.custs||[]).find(c => c.id === custId || c.id == custId);
  if (!cust) return;
  try {
    const { sales, payments } = await API.customers.getLedger(custId);
    let txt = '';
    let running = 0;
    [...sales, ...payments].sort((a,b) => (a.sale_date || a.payment_date).localeCompare(b.sale_date || b.payment_date)).forEach(e => {
      const date = e.sale_date || e.payment_date;
      const amount = parseFloat(e.total_amount || e.amount || 0);
      const type = e.total_amount !== undefined ? 'فاتورة' : 'دفعة';
      if (type === 'فاتورة') running += amount;
      else running -= amount;
      txt += `${date} | ${type} | ${amount} ج | الرصيد: ${running} ج\n`;
    });
    const shopName = currentUser?.company_name || 'المحل';
    const bal = parseFloat(cust.balance||0);
    const status = bal>0 ? 'مدين' : bal<0 ? 'دائن' : 'متزن';
    const msg = `*بيان حساب العميل*\n🏢 ${shopName}\n👤 ${cust.name}\n📞 ${cust.phone||'غير مسجل'}\n📅 ${new Date().toLocaleDateString('ar-EG')}\n━━━━━━━━━━\n${txt}━━━━━━━━━━\n💰 *الرصيد:* ${N(Math.abs(bal))} ج\n📝 *الحالة:* ${status}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  } catch(e) { AppError.log('shareWhatsApp', e, true); }
}