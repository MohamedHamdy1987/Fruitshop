// ===================== renderers/customers.js — العملاء (نسخة تتبع الأخطاء) =====================

function getCustBal(id) {
  try {
    const c = S.customers.find(x => x.id == id);
    if (!c) return 0;
    return c.ledger.reduce((s, e) =>
      e.type === 'order' ? s + e.amount : (e.type === 'payment' || e.type === 'discount') ? s - e.amount : s, 0);
  } catch(e) { alert("خطأ في getCustBal: "+e.message); return 0; }
}

function addCustomer() {
  try {
    alert("1- بدء إضافة عميل");
    
    const name  = document.getElementById('nc-name').value.trim();
    const phone = document.getElementById('nc-phone').value.trim();
    const bal   = parseFloat(document.getElementById('nc-balance').value) || 0;
    
    alert("2- الاسم: "+name);
    
    if (!name) return alert('أدخل اسم العميل');
    
    // التأكد من وجود user_metadata (تجنب الخطأ)
    if (currentUser && !currentUser.user_metadata) currentUser.user_metadata = {};
    if (currentUser && !currentUser.user_metadata.shop_name) {
      currentUser.user_metadata.shop_name = 'محل افتراضي';
    }
    
    const cust = { id: Date.now(), name, phone, ledger: [] };
    if (bal > 0) cust.ledger.push({ date: S.date, type: 'order', amount: bal, ref: 'رصيد منقول من الدفاتر', isTarhil: false });
    
    alert("3- قبل push إلى S.customers");
    S.customers.push(cust);
    alert("4- تم push، عدد العملاء الآن: "+S.customers.length);
    
    // تفريغ الحقول
    document.getElementById('nc-name').value = '';
    document.getElementById('nc-phone').value = '';
    document.getElementById('nc-balance').value = '';
    
    alert("5- قبل استدعاء save()");
    save();
    alert("6- بعد save()");
    
    alert("7- قبل renderCustList()");
    renderCustList();
    alert("8- بعد renderCustList()");
    
    alert("9- قبل refreshDropdowns()");
    refreshDropdowns();
    alert("10- تمت الإضافة بنجاح!");
    
    if (typeof showToast === 'function') showToast(`تم إضافة العميل ${name}`, 'success');
    else alert(`تم إضافة العميل ${name}`);
    
  } catch(e) {
    alert("خطأ في addCustomer: "+e.message);
  }
}

// بقية الدوال كما هي (delCustomer, renderCustList, ...) ولكن سأدرجها مختصرة
// ... (يمكنك الاحتفاظ بباقي الكود من المرة السابقة)

// لضمان وجود الدوال الأساسية
window.addCustomer = addCustomer;
