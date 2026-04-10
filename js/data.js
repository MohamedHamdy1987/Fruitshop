// ===================== data.js — نسخة محلية بسيطة (بدون سحابة) =====================

// Supabase معطل مؤقتاً
const sb = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithPassword: async () => ({ data: null, error: new Error("محلي") }),
    signUp: async () => ({ data: null, error: new Error("محلي") }),
    signOut: async () => ({ error: null })
  },
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    insert: async () => ({ error: null }),
    upsert: async () => ({ error: null })
  })
};

// إدارة التخزين المحلي
const store = {
  _state: null,
  init() {
    const saved = localStorage.getItem('veg_state');
    if (saved) {
      try {
        this._state = JSON.parse(saved);
      } catch(e) {
        this._state = this._getDefaultState();
      }
    } else {
      this._state = this._getDefaultState();
    }
    this._normalize();
  },
  _getDefaultState() {
    return {
      date: new Date().toLocaleDateString('ar-EG'),
      products: [],
      customers: [],
      suppliers: [],
      invoices: [],
      collections: [],
      expenses: [],
      tarhilLog: {},
      employees: [],
      partners: [],
      shops: []
    };
  },
  _normalize() {
    const st = this._state;
    if (!st.customers) st.customers = [];
    if (!st.suppliers) st.suppliers = [];
    if (!st.products) st.products = [];
    if (!st.invoices) st.invoices = [];
    if (!st.collections) st.collections = [];
    if (!st.expenses) st.expenses = [];
    if (!st.tarhilLog) st.tarhilLog = {};
    if (!st.employees) st.employees = [];
    if (!st.partners) st.partners = [];
    if (!st.shops) st.shops = [];
    if (!st.date) st.date = new Date().toLocaleDateString('ar-EG');
  },
  get state() { return this._state; },
  set(updater) {
    try {
      updater(this._state);
      this._persist();
    } catch(e) { console.error(e); }
  },
  replace(newState) {
    this._state = newState;
    this._normalize();
    this._persist();
  },
  _persist() {
    localStorage.setItem('veg_state', JSON.stringify(this._state));
  },
  serialize() { return JSON.stringify(this._state); }
};

const S = store.state;
let currentUser = null;
let xProd = null;

const AppError = {
  log(context, error) { console.error(context, error); },
  supabase(context, error) { console.error(context, error); }
};

const syncUI = {
  setStatus(status, msg) {
    document.dispatchEvent(new CustomEvent('sync-status', { detail: { status, msg } }));
  }
};

async function loadUserData() {}
function save() { store._persist(); }
function saveData() {}

// دوال المصادقة المحلية
window.doLogin = function() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  if (!email || !pass) {
    alert("أدخل البريد وكلمة المرور");
    return;
  }
  currentUser = { email: email, id: "local-user", user_metadata: { shop_name: "محلي" } };
  localStorage.setItem('veg_user', JSON.stringify(currentUser));
  showApp();
};

window.doRegister = function() {
  const shop = document.getElementById('reg-shop').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;
  if (!shop || !email || !pass) return alert("أكمل جميع البيانات");
  if (pass !== pass2) return alert("كلمة المرور غير متطابقة");
  currentUser = { email: email, id: "local-" + Date.now(), user_metadata: { shop_name: shop } };
  localStorage.setItem('veg_user', JSON.stringify(currentUser));
  showApp();
};

window.doLogout = function() {
  currentUser = null;
  localStorage.removeItem('veg_user');
  showAuth();
};

// التحقق من وجود مستخدم محلي سابق
const savedUser = localStorage.getItem('veg_user');
if (savedUser) {
  try { currentUser = JSON.parse(savedUser); } catch(e) {}
}

store.init();

window.S = S;
window.store = store;
window.save = save;
window.currentUser = currentUser;
