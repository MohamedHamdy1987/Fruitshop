// ===================== data.js — طبقة البيانات مع حفظ محلي آمن =====================

const SUPABASE_URL = 'https://lfhrorjiukzkqhafjtdd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaHJvcmppdWt6a3FoYWZqdGRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTc3NTgsImV4cCI6MjA5MDM3Mzc1OH0.eQ0w4DG_-DNvnJRJxgvJ7KhNNkBhOEswQhtbiO2my3Q';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─────────────────────────────────────────────
// 🗃️ State Manager
// ─────────────────────────────────────────────
const store = {
  _state: null,
  _version: 1,
  _saveTimer: null,

  init() {
    const saved = localStorage.getItem('veg_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this._state = parsed.state;
        this._version = parsed.version || 1;
      } catch(e) { 
        console.error('Failed to parse saved state', e);
        this._state = this._getDefaultState();
      }
    } else {
      this._state = this._getDefaultState();
    }
    this._normalize();
    this._persist();
  },

  _getDefaultState() {
    return {
      date: fmtDate(new Date()),
      products: [],
      customers: [],
      suppliers: [],
      invoices: [],
      collections: [],
      expenses: [],
      tarhilLog: {},
      employees: [],
      partners: [],
      shops: [],
      version: 1,
      lastUpdated: new Date().toISOString()
    };
  },

  _normalize() {
    const st = this._state;
    if (!st.employees)   st.employees = [];
    if (!st.partners)    st.partners = [];
    if (!st.shops)       st.shops = [];
    if (!st.tarhilLog)   st.tarhilLog = {};
    if (!st.collections) st.collections = [];
    if (!st.expenses)    st.expenses = [];
    if (!st.invoices)    st.invoices = [];
    if (!st.products)    st.products = [];
    if (!st.customers)   st.customers = [];
    if (!st.suppliers)   st.suppliers = [];
    if (!st.date)        st.date = fmtDate(new Date());
    if (!st.version)     st.version = 1;
    if (!st.lastUpdated) st.lastUpdated = new Date().toISOString();
    
    const now = new Date();
    for (const dateStr in st.tarhilLog) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime()) && (now - d) > 30 * 24 * 60 * 60 * 1000) {
        delete st.tarhilLog[dateStr];
      }
    }
  },

  get state() { return this._state; },

  set(updater) {
    try {
      updater(this._state);
      this._state.version = (this._state.version || 0) + 1;
      this._state.lastUpdated = new Date().toISOString();
      this._persist();
      this._scheduleSync();
    } catch (e) {
      console.error('store.set error', e);
    }
  },

  replace(newState) {
    this._state = newState;
    this._normalize();
    this._persist();
    this._scheduleSync();
  },

  _persist() {
    try {
      const toStore = {
        state: this._state,
        version: this._state.version
      };
      localStorage.setItem('veg_state', JSON.stringify(toStore));
      console.log('✅ Local save successful');
    } catch (e) {
      console.error('localStorage.save error', e);
    }
  },

  _scheduleSync() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => syncWithCloud(), 2000);
  },

  serialize() {
    return JSON.stringify(this._state);
  }
};

const S = store.state;
let currentUser = null;
let xProd = null;

const AppError = {
  log(context, error, notifyUser = false) {
    const msg = error?.message || String(error);
    console.error(`[${context}]`, msg, error);
    if (notifyUser && typeof showToast === 'function') {
      showToast(`خطأ: ${msg.substring(0, 100)}`, 'error');
    }
  },
  supabase(context, error) {
    console.error(`[Supabase/${context}]`, error?.message || error);
    if (typeof showToast === 'function') {
      showToast('خطأ في الاتصال بالسحابة - البيانات محفوظة محلياً', 'warning');
    }
  }
};

const syncUI = {
  setStatus(status, msg) {
    document.dispatchEvent(new CustomEvent('sync-status', {
      detail: { status, msg }
    }));
  }
};

let syncInProgress = false;

async function syncWithCloud() {
  if (!currentUser) return;
  if (syncInProgress) return;
  syncInProgress = true;
  try {
    syncUI.setStatus('saving', 'جاري المزامنة...');
    const { data: remoteData, error: fetchError } = await sb
      .from('shop_data')
      .select('data, updated_at, version')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
    let localVersion = S.version || 1;
    let remoteVersion = remoteData?.version || 0;
    let localUpdated = new Date(S.lastUpdated || 0);
    let remoteUpdated = new Date(remoteData?.updated_at || 0);
    if (remoteUpdated > localUpdated && remoteData?.data) {
      store.replace(JSON.parse(remoteData.data));
      syncUI.setStatus('', 'تم التحديث من السحابة');
    } else if (localUpdated > remoteUpdated) {
      const { error: upsertError } = await sb
        .from('shop_data')
        .upsert({
          user_id: currentUser.id,
          data: store.serialize(),
          version: localVersion + 1,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      if (upsertError) throw upsertError;
      S.version = localVersion + 1;
      S.lastUpdated = new Date().toISOString();
      store._persist();
      syncUI.setStatus('', 'محفوظ على السحابة ✓');
    } else {
      syncUI.setStatus('', 'محفوظ على السحابة ✓');
    }
  } catch (e) {
    AppError.supabase('syncWithCloud', e);
    syncUI.setStatus('error', 'خطأ في المزامنة');
  } finally {
    syncInProgress = false;
  }
}

async function loadUserData() {
  if (!currentUser) return;
  syncUI.setStatus('saving', 'جاري التحميل من السحابة...');
  try {
    const { data, error } = await sb
      .from('shop_data')
      .select('data, version, updated_at')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    if (data?.data) {
      const remoteState = JSON.parse(data.data);
      const localState = store.state;
      const remoteUpdated = new Date(data.updated_at || 0);
      const localUpdated = new Date(localState.lastUpdated || 0);
      if (remoteUpdated > localUpdated) {
        store.replace(remoteState);
        syncUI.setStatus('', 'تم التحميل من السحابة');
      } else {
        await syncWithCloud();
      }
    } else {
      await syncWithCloud();
    }
  } catch (e) {
    AppError.supabase('loadUserData', e);
    syncUI.setStatus('error', 'خطأ في التحميل');
  }
}

// ===================== دالة save الرئيسية (محسنة وآمنة) =====================
function save() {
  try {
    // حفظ فوري في localStorage
    store._persist();
    console.log("✅ save() completed locally");
    // محاولة المزامنة بدون انتظار (حتى لا تمنع الإضافة)
    if (currentUser && currentUser.id) {
      setTimeout(() => syncWithCloud(), 500);
    }
  } catch(e) {
    console.error("❌ save() failed:", e);
    alert("حدث خطأ أثناء حفظ البيانات: " + e.message);
  }
}

function saveData() {
  return save();
}

// تهيئة المتجر
store.init();

// تصدير للاستخدام العالمي
window.S = S;
window.store = store;
window.save = save;
window.saveData = saveData;
window.loadUserData = loadUserData;
window.syncWithCloud = syncWithCloud;
