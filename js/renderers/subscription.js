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
  let html = `<div style="background:var(--green-light);border-radius:8px;padding:10px;margin-bottom:12px;font-size:0.88rem;font-weight:700;color:var(--green)">
    💰 المبلغ المطلوب: ${N(amount)} جنيه
  </div>`;

  if (method === 'vodafone') {
    html += `<div class="frow"><label>📱 رقم فودافون كاش</label><input type="text" id="pay-phone" placeholder="01xxxxxxxxx"></div>
    <div class="frow"><label>🔢 رقم العملية</label><input type="text" id="pay-trans" placeholder="رقم العملية"></div>
    <div style="background:#fef9e7;padding:10px;border-radius:8px;font-size:0.82rem">⚠️ حوّل المبلغ إلى: <strong>0123456789</strong></div>`;
  } else if (method === 'instapay') {
    html += `<div class="frow"><label>🏦 رقم إنستاباي / IBAN</label><input type="text" id="pay-iban" placeholder="EG..."></div>
    <div class="frow"><label>🔢 رقم العملية</label><input type="text" id="pay-trans" placeholder="رقم العملية"></div>
    <div style="background:#fef9e7;padding:10px;border-radius:8px;font-size:0.82rem">⚠️ التحويل إلى: <strong>EG123456789</strong> — بنك مصر</div>`;
  } else if (method === 'bank') {
    html += `<div class="frow"><label>🏦 اسم البنك</label><input type="text" id="pay-bank" placeholder="بنك مصر"></div>
    <div class="frow"><label>🔢 رقم الحساب</label><input type="text" id="pay-account" placeholder="رقم الحساب"></div>
    <div class="frow"><label>🔢 رقم العملية</label><input type="text" id="pay-trans" placeholder="رقم العملية"></div>`;
  } else if (method === 'fawry') {
    html += `<div class="frow"><label>📱 رقم الهاتف</label><input type="text" id="pay-phone" placeholder="01xxxxxxxxx"></div>
    <div class="frow"><label>🔢 كود الدفع</label><input type="text" id="pay-fawry" placeholder="الكود"></div>
    <div style="background:#fef9e7;padding:10px;border-radius:8px;font-size:0.82rem">🚧 بوابة فوري — قريباً</div>`;
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
    div.innerHTML = `<div style="background:#e8f5e9;padding:14px;border-radius:10px;border:1.5px solid #a9dfbf">
      <div style="font-size:1rem;font-weight:800;color:var(--green)">✅ اشتراك نشط — باقة ${planName}</div>
      <div style="font-size:0.82rem;color:var(--gray);margin-top:4px">صالح حتى: ${endsStr}</div>
    </div>`;
  } else if (sub === 'trial') {
    const days = ends ? Math.ceil((new Date(ends)-Date.now())/86400000) : 0;
    div.innerHTML = `<div style="background:#fff3e0;padding:14px;border-radius:10px;border:1.5px solid #ffe082">
      <div style="font-size:1rem;font-weight:800;color:#e65100">⏳ تجربة مجانية — متبقي ${days} يوم</div>
      <div style="font-size:0.82rem;color:var(--gray);margin-top:4px">تنتهي: ${endsStr}</div>
    </div>`;
  } else {
    div.innerHTML = `<div style="background:var(--red-light);padding:14px;border-radius:10px;border:1.5px solid #f5c6c6">
      <div style="font-size:1rem;font-weight:800;color:var(--red)">⚠️ الاشتراك منتهٍ — جدّد الآن</div>
    </div>`;
  }
}