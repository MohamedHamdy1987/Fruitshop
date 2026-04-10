// ============================================================
// renderers/suppliers.js — إدارة الموردين (API-first)
// ============================================================

function getSuppBal(id) {
  const s = (store.supps||[]).find(x => x.id === id || x.id == id);
  return parseFloat(s?.balance || 0);
}

async function addSupplier() {
  const name  = document.getElementById('ns-name').value.trim();
  const phone = document.getElementById('ns-phone').value.trim();
  if (!name) return Toast.warning('أدخل اسم المورد');
  const btn = event.target;
  btn.disabled = true; btn.textContent = '...';
  try {
    await API.suppliers.add({ name, phone });
    const updated = await API.suppliers.list();
    store.set('suppliers', updated);
    ['ns-name','ns-phone'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    Toast.success(`✅ تم إضافة ${name}`);
    renderSuppList(); refreshDropdowns();
  } catch(e) { AppError.log('addSupplier', e, true); }
  finally { btn.disabled=false; btn.textContent='➕ إضافة'; }
}

async function delSupplier(id) {
  const s = (store.supps||[]).find(x => x.id===id||x.id==id);
  if (!confirm(`حذف المورد "${s?.name}"؟`)) return;
  try {
    await API.suppliers.delete(id);
    store.set('suppliers', (store.supps||[]).filter(x => x.id!==id && x.id!=id));
    Toast.success('تم الحذف');
    renderSuppList(); refreshDropdowns();
  } catch(e) { AppError.log('delSupplier', e, true); }
}

function renderSuppList() {
  const c = document.getElementById('supp-list-cont');
  if (!c) return;
  const supps = store.supps || [];
  if (!supps.length) {
    c.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🚛</div>
      <div class="empty-title">لا يوجد موردون</div>
      <div class="empty-sub">أضف أول مورد للبدء</div>
    </div>`;
    return;
  }
  c.innerHTML = supps.map(s => {
    const bal = parseFloat(s.balance||0);
    return `<div class="card supplier-card" style="cursor:pointer"
      data-name="${s.name.toLowerCase()}" data-phone="${(s.phone||'').toLowerCase()}"
      onclick="openSuppDetail('${s.id}')">
      <div style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;background:#fef5ec;border-bottom:2px solid #f5cba7">
        <div style="display:flex;align-items:center;gap:9px">
          <span>🚛</span>
          <div>
            <div style="font-weight:800;color:var(--orange)">${s.name}</div>
            <div style="font-size:0.74rem;color:var(--gray)">${s.phone||'لا يوجد هاتف'}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="text-align:left">
            <div style="font-size:0.74rem;color:var(--gray)">المستحق له</div>
            <div style="font-weight:900;color:${bal>0?'var(--red)':'var(--green)'}">${N(bal)} جنيه</div>
          </div>
          <button class="btn btn-r btn-xs no-print" onclick="event.stopPropagation();delSupplier('${s.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
  const kw = document.getElementById('searchSupplierInput')?.value.trim().toLowerCase();
  if (kw) filterSuppliersList();
}

function filterSuppliersList() {
  const kw = document.getElementById('searchSupplierInput')?.value.trim().toLowerCase() || '';
  document.querySelectorAll('#supp-list-cont .supplier-card').forEach(card => {
    const match = (card.getAttribute('data-name')||'').includes(kw) ||
                  (card.getAttribute('data-phone')||'').includes(kw);
    card.style.display = match ? '' : 'none';
  });
}

async function openSuppDetail(id) {
  const s = (store.supps||[]).find(x => x.id===id||x.id==id);
  if (!s) return;
  document.getElementById('supp-list-view').style.display   = 'none';
  document.getElementById('supp-detail-view').style.display = 'block';
  document.getElementById('sd-name').textContent = s.name;
  document.getElementById('sd-bal').textContent  = N(parseFloat(s.balance||0)) + ' جنيه';
  document.getElementById('sd-body').innerHTML   = '<div class="skeleton" style="height:200px"></div>';

  try {
    // جلب فواتير المورد من store المحلي
    const invs = (store.invs||[]).filter(i => i.supplier_id===id || i.supplierId==id);
    // جلب المدفوعات للمورد
    const { data: pays } = await sb.from('payments')
      .select('payment_date,amount,description')
      .eq('company_id', currentUser.company_id)
      .eq('supplier_id', id)
      .order('payment_date', { ascending: false });

    let run = 0, html = '';
    const entries = [
      ...invs.map(i => ({ date: i.invoice_date||i.date, type:'invoice', amount:parseFloat(i.total_amount||i.net||0), ref:`فاتورة ${i.invoice_number||''}` })),
      ...(pays||[]).map(p => ({ date:p.payment_date, type:'payment', amount:parseFloat(p.amount), ref:p.description||'دفعة' }))
    ].sort((a,b) => (a.date||'').localeCompare(b.date||''));

    if (!entries.length) {
      html = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">لا توجد حركات</div></div>`;
    } else {
      html = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.82rem">
        <thead><tr style="background:#f0f7f0"><th style="padding:6px">التاريخ</th><th>النوع</th><th>المبلغ</th><th>المستحق</th></tr></thead><tbody>`;
      entries.forEach(e => {
        if (e.type==='invoice') run += e.amount; else run -= e.amount;
        const isInv = e.type==='invoice';
        html += `<tr>
          <td style="padding:6px;font-size:0.75rem">${new Date(e.date).toLocaleDateString('ar-EG',{month:'short',day:'numeric'})}</td>
          <td style="padding:6px">${isInv
            ?'<span style="background:#d6eaf8;color:var(--blue);border-radius:4px;padding:1px 6px;font-size:0.72rem">فاتورة</span>'
            :'<span style="background:#fde8e8;color:var(--red);border-radius:4px;padding:1px 6px;font-size:0.72rem">دفعة</span>'}</td>
          <td style="padding:6px;font-weight:900;color:${isInv?'var(--green)':'var(--red)'}">
            ${isInv?'+':'-'}${N(e.amount)} ج</td>
          <td style="padding:6px;font-weight:900;color:${run>0?'var(--red)':'var(--green)'}">
            ${N(Math.abs(run))} ج</td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    }

    html += `<div style="margin-top:12px">
      <button class="btn btn-o btn-sm" onclick="openSuppPaymentModal('${s.id}','${s.name}')">💰 تسجيل دفعة للمورد</button>
    </div>`;
    document.getElementById('sd-body').innerHTML = html;
  } catch(e) {
    AppError.log('openSuppDetail', e);
    document.getElementById('sd-body').innerHTML = '<p style="color:var(--red);padding:16px">خطأ في تحميل البيانات</p>';
  }
}

function showSuppList() {
  document.getElementById('supp-list-view').style.display   = 'block';
  document.getElementById('supp-detail-view').style.display = 'none';
}

function openSuppPaymentModal(suppId, suppName) {
  Toast.info(`سيتم إضافة مودال الدفع للمورد ${suppName}`);
  // TODO: مودال مشابه لـ add-payment-modal
}
