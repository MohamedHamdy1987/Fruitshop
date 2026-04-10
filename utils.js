// ===================== utils.js — دوال مساعدة مشتركة =====================

/**
 * تنسيق التاريخ بالعربية
 */
function fmtDate(d) {
  return d.toLocaleDateString('ar-EG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

/**
 * تنسيق الأرقام بالعربية
 */
function N(n) {
  return (parseFloat(n) || 0).toLocaleString('ar-EG');
}

/**
 * إغلاق مودال
 */
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

/**
 * تغيير التاريخ يدوياً
 */
function changeDatePrompt() {
  const d = prompt('أدخل التاريخ:', S.date);
  if (d && d.trim()) {
    S.date = d.trim();
    save();
    updateDates();
    renderAll();
  }
}

/**
 * تحديث عرض التاريخ في كل عناصر الصفحة
 */
function updateDates() {
  ['headerDate', 'sales-badge', 'nazil-badge', 'col-badge', 'exp-badge', 'tarhil-badge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = S.date;
  });
}

/**
 * عرض قائمة المستخدم
 */
function showUserMenu() {
  const meta = currentUser?.user_metadata;
  document.getElementById('user-info').innerHTML = `
    <div><strong>المحل:</strong> ${meta?.shop_name || '-'}</div>
    <div><strong>البريد:</strong> ${currentUser?.email || '-'}</div>
    <div><strong>الاشتراك:</strong> ${
      meta?.subscription === 'trial'  ? 'تجربة مجانية' :
      meta?.subscription === 'active' ? 'مشترك'         : 'منتهي'
    }</div>`;
  document.getElementById('user-modal').classList.add('open');
}
