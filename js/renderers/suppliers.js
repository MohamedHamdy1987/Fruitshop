// ===================== renderers/suppliers.js — الموردون =====================

async function renderSuppList() {
  const container = document.getElementById('supp-list-cont');
  if (!container) {
    console.error('لم يتم العثور على عنصر supp-list-cont');
    return;
  }
  
  container.innerHTML = '<div style="text-align:center;padding:40px"><div class="skeleton" style="height:150px"></div></div>';

  try {
    const supps = store.supps || [];
    
    if (!supps.length) {
      container.innerHTML = '<p style="text-align:center;color:#aaa;padding:24px">لا يوجد موردون</p>';
      return;
    }

    container.innerHTML = supps.map(s => {
      const bal = parseFloat(s.balance || 0);
      return `
        <div class="card" style="cursor:pointer" onclick="openSuppDetail('${s.id}')">
          <div style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;background:#fef5ec;border-bottom:2px solid #f5cba7">
            <div style="display:flex;align-items:center;gap:9px">
              <span>🚛</span>
              <div>
                <div style="font-weight:800;color:var(--orange)">${s.name}</div>
                <div style="font-size:0.74rem;color:var(--gray)">${s.phone || 'لا يوجد هاتف'}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <div style="text-align:left">
                <div style="font-size:0.74rem;color:var(--gray)">المستحق له</div>
                <div style="font-weight:900;color:${bal > 0 ? 'var(--red)' : 'var(--green)'}">${N(bal)} جنيه</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (e) {
    console.error('Error in renderSuppList:', e);
    container.innerHTML = '<p style="text-align:center;color:var(--red);padding:24px">⚠️ خطأ في تحميل البيانات</p>';
  }
}

async function addSupplier() {
  const name = document.getElementById('ns-name')?.value.trim();  const phone = document.getElementById('ns-phone')?.value.trim();
  
  if (!name) {
    Toast.warning('أدخل اسم المورد');
    return;
  }

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'جاري الإضافة...';

  try {
    await API.suppliers.add({ name, phone });
    
    // تحديث القائمة
    const updated = await API.suppliers.list();
    store.set('suppliers', updated);
    
    // مسح الحقول
    ['ns-name', 'ns-phone'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    
    Toast.success(`✅ تم إضافة ${name}`);
    renderSuppList();
    
  } catch (e) {
    console.error('Error adding supplier:', e);
    Toast.error('خطأ في الإضافة');
  } finally {
    btn.disabled = false;
    btn.textContent = '➕ إضافة';
  }
}

function openSuppDetail(id) {
  Toast.info('سيتم عرض تفاصيل المورد ' + id);
  // TODO: تطبيق تفاصيل المورد
}

function showSuppList() {
  // دالة مساعدة
}

function filterSuppliersList() {
  // دالة البحث
  const kw = document.getElementById('searchSupplierInput')?.value.trim().toLowerCase() || '';
  document.querySelectorAll('#supp-list-cont .card').forEach(card => {
    const text = card.textContent.toLowerCase();    card.style.display = text.includes(kw) ? '' : 'none';
  });
}