// ===================== renderers/tarhil.js — الترحيلات (نسخة القديم مع البيانات من store.sales) =====================

async function renderTarhil() {
  const container = document.getElementById('tarhil-body');
  if (!container) return;
  const today = store._state.currentDate;
  // المبيعات الآجلة (غير نقدية) لهذا اليوم
  const sales = (store.sales || []).filter(s => s.sale_date === today && !s.is_cash);
  if (!sales.length) {
    container.innerHTML = '<p style="text-align:center;color:#aaa;padding:24px">لا توجد ترحيلات اليوم</p>';
    return;
  }
  // تجميع حسب العميل
  const grouped = {};
  for (const sale of sales) {
    if (!grouped[sale.customer_id]) grouped[sale.customer_id] = [];
    grouped[sale.customer_id].push(sale);
  }
  let html = '';
  for (const [custId, items] of Object.entries(grouped)) {
    const customer = store.custs.find(c => c.id === custId);
    const total = items.reduce((sum, s) => sum + s.total_amount, 0);
    html += `<div class="tarhil-card" style="background:#fff;border:1.5px solid #d6eaf8;border-radius:10px;margin-bottom:8px;overflow:hidden;cursor:pointer;" onclick="toggleTarhilDetails(this)">
      <div style="padding:9px 12px;background:var(--blue-light);display:flex;align-items:center;gap:8px">
        <span>👤</span>
        <span style="font-weight:800;color:var(--blue)">${customer ? customer.name : 'عميل محذوف'}</span>
        <span style="margin-right:auto;font-weight:900;color:var(--blue)">يومية: ${N(total)} جنيه</span>
        <span>▼</span>
      </div>
      <div class="tarhil-details" style="display:none;padding:10px 12px;border-top:1.5px solid #d6eaf8">
        <table style="width:100%;border-collapse:collapse;font-size:0.8rem">
          <thead><tr style="background:#f0f7f0"><th>الصنف</th><th>عدد</th><th>وزن(ك)</th><th>سعر</th><th>المبلغ</th></tr></thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td style="padding:5px;font-weight:700">${item.product?.name || '-'}</td>
                <td style="padding:5px">${item.quantity || '-'}</td>
                <td style="padding:5px">${item.weight_kg || '-'}</td>
                <td style="padding:5px">${N(item.unit_price)} جنيه</td>
                <td style="padding:5px;font-weight:900;color:var(--green)">${N(item.total_amount)} جنيه</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot><tr style="background:#eafaf1;font-weight:900">
            <td colspan="4" style="text-align:right;padding:5px">إجمالي اليومية</td>
            <td style="padding:5px;color:var(--green)">${N(total)} جنيه</td>
          </tr></tfoot>
        </table>
      </div>
    </div>`;
  }
  container.innerHTML = html;
}

function toggleTarhilDetails(el) {
  const details = el.querySelector('.tarhil-details');
  if (details) details.style.display = details.style.display === 'none' ? 'block' : 'none';
}

// دالة للانتقال إلى صفحة الترحيلات بتاريخ معين (تستخدم من صفحة العميل)
function goToTarhilDate(date) {
  // تحديث التاريخ الحالي في store
  store._state.currentDate = date;
  updateDates();      // تحديث شريط التاريخ في الهيدر
  showPage('tarhil', document.querySelector('[data-page="tarhil"]'));
  renderTarhil();     // إعادة تحميل الترحيلات
}