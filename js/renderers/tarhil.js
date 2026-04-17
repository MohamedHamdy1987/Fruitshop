// ============================================================
// js/renderers/tarhil.js — الترحيلات (مبيعات اليوم بالتفصيل)
// عرض لكل عميل: الأصناف × الكميات × الأسعار = الإجمالي
// ============================================================

async function renderTarhil() {
  const container = document.getElementById('tarhil-content');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:20px;color:#888">جاري التحميل...</div>';

  const picker = document.getElementById('tarhil-date-picker');
  const date   = picker?.value || store._state.currentDate;

  try {
    // جلب كل مبيعات اليوم من DB مباشرة
    const { data: allSales, error } = await sb.from('daily_sales')
      .select(`
        id, batch_id, sale_date,
        customer_id, quantity, weight_kg, unit_price, total_amount, is_cash,
        product:products(name, unit),
        customer:customers(name, phone)
      `)
      .eq('company_id', currentUser.company_id)
      .eq('sale_date', date)
      .order('customer_id', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    const sales = allSales || [];

    if (!sales.length) {
      container.innerHTML = `
      <div style="text-align:center;color:#888;padding:48px">
        <div style="font-size:52px">📤</div>
        <div style="font-weight:700;font-size:16px;margin:8px 0">لا توجد مبيعات في هذا اليوم</div>
        <div style="font-size:13px">${new Date(date).toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
      </div>`;
      return;
    }

    // إجمالي اليوم
    const dayTotal   = sales.reduce((s, x) => s + parseFloat(x.total_amount || 0), 0);
    const cashTotal  = sales.filter(x => x.is_cash || !x.customer_id)
                            .reduce((s, x) => s + parseFloat(x.total_amount || 0), 0);
    const creditTotal = dayTotal - cashTotal;

    // فصل نقدي عن آجل
    const cashSales   = sales.filter(s => s.is_cash || !s.customer_id);
    const creditSales = sales.filter(s => !s.is_cash && s.customer_id);

    // تجميع الآجل حسب العميل
    const byCustomer = {};
    creditSales.forEach(s => {
      const cid = s.customer_id;
      if (!byCustomer[cid]) {
        byCustomer[cid] = {
          customer: s.customer,
          customerId: cid,
          items: [],
          total: 0
        };
      }
      byCustomer[cid].items.push(s);
      byCustomer[cid].total += parseFloat(s.total_amount || 0);
    });

    let html = `
    <!-- شريط الملخص -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
      <div style="background:var(--green);color:#fff;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:12px;opacity:.9">إجمالي اليوم</div>
        <div style="font-weight:700;font-size:16px">${N(dayTotal)} ج</div>
      </div>
      <div style="background:#27ae60;color:#fff;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:12px;opacity:.9">نقدي 💵</div>
        <div style="font-weight:700;font-size:16px">${N(cashTotal)} ج</div>
      </div>
      <div style="background:var(--blue);color:#fff;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:12px;opacity:.9">آجل 📋</div>
        <div style="font-weight:700;font-size:16px">${N(creditTotal)} ج</div>
      </div>
    </div>`;

    // قسم المبيعات النقدية
    if (cashSales.length) {
      html += `
      <div class="card" style="margin-bottom:12px">
        <div class="card-header" style="background:#e8f8f0;color:var(--green)">
          💵 المبيعات النقدية (${cashSales.length} عملية)
        </div>
        <div style="padding:8px">
          ${cashSales.map(s => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px;border-bottom:1px solid #f0f0f0;font-size:13px">
            <div>
              <strong>${s.product?.name || '—'}</strong>
              <span style="color:#888;margin-right:8px">
                ${s.quantity > 0 ? N(s.quantity) + ' ' + (s.product?.unit || '') : ''}
                ${s.weight_kg > 0 ? N(s.weight_kg) + 'ك' : ''}
                × ${N(s.unit_price)} ج
              </span>
            </div>
            <strong style="color:var(--green)">${N(s.total_amount)} ج</strong>
          </div>`).join('')}
          <div style="display:flex;justify-content:space-between;padding:8px 4px;font-weight:700;color:var(--green)">
            <span>الإجمالي النقدي</span>
            <span>${N(cashTotal)} ج</span>
          </div>
        </div>
      </div>`;
    }

    // قسم الآجل حسب العميل
    if (Object.keys(byCustomer).length) {
      html += `<div style="font-weight:700;color:#555;margin-bottom:8px;font-size:14px">📋 الآجل حسب العميل</div>`;

      Object.values(byCustomer).forEach(group => {
        const custBal = parseFloat((store.custs||[]).find(c=>c.id===group.customerId)?.balance || 0);

        html += `
        <div class="card" style="margin-bottom:10px">
          <div style="background:#e8f4fd;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border-radius:10px 10px 0 0">
            <div>
              <div style="font-weight:700;font-size:15px">👤 ${group.customer?.name || 'عميل'}</div>
              ${group.customer?.phone ? `<div style="font-size:12px;color:#888">${group.customer.phone}</div>` : ''}
            </div>
            <div style="text-align:left">
              <div style="font-weight:700;color:var(--blue);font-size:16px">${N(group.total)} ج</div>
              <div style="font-size:11px;color:#888">رصيده: ${N(custBal)} ج</div>
            </div>
          </div>

          <!-- تفاصيل الأصناف -->
          <div style="padding:8px 14px">
            ${group.items.map(s => {
              const qtyStr = s.quantity > 0
                ? `${N(s.quantity)} ${s.product?.unit || ''}`
                : s.weight_kg > 0 ? `${N(s.weight_kg)} كيلو` : '';
              return `
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px">
                <span>📦 <strong>${s.product?.name || '—'}</strong></span>
                <span style="color:#666">${qtyStr} × ${N(s.unit_price)} ج</span>
                <strong>${N(s.total_amount)} ج</strong>
              </div>`;
            }).join('')}
            <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:700;color:var(--blue)">
              <span>إجمالي ${group.customer?.name || 'العميل'}</span>
              <span>${N(group.total)} ج</span>
            </div>
          </div>

          <!-- زر تسجيل دفعة -->
          ${group.customerId ? `
          <div style="padding:0 14px 12px">
            <button onclick="openAddPaymentModal('${group.customerId}','${group.customer?.name||''}')"
              style="width:100%;background:var(--green);color:#fff;border:none;border-radius:8px;padding:8px;cursor:pointer;font-weight:700">
              💵 تسجيل دفعة من ${group.customer?.name || 'العميل'}
            </button>
          </div>` : ''}
        </div>`;
      });
    }

    container.innerHTML = html;

  } catch(e) {
    AppError.log('renderTarhil', e);
    container.innerHTML = `<div style="color:var(--red);text-align:center;padding:24px">❌ خطأ: ${e.message}</div>`;
  }
}

async function loadTarhilByDate() {
  renderTarhil();
}
