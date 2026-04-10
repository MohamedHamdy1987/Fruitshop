// ============================================================
// js/auth.js — المصادقة (نسخة محسّنة — بدون Trigger dependency)
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
  if (typeof store !== 'undefined') store.reset();
}

// ─── تسجيل الدخول ────────────────────────────────────────────
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
    const msg = e?.message || '';
    if (msg.includes('Invalid') || msg.includes('invalid') || msg.includes('credentials') || msg.includes('password')) {
      showAuthErr('كلمة المرور أو البريد الإلكتروني غير صحيح');
    } else if (msg.includes('Email not confirmed')) {
      showAuthErr('يرجى تأكيد بريدك الإلكتروني أولاً');
    } else {
      showAuthErr('خطأ في الاتصال — تحقق من الإنترنت وحاول مجدداً');
    }
    console.error('doLogin error:', e);
  } finally {
    btn.disabled = false; btn.textContent = '🔑 دخول';
  }
}

// ─── إنشاء حساب جديد (بدون Trigger — كل شيء يدوياً) ─────────
async function doRegister() {
  const shop  = document.getElementById('reg-shop').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;

  if (!shop)           return showAuthErr('أدخل اسم المحل');
  if (!email)          return showAuthErr('أدخل البريد الإلكتروني');
  if (!pass)           return showAuthErr('أدخل كلمة المرور');
  if (pass !== pass2)  return showAuthErr('كلمة المرور غير متطابقة');
  if (pass.length < 6) return showAuthErr('كلمة المرور أقل من 6 أحرف');

  const btn = document.getElementById('reg-btn');
  btn.disabled = true; btn.textContent = 'جاري الإنشاء...';

  try {
    // ── الخطوة 1: تسجيل المستخدم في Supabase Auth فقط ──────
    // بدون options.data لتجنب أي trigger يفشل
    const { data, error: signupErr } = await sb.auth.signUp({
      email,
      password: pass
    });

    if (signupErr) {
      // معالجة أخطاء التسجيل المحددة
      const msg = signupErr.message || '';
      if (msg.includes('already') || msg.includes('registered')) {
        showAuthErr('هذا البريد مسجّل بالفعل — جرّب تسجيل الدخول');
      } else if (msg.includes('Database error')) {
        // الـ Trigger فاشل — نتجاهله ونكمل يدوياً
        console.warn('Trigger failed, continuing manually...');
        // محاولة تسجيل دخول مباشر (المستخدم ربما اتسجل فعلاً)
        const { data: loginData, error: loginErr } = await sb.auth.signInWithPassword({ email, password: pass });
        if (!loginErr && loginData?.user) {
          currentUser = loginData.user;
          await _setupUserData(currentUser, shop);
          await showApp();
          Toast.success(`مرحباً! تم إنشاء الحساب`);
          return;
        }
        showAuthErr('حدث خطأ في قاعدة البيانات — يرجى تنفيذ QUICK_START.sql في Supabase أولاً');
      } else {
        showAuthErr('حدث خطأ: ' + msg);
      }
      return;
    }

    // ── الخطوة 2: إعداد بيانات المستخدم يدوياً ──────────────
    if (data?.user) {
      currentUser = data.user;
      await _setupUserData(currentUser, shop);
      await showApp();
      Toast.success(`مرحباً بك في ${shop}!`);
    } else {
      // Supabase أرسل confirmation email — المستخدم محتاج يأكد
      showAuthErr('تم إرسال رسالة تأكيد لبريدك — تحقق منه ثم ادخل');
    }

  } catch (e) {
    console.error('doRegister error:', e);
    showAuthErr('حدث خطأ غير متوقع: ' + (e?.message || ''));
  } finally {
    btn.disabled = false; btn.textContent = '✅ إنشاء حساب';
  }
}

// ─── إعداد بيانات المستخدم في الجداول (بدون Trigger) ──────────
async function _setupUserData(user, shopName) {
  try {
    const displayName = shopName || user.email?.split('@')[0] || 'محل';

    // 1. هل عنده شركة بالفعل؟
    const { data: existingCompany } = await sb
      .from('companies')
      .select('id, name, subscription, trial_ends')
      .eq('owner_id', user.id)
      .maybeSingle();

    let companyId;

    if (existingCompany) {
      companyId = existingCompany.id;
      currentUser.company_id   = companyId;
      currentUser.company_name = existingCompany.name;
      currentUser.subscription = existingCompany.subscription || 'trial';
      currentUser.trial_ends   = existingCompany.trial_ends;
    } else {
      // 2. إنشاء شركة جديدة
      const { data: newCompany, error: companyErr } = await sb
        .from('companies')
        .insert({
          name:         displayName,
          owner_id:     user.id,
          subscription: 'trial',
          trial_ends:   new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      if (companyErr) {
        console.error('Cannot create company:', companyErr);
        // استخدام user.id مؤقتاً
        currentUser.company_id   = user.id;
        currentUser.company_name = displayName;
        currentUser.subscription = 'trial';
        currentUser.role         = 'owner';
        return;
      }

      companyId = newCompany.id;
      currentUser.company_id   = companyId;
      currentUser.company_name = displayName;
      currentUser.subscription = 'trial';
      currentUser.trial_ends   = newCompany.trial_ends;
    }

    // 3. إنشاء أو تحديث الـ profile
    const { error: profileErr } = await sb
      .from('profiles')
      .upsert({
        id:         user.id,
        company_id: companyId,
        full_name:  displayName,
        role:       'owner',
        is_active:  true
      }, { onConflict: 'id' });

    if (profileErr) {
      console.error('Cannot create profile:', profileErr);
    }

    currentUser.role      = 'owner';
    currentUser.full_name = displayName;

    console.log('✅ User setup complete:', displayName, companyId);

  } catch (e) {
    console.error('_setupUserData error:', e);
    // Fallback: استخدم user.id كـ company_id
    currentUser.company_id   = user.id;
    currentUser.company_name = shopName || 'محلي';
    currentUser.role         = 'owner';
    currentUser.subscription = 'trial';
  }
}

// ─── تسجيل الخروج ────────────────────────────────────────────
async function doLogout() {
  try { await sb.auth.signOut(); } catch(e) {}
  currentUser = null;
  if (typeof store !== 'undefined') store.reset();
  closeModal('user-modal');
  showAuth();
}

// ─── فحص التجربة المجانية ────────────────────────────────────
function checkTrial() {
  if (!currentUser) return;
  const banner = document.getElementById('trial-banner');
  const text   = document.getElementById('trial-text');
  if (!banner || !text) return;

  const sub  = currentUser.subscription || 'trial';
  const ends = currentUser.trial_ends || currentUser.sub_ends;

  if (sub === 'monthly' || sub === 'yearly') {
    banner.style.display = 'none';
    return;
  }

  if (sub === 'trial') {
    const days = ends ? Math.ceil((new Date(ends) - Date.now()) / 86400000) : 14;
    banner.style.display    = 'block';
    banner.style.background = 'linear-gradient(135deg,#f39c12,#e67e22)';
    text.textContent = days > 0
      ? `تجربة مجانية — متبقي ${days} يوم`
      : 'انتهت التجربة — اشترك الآن';
  } else {
    banner.style.display    = 'block';
    banner.style.background = 'linear-gradient(135deg,#c0392b,#e74c3c)';
    text.textContent        = 'انتهى اشتراكك — جدّد الآن';
  }
}

function updateAdminTabVisibility() {
  const adminTab = document.getElementById('adminTabBtn');
  if (!adminTab) return;
  adminTab.style.display = (currentUser?.role === 'owner' || currentUser?.role === 'admin') ? '' : 'none';
}
