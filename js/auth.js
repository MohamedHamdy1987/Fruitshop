// ============================================================
// auth.js — نسخة مُصلحة
// إصلاح: _setupUserData تتعامل مع RLS بشكل صحيح
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
  document.getElementById('app').style.display = 'none';
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

    if (error) {
      const m = error.message || '';
      if (m.includes('Invalid') || m.includes('invalid') || m.includes('credentials') || m.includes('password')) {
        showAuthErr('كلمة المرور أو البريد غير صحيح');
      } else if (m.includes('Email not confirmed')) {
        showAuthErr('يرجى تأكيد بريدك الإلكتروني أولاً — تحقق من inbox أو spam');
      } else {
        showAuthErr('خطأ: ' + m);
      }
      return;
    }

    currentUser = data.user;
    await loadUserProfile();

    // ✅ تأكد من وجود company_id قبل المتابعة
    if (!currentUser.company_id) {
      console.warn('company_id غير موجود — محاولة إنشاء شركة...');
      await _setupUserData(currentUser, null);
    }

    await showApp();

  } catch (e) {
    showAuthErr('خطأ في الاتصال — تحقق من الإنترنت');
    console.error('doLogin:', e);
  } finally {
    btn.disabled = false; btn.textContent = '🔑 دخول';
  }
}

// ─── إنشاء حساب جديد ─────────────────────────────────────────
async function doRegister() {
  const shop  = document.getElementById('reg-shop').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;

  if (!shop)           return showAuthErr('أدخل اسم المحل');
  if (!email)          return showAuthErr('أدخل البريد الإلكتروني');
  if (!pass)           return showAuthErr('أدخل كلمة المرور');
  if (pass !== pass2)  return showAuthErr('كلمة المرور غير متطابقة');
  if (pass.length < 6) return showAuthErr('كلمة المرور 6 أحرف على الأقل');

  const btn = document.getElementById('reg-btn');
  btn.disabled = true; btn.textContent = 'جاري الإنشاء...';

  try {
    const { data, error } = await sb.auth.signUp({ email, password: pass });

    const errMsg    = error?.message || '';
    const isDbError = errMsg.includes('Database error') || errMsg.includes('database');
    const isExisting = errMsg.includes('already') || errMsg.includes('registered') ||
                       errMsg.includes('User already');

    if (isExisting) {
      showAuthErr('هذا البريد مسجّل — جاري تسجيل الدخول تلقائياً...');
      const { data: ld, error: le } = await sb.auth.signInWithPassword({ email, password: pass });
      if (le) { showAuthErr('البريد مسجّل بكلمة مرور مختلفة'); return; }
      currentUser = ld.user;
      await _setupUserData(currentUser, shop);
      await showApp();
      return;
    }

    if (isDbError) {
      await new Promise(r => setTimeout(r, 1500));
      const { data: ld, error: le } = await sb.auth.signInWithPassword({ email, password: pass });
      if (!le && ld?.user) {
        currentUser = ld.user;
        await _setupUserData(currentUser, shop);
        await showApp();
        return;
      }
      showAuthErr('خطأ في قاعدة البيانات. تأكد من تنفيذ FIX_RLS.sql في Supabase ثم حاول مجدداً');
      return;
    }

    if (error) {
      showAuthErr('خطأ: ' + errMsg);
      return;
    }

    if (data?.user) {
      currentUser = data.user;
      await _setupUserData(currentUser, shop);
      await showApp();
      Toast.success('مرحباً بك! تجربة مجانية ١٤ يوم');
    } else {
      showAuthErr('تم إرسال رسالة تأكيد لبريدك — افتح الرسالة واضغط الرابط ثم ادخل');
    }

  } catch (e) {
    console.error('doRegister:', e);
    showAuthErr('خطأ غير متوقع: ' + (e?.message || e));
  } finally {
    btn.disabled = false; btn.textContent = '✅ إنشاء حساب';
  }
}

// ─── إعداد بيانات المستخدم — النسخة المُصلحة ─────────────────
async function _setupUserData(user, shopName) {
  const displayName = shopName || user.user_metadata?.shop_name ||
                      user.email?.split('@')[0] || 'محل';
  try {
    // ─── 1. ابحث عن شركة موجودة ───────────────────────────
    const { data: co, error: coErr } = await sb.from('companies')
      .select('id, name, subscription, trial_ends, sub_ends')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (coErr) {
      console.error('companies select error:', coErr.message);
    }

    let companyId;

    if (co) {
      // ─── شركة موجودة ───────────────────────────────────
      companyId = co.id;
      currentUser.company_id   = companyId;
      currentUser.company_name = co.name;
      currentUser.subscription = co.subscription || 'trial';
      currentUser.trial_ends   = co.trial_ends;
      currentUser.sub_ends     = co.sub_ends;

    } else {
      // ─── إنشاء شركة جديدة ──────────────────────────────
      console.log('إنشاء شركة جديدة...');
      const { data: newCo, error: ce } = await sb.from('companies').insert({
        name:         displayName,
        owner_id:     user.id,
        subscription: 'trial',
        trial_ends:   new Date(Date.now() + 14 * 864e5).toISOString()
      }).select().single();

      if (ce) {
        // ✅ الإصلاح: لو فشل INSERT، ابحث مجدداً — قد تكون موجودة بالفعل
        console.error('companies insert error:', ce.message, ce.code);

        // حاول جلب الشركة مرة ثانية (قد يكون race condition)
        const { data: retry } = await sb.from('companies')
          .select('id, name, subscription, trial_ends')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (retry) {
          companyId = retry.id;
          currentUser.company_id   = companyId;
          currentUser.company_name = retry.name;
          currentUser.subscription = retry.subscription || 'trial';
          currentUser.trial_ends   = retry.trial_ends;
        } else {
          // ✅ لا تضع company_id = user.id أبداً — هذا كان سبب المشكلة
          console.error('❌ فشل إنشاء الشركة ولم توجد — تحقق من RLS policies');
          showAuthErr('خطأ في إعداد الحساب. تأكد من تنفيذ FIX_RLS.sql في Supabase');
          return false;
        }
      } else {
        companyId = newCo.id;
        currentUser.company_id   = companyId;
        currentUser.company_name = displayName;
        currentUser.subscription = 'trial';
        currentUser.trial_ends   = newCo.trial_ends;
      }
    }

    // ─── 2. حفظ/تحديث profile ────────────────────────────
    const { error: profErr } = await sb.from('profiles').upsert({
      id:         user.id,
      company_id: companyId,
      full_name:  displayName,
      role:       'owner',
      is_active:  true
    }, { onConflict: 'id' });

    if (profErr) {
      console.error('profiles upsert error:', profErr.message);
    }

    currentUser.role      = 'owner';
    currentUser.full_name = displayName;

    console.log('✅ _setupUserData done:', { displayName, companyId });
    return true;

  } catch (e) {
    console.error('_setupUserData exception:', e);
    // ✅ لا نضع company_id = user.id أبداً
    showAuthErr('خطأ في إعداد الحساب: ' + (e?.message || e));
    return false;
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
  if (sub === 'monthly' || sub === 'yearly') { banner.style.display = 'none'; return; }
  const ends = currentUser.trial_ends || currentUser.sub_ends;
  const days = ends ? Math.ceil((new Date(ends) - Date.now()) / 864e5) : 14;
  banner.style.display    = 'block';
  banner.style.background = days > 0
    ? 'linear-gradient(135deg,#f39c12,#e67e22)'
    : 'linear-gradient(135deg,#c0392b,#e74c3c)';
  text.textContent = days > 0
    ? `تجربة مجانية — متبقي ${days} يوم`
    : 'انتهت التجربة — اشترك الآن';
}

function updateAdminTabVisibility() {
  const t = document.getElementById('adminTabBtn');
  if (t) t.style.display =
    (currentUser?.role === 'owner' || currentUser?.role === 'admin') ? '' : 'none';
}
