// ============================================================
// renderers/admin.js — لوحة تحكم المشرف (SaaS)
// ============================================================

async function loadAdminPayments() {
  const container = document.getElementById('admin-payments-list');
  if (!container) return;
  container.innerHTML = '<div class="skeleton" style="height:200px"></div>';
  try {
    const data = await API.subscriptions.getAll();
    if (!data?.length) { container.innerHTML='<p style="padding:20px;color:#aaa;text-align:center">لا توجد طلبات دفع</p>'; return; }

    const methodNames = { vodafone:'فودافون كاش', instapay:'إنستاباي', bank:'تحويل بنكي', fawry:'فوري' };
    const statusColor = { pending:'#f39c12', confirmed:'var(--green)', rejected:'var(--red)' };
    const statusText  = { pending:'قيد المراجعة', confirmed:'مؤكد ✅', rejected:'مرفوض ❌' };

    container.innerHTML = `<div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
        <thead><tr style="background:#f0f0f0">
          <th style="padding:8px">الشركة</th>
          <th>الباقة</th><th>المبلغ</th><th>الطريقة</th>
          <th>رقم العملية</th><th>التاريخ</th><th>الحالة</th><th>الإجراء</th>
        </tr></thead>
        <tbody>
          ${data.map(p => {
            let extras = '';
            try { extras = Object.values(JSON.parse(p.extra_data||'{}')).join(' | '); } catch(e) {}
            return `<tr style="border-bottom:1px solid #f0f0f0">
              <td style="padding:8px;font-weight:700">${p.company?.name||p.company_id||'-'}</td>
              <td style="padding:8px">${p.plan==='monthly'?'شهري':'سنوي'}</td>
              <td style="padding:8px;font-weight:700">${N(p.amount)} ج</td>
              <td style="padding:8px">${methodNames[p.payment_method]||p.payment_method||'-'}</td>
              <td style="padding:8px;font-size:0.75rem">${p.transaction_id||'-'}<br><span style="color:var(--gray)">${extras}</span></td>
              <td style="padding:8px;font-size:0.75rem">${new Date(p.created_at).toLocaleDateString('ar-EG')}</td>
              <td style="padding:8px">
                <span style="background:${statusColor[p.status]};color:#fff;border-radius:6px;padding:2px 8px;font-size:0.73rem;font-weight:700">
                  ${statusText[p.status]||p.status}
                </span>
              </td>
              <td style="padding:8px">
                ${p.status==='pending' ? `
                  <button class="btn btn-success btn-sm" onclick="confirmSub('${p.id}','${p.company_id}','${p.plan}')">تأكيد</button>
                  <button class="btn btn-danger btn-sm"  onclick="rejectSub('${p.id}')">رفض</button>
                ` : `
                  <button class="btn btn-warning btn-sm" onclick="resetSub('${p.id}')">إعادة</button>
                `}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  } catch(e) {
    AppError.log('loadAdminPayments', e);
    container.innerHTML = '<p style="color:var(--red);padding:16px">خطأ في التحميل</p>';
  }
}

async function confirmSub(subId, companyId, plan) {
  const months = plan==='monthly' ? 1 : 12;
  const endsAt = new Date(Date.now() + months*30*86400000).toISOString();
  try {
    await API.subscriptions.confirm(subId, companyId, plan, endsAt);
    Toast.success('✅ تم تأكيد الاشتراك وتفعيله');
    loadAdminPayments();
  } catch(e) { AppError.log('confirmSub', e, true); }
}

async function rejectSub(subId) {
  if (!confirm('رفض هذا الطلب؟')) return;
  try {
    await API.subscriptions.reject(subId);
    Toast.success('تم الرفض');
    loadAdminPayments();
  } catch(e) { AppError.log('rejectSub', e, true); }
}

async function resetSub(subId) {
  try {
    await sb.from('subscriptions').update({ status:'pending' }).eq('id', subId);
    loadAdminPayments();
  } catch(e) { AppError.log('resetSub', e, true); }
}

function updateAdminTabVisibility() {
  const adminTab = document.getElementById('adminTabBtn');
  if (!adminTab) return;
  const isAdmin = currentUser?.role === 'owner' ||
                  currentUser?.email?.endsWith('@admin.vegshop.com');
  adminTab.style.display = isAdmin ? '' : 'none';
}

// aliases للتوافق مع الكود القديم
async function confirmPayment(id,amount,uid) { await confirmSub(id,uid,'monthly'); }
async function rejectPayment(id)  { await rejectSub(id); }
async function resetPayment(id)   { await resetSub(id); }
