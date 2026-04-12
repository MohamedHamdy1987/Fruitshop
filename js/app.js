// ============================================================
// js/app.js — نقطة التشغيل الرئيسية
// ============================================================

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

// 🔹 ربط الصفحات بالدوال المدمجة (القديم + الجديد)
const PAGE_RENDERS = {
  dashboard:    () => safeRender('dashboard',    renderDashboard),
  // 🔹 صفحات النظام القديم (محدثة لـ Supabase)
  nazil:        () => { refreshDropdowns(); safeRender('nazil', renderNazilList); },
  baqi:         () => safeRender('baqi',         renderBaqi),
  tarhil:       () => safeRender('tarhil',       renderTarhil),
  sales:        () => { refreshDropdowns(); safeRender('sales', renderSalesTable); },
  customers:    () => safeRender('customers',    renderCustList),
  suppliers:    () => safeRender('suppliers',    renderSuppList),
  inventory:    () => safeRender('inventory',    renderInventory), // احتياطي
  invoices:     () => { refreshDropdowns(); safeRender('invoices', renderInvoicesPage); },
  employees:    () => safeRender('employees',    renderEmployees),
  partners:     () => safeRender('partners',     renderPartners),
  shops:        () => safeRender('shops',        renderShops),
  khazna:       () => { refreshDropdowns(); safeRender('khazna-col', renderCollections);
                         safeRender('khazna-exp', renderExpenses);
                         safeRender('khazna-sum', renderDaySummary); },
  subscription: () => safeRender('subscription', renderSubscriptionStatus),
  admin:        () => safeRender('admin',        loadAdminPayments),
};

let _activePage = 'dashboard';

function safeRender(name, fn) {
  try { fn(); } catch (e) { AppError.log(`render:${name}`, e); }
}

function renderPage(page) {  const target = page || _activePage;
  const fn = PAGE_RENDERS[target];
  if (fn) {
    // Skeleton loading logic...
    fn();
  }
}

function renderAll() {
  Object.keys(PAGE_RENDERS).forEach(page => {
    try { PAGE_RENDERS[page](); } catch(e) {}
  });
}

function refreshDropdowns() {
  const supps = store.supps || [];
  const suppOpts = '<option value="">-- اختر مورد --</option>' +
    supps.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  ['inv-supp-sel', 'np-supplier'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = suppOpts;
  });
}

function showPage(n, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
  const page = document.getElementById('page-' + n);
  if (page) page.classList.add('active');
  if (btn) btn.classList.add('active');
  _activePage = n;
  renderPage(n);
}

function showKTab(t) {
  document.getElementById('ks-col').style.display = t === 'col' ? 'block' : 'none';
  document.getElementById('ks-exp').style.display = t === 'exp' ? 'block' : 'none';
}

function updateHeader() {
  if (!currentUser) return;
  const nameEl = document.getElementById('shop-name-header');
  const badgeEl = document.getElementById('user-email-badge');
  if (nameEl) nameEl.textContent = currentUser.company_name || 'نظام المحل';
  if (badgeEl) badgeEl.textContent = currentUser.full_name || '-';
}

async function showApp() {
  document.getElementById('loading')?.style && (document.getElementById('loading').style.display = 'none');
  document.getElementById('app').style.display          = 'block';  document.getElementById('auth-screen').style.display  = 'none';
  updateHeader();
  updateRoleUI();
  checkTrial();
  updateAdminTabVisibility();
  await loadAppData();
  renderPage('dashboard');
}

function updateRoleUI() {
  const role = currentUser?.role;
  if (!role) return;
  const tabPermissions = {
    worker: ['dashboard','nazil','baqi','sales'],
    owner: null
  };
  const allowed = tabPermissions[role];
  if (!allowed) return;
  document.querySelectorAll('nav.tabs button[data-page]').forEach(btn => {
    const page = btn.getAttribute('data-page');
    btn.style.display = allowed.includes(page) ? '' : 'none';
  });
}

function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
function showUserMenu() {
  const meta = currentUser;
  document.getElementById('user-info').innerHTML = `
    <div style="display:grid;gap:6px;font-size:0.84rem">
      <div><strong>الاسم:</strong> ${meta?.full_name || '-'}</div>
      <div><strong>الشركة:</strong> ${meta?.company_name || '-'}</div>
      <div><strong>الاشتراك:</strong> ${meta?.subscription || '-'}</div>
    </div>`;
  document.getElementById('user-modal').classList.add('open');
}

function updateDates() {
  const displayDate = new Date(store._state.currentDate).toLocaleDateString('ar-EG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  ['headerDate','sales-badge','col-badge','exp-badge','tarhil-badge','nazil-badge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = displayDate;
  });
}

function changeDatePrompt() {
  const d = prompt('أدخل التاريخ (YYYY-MM-DD):', store._state.currentDate);
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
    store.set('currentDate', d.trim());    updateDates();
    loadTodayData().then(() => renderPage(_activePage));
  }
}

async function init() {
  try {
    let session = null;
    try {
      const res = await Promise.race([
        sb.auth.getSession(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
      ]);
      session = res?.data?.session;
    } catch (e) {}
    if (session) {
      currentUser = session.user;
      await loadUserProfile();
      await showApp();
    } else {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('auth-screen').style.display = 'flex';
    }
  } catch (e) {
    AppError.log('init', e);
    document.getElementById('loading').style.display = 'none';
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

function N(n) { return (parseFloat(n)||0).toLocaleString('ar-EG'); }

init();