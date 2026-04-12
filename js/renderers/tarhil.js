// ============================================================
// js/renderers/tarhil.js — الترحيلات (المبيعات الآجلة اليومية)
// مدمج مع Supabase — يعمل على بيانات store.sales الحديثة
// يحافظ على تصميم وآلية النظام القديم مع أمان وسحابة الجديد
// ============================================================

async function renderTarhil() {
  const container = document.getElementById('tarhil-body');
  const badge = document.getElementById('tarhil-badge');
  if (!container) return;

  // حالة تحميل أولية
  container.innerHTML = '<div class="skeleton" style="height:150px"></div>';
  if (badge) badge.textContent = '...';

  try {
    // استخدام البيانات المحلية إن وجدت، وإلا جلبها من API لضمان الدقة
    let salesData = store.sales || [];
    if (!salesData.length) {
      salesData = await API.sales.list(store._state.currentDate);
      store.set('sales', salesData);
    }

    // تصفية: المبيعات الآجلة فقط (غير نقدية) والمرتبطة بعميل
    const creditSales = salesData.filter(s => !s.is_cash && s.customer_id);

    // تحديث الشارة بعدد العملاء المرحّلة
    const uniqueCustomers = new Set(creditSales.map(s => s.customer_id));
    if (badge) badge.textContent = `${uniqueCustomers.size} عميل`;

    if (!creditSales.length) {
      container.innerHTML = '<p style="text-align:center;color:#aaa;padding:24px">✅ لا توجد ترحيلات (مبيعات آجلة) اليوم</p>';
      return;
    }

    // تجميع المبيعات حسب العميل
    const grouped = {};
    creditSales.forEach(s => {
      const custId = s.customer_id;
      if (!grouped[custId]) {
        grouped[custId] = {
          customerName: s.customer?.name || 'عميل غير معروف',
          customerPhone: s.customer?.phone || '',
          items: [],
          total: 0
        };
      }
      grouped[custId].items.push(s);
      grouped[custId].total += parseFloat(s.total_amount || 0);
    });
    // بناء واجهة العرض بنفس تصميم النظام القديم (قابل للطي)
    const ids = Object.keys(grouped);
    container.innerHTML = ids.map(cid => {
      const group = grouped[cid];
      
      const rows = group.items.map(t => `
        <tr>
          <td style="padding:5px;font-weight:700">${t.product?.name || 'صنف'}</td>
          <td style="padding:5px">${N(t.quantity || 0)} ${t.product?.unit || ''}</td>
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
            ${group.customerPhone ? `<span style="font-size:0.72rem;color:var(--gray)">(${group.customerPhone})</span>` : ''}
            <span style="margin-right:auto;font-weight:900;color:var(--blue)">يومية: ${N(group.total)} جنيه</span>
            <span>▼</span>
          </div>
          <div style="display:none;padding:10px 12px;border-top:1.5px solid #d6eaf8">
            <table style="width:100%;border-collapse:collapse;font-size:0.8rem">
              <thead>
                <tr style="background:#f0f7f0">
                  <th>الصنف</th><th>الكمية</th><th>السعر</th><th>المبلغ</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
              <tfoot>
                <tr style="background:#eafaf1;font-weight:900">
                  <td colspan="3" style="text-align:right;padding:5px">إجمالي اليومية</td>
                  <td style="padding:5px;color:var(--green)">${N(group.total)} جنيه</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      `;
    }).join('');

  } catch (e) {
    AppError.log('renderTarhil', e);
    container.innerHTML = '<p style="text-align:center;color:var(--red);padding:24px">⚠️ تعذر تحميل الترحيلات</p>';
    if (badge) badge.textContent = 'خطأ';
  }}

// ─────────────────────────────────────────────────────────────
// دالة مساعدة: الانتقال ليوم سابق (للتوافق مع الكود القديم)
// ─────────────────────────────────────────────────────────────
async function goToTarhilDate(date) {
  // تحديث التاريخ في الواجهة
  store.set('currentDate', date);
  updateDates();
  
  // إعادة تحميل بيانات اليوم المحدد
  await loadTodayData();
  
  // إعادة عرض الصفحة
  renderTarhil();
  
  // التأكد من أن التبويب نشط
  const tarhilBtn = document.querySelector('[data-page="tarhil"]');
  if (tarhilBtn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('page-tarhil').classList.add('active');
    tarhilBtn.classList.add('active');
  }
}