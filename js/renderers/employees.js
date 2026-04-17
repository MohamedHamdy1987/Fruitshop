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
    c.innerHTML=`👷لا يوجد موظفون`;
    return;
  }
  c.innerHTML = emps.map(e => {
    const dr   = (e.salary||0)/30;
    const abs  = (e.absences||[]).length;
    const ded  = abs * dr;
    const paid = ((store.pays||[]).filter(p=>p.payment_type==='salary'&&p.description?.includes(e.name)))
                 .reduce((s,p)=>s+parseFloat(p.amount||0),0);
    const rem  = (e.salary||0) - ded - paid;
    return `
      
        
          👷
          
            ${e.name}
            ${e.role||'عامل'} | راتب: ${N(e.salary)} ج
          
        
        
          
            المتبقي
            ${N(rem)} ج
          
          🗑️
        
      
    `;
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
    
      📅تسجيل الغياب
      
        
          التاريخ
          🔴 غياب
        
        ${abs.length ? abs.map((a,ai)=>`
          
            ${a.absent_date||a.date||'-'}
            -${N(dr)} ج
            🗑️
          `).join('') : 'لا توجد غيابات'}
        
          غياب: ${abs.length} يوم |
          خصم: ${N(ded)} ج
        
      
    
    
      💵تسجيل دفعة راتب
      
        
          المبلغ
          البيان
          ✅
        
      
    
    
      الراتب${N(e.salary||0)}
      خصم غياب-${N(ded)}
      واصل-${N(paid)}
      المتبقي${N(net)} ج
    `;
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