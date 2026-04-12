// ===================== renderers/baqi.js — الباقي في المحل (من النظام القديم) =====================

function renderBaqi() {
  // في النظام الجديد، المخزون موجود في store.inv (الدفعات النشطة)
  // نعتبر أن "الباقي" هو الدفعات التي لم تنتهِ (remaining_qty > 0) والتي ليس لها carryover_from أو نعتبرها كلها
  const batches = (store.inv || []).filter(b => b.remaining_qty > 0);
  const container = document.getElementById('baqi-body');
  if (!container) return;

  if (!batches.length) {
    container.innerHTML = '<p style="text-align:center;color:#aaa;padding:24px">لا توجد متبقيات</p>';
    return;
  }

  container.innerHTML = batches.map((batch, i) => {
    const supplier = (store.supps || []).find(s => s.id === batch.supplier_id);
    const fromDate = batch.carryover_from ? new Date(batch.batch_date).toLocaleDateString('ar-EG') : '-';
    return `<div style="background:#fff;border:1.5px solid #d2b4de;border-radius:10px;margin-bottom:8px;padding:11px 13px;display:flex;align-items:center;gap:10px;">
      <div style="background:#6c3483;color:#fff;border-radius:50%;width:25px;height:25px;display:flex;align-items:center;justify-content:center;font-size:0.77rem;font-weight:900;">${i + 1}</div>
      <div style="flex:1">
        <div style="font-weight:800;color:#6c3483">${batch.product_name}</div>
        <div style="font-size:0.76rem;color:var(--gray)">المورد: ${supplier ? supplier.name : '-'} | من: ${fromDate}</div>
      </div>
      <div style="font-weight:900;color:#6c3483">${N(batch.remaining_qty)} ${batch.unit}</div>
    </div>`;
  }).join('');
}