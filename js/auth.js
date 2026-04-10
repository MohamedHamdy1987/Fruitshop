// ===================== auth.js — تسجيل الدخول والخروج والتسجيل (معدل) =====================

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('login-form').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('auth-err').classList.remove('show');
}

function showAuthErr(msg) {
  const el = document.getElementById('auth-err');
  if (el) {
    el.textContent = msg;
    el.classList.add('show');
  } else {
    alert(msg);
  }
}

function showAuth() {
  const authScreen = document.getElementById('auth-screen');
  const appEl = document.getElementById('app');
  if (authScreen) authScreen.style.display = 'flex';
  if (appEl) appEl.style.display = 'none';
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) return showAuthErr('أدخل البريد وكلمة المرور');

  const btn = document.getElementById('login-btn');
  btn.disabled    = true;
  btn.textContent = 'جاري الدخول...';

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    currentUser = data.user;
    
    // ✅ التأكد من وجود user_metadata.shop_name
    if (!currentUser.user_metadata) currentUser.user_metadata = {};
    if (!currentUser.user_metadata.shop_name) {
      currentUser.user_metadata.shop_name = 'محل افتراضي';
      // محاولة تحديث metadata في Supabase (قد لا تنجح إذا لم يكن المستخدم مشرفاً، لكنها لن تمنع العمل)
      try {
        await sb.auth.updateUser({ data: { shop_name: currentUser.user_metadata.shop_name } });
      } catch(e) { console.warn("Could not update user metadata", e); }
    }
    
    await loadUserData();
    showApp();
    if (typeof showToast === 'function') showToast('تم تسجيل الدخول بنجاح', 'success');
  } catch (e) {
    const isAuthErr = e?.message?.toLowerCase().includes('invalid') ||
                      e?.message?.toLowerCase().includes('credentials');
    showAuthErr(isAuthErr
      ? 'بريد إلكتروني أو كلمة مرور خاطئة'
      : 'خطأ في الاتصال، حاول مرة أخرى');
    AppError.log('doLogin', e);
  } finally {
    btn.disabled    = false;
    btn.textContent = '🔑 دخول';
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
  if (!isValidEmail(email))     return showAuthErr('بريد إلكتروني غير صحيح');

  const btn = document.getElementById('reg-btn');
  btn.disabled    = true;
  btn.textContent = 'جاري الإنشاء...';

  try {
    const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb.auth.signUp({
      email, password: pass,
      options: { data: { shop_name: shop, subscription: 'trial', trial_ends: trialEnds } }
    });
    if (error) throw error;
    currentUser = data.user;
    // تأكيد وجود shop_name
    if (!currentUser.user_metadata) currentUser.user_metadata = {};
    currentUser.user_metadata.shop_name = shop;
    await saveData();
    showApp();
    if (typeof showToast === 'function') showToast('تم إنشاء الحساب بنجاح', 'success');
  } catch (e) {
    const isExisting = e?.message?.toLowerCase().includes('already');
    showAuthErr(isExisting
      ? 'هذا البريد مسجّل بالفعل، جرّب تسجيل الدخول'
      : 'حدث خطأ: ' + (e?.message || 'تحقق من الاتصال'));
    AppError.log('doRegister', e);
  } finally {
    btn.disabled    = false;
    btn.textContent = '✅ إنشاء حساب مجاني';
  }
}

async function doLogout() {
  try {
    await sb.auth.signOut();
  } catch (e) {
    AppError.log('doLogout', e);
  }
  currentUser = null;
  closeModal('user-modal');
  showAuth();
}

function checkTrial() {
  if (!currentUser) return;
  const banner = document.getElementById('trial-banner');
  const text   = document.getElementById('trial-text');
  if (!banner || !text) return;
  const meta   = currentUser.user_metadata;
  if (meta?.subscription === 'trial') {
    const ends = new Date(meta.trial_ends || Date.now() + 14 * 24 * 60 * 60 * 1000);
    const days = Math.ceil((ends - Date.now()) / (1000 * 60 * 60 * 24));
    if (days > 0) {
      banner.style.display = 'block';
      text.textContent     = `متبقي ${days} يوم من التجربة المجانية`;
    } else {
      banner.style.display = 'none';
    }
  } else {
    banner.style.display = 'none';
  }
}
