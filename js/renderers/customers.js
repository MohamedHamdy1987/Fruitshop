// ===================== renderers/customers.js — العملاء (نسخة آمنة) =====================

function getCustBal(id) {
  const c = S.customers.find(x => x.id == id);
  if (!c) return 0;
  return c.ledger.reduce((s, e) =>
    e.type === 'order' ? s + e.amount : (e.type === 'payment' || e.type === 'discount') ? s - e.amount : s, 0);
}

function addCustomer() {
  try {
    const name = document.getElementById('nc-name').value.trim();
    const phone = document.getElementById('nc-phone').value.trim();
    const bal = parseFloat(document.getElementById('nc-balance').value) || 0;
    if (!name) return alert('أدخل اسم العميل');

    // ✅ التأكد من أن S.customers مصفوفة
    if (!S.customers || !Array.isArray(S.customers)) {
      console.warn("S.customers كانت null، تم إعادة تهيئتها");
      S.customers = [];
    }

    const cust = { id: Date.now(), name, phone, ledger: [] };
    if (bal > 0) cust.ledger.push({ date: S.date, type: 'order', amount: bal, ref: 'رصيد منقول', isTarhil: false });

    S.customers.push(cust);
    console.log("تمت الإضافة، عدد العملاء الآن:", S.customers.length);

    document.getElementById('nc-name').value = '';
    document.getElementById('nc-phone').value = '';
    document.getElementById('nc-balance').value = '';

    save();
    renderCustList();
    refreshDropdowns();

    if (typeof showToast === 'function') showToast(`✅ تم إضافة العميل ${name}`, 'success');
    else alert(`✅ تم إضافة العميل ${name}`);
  } catch(e) {
    alert("خطأ في addCustomer: " + e.message);
    console.error(e);
  }
}

// بقية الدوال كما هي (delCustomer, renderCustList, ...) - احتفظ بها من ملفك الأصلي
// ...
