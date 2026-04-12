// ============================================================
// renderers/invoices.js — نظام فواتير الموردين (نسخة القديم)
// ============================================================

async function renderInvoicesPage() {
  const container = document.getElementById('invoices-cont');
  if (!container) return;
  const invs = store.invs || [];
  if (!invs.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🧾</div>
      <div class="empty-title">لا توجد فواتير</div>
      <div class="empty-sub">ستُنشأ الفواتير تلقائياً عند اكتمال بيع دفعة مورد</div>
    </div>`;
    return;
  }
  container.innerHTML = invs.map(inv => renderInvoiceCard(inv)).join('');
}

function renderInvoiceCard(inv) {
  const gross  = inv.subtotal || 0;
  const cm     = inv.commission_7pct || 0;
  const noulon = inv.noulon_total || 0;
  const mashal = inv.mashal_total || 0;
  const total  = inv.total_amount || (gross - cm - noulon - mashal);
  const supplier = store.supps?.find(s => s.id === inv.supplier_id) || { name: inv.supplierName || '-' };
  const items = inv.items || [];

  return `<div class="card" id="inv-${inv.id}">
    <div class="ch g" style="justify-content:space-between">
      <div>
        <h2>🧾 فاتورة: ${supplier.name}</h2>
        <div style="font-size:0.76rem;color:var(--gray)">${inv.invoice_date || inv.date || '-'}</div>
      </div>
      <div class="no-print">
        <button class="btn btn-b btn-sm" onclick="printInvoice('${inv.id}')">🖨️</button>
        <button class="btn btn-r btn-sm" onclick="delInvoice('${inv.id}')">🗑️</button>
      </div>
    </div>
    <div class="cb">
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:0.83rem">
          <thead><tr style="background:#f0f7f0"><th>الصنف</th><th>الوحدة</th><th>المباع</th><th>الوزن</th><th>الإجمالي</th></tr></thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td style="padding:5px;font-weight:700">${item.product?.name || '-'}</td>
                <td style="padding:5px">${item.product?.unit || '-'}</td>
                <td style="padding:5px">${N(item.quantity || 0)}</td>
                <td style="padding:5px">${item.weight_kg > 0 ? N(item.weight_kg)+' ك' : '-'}</td>
                <td style="padding:5px;font-weight:900;color:var(--green)">${N(item.total)} جنيه</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot><tr style="background:#eafaf1;font-weight:900"><td colspan="4">إجمالي المبيعات</td><td>${N(gross)} جنيه</td></tr></tfoot>
        </table>
      </div>
      <div style="background:#fef9e7;border:1.5px solid #f0d080;border-radius:9px;padding:11px;margin-top:10px">
        <div style="font-weight:800;color:#7a5c00;margin-bottom:8px">✂️ الخصومات</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:7px">
          <div><label style="font-size:0.75rem;font-weight:700">النولون</label><input type="number" value="${noulon}" min="0" onchange="updateInvDed('${inv.id}','noulon_total',this.value)"></div>
          <div><label style="font-size:0.75rem;font-weight:700">المشال</label><input type="number" value="${mashal}" min="0" onchange="updateInvDed('${inv.id}','mashal_total',this.value)"></div>
          <div><label style="font-size:0.75rem;font-weight:700">العمولة (7%)</label><input type="number" value="${cm}" min="0" onchange="updateInvDed('${inv.id}','commission_7pct',this.value)"></div>
        </div>
        <div style="margin-top:8px"><strong>الصافي المستحق للمورد: <span id="net-${inv.id}">${N(total)}</span> جنيه</strong></div>
      </div>
    </div>
  </div>`;
}

async function updateInvDed(invId, field, val) {
  const inv = store.invs.find(i => i.id === invId);
  if (!inv) return;
  inv[field] = parseFloat(val) || 0;
  const gross = inv.subtotal || 0;
  const total = gross - (inv.commission_7pct||0) - (inv.noulon_total||0) - (inv.mashal_total||0);
  inv.total_amount = total;
  document.getElementById(`net-${invId}`).innerText = N(total);
  try {
    await API.invoices.updateDeductions(invId, {
      subtotal: gross,
      commission: inv.commission_7pct,
      noulon: inv.noulon_total,
      mashal: inv.mashal_total,
      discount: 0
    });
  } catch(e) { AppError.log('updateInvDed', e); }
}

async function delInvoice(id) {
  if (!confirm('حذف هذه الفاتورة؟')) return;
  try {
    await API.invoices.delete(id);
    store.set('invoices', store.invs.filter(i => i.id !== id));
    Toast.success('تم الحذف');
    renderInvoicesPage();
  } catch(e) { AppError.log('delInvoice', e, true); }
}

function printInvoice(invId) {
  const card = document.getElementById(`inv-${invId}`);
  if (!card) return;
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet"><style>body{font-family:Cairo,sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:right}th{background:#f0f7f0}</style></head><body>${card.outerHTML}</body></html>`);
  w.document.close();
  w.print();
}

// للتوافق مع الأزرار القديمة
function generateInvoice() { Toast.info('تُنشأ الفواتير تلقائياً عند اكتمال بيع الدفعة'); }
function generateInvoiceFor() { generateInvoice(); }