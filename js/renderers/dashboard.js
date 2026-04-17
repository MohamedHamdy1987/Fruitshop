// ============================================================
// js/renderers/dashboard.js — لوحة التحكم الرئيسية
// ============================================================

async function renderDashboard() {
  const container = document.getElementById('dashboard-content');
  if (!container) return;

  const sales    = store.sales  || [];
  const pays     = store.pays   || [];
  const inv      = store.inv    || [];
  const custs    = store.custs  || [];

  const salesToday  = sales.reduce((s,x) => s + parseFloat(x.total_amount||0), 0);
  const cashToday   = sales.filter(s=>s.is_cash).reduce((s,x) => s+parseFloat(x.total_amount||0),0);
  const creditToday = salesToday - cashToday;
  const colToday    = pays.filter(p=>p.direction==='in').reduce((s,p) => s+parseFloat(p.amount||0),0);
  const expToday    = pays.filter(p=>p.direction==='out').reduce((s,p) => s+parseFloat(p.amount||0),0);
  const netToday    = colToday - expToday;

  const activeBatches = inv.filter(b => b.status==='active'||!b.status);
  const lowStock      = activeBatches.filter(b => b.is_low_stock);
  const totalDebt     = custs.reduce((s,c) => s+parseFloat(c.balance||0), 0);

  const dateStr = new Date(store._state.currentDate).toLocaleDateString('ar-EG',{
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });

  container.innerHTML = `
  
  ${dateStr}

  
  
    ${_kpiCard('🛒','مبيعات اليوم', N(salesToday)+' ج','var(--green)')}
    ${_kpiCard('💵','نقدي', N(cashToday)+' ج','#27ae60')}
    ${_kpiCard('📋','آجل اليوم', N(creditToday)+' ج','var(--blue)')}
    ${_kpiCard('💰','صافي الخزنة', N(netToday)+' ج', netToday>=0?'var(--green)':'var(--red)')}
    ${_kpiCard('📦','أصناف في المخزون', activeBatches.length,'var(--orange)')}
    ${_kpiCard('👥','رصيد العملاء', N(totalDebt)+' ج','var(--red)')}
  

  
  ${lowStock.length ? `
  
    
      ⚠️ مخزون منخفض — ${lowStock.length} صنف
    
    
      ${lowStock.slice(0,5).map(b=>`
      
        ${b.product_name}
        ${N(b.remaining_qty)} ${b.unit} متبقي
      `).join('')}
      ${lowStock.length>5?`و ${lowStock.length-5} أصناف أخرى...`:''}
    
  ` : ''}

  
  
    🛒 آخر مبيعات اليوم
    
      ${sales.length ? sales.slice(0,5).map(s => `
      
        📦 ${s.product?.name||'-'}
        ${s.is_cash?'نقدي':s.customer?.name||'عميل'}
        ${N(s.total_amount)} ج
      `).join('')
      : 'لا توجد مبيعات اليوم بعد'}
    
  

  
  
    🏦 ملخص الخزنة
    
      تحصيلات${N(colToday)} ج
      مصروفات${N(expToday)} ج
      صافي${N(netToday)} ج
    
  `;
}

function _kpiCard(icon, label, value, color) {
  return `
  
    ${icon}
    ${label}
    ${value}
  `;
}
