// ============================================================
// js/auth.js — المصادقة وإدارة الجلسة
// ============================================================

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('login-form').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('auth-err').classList.remove('show');
}

function showAuthErr(msg) {
  const el = document.getElementById('auth-err');
  el.textContent = msg;
  el.classList.add('show');
}

function showAuth() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display         = 'none';
  store.reset();
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) return showAuthErr('أدخل البريد وكلمة المرور');

  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'جاري الدخول...';

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    currentUser = data.user;
    await loadUserProfile();
    await showApp();
  } catch (e) {
    const isAuthErr = e?.message?.toLowerCase().includes('invalid') ||
                      e?.message?.toLowerCase().includes('credentials');
    showAuthErr(isAuthErr ? 'بريد إلكتروني أو كلمة مرور خاطئة' : 'خطأ في الاتصال، حاول مرة أخرى');
    AppError.log('doLogin', e);
  } finally {
    btn.disabled = false; btn.textContent = '🔑 دخول';
  }
}

async function doRegister() {
  const shop  = document.getElementById('reg-shop').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;

  if (!shop || !email || !pass) return showAuthErr('أكمل جميع البيانات');
  if (pass !== pass2)           return showAuthErr('كلمة المرور غير متطابقة');
  if (pass.length < 8)          return showAuthErr('كلمة المرور أقل من ٨ أحرف');
  if (!email.includes('@'))     return showAuthErr('بريد إلكتروني غير صحيح');

  const btn = document.getElementById('reg-btn');
  btn.disabled = true; btn.textContent = 'جاري الإنشاء...';

  try {
    const { data, error } = await sb.auth.signUp({
      email, password: pass,
      options: { data: { shop_name: shop } }
    });
    if (error) throw error;
    currentUser = data.user;
    // Profile يُنشأ تلقائياً بـ Trigger في قاعدة البيانات
    await loadUserProfile();
    await showApp();
    Toast.success(`مرحباً بك في ${shop}! تجربة مجانية ١٤ يوم`);
  } catch (e) {
    const isExisting = e?.message?.toLowerCase().includes('already');
    showAuthErr(isExisting ? 'هذا البريد مسجّل بالفعل' : 'حدث خطأ: ' + (e?.message || ''));
    AppError.log('doRegister', e);
  } finally {
    btn.disabled = false; btn.textContent = '✅ إنشاء حساب مجاني';
  }
}

async function doLogout() {
  try { await sb.auth.signOut(); } catch(e) { AppError.log('logout', e); }
  currentUser = null;
  store.reset();
  closeModal('user-modal');
  showAuth();
}

function checkTrial() {
  if (!currentUser) return;
  const banner = document.getElementById('trial-banner');
  const text   = document.getElementById('trial-text');
  if (!banner) return;

  const sub = currentUser.subscription;
  if (sub === 'trial') {
    const ends = new Date(currentUser.trial_ends || Date.now() + 14*86400000);
    const days = Math.ceil((ends - Date.now()) / 86400000);
    if (days > 0) {
      banner.style.display = 'block';
      text.textContent     = `تجربة مجانية — متبقي ${days} يوم`;
    } else {
      banner.style.display = 'block';
      banner.style.background = 'linear-gradient(135deg,#c0392b,#e74c3c)';
      text.textContent = 'انتهت التجربة المجانية — اشترك الآن للاستمرار';
    }
  } else if (sub === 'expired') {
    banner.style.display = 'block';
    banner.style.background = 'linear-gradient(135deg,#c0392b,#e74c3c)';
    text.textContent = 'انتهى اشتراكك — جدّد الآن';
  } else {
    banner.style.display = 'none';
  }
}

function updateAdminTabVisibility() {
  // Super Admin Tab (لوحة إدارة SaaS)
  const adminTab = document.getElementById('adminTabBtn');
  if (adminTab) {
    const isSuperAdmin = currentUser?.email === 'admin@vegshop.com' ||
                         currentUser?.role === 'owner';
    adminTab.style.display = isSuperAdmin ? '' : 'none';
  }
}
