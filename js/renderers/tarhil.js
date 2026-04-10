// ===================== renderers/tarhil.js — الترحيلات =====================

function renderTarhil() {
  const log = S.tarhilLog[S.date] || {};
  const ids = Object.keys(log).filter(id => log[id] && log[id].length > 0);
  document.getElementById('tarhil-body').innerHTML = ids.length
    ? ids.map(cid => {
        const cust  = S.customers.find(c => c.id == cid);
        const items = log[cid];
        const tot   = items.reduce((s, t) => s + t.total, 0);
        const rows  = items.map(t => `<tr>
          <td style="padding:5px;font-weight:700">${t.productName}</td>
          <td style="padding:5px">${t.qty || '-'}</td>
          <td style="padding:5px">${t.weight || '-'}</td>
          <td style="padding:5px">${t.price} جنيه</td>
          <td style="padding:5px;font-weight:900;color:var(--green)">${N(t.total)} جنيه</td>
        </tr>`).join('');
        return `<div style="background:#fff;border:1.5px solid #d6eaf8;border-radius:10px;margin-bottom:8px;overflow:hidden;cursor:pointer;"
          onclick="let el=this.querySelector('.tc-b');el.style.display=el.style.display==='none'?'block':'none';">
          <div style="padding:9px 12px;background:var(--blue-light);display:flex;align-items:center;gap:8px">
            <span>👤</span>
            <span style="font-weight:800;color:var(--blue)">${cust ? cust.name : 'محذوف'}</span>
            <span style="margin-right:auto;font-weight:900;color:var(--blue)">يومية: ${N(tot)} جنيه</span>
            <span>▼</span>
          </div>
          <div class="tc-b" style="display:none;padding:10px 12px;border-top:1.5px solid #d6eaf8">
            <table style="width:100%;border-collapse:collapse;font-size:0.8rem">
              <thead><tr style="background:#f0f7f0"><th>الصنف</th><th>عدد</th><th>وزن(ك)</th><th>سعر</th><th>المبلغ</th></tr></thead>
              <tbody>${rows}</tbody>
              <tfoot><tr style="background:#eafaf1;font-weight:900">
                <td colspan="4" style="text-align:right;padding:5px">إجمالي اليومية</td>
                <td style="padding:5px;color:var(--green)">${N(tot)} جنيه</td>
              </tr></tfoot>
            </table>
          </div>
        </div>`;
      }).join('')
    : '<p style="text-align:center;color:#aaa;padding:24px">لا توجد ترحيلات اليوم</p>';
}

function goToTarhilDate(date) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
  document.getElementById('page-tarhil').classList.add('active');
  document.querySelectorAll('nav.tabs button')[3].classList.add('active');
  const log = S.tarhilLog[date] || {};
  const ids = Object.keys(log).filter(id => log[id] && log[id].length > 0);
  document.getElementById('tarhil-badge').textContent = date;
  document.getElementById('tarhil-body').innerHTML = ids.length
    ? ids.map(cid => {
        const cust  = S.customers.find(c => c.id == cid);
        const items = log[cid];
        const tot   = items.reduce((s, t) => s + t.total, 0);
        const rows  = items.map(t => `<tr>
          <td style="padding:5px;font-weight:700">${t.productName}</td>
          <td style="padding:5px">${t.qty || '-'}</td>
          <td style="padding:5px">${t.weight || '-'}</td>
          <td style="padding:5px">${t.price} جنيه</td>
          <td style="padding:5px;font-weight:900;color:var(--green)">${N(t.total)} جنيه</td>
        </tr>`).join('');
        return `<div style="background:#fff;border:1.5px solid #d6eaf8;border-radius:10px;margin-bottom:8px;overflow:hidden;">
          <div style="padding:9px 12px;background:var(--blue-light);display:flex;align-items:center;gap:8px">
            <span>👤</span>
            <span style="font-weight:800;color:var(--blue)">${cust ? cust.name : 'محذوف'}</span>
            <span style="margin-right:auto;font-weight:900;color:var(--blue)">${N(tot)} جنيه</span>
          </div>
          <div style="padding:10px 12px">
            <table style="width:100%;border-collapse:collapse;font-size:0.8rem">
              <thead><tr style="background:#f0f7f0"><th>الصنف</th><th>عدد</th><th>وزن(ك)</th><th>سعر</th><th>المبلغ</th></tr></thead>
              <tbody>${rows}</tbody>
              <tfoot><tr style="background:#eafaf1;font-weight:900">
                <td colspan="4" style="text-align:right;padding:5px">إجمالي اليومية</td>
                <td style="padding:5px;color:var(--green)">${N(tot)} جنيه</td>
              </tr></tfoot>
            </table>
          </div>
        </div>`;
      }).join('')
    : '<p style="text-align:center;color:#aaa;padding:24px">لا توجد ترحيلات</p>';
}
