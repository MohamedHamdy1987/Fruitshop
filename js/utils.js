// ============================================================
// js/utils.js — دوال مساعدة مشتركة
// محدَّث: يعمل مع store._state بدلاً من S القديم
// ============================================================

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
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

/**
 * تغيير التاريخ يدوياً
 */
function changeDatePrompt() {
  const d = prompt('أدخل التاريخ (YYYY-MM-DD):', store._state.currentDate);
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
    store.set('currentDate', d.trim());
    updateDates();
    if (typeof loadTodayData === 'function') {
      loadTodayData().then(() => {
        if (typeof renderPage === 'function') renderPage(window._activePage || 'dashboard');
      });
    }
  } else if (d) {
    if (typeof Toast !== 'undefined') Toast.warning('صيغة التاريخ يجب أن تكون YYYY-MM-DD');
  }
}

/**
 * تحديث عرض التاريخ في كل عناصر الصفحة
 */
function updateDates() {
  const d = (typeof store !== 'undefined')
    ? store._state.currentDate
    : new Date().toISOString().slice(0,10);

  const displayDate = new Date(d).toLocaleDateString('ar-EG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  ['headerDate','sales-badge','col-badge','exp-badge','tarhil-badge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = displayDate;
  });

  // تحديث tarhil date picker
  const picker = document.getElementById('tarhil-date-picker');
  if (picker && !picker.value) picker.value = d;
}

/**
 * عرض قائمة المستخدم
 */
function showUserMenu() {
  const meta      = currentUser;
  const roleNames = { owner:'مالك', admin:'مدير', accountant:'محاسب', worker:'عامل' };
  const subNames  = { trial:'تجربة مجانية', monthly:'مشترك شهري', yearly:'مشترك سنوي', expired:'منتهي' };
  const el = document.getElementById('user-info');
  if (!el) return;
  el.innerHTML = `
    <div style="display:grid;gap:6px;font-size:0.84rem">
      <div><strong>الاسم:</strong>      ${meta?.full_name    || '-'}</div>
      <div><strong>البريد:</strong>     ${meta?.email        || '-'}</div>
      <div><strong>الشركة:</strong>     ${meta?.company_name || '-'}</div>
      <div><strong>الدور:</strong>      ${roleNames[meta?.role]  || meta?.role  || '-'}</div>
      <div><strong>الاشتراك:</strong>   ${subNames[meta?.subscription] || meta?.subscription || '-'}</div>
    </div>`;
  document.getElementById('user-modal')?.classList.add('open');
}
