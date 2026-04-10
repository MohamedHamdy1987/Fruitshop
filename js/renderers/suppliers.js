// ===================== renderers/suppliers.js — الموردون (نسخة آمنة) =====================

function addSupplier() {
  try {
    const name = document.getElementById('ns-name').value.trim();
    const phone = document.getElementById('ns-phone').value.trim();
    if (!name) return alert('أدخل اسم المورد');

    // ✅ التأكد من أن S.suppliers مصفوفة
    if (!S.suppliers || !Array.isArray(S.suppliers)) {
      console.warn("S.suppliers كانت null، تم إعادة تهيئتها");
      S.suppliers = [];
    }

    S.suppliers.push({ id: Date.now(), name, phone, ledger: [] });
    console.log("تمت الإضافة، عدد الموردين الآن:", S.suppliers.length);

    document.getElementById('ns-name').value = '';
    document.getElementById('ns-phone').value = '';

    save();
    renderSuppList();
    refreshDropdowns();

    if (typeof showToast === 'function') showToast(`✅ تم إضافة المورد ${name}`, 'success');
    else alert(`✅ تم إضافة المورد ${name}`);
  } catch(e) {
    alert("خطأ في addSupplier: " + e.message);
    console.error(e);
  }
}

// بقية الدوال كما هي...
