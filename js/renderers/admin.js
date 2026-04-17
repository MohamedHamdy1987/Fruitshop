// ============================================================
// renderers/admin.js — لوحة تحكم المشرف (SaaS)
// ✅ إصلاح updateAdminTabVisibility: الاعتماد على role فقط وليس البريد
// ✅ إضافة تحقق من الصلاحيات قبل عرض البيانات
// ============================================================

async function loadAdminPayments() {
  const container = document.getElementById('admin-payments-list');
  if (!container) return;
  
  // التحقق من الصلاحيات: فقط owner أو admin يمكنه رؤية هذه الصفحة
  const role = currentUser?.role;
  if (role !== 'owner' && role !== 'admin') {
    container.innerHTML = '<div style="color:var(--red);padding:20px;text-align:center">⛔ غير مصرح لك بالدخول إلى لوحة المشرف</div>';
    return;
  }
  
  container.innerHTML = '<div style="text-align:center;padding:20px;color:#888">جاري التحميل...</div>';
  
  try {
    const data = await API.subscriptions.getAll();
    if (!data?.length) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:#888">لا توجد طلبات دفع</div>';
      return;
    }

    const methodNames = { vodafone: 'فودافون كاش', instapay: 'إنستاباي', bank: 'تحويل بنكي', fawry: 'فوري' };
    const statusColor = { pending: '#f39c12', confirmed: 'var(--green)', rejected: 'var(--red)' };
    const statusText  = { pending: 'قيد المراجعة', confirmed: 'مؤكد ✅', rejected: 'مرفوض ❌' };

    container.innerHTML = `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="padding:8px">الشركة</th><th>الباقة</th><th>المبلغ</th><th>الطريقة</th><th>رقم العملية</th><th>التاريخ</th><th>الحالة</th><th>الإجراء</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(p => {
              let extras = '';
              try { extras = Object.values(JSON.parse(p.extra_data||'{}')).join(' | '); } catch(e) {}
              const extraDisplay = extras ? `<br><small style="color:#888">${extras}</small>` : '';
              return `
                <tr style="border-bottom:1px solid #eee;">
                  <td style="padding:8px">${p.company?.name || p.company_id || '-'}</td>
                  <td>${p.plan === 'monthly' ? 'شهري' : 'سنوي'}</td>
                  <td>${N(p.amount)} ج</td>
                  <td>${methodNames[p.payment_method] || p.payment_method || '-'}</td>
                  <td>${p.transaction_id || '-'}${extraDisplay}</td>
                  <td>${new Date(p.created_at).toLocaleDateString('ar-EG')}</td>
                  <td style="color:${statusColor[p.status] || '#888'}">${statusText[p.status] || p.status}</td>
                  <td>
                    ${p.status === 'pending' ? `
                      <button onclick="confirmSub('${p.id}', '${p.company_id}', '${p.plan}')" style="background:var(--green);color:#fff;border:none;border-radius:5px;padding:4px 8px;cursor:pointer;margin-left:4px">تأكيد</button>
                      <button onclick="rejectSub('${p.id}')" style="background:var(--red);color:#fff;border:none;border-radius:5px;padding:4px 8px;cursor:pointer">رفض</button>
                    ` : `
                      <button onclick="resetSub('${p.id}')" style="background:var(--orange);color:#fff;border:none;border-radius:5px;padding:4px 8px;cursor:pointer">إعادة</button>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch(e) {
    AppError.log('loadAdminPayments', e);
    container.innerHTML = '<div style="color:var(--red);padding:20px">خطأ في التحميل</div>';
  }
}

async function confirmSub(subId, companyId, plan) {
  const months = plan === 'monthly' ? 1 : 12;
  const endsAt = new Date(Date.now() + months * 30 * 86400000).toISOString();
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
    await sb.from('subscriptions').update({ status: 'pending' }).eq('id', subId);
    loadAdminPayments();
  } catch(e) { AppError.log('resetSub', e, true); }
}

function updateAdminTabVisibility() {
  const adminTab = document.getElementById('adminTabBtn');
  if (!adminTab) return;
  const role = currentUser?.role;
  // فقط owner أو admin يمكنه رؤية تبويب المشرف (لا نعتمد على البريد الإلكتروني)
  const isAdmin = role === 'owner' || role === 'admin';
  adminTab.style.display = isAdmin ? '' : 'none';
}

// aliases للتوافق مع الكود القديم
async function confirmPayment(id, amount, uid) { await confirmSub(id, uid, 'monthly'); }
async function rejectPayment(id)  { await rejectSub(id); }
async function resetPayment(id)   { await resetSub(id); }