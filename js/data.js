// ============================================================
// js/data.js — طبقة البيانات والحالة المركزية
// ============================================================

const SUPABASE_URL = 'https://lfhrorjiukzkqhafjtdd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaHJvcmppdWt6a3FoYWZqdGRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTc3NTgsImV4cCI6MjA5MDM3Mzc1OH0.eQ0w4DG_-DNvnJRJxgvJ7KhNNkBhOEswQhtbiO2my3Q';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── State ───────────────────────────────────────────────────
const store = {
  _state: {
    inventory: [], customers: [], suppliers: [], products: [],
    employees: [], partners: [], shops: [], sales: [], payments: [],
    invoices: [], currentDate: new Date().toISOString().slice(0,10),
    activeProduct: null, isLoading: false, lastSync: null
  },
  get state()  { return this._state; },
  get inv()    { return this._state.inventory; },
  get custs()  { return this._state.customers; },
  get supps()  { return this._state.suppliers; },
  get prods()  { return this._state.products; },
  get emps()   { return this._state.employees; },
  get parts()  { return this._state.partners; },
  get shps()   { return this._state.shops; },
  get sales()  { return this._state.sales; },
  get pays()   { return this._state.payments; },
  get invs()   { return this._state.invoices; },
  set(key, value) { if (key in this._state) this._state[key] = value; },
  setLoading(v)   { this._state.isLoading = v; },
  reset() {
    ['inventory','customers','suppliers','products','employees',
     'partners','shops','sales','payments','invoices'].forEach(k => this._state[k]=[]);
    Cache.clear();
  }
};

// اختصار للتوافق مع الكود القديم
const S = store._state;

// ─── المستخدم الحالي ─────────────────────────────────────────
let currentUser = null;
let xProd = null;

// ─── معالجة الأخطاء ─────────────────────────────────────────
const AppError = {
  log(context, error, notifyUser = false) {
    const msg = error?.message || String(error);
    console.error(`[${context}]`, msg, error);
    if (notifyUser) Toast.error(`خطأ: ${msg}`);
  },
  async handle(context, fn) {
    try { return await fn(); }
    catch (e) { this.log(context, e, true); return null; }
  }
};

// ─── Toast ───────────────────────────────────────────────────
const Toast = {
  _c: null,
  _get() { return this._c || (this._c = document.getElementById('toast-container')); },
  show(msg, type='info', dur=3500) {
    const c = this._get(); if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    t.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span class="toast-msg">${msg}</span>`;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(()=>t.remove(),350); }, dur);
  },
  success(msg) { this.show(msg,'success'); },
  error(msg)   { this.show(msg,'error',5000); },
  warning(msg) { this.show(msg,'warning'); },
  info(msg)    { this.show(msg,'info'); }
};

// ─── Sync Status ─────────────────────────────────────────────
const syncUI = {
  setStatus(status, msg) {
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status, msg } }));
  }
};

// ─── تحميل Profile مع Fallback ──────────────────────────────
async function loadUserProfile() {
  if (!currentUser?.id) return;
  try {
    // محاولة جلب الـ profile
    const { data: profile, error } = await sb
      .from('profiles')
      .select('*, company:companies(*)')
      .eq('id', currentUser.id)
      .maybeSingle();   // maybeSingle بدل single — لا يرمي error لو فاضي

    if (profile) {
      // profile موجود — استخدمه
      currentUser.company_id   = profile.company_id;
      currentUser.role         = profile.role || 'owner';
      currentUser.full_name    = profile.full_name;
      currentUser.company_name = profile.company?.name;
      currentUser.subscription = profile.company?.subscription || 'trial';
      currentUser.trial_ends   = profile.company?.trial_ends;
      currentUser.sub_ends     = profile.company?.sub_ends;
      console.log('✅ Profile loaded:', currentUser.company_name, '| Role:', currentUser.role);
    } else {
      // لا يوجد profile — إنشاء شركة وprofile تلقائياً
      console.warn('⚠️ No profile found — creating company automatically...');
      await _createCompanyAndProfile();
    }
  } catch (e) {
    console.error('loadUserProfile error:', e);
    // Fallback أخير: إنشاء شركة
    await _createCompanyAndProfile();
  }
}

// ─── إنشاء شركة وprofile تلقائياً ───────────────────────────
async function _createCompanyAndProfile() {
  try {
    const shopName = currentUser.user_metadata?.shop_name ||
                     currentUser.email?.split('@')[0] ||
                     'محل جديد';

    // 1. إنشاء شركة
    const { data: company, error: cErr } = await sb
      .from('companies')
      .insert({
        name:         shopName,
        owner_id:     currentUser.id,
        subscription: 'trial',
        trial_ends:   new Date(Date.now() + 14*86400000).toISOString()
      })
      .select()
      .single();

    if (cErr) {
      // الشركة موجودة بالفعل؟ اجلبها
      if (cErr.code === '23505') {
        const { data: existing } = await sb
          .from('companies')
          .select('*')
          .eq('owner_id', currentUser.id)
          .maybeSingle();
        if (existing) {
          currentUser.company_id   = existing.id;
          currentUser.company_name = existing.name;
          currentUser.subscription = existing.subscription || 'trial';
          await _ensureProfile(existing.id, shopName);
          return;
        }
      }
      throw cErr;
    }

    currentUser.company_id   = company.id;
    currentUser.company_name = company.name;
    currentUser.subscription = 'trial';
    currentUser.role         = 'owner';

    // 2. إنشاء profile
    await _ensureProfile(company.id, shopName);

    console.log('✅ Company & profile created:', shopName);
    Toast.success(`مرحباً! تم إنشاء شركتك: ${shopName}`);
  } catch (e) {
    console.error('_createCompanyAndProfile error:', e);

    // Fallback نهائي: استخدم user_metadata لو كل شيء فشل
    if (currentUser.user_metadata?.company_id) {
      currentUser.company_id = currentUser.user_metadata.company_id;
    } else {
      // آخر خيار: استخدم user.id كـ company_id مؤقت
      currentUser.company_id = currentUser.id;
      currentUser.company_name = currentUser.email?.split('@')[0] || 'محلي';
      currentUser.role = 'owner';
      console.warn('⚠️ Using user.id as temporary company_id');
      Toast.warning('تحذير: لم يتم إنشاء الشركة في قاعدة البيانات. تأكد من تنفيذ schema.sql');
    }
  }
}

async function _ensureProfile(companyId, fullName) {
  const { error } = await sb.from('profiles').upsert({
    id:         currentUser.id,
    company_id: companyId,
    full_name:  fullName,
    role:       'owner'
  }, { onConflict: 'id' });
  if (error) console.error('_ensureProfile error:', error);
  else currentUser.role = 'owner';
}

// ─── تحميل بيانات التطبيق ────────────────────────────────────
async function loadAppData() {
  if (!currentUser?.company_id) {
    console.error('loadAppData: no company_id!');
    Toast.error('خطأ: لا يوجد company_id. تأكد من تنفيذ schema.sql في Supabase');
    return;
  }

  store.setLoading(true);
  syncUI.setStatus('saving', 'جاري تحميل البيانات...');

  try {
    // تحميل بيانات أساسية — كل واحدة مستقلة لو فشلت
    const results = await Promise.allSettled([
      API.customers.list(),
      API.suppliers.list(),
      API.products.list(),
      API.employees.list(),
      API.partners.list(),
      API.shops.list(),
      API.invoices.list()
    ]);

    const [customers, suppliers, products, employees, partners, shops, invoices] = results.map(r =>
      r.status === 'fulfilled' ? (r.value || []) : []
    );

    store.set('customers', customers);
    store.set('suppliers', suppliers);
    store.set('products',  products);
    store.set('employees', employees);
    store.set('partners',  partners);
    store.set('shops',     shops);
    store.set('invoices',  invoices);

    await loadTodayData();
    store._state.lastSync = new Date().toISOString();
    syncUI.setStatus('', 'محفوظ على السحابة ✓');
  } catch (e) {
    AppError.log('loadAppData', e);
    syncUI.setStatus('error', 'خطأ في تحميل البيانات');
  } finally {
    store.setLoading(false);
  }
}

async function loadTodayData() {
  const today = store._state.currentDate;
  const results = await Promise.allSettled([
    API.inventory.list(),
    API.sales.list(today),
    API.payments.list(today)
  ]);
  const [inventory, sales, payments] = results.map(r =>
    r.status === 'fulfilled' ? (r.value || []) : []
  );
  store.set('inventory', inventory);
  store.set('sales',     sales);
  store.set('payments',  payments);
}

// ─── RBAC ────────────────────────────────────────────────────
const RBAC = {
  can(action) {
    const role = currentUser?.role;
    if (!role) return true; // لو مفيش role — اسمح بكل شيء مؤقتاً
    const permissions = {
      owner:      ['*'],
      admin:      ['read','write','delete','manage_employees','manage_partners'],
      accountant: ['read','write','invoices','payments','reports'],
      worker:     ['read','sales','inventory_add']
    };
    const perms = permissions[role] || ['*'];
    return perms.includes('*') || perms.includes(action);
  }
};

function refreshLocal(key, newData) {
  store.set(key, newData);
  Cache.invalidate(key);
}
