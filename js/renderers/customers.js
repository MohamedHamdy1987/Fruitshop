// ============================================================
// renderers/customers.js — محدَّث
// ✅ منع تكرار العملاء بنفس رقم الهاتف
// ✅ عرض الرصيد الحالي واليوميات (daily totals)
// ✅ عند الضغط على يوم → يفتح تفاصيل الترحيلات
// ============================================================

function getCustBal(id) {
  const c = (store.custs || []).find(x => x.id === id || x.id == id);
  return parseFloat(c?.balance || 0);
}

// ─── إضافة عميل (مع منع التكرار) ───────────────────────────
async function addCustomer() {
  const name  = document.getElementById('nc-name').value.trim();
  const phone = document.getElementById('nc-phone').value.trim();
  const bal   = parseFloat(document.getElementById('nc-balance').value) || 0;
  if (!name) return Toast.warning('أدخل اسم العميل');

  const btn = event.target;
  btn.disabled = true; btn.textContent = '...';
  try {
    const result = await API.customers.add({ name, phone, initialBalance: bal });
    const updated = await API.customers.list();
    store.set('customers', updated);
    // مسح الحقول فقط إذا تم إنشاء جديد (اختياري)
    if (result && result.id && !result.wasExisting) {
      document.getElementById('nc-name').value = '';
      document.getElementById('nc-phone').value = '';
      document.getElementById('nc-balance').value = '';
    }
    Toast.success(`✅ تم إضافة ${result.name}`);
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
      <div class="empty-state">
        <div class="empty-icon">👤</div>
        <div class="empty-title">لا يوجد عملاء بعد</div>
        <div class="empty-sub">أضف أول عميل لتبدأ</div>
      </div>`;
    return;
  }
  container.innerHTML = custs.map(cust => {
    const bal = parseFloat(cust.balance || 0);
    return `
      <div class="card" style="margin-bottom:8px;overflow:hidden" data-cust-id="${cust.id}" data-name="${cust.name.toLowerCase()}" data-phone="${(cust.phone||'').toLowerCase()}">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;cursor:pointer" onclick="openCustDetail('${cust.id}')">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="background:var(--blue-light);border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:22px">👤</div>
            <div>
              <div style="font-weight:700;font-size:15px">${cust.name}</div>
              <div style="font-size:12px;color:#888">${cust.phone || 'لا يوجد هاتف'}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="text-align:left">
              <div style="font-size:11px;color:#888">الرصيد</div>
              <div style="font-weight:700;font-size:15px;color:${bal > 0 ? 'var(--green)' : '#888'}">${N(bal)} ج</div>
            </div>
            <button onclick="event.stopPropagation();toggleCustEdit('${cust.id}')" style="background:var(--blue);color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px">✏️</button>
            <button onclick="event.stopPropagation();delCustomer('${cust.id}')" style="background:var(--red);color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px">🗑️</button>
          </div>
        </div>

        <!-- تعديل Inline -->
        <div id="cust-edit-${cust.id}" style="display:none;padding:12px 14px;border-top:1px solid #eee;background:#fffde7">
          <div style="font-weight:700;color:var(--orange);margin-bottom:8px">✏️ تعديل بيانات العميل</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><label style="font-size:12px;color:#666">الاسم</label><input id="ce-name-${cust.id}" value="${cust.name}" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px"></div>
            <div><label style="font-size:12px;color:#666">الهاتف</label><input id="ce-phone-${cust.id}" value="${cust.phone||''}" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px"></div>
            <div><label style="font-size:12px;color:#666">الرصيد</label><input id="ce-balance-${cust.id}" value="${bal}" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px"></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button onclick="saveCustEdit('${cust.id}')" style="background:var(--orange);color:#fff;border:none;border-radius:8px;padding:8px 20px;cursor:pointer;font-weight:700;flex:1">💾 حفظ</button>
            <button onclick="toggleCustEdit('${cust.id}')" style="background:#eee;border:none;border-radius:8px;padding:8px 16px;cursor:pointer">إلغاء</button>
          </div>
        </div>
      </div>`;
  }).join('');
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
  document.querySelectorAll('#cust-list-cont .card').forEach(card => {
    const name = card.getAttribute('data-name') || '';
    const phone = card.getAttribute('data-phone') || '';
    card.style.display = (name.includes(kw) || phone.includes(kw)) ? '' : 'none';
  });
}

// ─── تفاصيل العميل (الرصيد + اليوميات) ─────────────────────
async function openCustDetail(id) {
  const c = (store.custs||[]).find(x => x.id === id || x.id == id);
  if (!c) return;
  document.getElementById('cust-list-view').style.display   = 'none';
  document.getElementById('cust-detail-view').style.display = 'block';
  document.getElementById('cd-name').textContent = c.name;
  document.getElementById('cd-bal').textContent  = N(parseFloat(c.balance||0)) + ' جنيه';
  document.getElementById('cd-body').innerHTML   = '<div style="color:#888;text-align:center;padding:16px">جاري التحميل...</div>';

  try {
    const { sales, payments } = await API.customers.getLedger(id);
    _renderCustLedger(c, sales, payments);
  } catch(e) {
    AppError.log('openCustDetail', e);
    document.getElementById('cd-body').innerHTML = '<div style="color:var(--red);padding:16px">❌ خطأ في تحميل البيانات</div>';
  }
}

// عرض دفتر الأستاذ مع تجميع اليوميات
function _renderCustLedger(cust, sales, payments) {
  // تجميع المبيعات حسب اليوم
  const dailyTotals = {};
  (sales || []).forEach(s => {
    const day = s.sale_date;
    if (!dailyTotals[day]) dailyTotals[day] = { total: 0, items: [] };
    dailyTotals[day].total += parseFloat(s.total_amount || 0);
    dailyTotals[day].items.push(s);
  });

  let html = `<div style="margin-bottom:12px"><strong>📅 اليوميات</strong></div>`;
  const sortedDays = Object.keys(dailyTotals).sort().reverse();
  
  if (sortedDays.length === 0) {
    html += '<div style="color:#888;padding:8px 0">لا توجد مبيعات بعد</div>';
  } else {
    for (const day of sortedDays) {
      const dayTotal = dailyTotals[day].total;
      html += `
        <div style="border:1px solid #ddd; border-radius:8px; margin-bottom:8px; padding:6px 10px; cursor:pointer; background:#f9f9f9;"
             onclick="showDayDetails('${cust.id}', '${day}')">
          <div style="display:flex; justify-content:space-between;">
            <span>📆 ${new Date(day).toLocaleDateString('ar-EG')}</span>
            <strong>${N(dayTotal)} ج</strong>
          </div>
        </div>`;
    }
  }

  // إضافة المدفوعات
  if (payments && payments.length) {
    html += `<div style="margin-top:16px"><strong>✅ المدفوعات</strong></div>`;
    payments.forEach(p => {
      const payAmount = parseFloat(p.amount || 0) + parseFloat(p.discount_amount || 0);
      html += `
        <div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #eee;">
          <span>${new Date(p.payment_date).toLocaleDateString('ar-EG')} — ${p.description || 'دفعة'}</span>
          <span style="color:var(--green)">-${N(payAmount)} ج</span>
        </div>`;
    });
  }

  const finalBal = parseFloat(cust.balance || 0);
  html += `
    <div class="netbox" style="margin-top:12px; background:var(--blue);">
      <span>💰 الرصيد الحالي</span>
      <span>${N(finalBal)} جنيه</span>
    </div>
    <div style="margin-top:12px; display:flex; gap:8px;">
      <button class="btn btn-g" style="flex:1" onclick="openAddPaymentModal('${cust.id}', '${cust.name.replace(/'/g, "\\'")}')">💵 تسجيل دفعة</button>
      ${cust.phone ? `<button class="btn btn-b" style="flex:1" onclick="shareCustomerWhatsApp('${cust.id}')">📱 واتساب</button>` : ''}
    </div>
  `;

  document.getElementById('cd-body').innerHTML = html;
}

// عرض تفاصيل يوم معين (فتح صفحة الترحيلات)
function showDayDetails(customerId, date) {
  window._tarhilCustomerId = customerId;
  window._tarhilDate = date;
  showPage('tarhil', document.querySelector('[data-page="tarhil"]'));
  setTimeout(() => {
    if (typeof renderTarhil === 'function') renderTarhil();
  }, 100);
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
    // تسجيل الدفعة الأساسية
    if (amount > 0) {
      await API.payments.addCollection({
        customerId: custId, amount, discount: 0,
        description: note || 'تحصيل', date: store._state.currentDate
      });
    }
    // تسجيل القطعية كحركة منفصلة (بدون discount_amount لتجنب الخصم المزدوج)
    if (discount > 0) {
      await API.payments.addCollection({
        customerId: custId, amount: discount, discount: 0,
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