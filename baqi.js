// ===================== renderers/baqi.js — الباقي في المحل =====================

function renderBaqi() {
  const items = S.products.filter(p => p.carryoverFrom);
  document.getElementById('baqi-body').innerHTML = items.length
    ? items.map((p, i) => {
        const sup = S.suppliers.find(s => s.id == p.supplierId);
        return `<div style="background:#fff;border:1.5px solid #d2b4de;border-radius:10px;margin-bottom:8px;padding:11px 13px;display:flex;align-items:center;gap:10px;">
          <div style="background:#6c3483;color:#fff;border-radius:50%;width:25px;height:25px;display:flex;align-items:center;justify-content:center;font-size:0.77rem;font-weight:900;">${i + 1}</div>
          <div style="flex:1">
            <div style="font-weight:800;color:#6c3483">${p.name}</div>
            <div style="font-size:0.76rem;color:var(--gray)">المورد: ${sup ? sup.name : '-'} | من: ${p.carryoverFrom}</div>
          </div>
          <div style="font-weight:900;color:#6c3483">${p.totalQty - p.sold} ${p.unit}</div>
        </div>`;
      }).join('')
    : '<p style="text-align:center;color:#aaa;padding:24px">لا توجد متبقيات</p>';
}
