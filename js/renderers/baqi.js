// ============================================================
// js/renderers/baqi.js — الباقي في المحل (مدمج مع Supabase)
// ============================================================
async function renderBaqi() {
  const container = document.getElementById('baqi-body');
  if (!container) return;

  container.innerHTML = '<div class="skeleton" style="height:150px"></div>';

  try {
    // فلترة: الدفعات النشطة التي تم ترحيلها من يوم سابق
    const baqiItems = store.inv.filter(b => 
      b.carryover_from && b.status === 'active' && b.remaining_qty > 0
    );

    if (!baqiItems.length) {
      container.innerHTML = '<p style="text-align:center;color:#aaa;padding:24px">✅ لا توجد متبقيات من الأيام السابقة</p>';
      return;
    }

    // نفس تصميم النظام القديم
    container.innerHTML = baqiItems.map((b, i) => {
      const pct = b.original_qty > 0 ? Math.round((b.remaining_qty / b.original_qty) * 100) : 0;
      const barColor = pct > 50 ? 'var(--green)' : pct > 20 ? 'var(--orange)' : 'var(--red)';
      
      return `<div style="background:#fff;border:1.5px solid #d2b4de;border-radius:10px;margin-bottom:8px;padding:11px 13px;display:flex;align-items:center;gap:10px;">
        <div style="background:#6c3483;color:#fff;border-radius:50%;width:25px;height:25px;display:flex;align-items:center;justify-content:center;font-size:0.77rem;font-weight:900;">${i + 1}</div>
        <div style="flex:1">
          <div style="font-weight:800;color:#6c3483">${b.product_name}</div>
          <div style="font-size:0.76rem;color:var(--gray)">
            المورد: ${b.supplier_name || '-'} | 🔄 ترحيل من: ${new Date(b.carryover_from).toLocaleDateString('ar-EG', {month:'short', day:'numeric'})}
          </div>
          <div class="progress-bar-wrap" style="height:4px;margin-top:4px">
            <div class="progress-bar-fill" style="width:${pct}%;background:${barColor}"></div>
          </div>
        </div>
        <div style="text-align:left">
          <div style="font-weight:900;color:#6c3483;font-size:1rem">${N(b.remaining_qty)} ${b.unit}</div>
        </div>
      </div>`;
    }).join('');

  } catch (e) {
    AppError.log('renderBaqi', e);
    container.innerHTML = '<p style="text-align:center;color:var(--red);padding:24px">⚠️ تعذر تحميل المتبقيات</p>';
  }
}