// ============================================================
// js/renderers/suppliers.js — الموردون
// يعرض: الرصيد + الفواتير + الدفعات المصفّاة
// ============================================================

async function renderSuppList() {
  const container = document.getElementById('supp-list-cont');
  if (!container) return;

  try {
    // جلب مباشر من DB
    const supps = await API.suppliers.list();
    store.set('suppliers', supps);

    if (!supps.length) {
      container.innerHTML = `<div style="text-align:center;color:#888;padding:40px">
        <div style="font-size:48px">🚛</div>
        <div>لا يوجد موردون</div>
      </div>`;
      return;
    }

    container.innerHTML = supps.map(s => {
      const bal = parseFloat(s.balance || 0);
      return `
      <div class="card" style="margin-bottom:8px;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;cursor:pointer"
          onclick="openSuppDetail('${s.id}')">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="background:#fde8d8;border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:22px">🚛</div>
            <div>
              <div style="font-weight:700;font-size:15px">${s.name}</div>
              <div style="font-size:12px;color:#888">${s.phone || 'لا يوجد هاتف'}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="text-align:left">
              <div style="font-size:11px;color:#888">رصيده المستحق</div>
              <div style="font-weight:700;font-size:15px;color:${bal > 0 ? 'var(--green)' : '#888'}">${N(bal)} ج</div>
            </div>
            <button onclick="event.stopPropagation();toggleSuppEdit('${s.id}')"
              style="background:var(--blue);color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px">✏️</button>
            <button onclick="event.stopPropagation();delSupplier('${s.id}')"
              style="background:var(--red);color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px">🗑️</button>
          </div>
        </div>

        <!-- تعديل -->
        <div id="supp-edit-${s.id}" style="display:none;padding:12px 14px;border-top:1px solid #eee;background:#fffde7">
          <div style="font-weight:700;color:var(--orange);margin-bottom:8px">✏️ تعديل المورد</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><label style="font-size:12px;color:#666">الاسم</label>
              <input id="se-sname-${s.id}" value="${s.name}"
                style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px"></div>
            <div><label style="font-size:12px;color:#666">الهاتف</label>
              <input id="se-sphone-${s.id}" value="${s.phone||''}"
                style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px"></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button onclick="saveSuppEdit('${s.id}')"
              style="background:var(--orange);color:#fff;border:none;border-radius:8px;padding:8px 20px;cursor:pointer;font-weight:700;flex:1">💾 حفظ</button>
            <button onclick="toggleSuppEdit('${s.id}')"
              style="background:#eee;border:none;border-radius:8px;padding:8px 16px;cursor:pointer">إلغاء</button>
          </div>
        </div>
      </div>`;
    }).join('');

  } catch(e) {
    AppError.log('renderSuppList', e);
    container.innerHTML = `<div style="color:var(--red);padding:20px">❌ خطأ: ${e.message}</div>`;
  }
}

function toggleSuppEdit(id) {
  const el = document.getElementById(`supp-edit-${id}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function saveSuppEdit(id) {
  const name  = document.getElementById(`se-sname-${id}`)?.value.trim();
  const phone = document.getElementById(`se-sphone-${id}`)?.value.trim();
  if (!name) return Toast.warning('أدخل الاسم');
  try {
    await API.suppliers.update(id, { name, phone: phone || null });
    Toast.success('✅ تم التعديل');
    await renderSuppList();
    refreshDropdowns();
  } catch(e) { AppError.log('saveSuppEdit', e, true); }
}

// ─── إضافة مورد ─────────────────────────────────────────────
async function addSupplier() {
  const name  = document.getElementById('ns-name')?.value.trim();
  const phone = document.getElementById('ns-phone')?.value.trim();
  if (!name) return Toast.warning('أدخل اسم المورد');

  const btn = event.target;
  btn.disabled = true; btn.textContent = '⏳...';
  try {
    await API.suppliers.add({ name, phone });
    const updated = await API.suppliers.list();
    store.set('suppliers', updated);
    document.getElementById('ns-name').value  = '';
    document.getElementById('ns-phone').value = '';
    Toast.success(`✅ تم إضافة ${name}`);
    await renderSuppList();
    refreshDropdowns();
  } catch(e) { AppError.log('addSupplier', e, true); }
  finally { btn.disabled = false; btn.textContent = '➕ إضافة'; }
}

// ─── حذف مورد ───────────────────────────────────────────────
async function delSupplier(id) {
  const s = (store.supps||[]).find(x => x.id === id);
  if (!confirm(`حذف المورد "${s?.name}"؟`)) return;
  try {
    await API.suppliers.delete(id);
    store.set('suppliers', (store.supps||[]).filter(x => x.id !== id));
    Toast.success('تم الحذف');
    await renderSuppList();
    refreshDropdowns();
  } catch(e) { AppError.log('delSupplier', e, true); }
}

// ─── تفاصيل المورد ───────────────────────────────────────────
async function openSuppDetail(id) {
  const s = (store.supps||[]).find(x => x.id === id);
  if (!s) return;

  document.getElementById('supp-list-view').style.display   = 'none';
  document.getElementById('supp-detail-view').style.display = 'block';
  document.getElementById('sd-name').textContent = s.name;
  document.getElementById('sd-bal').textContent  = N(parseFloat(s.balance||0)) + ' جنيه';
  document.getElementById('sd-body').innerHTML   = '<div style="color:#888;text-align:center;padding:16px">جاري التحميل...</div>';

  try {
    const [invoices, batches] = await Promise.all([
      API.suppliers.getInvoices(id),
      API.suppliers.getBatches(id)
    ]);

    let html = '';

    // ملخص الرصيد
    html += `
    <div style="background:var(--green);color:#fff;padding:12px;border-radius:10px;display:flex;justify-content:space-between;font-weight:700;margin-bottom:12px">
      <span>💰 إجمالي مستحقات ${s.name}</span>
      <span>${N(parseFloat(s.balance||0))} جنيه</span>
    </div>`;

    // الفواتير
    if (invoices.length) {
      html += `
      <div class="card" style="margin-bottom:12px">
        <div class="card-header">🧾 الفواتير المصفّاة (${invoices.length})</div>
        <div style="padding:8px">
          ${invoices.map(inv => {
            const gross  = parseFloat(inv.subtotal || 0);
            const comm   = parseFloat(inv.commission_7pct || 0);
            const noulon = parseFloat(inv.noulon_total || 0);
            const mashal = parseFloat(inv.mashal_total || 0);
            const net    = parseFloat(inv.total_amount || 0);
            const dateStr = new Date(inv.invoice_date).toLocaleDateString('ar-EG',{month:'short',day:'numeric',year:'numeric'});
            return `
            <div style="border:1px solid #e0e0e0;border-radius:8px;padding:10px;margin-bottom:8px;cursor:pointer"
              onclick="toggleInvDetail('${inv.id}')">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                  <div style="font-weight:700">${inv.invoice_number || 'فاتورة'}</div>
                  <div style="font-size:12px;color:#888">📅 ${dateStr}</div>
                </div>
                <div style="text-align:left">
                  <div style="font-size:12px;color:#888">إجمالي البيع: ${N(gross)} ج</div>
                  <div style="font-weight:700;color:var(--green)">صافي: ${N(net)} ج</div>
                </div>
              </div>
              <div id="inv-detail-${inv.id}" style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid #f0f0f0;font-size:12px;color:#666">
                <div style="display:flex;justify-content:space-between"><span>إجمالي المبيعات</span><span>${N(gross)} ج</span></div>
                <div style="display:flex;justify-content:space-between"><span>عمولة 7٪</span><span>-${N(comm)} ج</span></div>
                <div style="display:flex;justify-content:space-between"><span>نولون</span><span>-${N(noulon)} ج</span></div>
                <div style="display:flex;justify-content:space-between"><span>مشال</span><span>-${N(mashal)} ج</span></div>
                <div style="display:flex;justify-content:space-between;font-weight:700;color:var(--green);margin-top:4px"><span>الصافي للمورد</span><span>${N(net)} ج</span></div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }

    // الدفعات (النازل)
    if (batches.length) {
      html += `
      <div class="card">
        <div class="card-header">📦 الدفعات (${batches.length})</div>
        <div style="padding:8px">
          ${batches.slice(0,10).map(b => {
            const remQty = parseFloat(b.remaining_qty || 0);
            const origQty = parseFloat(b.quantity || remQty);
            const status = b.status === 'finished' ? '✅ مصفّاة'
                         : b.status === 'active'   ? '🟢 نشطة'
                         : '🔄 مرحّلة';
            const dateStr = new Date(b.batch_date||b.created_at).toLocaleDateString('ar-EG',{month:'short',day:'numeric'});
            return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f0f0f0;font-size:13px">
              <div>
                <strong>${b.product?.name || '—'}</strong>
                <span style="font-size:11px;color:#888;margin-right:6px">📅 ${dateStr}</span>
              </div>
              <div style="text-align:left">
                <div>${N(remQty)} / ${N(origQty)} ${b.product?.unit || ''}</div>
                <div style="font-size:11px">${status}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }

    if (!invoices.length && !batches.length) {
      html += `<div style="text-align:center;color:#888;padding:32px">لا توجد بيانات بعد</div>`;
    }

    document.getElementById('sd-body').innerHTML = html;

  } catch(e) {
    AppError.log('openSuppDetail', e);
    document.getElementById('sd-body').innerHTML = `<div style="color:var(--red);padding:16px">❌ خطأ: ${e.message}</div>`;
  }
}

function toggleInvDetail(invId) {
  const el = document.getElementById(`inv-detail-${invId}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function showSuppList() {
  document.getElementById('supp-list-view').style.display   = 'block';
  document.getElementById('supp-detail-view').style.display = 'none';
}

function filterSuppliersList() {
  const kw = document.getElementById('searchSupplierInput')?.value.trim().toLowerCase() || '';
  document.querySelectorAll('#supp-list-cont .card').forEach(card => {
    card.style.display = card.textContent.toLowerCase().includes(kw) ? '' : 'none';
  });
}
