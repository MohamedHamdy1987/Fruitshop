// ============================================================
// js/data.js — طبقة البيانات والحالة المركزية
// ============================================================

// ─────────────────────────────────────────────────────────────
// Supabase Client
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://rfrrtfjbaeflyrbavbrg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmcnJ0ZmpiYWVmbHlyYmF2YnJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3Njk3NjYsImV4cCI6MjA5MTM0NTc2Nn0.K9Ho5imrtVUVEv0PiZObAYKIbmfBB2d6C9azv5wqAGw';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─────────────────────────────────────────────────────────────
// الحالة العامة للمستخدم
// ─────────────────────────────────────────────────────────────
let currentUser = null;  // { id, email, company_id, role, company_name, ... }

// ─────────────────────────────────────────────────────────────
// State Manager — البيانات المحلية المؤقتة (للأداء)
// البيانات الرئيسية الآن في قاعدة البيانات
// هذا فقط للـ cache والعمل offline
// ─────────────────────────────────────────────────────────────
const store = {
  _state: {
    // بيانات مؤقتة في الذاكرة (تُحمَّل من DB)
    inventory:    [],   // incoming_batches النشطة
    customers:    [],
    suppliers:    [],
    products:     [],
    employees:    [],
    partners:     [],
    shops:        [],
    sales:        [],   // مبيعات اليوم
    payments:     [],   // مدفوعات اليوم
    invoices:     [],

    // حالة الواجهة
    currentDate:  new Date().toISOString().slice(0,10),
    activeProduct: null,  // بدل xProd
    isLoading:    false,
    lastSync:     null
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

  set(key, value) {
    if (!(key in this._state)) {
      AppError.log('store.set', new Error(`مفتاح غير معروف: ${key}`));
      return;
    }
    this._state[key] = value;
  },

  setLoading(v) { this._state.isLoading = v; },

  reset() {
    this._state.inventory  = [];
    this._state.customers  = [];
    this._state.suppliers  = [];
    this._state.products   = [];
    this._state.employees  = [];
    this._state.partners   = [];
    this._state.shops      = [];
    this._state.sales      = [];
    this._state.payments   = [];
    this._state.invoices   = [];
    Cache.clear();
  }
};

// اختصار للتوافق مع الكود القديم
// S الآن يشير لـ store._state مباشرة
const S = store._state;

// ─────────────────────────────────────────────────────────────
// معالجة الأخطاء المركزية
// ─────────────────────────────────────────────────────────────
const AppError = {
  log(context, error, notifyUser = false) {
    const msg = error?.message || String(error);
    console.error(`[${context}]`, msg, error);
    if (notifyUser) Toast.error(`خطأ: ${msg}`);
  },

  async handle(context, fn) {
    try {
      return await fn();
    } catch (e) {
      this.log(context, e, true);
      return null;
    }
  }
};

// ─────────────────────────────────────────────────────────────
// نظام الـ Notifications (Toast)
// ─────────────────────────────────────────────────────────────
const Toast = {
  _container: null,

  _getContainer() {
    if (!this._container) {
      this._container = document.getElementById('toast-container');
    }
    return this._container;
  },

  show(msg, type = 'info', duration = 3500) {
    const c = this._getContainer();
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    t.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span class="toast-msg">${msg}</span>`;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 350);
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg)   { this.show(msg, 'error', 5000); },
  warning(msg) { this.show(msg, 'warning'); },
  info(msg)    { this.show(msg, 'info'); }
};

// ─────────────────────────────────────────────────────────────
// شريط المزامنة
// ─────────────────────────────────────────────────────────────
const syncUI = {
  setStatus(status, msg) {
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status, msg } }));
  }
};

// ─────────────────────────────────────────────────────────────
// تحميل البيانات من قاعدة البيانات
// ─────────────────────────────────────────────────────────────
async function loadAppData() {
  if (!currentUser?.company_id) return;
  store.setLoading(true);
  syncUI.setStatus('saving', 'جاري تحميل البيانات...');

  try {
    // تحميل البيانات الأساسية بالتوازي
    const [
      customers, suppliers, products,
      employees, partners, shops, invoices
    ] = await Promise.all([
      API.customers.list(),
      API.suppliers.list(),
      API.products.list(),
      API.employees.list(),
      API.partners.list(),
      API.shops.list(),
      API.invoices.list()
    ]);

    store.set('customers', customers || []);
    store.set('suppliers', suppliers || []);
    store.set('products',  products  || []);
    store.set('employees', employees || []);
    store.set('partners',  partners  || []);
    store.set('shops',     shops     || []);
    store.set('invoices',  invoices  || []);

    // تحميل بيانات اليوم
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
  const [inventory, sales, payments] = await Promise.all([
    API.inventory.list(),
    API.sales.list(today),
    API.payments.list(today)
  ]);
  store.set('inventory', inventory || []);
  store.set('sales',     sales     || []);
  store.set('payments',  payments  || []);
}

// ─────────────────────────────────────────────────────────────
// تحميل profile المستخدم وشركته
// ─────────────────────────────────────────────────────────────
async function loadUserProfile() {
  try {
    const profile = await API.company.getProfile();
    if (profile) {
      currentUser.company_id   = profile.company_id;
      currentUser.role         = profile.role;
      currentUser.full_name    = profile.full_name;
      currentUser.company_name = profile.company?.name;
      currentUser.subscription = profile.company?.subscription;
      currentUser.trial_ends   = profile.company?.trial_ends;
      currentUser.sub_ends     = profile.company?.sub_ends;
    }
  } catch (e) {
    AppError.log('loadUserProfile', e);
  }
}

// ─────────────────────────────────────────────────────────────
// RBAC — التحقق من الصلاحيات
// ─────────────────────────────────────────────────────────────
const RBAC = {
  can(action) {
    const role = currentUser?.role;
    if (!role) return false;

    const permissions = {
      owner:      ['*'],
      admin:      ['read','write','delete','manage_employees','manage_partners'],
      accountant: ['read','write','invoices','payments','reports'],
      worker:     ['read','sales','inventory_add']
    };

    const perms = permissions[role] || [];
    return perms.includes('*') || perms.includes(action);
  },

  requireRole(roles, action) {
    if (!this.can(action)) {
      Toast.error('ليس لديك صلاحية للقيام بهذه العملية');
      return false;
    }
    return true;
  }
};

// ─────────────────────────────────────────────────────────────
// دوال تحديث البيانات المحلية بعد العمليات
// ─────────────────────────────────────────────────────────────
function refreshLocal(key, newData) {
  store.set(key, newData);
  Cache.invalidate(key);
}
