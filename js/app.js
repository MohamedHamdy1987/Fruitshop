[file name]: app.js.html
[file content begin]
// ============================================================
// js/app.js — النقطة الرئيسية + نظام Rendering الذكي
// محدَّث: inventory يحل محل baqi/nazil, sales و tarhil الجديدان
// مع تحسين renderAll
// ============================================================

// ─────────────────────────────────────────────────────────────
// Sync Status Listener
// ─────────────────────────────────────────────────────────────
let _syncHideTimer = null;
window.addEventListener('sync-status', (e) => {
  const { status, msg } = e.detail;
  const bar  = document.getElementById('sync-bar');
  const text = document.getElementById('sync-text');
  if (!bar || !text) return;
  clearTimeout(_syncHideTimer);
  bar.className    = 'sync-bar ' + (status === 'saving' ? 'saving' : status === 'error' ? 'error' : '');
  text.textContent = msg;
  if (!status || status === '') {
    _syncHideTimer = setTimeout(() => { bar.style.opacity = '0.5'; }, 4000);
    bar.style.opacity = '1';
  } else {
    bar.style.opacity = '1';
  }
});

// ─────────────────────────────────────────────────────────────
// Render Registry
// ─────────────────────────────────────────────────────────────
const PAGE_RENDERS = {
  dashboard:    () => safeRender('dashboard',    renderDashboard),

  inventory:    () => safeRender('inventory',    renderInventory),

  sales:        () => { refreshDropdowns(); safeRender('sales', renderSalesTable); },

  tarhil:       () => safeRender('tarhil',       renderTarhil),

  customers:    () => safeRender('customers',    renderCustList),
  suppliers:    () => safeRender('suppliers',    renderSuppList),
  invoices:     () => { refreshDropdowns(); safeRender('invoices', renderInvoicesPage); },
  employees:    () => safeRender('employees',    renderEmployees),
  partners:     () => safeRender('partners',     renderPartners),
  shops:        () => safeRender('shops',        renderShops),
  khazna:       () => {
    refreshDropdowns();
    safeRender('khazna-col', renderCollections);
    safeRender('khazna-exp', renderExpenses);
    safeRender('khazna-sum', renderDaySummary);
  },
  subscription: () => safeRender('subscription', renderSubscriptionStatus),
  admin:        () => safeRender('admin',        loadAdminPayments),

  baqi:         () => safeRender('baqi',         renderInventory),
  nazil:        () => safeRender('nazil',        renderInventory),
};

let _activePage = 'dashboard';

// ─────────────────────────────────────────────────────────────
// Safe Render مع error isolation
// ─────────────────────────────────────────────────────────────
function safeRender(name, fn) {
  try { fn(); }
  catch (e) { AppError.log(`render:${name}`, e); }
}

// ─────────────────────────────────────────────────────────────
// renderPage — يعمل render للصفحة المحددة فقط
// ─────────────────────────────────────────────────────────────
function renderPage(page) {
  const target = page || _activePage;
  const fn = PAGE_RENDERS[target];
  if (fn) {
    showSkeleton(target);
    fn();
  }
}

// renderAll — للحالات التي تؤثر على أكثر من صفحة (مثل إضافة دفعة)
function renderAll() {
  const pagesToRefresh = ['inventory', 'sales', 'dashboard'];
  pagesToRefresh.forEach(page => {
    const fn = PAGE_RENDERS[page];
    if (fn) try { fn(); } catch(e) { AppError.log(`renderAll:${page}`, e); }
  });
  // تحديث الخزنة أيضاً إذا كانت مفتوحة
  if (_activePage === 'khazna') {
    safeRender('khazna-col', renderCollections);
    safeRender('khazna-exp', renderExpenses);
    safeRender('khazna-sum', renderDaySummary);
  }
}

// ─────────────────────────────────────────────────────────────
// Dropdowns — يُحدَّث عند تغيير العملاء/الموردين
// ─────────────────────────────────────────────────────────────
function refreshDropdowns() {
  const custs = store.custs || [];
  const supps = store.supps || [];

  // مورد الفواتير
  const suppOpts = '<option value="">-- اختر مورد --</option>' +
    supps.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  ['inv-supp-sel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = suppOpts;
  });

  // عميل التحصيلات
  const custOpts = '<option value="">-- اختر عميل --</option>' +
    custs.map(c => `<option value="${c.id}">${c.name} (${N(c.balance||0)} ج)</option>`).join('');
  const cc = document.getElementById('col-cust-sel');
  if (cc) cc.innerHTML = custOpts;

  // مورد المصروفات
  const es = document.getElementById('exp-supp-sel');
  if (es) es.innerHTML = '<option value="">-- بدون مورد --</option>' +
    supps.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

// ─────────────────────────────────────────────────────────────
// Skeleton Loading
// ─────────────────────────────────────────────────────────────
function showSkeleton(page) {
  const containers = {
    customers: '#cust-list-cont',
    suppliers: '#supp-list-cont',
    employees: '#emp-list-cont',
    partners:  '#part-list-cont',
    shops:     '#shop-list-cont'
  };
  const sel = containers[page];
  if (sel) {
    const el = document.querySelector(sel);
    if (el && el.children.length === 0) {
      el.innerHTML = _skeletonCards(3);
    }
  }
}

function _skeletonCards(n) {
  return Array(n).fill(`
    <div class="card">
      <div class="cb">
        <div class="skeleton" style="height:18px;width:60%;margin-bottom:8px"></div>
        <div class="skeleton" style="height:14px;width:40%"></div>
      </div>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────
// إدارة الصفحات
// ─────────────────────────────────────────────────────────────
function showPage(n, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));

  const actualPage = (n === 'baqi' || n === 'nazil') ? 'inventory' : n;

  const page = document.getElementById('page-' + actualPage);
  if (page) page.classList.add('active');
  if (btn)  btn.classList.add('active');
  _activePage = actualPage;
  renderPage(actualPage);

  updateDates();
}

function showKTab(t) {
  document.getElementById('ks-col').style.display = t === 'col' ? 'block' : 'none';
  document.getElementById('ks-exp').style.display = t === 'exp' ? 'block' : 'none';
}

// ─────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────
function updateHeader() {
  if (!currentUser) return;
  const nameEl  = document.getElementById('shop-name-header');
  const badgeEl = document.getElementById('user-email-badge');
  const roleEl  = document.getElementById('user-role-badge');
  if (nameEl)  nameEl.textContent  = currentUser.company_name || 'نظام المحل';
  if (badgeEl) badgeEl.textContent = currentUser.full_name || currentUser.email?.split('@')[0] || '-';
  if (roleEl) {
    const roleNames = { owner:'مالك', admin:'مدير', accountant:'محاسب', worker:'عامل' };
    roleEl.textContent = roleNames[currentUser.role] || currentUser.role || '';
  }
}

// ─────────────────────────────────────────────────────────────
// showApp
// ─────────────────────────────────────────────────────────────
async function showApp() {
  document.getElementById('loading')?.style && (document.getElementById('loading').style.display = 'none');
  document.getElementById('app').style.display         = 'block';
  document.getElementById('auth-screen').style.display = 'none';

  updateHeader();
  updateRoleUI();
  checkTrial();
  updateAdminTabVisibility();

  await loadAppData();

  const picker = document.getElementById('tarhil-date-picker');
  if (picker) picker.value = store._state.currentDate;

  updateDates();
  renderPage('dashboard');
}

// ─────────────────────────────────────────────────────────────
// RBAC UI
// ─────────────────────────────────────────────────────────────
function updateRoleUI() {
  const role = currentUser?.role;
  if (!role) return;

  const tabPermissions = {
    worker:     ['dashboard','sales','inventory'],
    accountant: ['dashboard','sales','inventory','customers','suppliers','invoices','khazna','tarhil'],
    admin:      ['dashboard','sales','inventory','customers','suppliers','invoices','khazna','tarhil',
                 'employees','partners','shops','subscription'],
    owner:      null  // كل شيء
  };

  const allowed = tabPermissions[role];
  if (!allowed) return;

  document.querySelectorAll('nav.tabs button[data-page]').forEach(btn => {
    const page = btn.getAttribute('data-page');
    btn.style.display = allowed.includes(page) ? '' : 'none';
  });
}

// ─────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function showUserMenu() {
  const meta      = currentUser;
  const roleNames = { owner:'مالك', admin:'مدير', accountant:'محاسب', worker:'عامل' };
  const subNames  = { trial:'تجربة مجانية', monthly:'مشترك شهري', yearly:'مشترك سنوي', expired:'منتهي' };
  document.getElementById('user-info').innerHTML = `
    <div style="display:grid;gap:6px;font-size:0.84rem">
      <div><strong>الاسم:</strong> ${meta?.full_name || '-'}</div>
      <div><strong>البريد:</strong> ${meta?.email || '-'}</div>
      <div><strong>الشركة:</strong> ${meta?.company_name || '-'}</div>
      <div><strong>الدور:</strong> <span class="role-badge">${roleNames[meta?.role]||meta?.role||'-'}</span></div>
      <div><strong>الاشتراك:</strong> ${subNames[meta?.subscription]||meta?.subscription||'-'}</div>
    </div>`;
  document.getElementById('user-modal').classList.add('open');
}

// ─────────────────────────────────────────────────────────────
// التاريخ
// ─────────────────────────────────────────────────────────────
function updateDates() {
  const d = store._state.currentDate;
  const displayDate = new Date(d).toLocaleDateString('ar-EG', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });
  ['headerDate','sales-badge','col-badge','exp-badge','tarhil-badge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = displayDate;
  });
  const picker = document.getElementById('tarhil-date-picker');
  if (picker && !picker.value) picker.value = d;
}

function changeDatePrompt() {
  const d = prompt('أدخل التاريخ (YYYY-MM-DD):', store._state.currentDate);
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
    store.set('currentDate', d.trim());
    const picker = document.getElementById('tarhil-date-picker');
    if (picker) picker.value = d.trim();
    updateDates();
    loadTodayData().then(() => renderPage(_activePage));
  } else if (d) {
    Toast.warning('صيغة التاريخ يجب أن تكون YYYY-MM-DD');
  }
}

// ─────────────────────────────────────────────────────────────
// init
// ─────────────────────────────────────────────────────────────
async function init() {
  try {
    let session = null;
    try {
      const res = await Promise.race([
        sb.auth.getSession(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
      ]);
      session = res?.data?.session;
    } catch (e) {
      if (e.message !== 'timeout') AppError.log('init.getSession', e);
    }

    if (session) {
      currentUser = session.user;
      await loadUserProfile();
      await showApp();
    } else {
      document.getElementById('loading').style.display  = 'none';
      document.getElementById('auth-screen').style.display = 'flex';
    }
  } catch (e) {
    AppError.log('init', e);
    document.getElementById('loading').style.display  = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
  }
}

window.addEventListener('load', () => {
  setTimeout(() => {
    const loading = document.getElementById('loading');
    if (loading && loading.style.display !== 'none') {
      loading.style.display = 'none';
      document.getElementById('auth-screen').style.display = 'flex';
    }
  }, 6000);
});

function N(n)      { return (parseFloat(n)||0).toLocaleString('ar-EG'); }
function fmtDate(d){ return d.toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); }

init();
[file content end]