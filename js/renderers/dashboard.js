// ============================================================
// js/renderers/dashboard.js — لوحة التحكم التجارية
// ============================================================

let _dashChart = null;  // مرجع لـ Chart.js instance

async function renderDashboard() {
  const container = document.getElementById('page-dashboard');
  if (!container) return;

  container.innerHTML = `
    <div class="dashboard-grid">

      <!-- KPI Cards -->
      <div class="kpi-row" id="kpi-row">
        ${_kpiSkeleton()}
      </div>

      <!-- صف الرسم البياني + أكبر المدينين -->
      <div class="dash-row-2">
        <div class="card dash-chart-card">
          <div class="ch g"><span>📈</span><h2>مبيعات آخر ٣٠ يوم</h2></div>
          <div class="cb"><canvas id="salesChart" height="200"></canvas></div>
        </div>
        <div class="card dash-debtors-card">
          <div class="ch r"><span>💸</span><h2>أكبر المدينين</h2></div>
          <div class="cb" id="dash-debtors"><div class="skeleton-list"></div></div>
        </div>
      </div>

      <!-- صف المخزون المنخفض + أعلى المنتجات -->
      <div class="dash-row-2">
        <div class="card">
          <div class="ch" style="background:#fff3e0;border-bottom-color:#ffe082;">
            <span>⚠️</span><h2 style="color:#e65100">مخزون منخفض</h2>
          </div>
          <div class="cb" id="dash-lowstock"><div class="skeleton-list"></div></div>
        </div>
        <div class="card">
          <div class="ch b"><span>🏆</span><h2>أداء اليوم</h2></div>
          <div class="cb" id="dash-today"><div class="skeleton-list"></div></div>
        </div>
      </div>

    </div>`;

  // تحميل البيانات
  try {
    const data = await API.dashboard.getSummary();
    _renderKPIs(data);
    _renderSalesChart(data.salesHistory);
    _renderDebtors(data.topDebtors);
    _renderLowStock(data.inventory);
    _renderTodayPerf(data);
  } catch (e) {
    AppError.log('renderDashboard', e);
    Toast.error('خطأ في تحميل لوحة التحكم');
  }
}

// ─────────────────────────────────────────────────────────────
function _kpiSkeleton() {
  return ['', '', '', ''].map(() => `
    <div class="kpi-card">
      <div class="skeleton" style="height:40px;width:60%;margin-bottom:8px"></div>
      <div class="skeleton" style="height:20px;width:80%"></div>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────
function _renderKPIs(data) {
  const today      = store._state.currentDate;
  const todaySales = data.salesHistory.find(s => s.sale_date === today);
  const totalIn    = data.todayPayments.filter(p => p.direction === 'in').reduce((s,p) => s+p.amount, 0);
  const totalOut   = data.todayPayments.filter(p => p.direction === 'out').reduce((s,p) => s+p.amount, 0);
  const totalDebt  = store.custs.reduce((s,c) => s + (c.balance||0), 0);
  const lowStock   = data.inventory.filter(i => i.is_low_stock).length;

  const kpis = [
    {
      label:  'مبيعات اليوم',
      value:  N(todaySales?.total_sales || 0) + ' جنيه',
      sub:    `نقدي: ${N(todaySales?.cash_sales||0)} ج | آجل: ${N(todaySales?.credit_sales||0)} ج`,
      icon:   '🛒',
      color:  'var(--green)',
      bg:     'var(--green-light)'
    },
    {
      label:  'تحصيلات اليوم',
      value:  N(totalIn) + ' جنيه',
      sub:    `مصروفات: ${N(totalOut)} ج | صافي: ${N(totalIn-totalOut)} ج`,
      icon:   '💵',
      color:  'var(--blue)',
      bg:     'var(--blue-light)'
    },
    {
      label:  'إجمالي الديون',
      value:  N(totalDebt) + ' جنيه',
      sub:    `${store.custs.filter(c=>(c.balance||0)>0).length} عميل مدين`,
      icon:   '📋',
      color:  'var(--red)',
      bg:     'var(--red-light)'
    },
    {
      label:  'تنبيهات المخزون',
      value:  lowStock + ' صنف',
      sub:    lowStock > 0 ? '⚠️ يحتاج تجديد' : '✅ المخزون كافٍ',
      icon:   '📦',
      color:  lowStock > 0 ? 'var(--orange)' : 'var(--green)',
      bg:     lowStock > 0 ? '#fff3e0' : 'var(--green-light)'
    }
  ];

  document.getElementById('kpi-row').innerHTML = kpis.map(k => `
    <div class="kpi-card" style="border-top:4px solid ${k.color};background:${k.bg}">
      <div class="kpi-icon">${k.icon}</div>
      <div class="kpi-value" style="color:${k.color}">${k.value}</div>
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────
function _renderSalesChart(history) {
  const canvas = document.getElementById('salesChart');
  if (!canvas) return;

  if (_dashChart) { _dashChart.destroy(); _dashChart = null; }

  if (!history?.length) {
    canvas.parentElement.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px">لا توجد بيانات كافية</p>';
    return;
  }

  // آخر 30 يوم مرتبة
  const sorted = [...history].sort((a,b) => a.sale_date.localeCompare(b.sale_date));
  const labels = sorted.map(d => {
    const dt = new Date(d.sale_date);
    return `${dt.getDate()}/${dt.getMonth()+1}`;
  });
  const sales  = sorted.map(d => parseFloat(d.total_sales) || 0);
  const cash   = sorted.map(d => parseFloat(d.cash_sales)  || 0);

  _dashChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label:           'إجمالي المبيعات',
          data:            sales,
          backgroundColor: 'rgba(26,107,56,0.7)',
          borderColor:     'rgba(26,107,56,1)',
          borderWidth:     1,
          borderRadius:    4
        },
        {
          label:           'نقدي',
          data:            cash,
          backgroundColor: 'rgba(39,174,96,0.4)',
          borderColor:     'rgba(39,174,96,1)',
          borderWidth:     1,
          borderRadius:    4
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top', labels: { font: { family: 'Cairo' } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${N(ctx.raw)} جنيه`
          }
        }
      },
      scales: {
        y: { ticks: { callback: v => N(v) + ' ج' } },
        x: { ticks: { font: { family: 'Cairo', size: 10 } } }
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────
function _renderDebtors(debtors) {
  const el = document.getElementById('dash-debtors');
  if (!el) return;
  if (!debtors?.length) {
    el.innerHTML = '<p style="text-align:center;color:#aaa;padding:20px">✅ لا توجد ديون</p>';
    return;
  }
  el.innerHTML = debtors.map((c, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f0f0f0">
      <div style="background:var(--red);color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:900;flex-shrink:0">${i+1}</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:0.88rem">${c.name}</div>
        <div style="font-size:0.72rem;color:var(--gray)">${c.phone || '-'}</div>
      </div>
      <div style="font-weight:900;color:var(--red);font-size:0.93rem">${N(c.balance)} جنيه</div>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────
function _renderLowStock(inventory) {
  const el = document.getElementById('dash-lowstock');
  if (!el) return;
  const low = (inventory || []).filter(i => i.is_low_stock);
  if (!low.length) {
    el.innerHTML = '<p style="text-align:center;color:var(--green);padding:20px">✅ المخزون كافٍ</p>';
    return;
  }
  el.innerHTML = low.map(item => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #f0f0f0">
      <div>
        <div style="font-weight:700;font-size:0.88rem">${item.product_name}</div>
        <div style="font-size:0.72rem;color:var(--gray)">من: ${item.supplier_name}</div>
      </div>
      <div style="text-align:left">
        <div style="font-weight:900;color:var(--orange)">${N(item.remaining_qty)} ${item.unit}</div>
        <div style="font-size:0.7rem;color:var(--red)">الحد: ${N(item.low_stock_alert)}</div>
      </div>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────
function _renderTodayPerf(data) {
  const el = document.getElementById('dash-today');
  if (!el) return;
  const today     = store._state.currentDate;
  const todaySale = data.salesHistory.find(s => s.sale_date === today);
  const totalIn   = data.todayPayments.filter(p => p.direction==='in').reduce((s,p)=>s+p.amount,0);
  const totalOut  = data.todayPayments.filter(p => p.direction==='out').reduce((s,p)=>s+p.amount,0);

  const rows = [
    { label: '🛒 إجمالي المبيعات',  value: N(todaySale?.total_sales||0) + ' جنيه', color: 'var(--green)' },
    { label: '💵 مبيعات نقدية',      value: N(todaySale?.cash_sales||0)  + ' جنيه', color: 'var(--green)' },
    { label: '📋 مبيعات آجلة',       value: N(todaySale?.credit_sales||0)+ ' جنيه', color: 'var(--blue)'  },
    { label: '✅ تحصيلات',           value: N(totalIn)  + ' جنيه', color: 'var(--green)' },
    { label: '💸 مصروفات',           value: N(totalOut) + ' جنيه', color: 'var(--red)'   },
    { label: '📊 صافي الخزنة',       value: N(totalIn - totalOut) + ' جنيه',
      color: (totalIn - totalOut) >= 0 ? 'var(--green)' : 'var(--red)' },
    { label: '👤 عدد العملاء',       value: (todaySale?.customers_count||0) + ' عميل', color: 'var(--blue)' },
    { label: '📦 أصناف تم بيعها',   value: (todaySale?.products_count||0) + ' صنف', color: 'var(--gray)' }
  ];

  el.innerHTML = rows.map(r => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f5f5f5">
      <span style="font-size:0.83rem;color:#555">${r.label}</span>
      <strong style="color:${r.color};font-size:0.9rem">${r.value}</strong>
    </div>`).join('');
}
