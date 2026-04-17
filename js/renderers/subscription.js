// ============================================================
// renderers/subscription.js — الاشتراك وإدارة الباقات
// ============================================================

let _selectedPlan = null;
const PLAN_AMOUNTS = { monthly: 750, yearly: 6000 };

function selectPlan(plan) {
  _selectedPlan = plan;
  document.getElementById('payment-form').style.display = 'block';
  updatePaymentDetails();
}

function updatePaymentDetails() {
  const method     = document.getElementById('payment-method').value;
  const detailsDiv = document.getElementById('payment-details');
  const amount     = PLAN_AMOUNTS[_selectedPlan] || 0;
  let html = `
    💰 المبلغ المطلوب: ${N(amount)} جنيه
  `;

  if (method === 'vodafone') {
    html += `📱 رقم فودافون كاش
    🔢 رقم العملية
    ⚠️ حوّل المبلغ إلى: 0123456789`;
  } else if (method === 'instapay') {
    html += `🏦 رقم إنستاباي / IBAN
    🔢 رقم العملية
    ⚠️ التحويل إلى: EG123456789 — بنك مصر`;
  } else if (method === 'bank') {
    html += `🏦 اسم البنك
    🔢 رقم الحساب
    🔢 رقم العملية`;
  } else if (method === 'fawry') {
    html += `📱 رقم الهاتف
    🔢 كود الدفع
    🚧 بوابة فوري — قريباً`;
  }
  detailsDiv.innerHTML = html;
}

async function submitPayment() {
  if (!_selectedPlan) return Toast.warning('اختر باقة أولاً');
  const method  = document.getElementById('payment-method').value;
  const amount  = PLAN_AMOUNTS[_selectedPlan];
  const transId = document.getElementById('pay-trans')?.value || '';
  if (!transId && method !== 'fawry') return Toast.warning('أدخل رقم العملية');

  let extraData = {};
  if (method==='vodafone') extraData.phone = document.getElementById('pay-phone')?.value;
  if (method==='instapay') extraData.iban  = document.getElementById('pay-iban')?.value;
  if (method==='bank') {
    extraData.bank    = document.getElementById('pay-bank')?.value;
    extraData.account = document.getElementById('pay-account')?.value;
  }

  const btn = event.target; btn.disabled=true; btn.textContent='...';
  try {
    await API.subscriptions.submit({
      plan:          _selectedPlan,
      amount,
      method,
      transactionId: transId,
      extraData
    });
    document.getElementById('payment-form').style.display = 'none';
    Toast.success('✅ تم إرسال طلب الدفع — سيتم المراجعة خلال 24 ساعة');
    renderSubscriptionStatus();
  } catch(e) { AppError.log('submitPayment', e, true); }
  finally { btn.disabled=false; btn.textContent='✅ تأكيد الدفع'; }
}

function renderSubscriptionStatus() {
  const div = document.getElementById('sub-status');
  if (!div) return;
  const sub = currentUser?.subscription;
  const ends = currentUser?.sub_ends || currentUser?.trial_ends;
  const endsStr = ends ? new Date(ends).toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'}) : '-';

  if (sub === 'monthly' || sub === 'yearly') {
    const planName = sub==='monthly' ? 'شهري' : 'سنوي';
    div.innerHTML = `
      ✅ اشتراك نشط — باقة ${planName}
      صالح حتى: ${endsStr}
    `;
  } else if (sub === 'trial') {
    const days = ends ? Math.ceil((new Date(ends)-Date.now())/86400000) : 0;
    div.innerHTML = `
      ⏳ تجربة مجانية — متبقي ${days} يوم
      تنتهي: ${endsStr}
    `;
  } else {
    div.innerHTML = `
      ⚠️ الاشتراك منتهٍ — جدّد الآن
    `;
  }
}