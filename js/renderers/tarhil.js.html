// ============================================================
// js/renderers/tarhil.js — الترحيلات اليومية
// يعرض daily_sales مجمعة حسب (customer_id + sale_date)
// لا يستخدم S.tarhilLog أبداً — يعتمد على DB مباشرة
// ============================================================

// ─────────────────────────────────────────────────────────────
// renderTarhil — نقطة الدخول (تُستدعى من PAGE_RENDERS)
// ─────────────────────────────────────────────────────────────
async function renderTarhil() {
  const container = document.getElementById('tarhil-body');
  if (!container) return;

  container.innerHTML = `<div class="skeleton" style="height:200px;border-radius:9px"></div>`;

  try {
    const date   = store._state.currentDate;
    const sales  = await _fetchTarhilSales(date);
    _renderTarhilContent(container, sales, date);
  } catch(e) {
    AppError.log('renderTarhil', e);
    container.innerHTML = '<p style="color:var(--red);padding:16px;text-align:center">خطأ في تحميل الترحيلات</p>';
  }
}

// ─────────────────────────────────────────────────────────────
// _fetchTarhilSales — جلب مبيعات الآجل من DB
// فلتر: is_cash = false (آجل فقط)، مجمعة حسب customer + date
// ─────────────────────────────────────────────────────────────
async function _fetchTarhilSales(date) {
  const { data, error } = await sb
    .from('daily_sales')
    .select(`
      id,
      sale_date,
      customer_id,
      quantity,
      weight_kg,
      unit_price,
      total_amount,
      is_cash,
      product:products(name, unit),
      customer:customers(name, phone)
    `)
    .eq('company_id', currentUser.company_id)
    .eq('sale_date',  date)
    .eq('is_cash',    false)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

// ─────────────────────────────────────────────────────────────
// _renderTarhilContent — رسم الواجهة
// ─────────────────────────────────────────────────────────────
function _renderTarhilContent(container, sales, date) {
  // تجميع حسب العميل
  const byCustomer = {};
  sales.forEach(s => {
    const cid   = s.customer_id;
    const cname = s.customer?.name || 'عميل محذوف';
    if (!byCustomer[cid]) byCustomer[cid] = { name: cname, items: [], total: 0 };
    byCustomer[cid].items.push(s);
    byCustomer[cid].total += parseFloat(s.total_amount || 0);
  });

  const ids = Object.keys(byCustomer);

  if (!ids.length) {
    container.innerHTML = `
    <div class="empty-state" style="padding:30px">
      <div class="empty-icon">📤</div>
      <div class="empty-title">لا توجد ترحيلات آجلة اليوم</div>
      <div class="empty-sub">المبيعات الآجلة ستظهر هنا</div>
    </div>`;
    return;
  }

  // حساب إجمالي اليوم
  const dayTotal = ids.reduce((s, id) => s + byCustomer[id].total, 0);

  let html = `
  <!-- إجمالي اليوم -->
  <div style="background:var(--blue-light);border:1.5px solid #aed6f1;border-radius:10px;
    padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <div style="font-weight:800;color:var(--blue)">📤 إجمالي ترحيلات ${new Date(date).toLocaleDateString('ar-EG',{month:'short',day:'numeric'})}</div>
    <div style="font-size:1.1rem;font-weight:900;color:var(--blue)">${N(dayTotal)} ج</div>
  </div>`;

  // بطاقة لكل عميل
  ids.forEach(cid => {
    const cust  = byCustomer[cid];
    const cObj  = (store.custs||[]).find(c => c.id === cid);
    const bal   = parseFloat(cObj?.balance || 0);

    const rows = cust.items.map(s => {
      const pName = s.product?.name  || '-';
      const pUnit = s.product?.unit  || '';
      const qty   = s.quantity  > 0 ? `${N(s.quantity)} ${pUnit}` : '-';
      const wt    = s.weight_kg > 0 ? `${N(s.weight_kg)} ك`       : '-';
      return `
      <tr>
        <td style="padding:5px 7px;font-weight:700;color:#1a5276">${pName}</td>
        <td style="padding:5px 7px;color:var(--gray)">${qty}</td>
        <td style="padding:5px 7px;color:var(--gray)">${wt}</td>
        <td style="padding:5px 7px">${N(s.unit_price)} ج</td>
        <td style="padding:5px 7px;font-weight:900;color:var(--green)">${N(s.total_amount)} ج</td>
      </tr>`;
    }).join('');

    html += `
    <div style="background:#fff;border:1.5px solid #d6eaf8;border-radius:10px;
      margin-bottom:9px;overflow:hidden;cursor:pointer;"
      onclick="this.querySelector('.tc-body').style.display =
        this.querySelector('.tc-body').style.display==='none' ? 'block' : 'none'">

      <!-- رأس العميل -->
      <div style="padding:10px 14px;background:var(--blue-light);
        display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <span>👤</span>
          <div>
            <div style="font-weight:800;color:var(--blue)">${cust.name}</div>
            ${cObj?.phone ? `<div style="font-size:.72rem;color:var(--gray)">${cObj.phone}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <div style="text-align:left">
            <div style="font-size:.72rem;color:var(--gray)">يومية</div>
            <div style="font-weight:900;color:var(--blue)">${N(cust.total)} ج</div>
          </div>
          <div style="text-align:left">
            <div style="font-size:.72rem;color:var(--gray)">رصيد</div>
            <div style="font-weight:800;color:${bal>0?'var(--red)':'var(--green)'}">${N(Math.abs(bal))} ج</div>
          </div>
          <span style="color:var(--gray)">▼</span>
        </div>
      </div>

      <!-- تفاصيل الأصناف -->
      <div class="tc-body" style="display:none;padding:10px 14px;border-top:1.5px solid #d6eaf8">
        <table style="width:100%;border-collapse:collapse;font-size:.8rem">
          <thead>
            <tr style="background:#f0f7fb">
              <th style="padding:4px 7px;text-align:right">الصنف</th>
              <th style="padding:4px 7px">عدد</th>
              <th style="padding:4px 7px">وزن</th>
              <th style="padding:4px 7px">سعر</th>
              <th style="padding:4px 7px">المبلغ</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:#eaf4fb;font-weight:900">
              <td colspan="4" style="text-align:right;padding:5px 7px;color:var(--blue)">إجمالي اليومية</td>
              <td style="padding:5px 7px;color:var(--blue)">${N(cust.total)} ج</td>
            </tr>
          </tfoot>
        </table>

        <!-- زر الدفعة السريعة -->
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="btn btn-g btn-sm"
            onclick="event.stopPropagation();openAddPaymentModal('${cid}','${cust.name}')">
            💵 تسجيل دفعة
          </button>
          <button class="btn btn-b btn-sm"
            onclick="event.stopPropagation();openCustDetail('${cid}')">
            📋 كشف حساب
          </button>
        </div>
      </div>
    </div>`;
  });

  container.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────
// goToTarhilDate — عرض ترحيلات تاريخ محدد
// ─────────────────────────────────────────────────────────────
async function goToTarhilDate(date) {
  showPage('tarhil', document.querySelector('[data-page=tarhil]'));
  const container = document.getElementById('tarhil-body');
  if (!container) return;
  container.innerHTML = `<div class="skeleton" style="height:200px;border-radius:9px"></div>`;
  try {
    const sales = await _fetchTarhilSales(date);
    _renderTarhilContent(container, sales, date);
  } catch(e) {
    AppError.log('goToTarhilDate', e);
  }
}