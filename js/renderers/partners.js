// ============================================================
// renderers/partners.js — محدَّث
// ✅ يعمل على Supabase بدلاً من localStorage
// ✅ Inline Edit على الشركاء
// ============================================================

async function addPartner() {
  const name  = document.getElementById('pt-name')?.value.trim();
  if (!name) return Toast.warning('أدخل اسم الشريك');

  try {
    await API.partners.add({
      name,
      phone:  document.getElementById('pt-phone')?.value.trim(),
      daily:  parseFloat(document.getElementById('pt-daily')?.value)  || 0,
      profit: parseFloat(document.getElementById('pt-profit')?.value) || 0,
      bank:   document.getElementById('pt-bank')?.value.trim(),
      post:   document.getElementById('pt-post')?.value.trim(),
      voda:   document.getElementById('pt-voda')?.value.trim()
    });
    const updated = await API.partners.list();
    store.set('partners', updated);
    ['pt-name','pt-phone','pt-daily','pt-profit','pt-bank','pt-post','pt-voda'].forEach(id => {
      const el = document.getElementById(id); if(el) el.value = '';
    });
    Toast.success(`✅ تم إضافة ${name}`);
    renderPartners();
  } catch(e) { AppError.log('addPartner', e, true); }
}

async function delPartner(id) {
  if (!confirm('حذف هذا الشريك؟')) return;
  try {
    await API.partners.delete(id);
    store.set('partners', (store.parts||[]).filter(p => p.id !== id && p.id != id));
    Toast.success('تم الحذف');
    renderPartners();
  } catch(e) { AppError.log('delPartner', e, true); }
}

function renderPartners() {
  const c = document.getElementById('part-list-cont');
  if (!c) return;
  const parts = store.parts || [];
  if (!parts.length) {
    c.innerHTML = `
      🤝لا يوجد شركاء`;
    return;
  }
  c.innerHTML = parts.map(p => {
    const presents = 30 - (p.absences||[]).length;
    const earned   = presents * (p.daily_expense || 0);
    const paid     = (p.payments||[]).reduce((s, x) => s + parseFloat(x.amount||0), 0);
    const net      = earned - paid;
    return `
    
      
        
          🤝
          
            ${p.name}
            ${p.phone||'-'} | ${p.daily_expense||0} ج/يوم | أرباح ${p.profit_pct||0}%
          
        
        
          
            المستحق
            ${N(net)} جنيه
          
          ✏️
          🗑️
        
      

      
      
        ✏️ تعديل بيانات الشريك
        
          الاسم
            
          الهاتف
            
          مصاريف يومية
            
          نسبة أرباح %
            
        
        
          💾 حفظ
          إلغاء
        
      
    `;
  }).join('');
}

function togglePartEdit(id) {
  const el = document.getElementById(`part-edit-${id}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function savePartEdit(id) {
  const name   = document.getElementById(`pe-name-${id}`)?.value.trim();
  const phone  = document.getElementById(`pe-phone-${id}`)?.value.trim();
  const daily  = parseFloat(document.getElementById(`pe-daily-${id}`)?.value) || 0;
  const profit = parseFloat(document.getElementById(`pe-profit-${id}`)?.value) || 0;
  if (!name) return Toast.warning('أدخل الاسم');
  try {
    await API.partners.update(id, { name, phone: phone||null, daily_expense: daily, profit_pct: profit });
    const updated = await API.partners.list();
    store.set('partners', updated);
    Toast.success('✅ تم التعديل');
    renderPartners();
  } catch(e) { AppError.log('savePartEdit', e, true); }
}

async function openPartDetail(id) {
  const p = (store.parts||[]).find(x => x.id === id || x.id == id);
  if (!p) return;
  document.getElementById('part-list-view').style.display   = 'none';
  document.getElementById('part-detail-view').style.display = 'block';
  document.getElementById('pd-name').textContent = p.name;
  document.getElementById('pd-info').textContent = `${p.daily_expense||0} ج/يوم | أرباح ${p.profit_pct||0}%`;

  const absences = p.absences || [];
  const payments = p.payments || [];
  const profits  = p.profits  || [];

  const presents     = 30 - absences.length;
  const masarif      = presents * (p.daily_expense||0);
  const totalPaid    = payments.reduce((s, x) => s + parseFloat(x.amount||0), 0);
  const totalProfits = profits.reduce((s, x)  => s + parseFloat(x.amount||0), 0);
  const net          = (masarif + totalProfits) - totalPaid;
  const dr           = Math.round((p.daily_expense||0));

  const bankInfo = [
    p.bank_account  ? `🏦 بنكي: ${p.bank_account}`  : '',
    p.post_account  ? `📮 بريد: ${p.post_account}`  : '',
    p.vodafone_cash ? `📱 فودافون: ${p.vodafone_cash}` : ''
  ].join('');

  const absRows = absences.map(a => `
    
      ${a.absent_date||a.date||'-'}
      -${N(dr)} ج
      🗑️
    `).join('') || 'لا توجد غيابات';

  const payRows = payments.map(x => `
    
      ${x.note||'دفعة'}
      -${N(x.amount)}
      🗑️
    `).join('') || 'لا توجد';

  const profitRows = profits.map(x => `
    
      ${x.note||'أرباح'}
      +${N(x.amount)}
      🗑️
    `).join('') || 'لا توجد';

  document.getElementById('pd-body').innerHTML = `
    ${bankInfo}
    
      📅 تسجيل الغياب
      
        
          
          🔴 غياب
        
        ${absRows}
        أيام الحضور: ${presents} يوم | مصاريف: ${N(masarif)} ج
      
    

    
      
        💵 الواصل
        
          
            
            
            ✅
          
          ${payRows}
        
      
      
        💰 الأرباح
        
          
            
            
            ➕
          
          ${profitRows}
          إجمالي الأرباح: ${N(totalProfits)} ج
        
      
    

    
      💰 الصافي المتبقي للشريك
      ${N(net)} جنيه
    `;
}

async function addPartAbs(id) {
  const date = document.getElementById(`pabs-${id}`)?.value || store._state.currentDate;
  try {
    await API.partners.addAbsence(id, date);
    const updated = await API.partners.list();
    store.set('partners', updated);
    openPartDetail(id);
  } catch(e) { AppError.log('addPartAbs', e, true); }
}

async function delPartAbs(absId, partnerId) {
  try {
    await API.partners.deleteAbsence(absId);
    const updated = await API.partners.list();
    store.set('partners', updated);
    openPartDetail(partnerId);
  } catch(e) { AppError.log('delPartAbs', e, true); }
}

async function addPartPay(id) {
  const amt  = parseFloat(document.getElementById(`pp-amt-${id}`)?.value) || 0;
  const note = document.getElementById(`pp-note-${id}`)?.value.trim() || 'دفعة';
  if (!amt) return Toast.warning('أدخل المبلغ');
  try {
    await API.partners.addPayment(id, amt, note, store._state.currentDate);
    // تسجيل في المصروفات أيضاً
    const p = (store.parts||[]).find(x => x.id === id || x.id == id);
    await API.payments.addExpense({ amount: amt, description: `شريك — ${p?.name||''}: ${note}`, type: 'expense', date: store._state.currentDate });
    const [parts, pays] = await Promise.all([API.partners.list(), API.payments.list(store._state.currentDate)]);
    store.set('partners', parts);
    store.set('payments', pays);
    Toast.success(`✅ ${N(amt)} ج`);
    openPartDetail(id);
    if (typeof renderDaySummary === 'function') renderDaySummary();
  } catch(e) { AppError.log('addPartPay', e, true); }
}

async function delPartPay(payId, partnerId) {
  try {
    await API.partners.deletePayment(payId);
    const updated = await API.partners.list();
    store.set('partners', updated);
    openPartDetail(partnerId);
  } catch(e) { AppError.log('delPartPay', e, true); }
}

async function addPartProf(id) {
  const amt  = parseFloat(document.getElementById(`ppr-amt-${id}`)?.value) || 0;
  const note = document.getElementById(`ppr-note-${id}`)?.value.trim() || 'أرباح';
  if (!amt) return Toast.warning('أدخل المبلغ');
  try {
    await API.partners.addProfit(id, amt, note, store._state.currentDate);
    const updated = await API.partners.list();
    store.set('partners', updated);
    Toast.success(`✅ ${N(amt)} ج`);
    openPartDetail(id);
  } catch(e) { AppError.log('addPartProf', e, true); }
}

async function delPartProf(profId, partnerId) {
  try {
    await API.partners.deleteProfit(profId);
    const updated = await API.partners.list();
    store.set('partners', updated);
    openPartDetail(partnerId);
  } catch(e) { AppError.log('delPartProf', e, true); }
}

function showPartList() {
  document.getElementById('part-list-view').style.display   = 'block';
  document.getElementById('part-detail-view').style.display = 'none';
}
