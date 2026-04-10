// ============================================================
// renderers/employees.js — إدارة الموظفين (API-first)
// ============================================================

async function addEmployee() {
  const name   = document.getElementById('emp-name').value.trim();
  const role   = document.getElementById('emp-role').value;
  const salary = parseFloat(document.getElementById('emp-salary').value)||0;
  const phone  = document.getElementById('emp-phone').value.trim();
  if (!name||!salary) return Toast.warning('أدخل الاسم والراتب');
  const btn=event.target; btn.disabled=true; btn.textContent='...';
  try {
    await API.employees.add({ name, role, salary, phone });
    const updated = await API.employees.list();
    store.set('employees', updated);
    ['emp-name','emp-salary','emp-phone'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    Toast.success(`✅ تم إضافة ${name}`);
    renderEmployees();
  } catch(e) { AppError.log('addEmployee', e, true); }
  finally { btn.disabled=false; btn.textContent='➕ إضافة'; }
}

async function delEmployee(id) {
  const e=(store.emps||[]).find(x=>x.id===id||x.id==id);
  if (!confirm(`حذف الموظف "${e?.name}"؟`)) return;
  try {
    await API.employees.delete(id);
    store.set('employees',(store.emps||[]).filter(x=>x.id!==id&&x.id!=id));
    Toast.success('تم الحذف'); renderEmployees();
  } catch(e) { AppError.log('delEmployee', e, true); }
}

function renderEmployees() {
  const c = document.getElementById('emp-list-cont');
  if (!c) return;
  const emps = store.emps || [];
  if (!emps.length) {
    c.innerHTML=`<div class="empty-state"><div class="empty-icon">👷</div><div class="empty-title">لا يوجد موظفون</div></div>`;
    return;
  }
  c.innerHTML = emps.map(e => {
    const dr   = (e.salary||0)/30;
    const abs  = (e.absences||[]).length;
    const ded  = abs * dr;
    const paid = ((store.pays||[]).filter(p=>p.payment_type==='salary'&&p.description?.includes(e.name)))
                 .reduce((s,p)=>s+parseFloat(p.amount||0),0);
    const rem  = (e.salary||0) - ded - paid;
    return `<div class="card" style="cursor:pointer" onclick="openEmpDetail('${e.id}')">
      <div class="ch g" style="justify-content:space-between">
        <div style="display:flex;align-items:center;gap:9px">
          <span>👷</span>
          <div>
            <div style="font-weight:800;color:var(--green)">${e.name}</div>
            <div style="font-size:0.74rem;color:var(--gray)">${e.role||'عامل'} | راتب: ${N(e.salary)} ج</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="text-align:left">
            <div style="font-size:0.74rem;color:var(--gray)">المتبقي</div>
            <div style="font-weight:900;color:${rem>0?'var(--red)':'var(--green)'}">${N(rem)} ج</div>
          </div>
          <button class="btn btn-r btn-xs no-print" onclick="event.stopPropagation();delEmployee('${e.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openEmpDetail(id) {
  const e=(store.emps||[]).find(x=>x.id===id||x.id==id);
  if (!e) return;
  document.getElementById('emp-list-view').style.display   = 'none';
  document.getElementById('emp-detail-view').style.display = 'block';
  document.getElementById('ed-name').textContent   = e.name;
  document.getElementById('ed-role').textContent   = e.role||'عامل';
  document.getElementById('ed-salary').textContent = 'راتب: '+N(e.salary||0)+' ج';

  const dr  = Math.round((e.salary||0)/30);
  const abs = e.absences||[];
  const ded = abs.length * dr;
  const paid= ((store.pays||[]).filter(p=>p.payment_type==='salary'&&p.description?.includes(e.name)))
              .reduce((s,p)=>s+parseFloat(p.amount||0),0);
  const net = (e.salary||0) - ded - paid;

  document.getElementById('ed-body').innerHTML = `
    <div class="card">
      <div class="ch" style="background:#fef9e7;border-bottom-color:#f0d080"><span>📅</span><h2 style="color:#d4ac0d">تسجيل الغياب</h2></div>
      <div class="cb">
        <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:9px">
          <div style="flex:1"><label class="lbl">التاريخ</label><input type="date" id="abs-date-${id}" value="${store._state.currentDate}"></div>
          <button class="btn btn-r btn-sm" onclick="addAbsence('${id}',${dr})">🔴 غياب</button>
        </div>
        ${abs.length ? abs.map((a,ai)=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f0f0f0;font-size:0.82rem">
            <span>${a.absent_date||a.date||'-'}</span>
            <span style="color:var(--red)">-${N(dr)} ج</span>
            <button class="btn btn-r btn-xs" onclick="delAbsence('${a.id||ai}','${id}')">🗑️</button>
          </div>`).join('') : '<p style="color:#aaa;text-align:center;padding:8px">لا توجد غيابات</p>'}
        <div style="margin-top:7px;font-size:0.84rem">
          غياب: <strong style="color:var(--red)">${abs.length} يوم</strong> |
          خصم: <strong style="color:var(--red)">${N(ded)} ج</strong>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="ch g"><span>💵</span><h2>تسجيل دفعة راتب</h2></div>
      <div class="cb">
        <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:9px">
          <div style="flex:1"><label class="lbl">المبلغ</label><input type="number" id="ep-amt-${id}" placeholder="0" min="0"></div>
          <div style="flex:1"><label class="lbl">البيان</label><input type="text" id="ep-note-${id}" placeholder="دفعة راتب..."></div>
          <button class="btn btn-g btn-sm" onclick="addEmpPayment('${id}','${e.name}')">✅</button>
        </div>
      </div>
    </div>
    <div style="background:var(--green);color:#fff;border-radius:10px;padding:12px 15px;display:grid;grid-template-columns:repeat(4,1fr);text-align:center">
      <div><div style="font-size:0.72rem;opacity:.8">الراتب</div><div style="font-weight:800">${N(e.salary||0)}</div></div>
      <div><div style="font-size:0.72rem;opacity:.8">خصم غياب</div><div style="font-weight:800;color:#ffd700">-${N(ded)}</div></div>
      <div><div style="font-size:0.72rem;opacity:.8">واصل</div><div style="font-weight:800;color:#a9dfbf">-${N(paid)}</div></div>
      <div><div style="font-size:0.72rem;opacity:.8">المتبقي</div><div style="font-weight:800">${N(net)} ج</div></div>
    </div>`;
}

async function addAbsence(empId, deduction) {
  const date = document.getElementById(`abs-date-${empId}`)?.value || store._state.currentDate;
  try {
    await API.employees.addAbsence(empId, date, deduction);
    const updated = await API.employees.list();
    store.set('employees', updated);
    Toast.success('تم تسجيل الغياب');
    openEmpDetail(empId);
  } catch(e) { AppError.log('addAbsence', e, true); }
}

async function delAbsence(absenceId, empId) {
  try {
    await API.employees.deleteAbsence(absenceId);
    const updated = await API.employees.list();
    store.set('employees', updated);
    openEmpDetail(empId);
  } catch(e) { AppError.log('delAbsence', e, true); }
}

async function addEmpPayment(empId, empName) {
  const amt  = parseFloat(document.getElementById(`ep-amt-${empId}`)?.value)||0;
  const note = document.getElementById(`ep-note-${empId}`)?.value.trim()||'دفعة راتب';
  if (!amt) return Toast.warning('أدخل المبلغ');
  try {
    await API.payments.addExpense({
      amount:      amt,
      description: `راتب — ${empName}: ${note}`,
      type:        'salary',
      date:        store._state.currentDate
    });
    const pays = await API.payments.list(store._state.currentDate);
    store.set('payments', pays);
    Toast.success(`✅ ${N(amt)} ج`);
    openEmpDetail(empId); renderDaySummary();
  } catch(e) { AppError.log('addEmpPayment', e, true); }
}

function delEmpPayment(id, empId) { delPayment(id).then(()=>openEmpDetail(empId)); }
function showEmpList() {
  document.getElementById('emp-list-view').style.display   = 'block';
  document.getElementById('emp-detail-view').style.display = 'none';
}
