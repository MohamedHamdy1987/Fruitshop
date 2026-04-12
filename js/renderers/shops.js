// ===================== renderers/shops.js — المحلات =====================

function addShop() {
  const name  = document.getElementById('sh-name').value.trim();
  const phone = document.getElementById('sh-phone').value.trim();
  if (!name) return alert('أدخل اسم المحل');
  S.shops.push({ id: Date.now(), name, phone, lahu: [], alihi: [] });
  ['sh-name', 'sh-phone'].forEach(id => document.getElementById(id).value = '');
  save(); renderShops();
}

function delShop(id) {
  if (!confirm('حذف هذا المحل وكل حركاته؟')) return;
  S.shops = S.shops.filter(s => s.id != id);
  save(); renderShops();
}

function renderShops() {
  const c = document.getElementById('shop-list-cont');
  if (!S.shops.length) { c.innerHTML = '<p style="text-align:center;color:#aaa;padding:24px">لا توجد محلات</p>'; return; }
  c.innerHTML = S.shops.map(sh => {
    const lahu  = (sh.lahu  || []).reduce((s, x) => s + x.total, 0);
    const alihi = (sh.alihi || []).reduce((s, x) => s + x.total, 0);
    const net   = lahu - alihi;
    return `<div class="card" style="cursor:pointer" onclick="openShopDetail(${sh.id})">
      <div style="padding:10px 12px;background:#f3e5f5;display:flex;align-items:center;gap:8px">
        <span>🏬</span>
        <div>
          <div style="font-weight:800;color:#8e24aa">${sh.name}</div>
          <div style="font-size:0.74rem;color:var(--gray)">${sh.phone || 'لا يوجد هاتف'}</div>
        </div>
        <div style="margin-right:auto;display:flex;align-items:center;gap:8px">
          <div style="text-align:left">
            <div style="font-size:0.74rem;color:var(--gray)">الرصيد</div>
            <div style="font-weight:900;color:${net >= 0 ? 'var(--green)' : 'var(--red)'}">${N(net)} جنيه</div>
          </div>
          <button class="btn btn-r btn-xs no-print" onclick="event.stopPropagation();delShop(${sh.id})">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openShopDetail(id) {
  const sh = S.shops.find(x => x.id == id);
  if (!sh) return;
  sh.lahu  = sh.lahu  || [];
  sh.alihi = sh.alihi || [];
  document.getElementById('shop-list-view').style.display   = 'none';
  document.getElementById('shop-detail-view').style.display = 'block';
  document.getElementById('shd-name').textContent = sh.name;

  const lahuTot  = sh.lahu.reduce((s, x)  => s + x.total, 0);
  const alihiTot = sh.alihi.reduce((s, x) => s + x.total, 0);
  const net      = lahuTot - alihiTot;
  document.getElementById('shd-bal').textContent = `رصيد: ${N(net)} جنيه`;

  const custOpts =
    '<option value="">نقدي</option>' +
    S.customers.map(c  => `<option value="c_${c.id}">${c.name}</option>`).join('') +
    S.employees.map(e  => `<option value="e_${e.id}">👷 ${e.name}</option>`).join('') +
    S.partners.map(p   => `<option value="p_${p.id}">🤝 ${p.name}</option>`).join('');

  const lahuRows = sh.lahu.map((x, xi) =>
    `<tr>
      <td style="padding:5px;font-size:0.75rem">${x.date}</td>
      <td style="padding:5px;font-weight:700">${x.productName}</td>
      <td style="padding:5px">${x.qty || '-'}</td>
      <td style="padding:5px">${x.weight || '-'}</td>
      <td style="padding:5px;font-weight:900;color:var(--green)">${N(x.total)} جنيه</td>
      <td style="padding:5px;font-size:0.74rem">${x.targetName || 'نقدي'}</td>
      <td style="padding:5px"><button class="btn btn-r btn-xs" onclick="delShopLahu(${id},${xi})">🗑️</button></td>
    </tr>`).join('') || '<tr><td colspan="7" style="color:#aaa;text-align:center;padding:10px">لا توجد حركات</td></tr>';

  const alihiRows = sh.alihi.map(x =>
    `<tr>
      <td style="padding:5px;font-size:0.75rem">${x.date}</td>
      <td style="padding:5px;font-weight:700">${x.productName}</td>
      <td style="padding:5px">${x.qty || '-'}</td>
      <td style="padding:5px">${x.weight || '-'}</td>
      <td style="padding:5px;font-weight:900;color:var(--red)">${N(x.total)} جنيه</td>
    </tr>`).join('') || '<tr><td colspan="5" style="color:#aaa;text-align:center;padding:10px">لا توجد حركات</td></tr>';

  document.getElementById('shd-body').innerHTML = `
    <div style="display:flex;gap:0;margin-bottom:14px;border-radius:11px;overflow:hidden;box-shadow:var(--shadow)">
      <button style="flex:1;padding:13px;font-family:Cairo,sans-serif;font-size:0.93rem;font-weight:800;border:none;cursor:pointer;background:#8e24aa;color:#fff"
        onclick="showShopTab('lahu',this,${id})">له 📥</button>
      <button style="flex:1;padding:13px;font-family:Cairo,sans-serif;font-size:0.93rem;font-weight:800;border:none;cursor:pointer;background:#fdf2f2;color:var(--red)"
        onclick="showShopTab('alihi',this,${id})">عليه 📤</button>
    </div>

    <div id="sh-lahu-${id}">
      <div class="card">
        <div class="ch g"><span>➕</span><h2>إضافة مأخوذ منه (له)</h2></div>
        <div class="cb">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:6px;margin-bottom:7px">
            <div><label class="lbl">الصنف</label><input type="text" id="sh-pname-${id}" placeholder="فراولة"></div>
            <div><label class="lbl">عدد</label><input type="number" id="sh-qty-${id}" placeholder="0" min="0" oninput="calcShop(${id})"></div>
            <div><label class="lbl">الوحدة</label>
              <select id="sh-unit-${id}">
                <option>عداية</option><option>شوال</option><option>سبت</option>
                <option>برنيكة</option><option>صندوق خشب</option><option>كرتونة</option>
              </select>
            </div>
            <div><label class="lbl">وزن(ك)</label><input type="number" id="sh-wt-${id}" placeholder="0" step="0.01" min="0" oninput="calcShop(${id})"></div>
            <div><label class="lbl">سعر</label><input type="number" id="sh-price-${id}" placeholder="0" min="0" oninput="calcShop(${id})"></div>
            <div><label class="lbl">المبلغ</label><input type="number" id="sh-tot-${id}" readonly placeholder="0"></div>
            <div><label class="lbl">يُرحَّل إلى</label><select id="sh-target-${id}">${custOpts}</select></div>
          </div>
          <button class="btn btn-g btn-sm" onclick="addShopLahu(${id})">✅ إضافة</button>
        </div>
      </div>
      <div class="card">
        <div class="ch g"><span>📋</span><h2>سجل له</h2></div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:0.8rem">
            <thead><tr style="background:#f0f7f0">
              <th>التاريخ</th><th>الصنف</th><th>عدد</th><th>وزن</th><th>المبلغ</th><th>مرحَّل</th><th></th>
            </tr></thead>
            <tbody>${lahuRows}</tbody>
          </table>
        </div>
        <div class="cb" style="border-top:2px solid var(--border)">
          <div style="background:var(--green-light);border:1.5px solid #a9dfbf;border-radius:9px;padding:9px 12px;display:flex;justify-content:space-between">
            <span>إجمالي له</span><strong style="color:var(--green)">${N(lahuTot)} جنيه</strong>
          </div>
        </div>
      </div>
    </div>

    <div id="sh-alihi-${id}" style="display:none">
      <div class="card">
        <div class="ch r"><h2 style="color:var(--red)">ما باعه لعملائنا (عليه)</h2></div>
        <div class="cb"><p style="color:var(--gray);font-size:0.83rem">يُستورد تلقائياً من صفحة المشتريات عند اختيار هذا المحل.</p></div>
      </div>
      <div class="card">
        <div class="ch r"><h2 style="color:var(--red)">سجل عليه</h2></div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:0.8rem">
            <thead><tr style="background:#fdf2f2">
              <th>التاريخ</th><th>الصنف</th><th>عدد</th><th>وزن(ك)</th><th>المبلغ</th>
            </tr></thead>
            <tbody>${alihiRows}</tbody>
          </table>
        </div>
        <div class="cb" style="border-top:2px solid var(--border)">
          <div style="background:var(--red-light);border:1.5px solid #f5c6c6;border-radius:9px;padding:9px 12px;display:flex;justify-content:space-between">
            <span>إجمالي عليه</span><strong style="color:var(--red)">${N(alihiTot)} جنيه</strong>
          </div>
        </div>
      </div>
      <div style="background:${net >= 0 ? 'var(--green)' : 'var(--red)'};color:#fff;border-radius:10px;padding:12px 15px;display:flex;justify-content:space-between;font-weight:900;margin-top:10px">
        <span>${net >= 0 ? 'المحل مدين بـ' : 'المحل دائن بـ'}</span>
        <span>${N(Math.abs(net))} جنيه</span>
      </div>
    </div>`;
}

function showShopTab(tab, btn, id) {
  document.getElementById(`sh-lahu-${id}`).style.display  = tab === 'lahu'  ? 'block' : 'none';
  document.getElementById(`sh-alihi-${id}`).style.display = tab === 'alihi' ? 'block' : 'none';
}

function calcShop(id) {
  const qty   = parseFloat(document.getElementById(`sh-qty-${id}`).value)   || 0;
  const wt    = parseFloat(document.getElementById(`sh-wt-${id}`).value)    || 0;
  const price = parseFloat(document.getElementById(`sh-price-${id}`).value) || 0;
  document.getElementById(`sh-tot-${id}`).value = (wt > 0 ? wt : qty) * price || '';
}

function addShopLahu(id) {
  const sh    = S.shops.find(x => x.id == id);
  if (!sh) return;
  const pname = document.getElementById(`sh-pname-${id}`).value.trim();
  const qty   = parseFloat(document.getElementById(`sh-qty-${id}`).value)   || 0;
  const unit  = document.getElementById(`sh-unit-${id}`).value;
  const wt    = parseFloat(document.getElementById(`sh-wt-${id}`).value)    || 0;
  const price = parseFloat(document.getElementById(`sh-price-${id}`).value) || 0;
  const tv    = document.getElementById(`sh-target-${id}`).value;
  if (!pname) return alert('أدخل اسم الصنف');
  const units = wt > 0 ? wt : qty;
  if (!units || !price) return alert('أدخل الكمية والسعر');
  const total = units * price;
  let targetName = 'نقدي';
  if (tv.startsWith('c_')) {
    const cust = S.customers.find(c => c.id == tv.slice(2));
    if (cust) { targetName = cust.name; cust.ledger.push({ date: S.date, type: 'order', amount: total, ref: pname, isTarhil: false }); }
  } else if (tv.startsWith('e_')) {
    const emp = S.employees.find(e => e.id == tv.slice(2));
    if (emp) { targetName = '👷 ' + emp.name; emp.payments.push({ amount: total, note: `بضاعة: ${pname}`, date: S.date }); }
  } else if (tv.startsWith('p_')) {
    const part = S.partners.find(p => p.id == tv.slice(2));
    if (part) { targetName = '🤝 ' + part.name; part.payments.push({ amount: total, note: `بضاعة: ${pname}`, date: S.date }); }
  }
  sh.lahu.push({ date: S.date, productName: pname, qty: qty || null, unit, weight: wt || null, price, total, targetName });
  ['sh-pname', 'sh-qty', 'sh-wt', 'sh-price', 'sh-tot'].forEach(pfx => document.getElementById(`${pfx}-${id}`).value = '');
  save(); openShopDetail(id); renderAll();
}

function delShopLahu(shId, idx) {
  const sh = S.shops.find(x => x.id == shId);
  if (!sh) return;
  sh.lahu.splice(idx, 1);
  save(); openShopDetail(shId);
}

function showShopList() {
  document.getElementById('shop-list-view').style.display   = 'block';
  document.getElementById('shop-detail-view').style.display = 'none';
}