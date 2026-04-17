// ============================================================
// renderers/shops.js — محدَّث
// ✅ يعمل على Supabase بدلاً من localStorage
// ✅ Inline Edit على المحلات
// ============================================================

async function addShop() {
  const name  = document.getElementById('sh-name')?.value.trim();
  const phone = document.getElementById('sh-phone')?.value.trim();
  if (!name) return Toast.warning('أدخل اسم المحل');
  try {
    await API.shops.add({ name, phone });
    const updated = await API.shops.list();
    store.set('shops', updated);
    ['sh-name','sh-phone'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    Toast.success(`✅ تم إضافة ${name}`);
    renderShops();
  } catch(e) { AppError.log('addShop', e, true); }
}

async function delShop(id) {
  if (!confirm('حذف هذا المحل؟')) return;
  try {
    await API.shops.delete(id);
    store.set('shops', (store.shps||[]).filter(s => s.id !== id && s.id != id));
    Toast.success('تم الحذف');
    renderShops();
  } catch(e) { AppError.log('delShop', e, true); }
}

function renderShops() {
  const c = document.getElementById('shop-list-cont');
  if (!c) return;
  const shops = store.shps || [];
  if (!shops.length) {
    c.innerHTML = `
      🏬لا توجد محلات`;
    return;
  }
  c.innerHTML = shops.map(sh => {
    const lahu  = (sh.lahu  || []).reduce((s, x) => s + parseFloat(x.total||0), 0);
    const alihi = (sh.alihi || []).reduce((s, x) => s + parseFloat(x.total||0), 0);
    const net   = lahu - alihi;
    return `
    
      
        
          🏬
          
            ${sh.name}
            ${sh.phone||'لا يوجد هاتف'}
          
        
        
          
            الرصيد
            ${N(net)} جنيه
          
          ✏️
          🗑️
        
      

      
      
        ✏️ تعديل بيانات المحل
        
          الاسم
            
          الهاتف
            
        
        
          💾 حفظ
          إلغاء
        
      
    `;
  }).join('');
}

function toggleShopEdit(id) {
  const el = document.getElementById(`shop-edit-${id}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function saveShopEdit(id) {
  const name  = document.getElementById(`she-name-${id}`)?.value.trim();
  const phone = document.getElementById(`she-phone-${id}`)?.value.trim();
  if (!name) return Toast.warning('أدخل الاسم');
  try {
    await API.shops.update(id, { name, phone: phone||null });
    const updated = await API.shops.list();
    store.set('shops', updated);
    Toast.success('✅ تم التعديل');
    renderShops();
  } catch(e) { AppError.log('saveShopEdit', e, true); }
}

async function openShopDetail(id) {
  const sh = (store.shps||[]).find(x => x.id === id || x.id == id);
  if (!sh) return;

  document.getElementById('shop-list-view').style.display   = 'none';
  document.getElementById('shop-detail-view').style.display = 'block';
  document.getElementById('shd-name').textContent = sh.name;

  const lahuTot  = (sh.lahu  || []).reduce((s, x) => s + parseFloat(x.total||0), 0);
  const alihiTot = (sh.alihi || []).reduce((s, x) => s + parseFloat(x.total||0), 0);
  const net      = lahuTot - alihiTot;
  document.getElementById('shd-bal').textContent = `رصيد: ${N(net)} جنيه`;

  const custOpts =
    'نقدي' +
    (store.custs||[]).map(c  => `${c.name}`).join('') +
    (store.emps||[]).map(e   => `👷 ${e.name}`).join('') +
    (store.parts||[]).map(p  => `🤝 ${p.name}`).join('');

  const lahuRows = (sh.lahu||[]).map(x => `
    
      ${x.batch_date||x.date||'-'}
      ${x.product_name||'-'}
      ${x.qty||'-'}
      ${x.weight_kg||'-'}
      ${N(x.total)} ج
      ${x.target_name||'نقدي'}
      🗑️
    `).join('') || 'لا توجد حركات';

  const alihiRows = (sh.alihi||[]).map(x => `
    
      ${x.batch_date||x.date||'-'}
      ${x.product_name||'-'}
      ${x.qty||'-'}
      ${x.weight_kg||'-'}
      ${N(x.total)} ج
    `).join('') || 'لا توجد حركات';

  document.getElementById('shd-body').innerHTML = `
  
    ➕ إضافة مأخوذ منه (له)
    
      
        الصنف
          
        عدد
          
        وزن(ك)
          
        سعر
          
        المبلغ
          
        يُرحَّل إلى
          ${custOpts}
      
      ✅ إضافة
    
  

  
    
      📥 سجل له
      
        
          التاريخالصنفعددوزنالمبلغمرحَّل
        
        ${lahuRows}
        
          إجمالي له${N(lahuTot)} ج
        
      
    
    
      📤 سجل عليه
      
        يُستورد تلقائياً من صفحة المبيعات
        
          التاريخالصنفعددوزنالمبلغ
        
        ${alihiRows}
        
          إجمالي عليه${N(alihiTot)} ج
        
      
    
  

  
    ${net>=0?'المحل مدين بـ':'المحل دائن بـ'}
    ${N(Math.abs(net))} جنيه
  `;
}

function calcShop(id) {
  const qty   = parseFloat(document.getElementById(`sh-qty-${id}`)?.value)   || 0;
  const wt    = parseFloat(document.getElementById(`sh-wt-${id}`)?.value)    || 0;
  const price = parseFloat(document.getElementById(`sh-price-${id}`)?.value) || 0;
  const tot   = document.getElementById(`sh-tot-${id}`);
  if (tot) tot.value = (wt > 0 ? wt : qty) * price || '';
}

async function addShopLahuItem(id) {
  const pname  = document.getElementById(`sh-pname-${id}`)?.value.trim();
  const qty    = parseFloat(document.getElementById(`sh-qty-${id}`)?.value)   || 0;
  const wt     = parseFloat(document.getElementById(`sh-wt-${id}`)?.value)    || 0;
  const price  = parseFloat(document.getElementById(`sh-price-${id}`)?.value) || 0;
  const target = document.getElementById(`sh-target-${id}`)?.value || '';

  if (!pname) return Toast.warning('أدخل اسم الصنف');
  const units = wt > 0 ? wt : qty;
  if (!units || !price) return Toast.warning('أدخل الكمية والسعر');
  const total = units * price;

  let targetName = 'نقدي';

  try {
    // تحويل الرصيد للعميل/الموظف/الشريك إن وُجد
    if (target.startsWith('c_')) {
      const custId = target.slice(2);
      const cust = (store.custs||[]).find(c => c.id===custId||c.id==custId);
      if (cust) {
        targetName = cust.name;
        await API.customers.update(custId, { balance: parseFloat(cust.balance||0) + total });
      }
    }

    await API.shops.addLahu(id, {
      product_name: pname,
      qty:          qty || null,
      weight_kg:    wt  || null,
      price,
      total,
      target_name:  targetName,
      batch_date:   store._state.currentDate
    });

    const [shops, custs] = await Promise.all([API.shops.list(), API.customers.list()]);
    store.set('shops', shops);
    store.set('customers', custs);

    ['sh-pname','sh-qty','sh-wt','sh-price','sh-tot'].forEach(pfx => {
      const el = document.getElementById(`${pfx}-${id}`); if(el) el.value='';
    });

    Toast.success(`✅ تم إضافة ${N(total)} ج`);
    openShopDetail(id);
  } catch(e) { AppError.log('addShopLahuItem', e, true); }
}

async function delShopLahu(lahuId, shopId) {
  try {
    await API.shops.deleteLahu(lahuId);
    const updated = await API.shops.list();
    store.set('shops', updated);
    openShopDetail(shopId);
  } catch(e) { AppError.log('delShopLahu', e, true); }
}

function showShopList() {
  document.getElementById('shop-list-view').style.display   = 'block';
  document.getElementById('shop-detail-view').style.display = 'none';
}
