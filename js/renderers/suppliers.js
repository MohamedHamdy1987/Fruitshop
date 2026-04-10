// ===================== renderers/suppliers.js — الموردون (نسخة تتبع الأخطاء) =====================

function addSupplier() {
  try {
    alert("1- بدء إضافة مورد");
    
    const name  = document.getElementById('ns-name').value.trim();
    const phone = document.getElementById('ns-phone').value.trim();
    
    if (!name) return alert('أدخل اسم المورد');
    
    if (currentUser && !currentUser.user_metadata) currentUser.user_metadata = {};
    if (currentUser && !currentUser.user_metadata.shop_name) {
      currentUser.user_metadata.shop_name = 'محل افتراضي';
    }
    
    S.suppliers.push({ id: Date.now(), name, phone, ledger: [] });
    alert("2- تم push إلى S.suppliers");
    
    document.getElementById('ns-name').value = '';
    document.getElementById('ns-phone').value = '';
    
    alert("3- قبل save()");
    save();
    alert("4- بعد save()");
    
    alert("5- قبل renderSuppList()");
    renderSuppList();
    alert("6- بعد renderSuppList()");
    
    alert("7- قبل refreshDropdowns()");
    refreshDropdowns();
    alert("8- تمت الإضافة بنجاح!");
    
    if (typeof showToast === 'function') showToast(`تم إضافة المورد ${name}`, 'success');
    else alert(`تم إضافة المورد ${name}`);
    
  } catch(e) {
    alert("خطأ في addSupplier: "+e.message);
  }
}

window.addSupplier = addSupplier;
