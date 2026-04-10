// ===================== utils.js — دوال مساعدة مشتركة ومحسّنة (نسخة متكاملة) =====================

/**
 * تنسيق التاريخ بالعربية (يوم، شهر، سنة)
 */
function fmtDate(d) {
  return d.toLocaleDateString('ar-EG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

/**
 * تنسيق التاريخ والوقت للاستخدام في السجلات
 */
function fmtDateTime(d) {
  return d.toLocaleString('ar-EG');
}

/**
 * تنسيق الأرقام بالعربية مع منزلتين عشريتين
 */
function N(n) {
  return (parseFloat(n) || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * تنسيق الرقم كعملة (بدون كسور)
 */
function currency(n) {
  return (parseFloat(n) || 0).toLocaleString('ar-EG') + ' جنيه';
}

/**
 * إغلاق مودال
 */
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

/**
 * فتح مودال
 */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
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
  const subStatus = 
    meta?.subscription === 'trial' ? 'تجربة مجانية' :
    meta?.subscription === 'active' ? 'مشترك' : 'منتهي';
  document.getElementById('user-info').innerHTML = `
    <div><strong>المحل:</strong> ${escapeHtml(meta?.shop_name || '-')}</div>
    <div><strong>البريد:</strong> ${escapeHtml(currentUser?.email || '-')}</div>
    <div><strong>الاشتراك:</strong> ${subStatus}</div>
  `;
  openModal('user-modal');
}

/**
 * عرض إشعار منبثق (toast)
 */
function showToast(msg, type = 'info') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(toastContainer);
  }
  const toast = document.createElement('div');
  const bgColor = type === 'success' ? '#1a6b38' : type === 'error' ? '#c0392b' : type === 'warning' ? '#f39c12' : '#1a5276';
  toast.style.cssText = `background:${bgColor};color:#fff;padding:10px 16px;border-radius:8px;font-size:0.85rem;max-width:300px;box-shadow:0 2px 10px rgba(0,0,0,0.2);animation:fadeInUp 0.3s ease;`;
  toast.textContent = msg;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

/**
 * تنبيه عادي مع fallback
 */
function alertMsg(msg, type = 'info') {
  if (typeof showToast === 'function') showToast(msg, type);
  else alert(msg);
}

/**
 * تأكيد المستخدم (Promise-based)
 */
function confirmMsg(msg) {
  return new Promise((resolve) => {
    const result = confirm(msg);
    resolve(result);
  });
}

/**
 * التحقق من صحة البريد الإلكتروني
 */
function isValidEmail(email) {
  return /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/.test(email);
}

/**
 * التحقق من صحة رقم الهاتف المصري
 */
function isValidPhone(phone) {
  return /^01[0-9]{9}$/.test(phone);
}

/**
 * ترميز HTML لمنع XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
    return c;
  });
}

/**
 * إنشاء معرف فريد
 */
function generateId() {
  return Date.now() + Math.floor(Math.random() * 10000);
}

/**
 * نسخ عميق لكائن
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * انتظار milliseconds (async)
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// إضافة أنماط للـ toasts إذا لم تكن موجودة
if (!document.querySelector('#toast-styles')) {
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}
