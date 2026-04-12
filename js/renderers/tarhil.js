// ===================== renderers/tarhil.js — الترحيلات (مدمج مع Supabase) =====================

async function renderTarhil() {
  const container = document.getElementById('tarhil-body');
  const badge = document.getElementById('tarhil-badge');
  if (!container) return;

  container.innerHTML = '<div class="skeleton" style="height:150px"></div>';
  if (badge) badge.textContent = '...';

  try {
    // جلب بيانات المبيعات من التخزين المحلي (المحدث من Supabase)
    let salesData = store.sales || [];
    if (!salesData.length) {
      salesData = await API.sales.list(store._state.currentDate);
      store.set('sales', salesData);
    }

    // فلترة: المبيعات الآجلة فقط (غير نقدية) والتي لها عميل
    const creditSales = salesData.filter(s => !s.is_cash && s.customer_id);

    // تحديث الشارة بالتاريخ الحالي
    if (badge) badge.textContent = new Date(store._state.currentDate).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });

    if (!creditSales.length) {
      container.innerHTML = '<p style="text-align:center;color:#aaa;padding:24px">لا توجد ترحيلات اليوم</p>';
      return;
    }

    // تجميع المبيعات حسب العميل
    const grouped = {};
    creditSales.forEach(s => {
      if (!grouped[s.customer_id]) {
        grouped[s.customer_id] = {
          customerName: s.customer?.name || 'عميل',
          customerPhone: s.customer?.phone || '',
          items: [],
          total: 0
        };
      }
      grouped[s.customer_id].items.push(s);
      grouped[s.customer_id].total += parseFloat(s.total_amount || 0);
    });

    // بناء واجهة العرض بنفس هيكل النظام القديم
    const ids = Object.keys(grouped);
    container.innerHTML = ids.map(cid => {
      const group = grouped[cid];
      const rows = group.items.map(t => `
        <tr>
          <td style="padding:5px;font-weight:700">${t.product?.name || 'صنف'}</td>
          <td style="padding:5px">${N(t.quantity || 0)}</td>
          <td style="padding:5px">${t.weight_kg ? N(t.weight_kg) + ' ك' : '-'}</td>
          <td style="padding:5px">${N(t.unit_price)} جنيه</td>
          <td style="padding:5px;font-weight:900;color:var(--green)">${N(t.total_amount)} جنيه</td>
        </tr>
      `).join('');

      return `
        <div style="background:#fff;border:1.5px solid #d6eaf8;border-radius:10px;margin-bottom:8px;overflow:hidden;">
          <div style="padding:9px 12px;background:var(--blue-light);display:flex;align-items:center;gap:8px;cursor:pointer"
            onclick="let el=this.nextElementSibling; el.style.display = el.style.display==='none'?'block':'none';">
            <span>👤</span>
            <span style="font-weight:800;color:var(--blue)">${group.customerName}</span>
            <span style="margin-right:auto;font-weight:900;color:var(--blue)">يومية: ${N(group.total)} جنيه</span>
            <span>▼</span>
          </div>
          <div style="display:none;padding:10px 12px;border-top:1.5px solid #d6eaf8">
            <table style="width:100%;border-collapse:collapse;font-size:0.8rem">
              <thead><tr style="background:#f0f7f0"><th>الصنف</th><th>عدد</th><th>وزن(ك)</th><th>سعر</th><th>المبلغ</th></tr></thead>
              <tbody>${rows}</tbody>
              <tfoot><tr style="background:#eafaf1;font-weight:900">
                <td colspan="4" style="text-align:right;padding:5px">إجمالي اليومية</td>
                <td style="padding:5px;color:var(--green)">${N(group.total)} جنيه</td>
              </tr></tfoot>
            </table>
          </div>
        </div>
      `;
    }).join('');

  } catch (e) {
    AppError.log('renderTarhil', e);
    container.innerHTML = '<p style="text-align:center;color:var(--red);padding:24px">⚠️ تعذر تحميل الترحيلات</p>';
  }
}

// دالة مساعدة: الانتقال ليوم سابق (للتوافق مع الكود القديم)
async function goToTarhilDate(date) {
  store.set('currentDate', date);
  updateDates();
  await loadTodayData();
  renderTarhil();
  
  // تفعيل التبويب
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
  document.getElementById('page-tarhil').classList.add('active');
  document.querySelector('[data-page="tarhil"]')?.classList.add('active');
}