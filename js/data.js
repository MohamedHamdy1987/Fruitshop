// ============================================================
// js/data.js — نسخة معدلة جذرياً (تجاوز مشكلة company_id)
// ============================================================

const SUPABASE_URL = 'https://clwedhwbwcdjmnzvlkwo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsd2VkaHdid2Nkam1uenZsa3dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5OTI3NjMsImV4cCI6MjA5MTU2ODc2M30.r6T-eiH4AVlW5VV_6yl2JVBljl7Jj262hkFdfIM2Wg0';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;

const store = {
  _state: {
    inventory: [], customers: [], suppliers: [], products: [],
    employees: [], partners: [], shops: [], sales: [], payments: [], invoices: [],
    currentDate: new Date().toISOString().slice(0,10),
    activeProduct: null, isLoading: false, lastSync: null
  },
  get state() { return this._state; },
  get inv() { return this._state.inventory; },
  get custs() { return this._state.customers; },
  get supps() { return this._state.suppliers; },
  get prods() { return this._state.products; },
  get emps() { return this._state.employees; },
  get parts() { return this._state.partners; },
  get shps() { return this._state.shops; },
  get sales() { return this._state.sales; },
  get pays() { return this._state.payments; },
  get invs() { return this._state.invoices; },
  set(key, value) { if (key in this._state) this._state[key] = value; else console.error('Invalid key', key); },
  setLoading(v) { this._state.isLoading = v; },
  reset() { for (let k in this._state) if (Array.isArray(this._state[k])) this._state[k] = []; if (typeof Cache !== 'undefined') Cache.clear(); }
};

const S = store._state;

const AppError = {
  log(context, error, notifyUser = false) {
    console.error(`[${context}]`, error);
    if (notifyUser && typeof Toast !== 'undefined') Toast.error(error?.message || 'خطأ');
  }
};

const Toast = {
  _container: null,
  _getContainer() { if (!this._container) this._container = document.getElementById('toast-container'); return this._container; },
  show(msg, type = 'info', duration = 3500) {
    const c = this._getContainer(); if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    t.innerHTML = `${icons[type]||'ℹ️'}${msg}`;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, duration);
  },
  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error', 5000); },
  warning(msg) { this.show(msg, 'warning'); },
  info(msg) { this.show(msg, 'info'); }
};

const syncUI = { setStatus(status, msg) { window.dispatchEvent(new CustomEvent('sync-status', { detail: { status, msg } })); } };

async function loadAppData() {
  if (!currentUser) return;
  store.setLoading(true);
  syncUI.setStatus('saving', 'جاري تحميل البيانات...');
  try {
    // جلب company_id مباشرة إذا لم يكن موجوداً
    if (!currentUser.company_id) {
      const { data: prof } = await sb.from('profiles').select('company_id').eq('id', currentUser.id).single();
      if (prof) currentUser.company_id = prof.company_id;
      else throw new Error('لا يوجد بروفايل للمستخدم');
    }
    const [customers, suppliers, products, employees, partners, shops, invoices] = await Promise.all([
      API.customers.list(), API.suppliers.list(), API.products.list(),
      API.employees.list(), API.partners.list(), API.shops.list(), API.invoices.list()
    ]);
    store.set('customers', customers || []);
    store.set('suppliers', suppliers || []);
    store.set('products', products || []);
    store.set('employees', employees || []);
    store.set('partners', partners || []);
    store.set('shops', shops || []);
    store.set('invoices', invoices || []);
    await loadTodayData();
    store._state.lastSync = new Date().toISOString();
    syncUI.setStatus('', 'محفوظ على السحابة ✓');
  } catch(e) { AppError.log('loadAppData', e); syncUI.setStatus('error', 'خطأ في تحميل البيانات'); }
  finally { store.setLoading(false); }
}

async function loadTodayData() {
  const today = store._state.currentDate;
  const [inventory, sales, payments] = await Promise.all([
    API.inventory.list(), API.sales.list(today), API.payments.list(today)
  ]);
  store.set('inventory', inventory || []);
  store.set('sales', sales || []);
  store.set('payments', payments || []);
}

async function loadUserProfile() {
  try {
    const profile = await API.company.getProfile();
    if (profile) {
      currentUser.company_id = profile.company_id;
      currentUser.role = profile.role;
      currentUser.full_name = profile.full_name;
      currentUser.company_name = profile.company?.name;
      currentUser.subscription = profile.company?.subscription;
      currentUser.trial_ends = profile.company?.trial_ends;
      currentUser.sub_ends = profile.company?.sub_ends;
    } else {
      // محاولة بديلة: جلب company_id مباشرة
      const { data: prof } = await sb.from('profiles').select('company_id').eq('id', currentUser.id).single();
      if (prof) currentUser.company_id = prof.company_id;
    }
  } catch(e) { AppError.log('loadUserProfile', e); }
}

const RBAC = {
  can(action) {
    const role = currentUser?.role;
    if (!role) return false;
    const permissions = { owner: ['*'], admin: ['read','write','delete','manage_employees','manage_partners'], accountant: ['read','write','invoices','payments','reports'], worker: ['read','sales','inventory_add'] };
    const perms = permissions[role] || [];
    return perms.includes('*') || perms.includes(action);
  },
  requireRole(roles, action) { if (!this.can(action)) { Toast.error('ليس لديك صلاحية'); return false; } return true; }
};

function refreshLocal(key, newData) { store.set(key, newData); if (typeof Cache !== 'undefined') Cache.invalidate(key); }