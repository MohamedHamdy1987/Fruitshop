// ===================== renderers/customers.js — العملاء (مدمج مع Supabase) =====================

// حساب الرصيد من قاعدة البيانات
async function getCustBal(id) {
  try {
    // إجمالي المبيعات الآجلة
    const salesRes = await sb.from('daily_sales')
      .select('total_amount')
      .eq('company_id', currentUser.company_id)
      .eq('customer_id', id)
      .eq('is_cash', false);
      
    const totalSales = (salesRes.data || []).reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0);
    
    // إجمالي التحصيلات
    const payRes = await sb.from('payments')
      .select('amount, discount_amount')
      .eq('company_id', currentUser.company_id)
      .eq('customer_id', id)
      .eq('payment_type', 'collection');
      
    const totalPaid = (payRes.data || []).reduce((s, r) => s + (parseFloat(r.amount) || 0) + (parseFloat(r.discount_amount) || 0), 0);
    
    return totalSales - totalPaid;
  } catch (e) {
    AppError.log('getCustBal', e);
    return 0;
  }
}

function addCustomer() {
  const name  = document.getElementById('nc-name').value.trim();
  const phone = document.getElementById('nc-phone').value.trim();
  if (!name) return Toast.warning('أدخل اسم العميل');
  
  const btn = event.target;
  btn.disabled = true; btn.textContent = '...';
  
  API.customers.add({ name, phone, initialBalance: 0 })
    .then(() => {
      Toast.success(`✅ تم إضافة ${name}`);
      ['nc-name', 'nc-phone'].forEach(id => document.getElementById(id).value = '');
      renderCustList(); refreshDropdowns();
    })
    .catch(e => AppError.log('addCustomer', e, true))
    .finally(() => { btn.disabled = false; btn.textContent = '➕ إضافة'; });
}

async function delCustomer(id) {
  if (!confirm('حذف هذا العميل؟ (لن يتم حذف سجل المبيعات المالي)')) return;  try {
    await API.customers.delete(id);
    Toast.success('تم الحذف');
    renderCustList();
  } catch(e) { AppError.log('delCustomer', e, true); }
}

async function renderCustList() {
  const container = document.getElementById('cust-list-cont');
  if (!container) return;
  
  container.innerHTML = '<div class="skeleton" style="height:200px"></div>';
  
  try {
    const custs = await API.customers.list();
    store.set('customers', custs); // تحديث المخزن المحلي
    
    if (!custs.length) {
      container.innerHTML = '<p style="text-align:center;color:#aaa;padding:24px">لا يوجد عملاء</p>';
      return;
    }

    container.innerHTML = custs.map(cust => {
      // ملاحظة: للحصول على الرصيد الفوري نحتاج لطلب إضافي، هنا نعرض الصفر مؤقتاً أو نستخدم قيمة محفوظة إن وجدت
      // للأداء الأفضل، يمكن جلب الأرصدة مرة واحدة في loadAppData
      const bal = cust.balance || 0; 
      return `<div class="card customer-card" style="cursor:pointer"
        data-name="${cust.name.toLowerCase()}" data-phone="${(cust.phone||'').toLowerCase()}"
        onclick="openCustDetail('${cust.id}')">
        <div style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;background:var(--blue-light);border-bottom:2px solid #c5d8e8">
          <div style="display:flex;align-items:center;gap:9px">
            <span>👤</span>
            <div>
              <div style="font-weight:800;color:var(--blue)">${cust.name}</div>
              <div style="font-size:0.74rem;color:var(--gray)">${cust.phone || 'لا يوجد هاتف'}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="text-align:left">
              <div style="font-size:0.74rem;color:var(--gray)">الرصيد</div>
              <div style="font-weight:900;color:${bal > 0 ? 'var(--red)' : 'var(--green)'}">${N(bal)} جنيه</div>
            </div>
            <button class="btn btn-r btn-xs no-print" onclick="event.stopPropagation();delCustomer('${cust.id}')">🗑️</button>
          </div>
        </div>
      </div>`;
    }).join('');
    
    const kw = document.getElementById('searchCustomerInput')?.value.trim().toLowerCase();
    if (kw) filterCustomersList();  } catch (e) {
    AppError.log('renderCustList', e);
  }
}

function filterCustomersList() {
  const kw = document.getElementById('searchCustomerInput')?.value.trim().toLowerCase() || '';
  document.querySelectorAll('#cust-list-cont .customer-card').forEach(card => {
    const name = card.getAttribute('data-name') || '';
    const phone = card.getAttribute('data-phone') || '';
    card.style.display = (name.includes(kw) || phone.includes(kw)) ? '' : 'none';
  });
}

async function openCustDetail(id) {
  document.getElementById('cust-list-view').style.display = 'none';
  document.getElementById('cust-detail-view').style.display = 'block';
  
  const cust = store.custs.find(c => c.id === id);
  if (!cust) return;
  
  document.getElementById('cd-name').textContent = cust.name;
  document.getElementById('cd-bal').textContent = 'جاري الحساب...';
  document.getElementById('cd-body').innerHTML = '<div class="skeleton" style="height:200px"></div>';

  try {
    // جلب كشف الحساب من API
    const ledger = await API.customers.getLedger(id);
    const currentBal = await getCustBal(id);
    
    document.getElementById('cd-bal').textContent = N(currentBal) + ' جنيه';
    
    if (!ledger.sales.length && !ledger.payments.length) {
      document.getElementById('cd-body').innerHTML = '<p style="text-align:center;color:#aaa;padding:24px">لا توجد حركات</p>';
      return;
    }

    // دمج وتوحيد الحركات (مبيعات + مدفوعات) وترتيبها
    const allEntries = [
      ...ledger.sales.map(s => ({
        date: s.sale_date,
        type: 'order',
        amount: parseFloat(s.total_amount),
        ref: `فاتورة ${s.product?.name || ''}`,
        isTarhil: true
      })),
      ...ledger.payments.map(p => ({
        date: p.payment_date,
        type: 'payment',
        amount: parseFloat(p.amount) + parseFloat(p.discount_amount || 0),        ref: p.description || 'دفعة'
      }))
    ].sort((a, b) => a.date.localeCompare(b.date));

    let run = 0;
    let html = '';
    
    allEntries.forEach(e => {
      const isOrd = e.type === 'order';
      if (isOrd) run += e.amount; else run -= e.amount;
      
      const ac = isOrd ? 'var(--blue)' : 'var(--red)';
      const bc = run > 0 ? 'var(--red)' : 'var(--green)';
      let lbl = '';
      
      if (isOrd && e.isTarhil) lbl = `<span style="color:#784212;font-weight:800">يومية ${e.date}</span>`;
      else if (isOrd) lbl = `<span style="color:#555">${e.ref}</span>`;
      else lbl = `<span style="color:var(--red)">دفعة — ${e.ref}</span>`;
      
      html += `<div style="display:flex;align-items:center;gap:7px;padding:7px 3px;border-bottom:1px solid #f0f0f0;font-size:0.84rem;flex-wrap:wrap">
        <span style="font-weight:900;color:${ac};font-size:0.93rem;min-width:85px">${isOrd ? '+' : '-'}${N(e.amount)} جنيه</span>
        <span style="flex:1;font-size:0.79rem">${lbl}</span>
        <span style="font-weight:800;font-size:0.78rem;color:${bc}">باقي: ${N(run)}</span>
      </div>${isOrd ? '<div style="border-bottom:1.5px dashed #ddd;margin:2px 0"></div>' : ''}`;
    });
    
    html += `<div class="netbox"><span>إجمالي الحساب</span><span>${N(currentBal)} جنيه</span></div>`;
    document.getElementById('cd-body').innerHTML = html;
    
  } catch (e) {
    AppError.log('openCustDetail', e);
    document.getElementById('cd-body').innerHTML = '<p style="color:var(--red);padding:16px">خطأ في تحميل البيانات</p>';
  }
}

function showCustList() {
  document.getElementById('cust-list-view').style.display = 'block';
  document.getElementById('cust-detail-view').style.display = 'none';
}

// مشاركة كشف الحساب عبر واتساب (محدث ليعمل مع البيانات الجديدة)
async function shareCustomerWhatsApp() {
  const custName = document.getElementById('cd-name').textContent;
  const cust = store.custs.find(c => c.name === custName);
  if (!cust) return Toast.warning('لم يتم العثور على العميل');
  
  try {
    const ledger = await API.customers.getLedger(cust.id);
    const bal = await getCustBal(cust.id);
        let ledgerText = '', running = 0;
    const allEntries = [
      ...ledger.sales.map(s => ({ date: s.sale_date, type: 'order', amount: parseFloat(s.total_amount), name: s.product?.name })),
      ...ledger.payments.map(p => ({ date: p.payment_date, type: 'payment', amount: parseFloat(p.amount) }))
    ].sort((a, b) => a.date.localeCompare(b.date));
    
    allEntries.forEach(e => {
      if (e.type === 'order') running += e.amount; else running -= e.amount;
      const typeDesc = e.type === 'order' ? `فاتورة ${e.name || ''}` : 'دفعة';
      ledgerText += `${e.date} | ${typeDesc} | ${N(e.amount)} ج | الرصيد: ${N(running)} ج\n`;
    });
    
    const status = bal > 0 ? 'مدين' : (bal < 0 ? 'دائن' : 'متزن');
    const msg = `*بيان حساب العميل*\n🏢 ${currentUser.company_name}\n👤 العميل: ${cust.name}\n📞 الهاتف: ${cust.phone || 'غير مسجل'}\n━━━━━━━━━━━━━━━━━━━\n*الحركات:*\n${ledgerText}━━━━━━━━━━━━━━━━━━━\n💰 *الرصيد الحالي:* ${N(Math.abs(bal))} ج\n📝 *الحالة:* ${status}\n━━━━━━━━━━━━━━━━━━━`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  } catch (e) {
    AppError.log('shareWhatsApp', e, true);
  }
}