// ============================================================
// js/data.js — نسخة مختصرة وسهلة النسخ
// ============================================================

const SUPABASE_URL = 'https://rfrrtfjbaeflyrbavbrg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmcnJ0ZmpiYWVmbHlyYmF2YnJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3Njk3NjYsImV4cCI6MjA5MTM0NTc2Nn0.K9Ho5imrtVUVEv0PiZObAYKIbmfBB2d6C9azv5wqAGw';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const store = {
  _state: { inventory:[], customers:[], suppliers:[], products:[], employees:[], partners:[], shops:[], sales:[], payments:[], invoices:[], currentDate: new Date().toISOString().slice(0,10), activeProduct: null, isLoading: false, lastSync: null },
  get state() { return this._state; },
  set(key, value) { if (key in this._state) this._state[key] = value; },
  reset() { ['inventory','customers','suppliers','products','employees','partners','shops','sales','payments','invoices'].forEach(k => this._state[k]=[]); if(typeof Cache!=='undefined') Cache.clear(); }
};

const S = store._state;
let currentUser = null, xProd = null;

const AppError = { log(context, error, notifyUser=false) { console.error(context, error); if(notifyUser && Toast) Toast.error('خطأ: '+(error?.message||error)); }, async handle(context, fn) { try { return await fn(); } catch(e) { this.log(context,e,true); return null; } } };

const Toast = { _c:null, _get(){ return this._c || (this._c = document.getElementById('toast-container')); }, show(msg,type='info',dur=3500){ let c=this._get(); if(!c) return; let t=document.createElement('div'); t.className=`toast toast-${type}`; let icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'}; t.innerHTML=`<span>${icons[type]||'ℹ️'}</span> ${msg}`; c.appendChild(t); setTimeout(()=>t.remove(),dur); }, success(msg){this.show(msg,'success');}, error(msg){this.show(msg,'error',5000);}, warning(msg){this.show(msg,'warning');}, info(msg){this.show(msg,'info');} };

const syncUI = { setStatus(status, msg) { window.dispatchEvent(new CustomEvent('sync-status', { detail: { status, msg } })); } };

async function loadUserProfile() { if(!currentUser?.id) return; try { const { data: profile, error } = await sb.from('profiles').select('*, company:companies(*)').eq('id', currentUser.id).maybeSingle(); if(profile) { currentUser.company_id = profile.company_id; currentUser.role = profile.role || 'owner'; currentUser.full_name = profile.full_name; currentUser.company_name = profile.company?.name; currentUser.subscription = profile.company?.subscription || 'trial'; currentUser.trial_ends = profile.company?.trial_ends; console.log('✅ Profile loaded:', currentUser.company_name); } else { console.warn('⏳ Profile not ready, retrying...'); setTimeout(loadUserProfile, 1000); } } catch(e) { console.error(e); } }

async function loadAppData() { if(!currentUser?.company_id) { Toast.error('خطأ: لا يوجد company_id'); return; } store.setLoading(true); syncUI.setStatus('saving', 'جاري التحميل...'); try { const results = await Promise.allSettled([ API.customers.list(), API.suppliers.list(), API.products.list(), API.employees.list(), API.partners.list(), API.shops.list(), API.invoices.list() ]); const [customers, suppliers, products, employees, partners, shops, invoices] = results.map(r => r.status==='fulfilled' ? (r.value||[]) : []); store.set('customers', customers); store.set('suppliers', suppliers); store.set('products', products); store.set('employees', employees); store.set('partners', partners); store.set('shops', shops); store.set('invoices', invoices); await loadTodayData(); store._state.lastSync = new Date().toISOString(); syncUI.setStatus('', 'محفوظ على السحابة ✓'); } catch(e) { AppError.log('loadAppData', e); syncUI.setStatus('error', 'خطأ في تحميل البيانات'); } finally { store.setLoading(false); } }

async function loadTodayData() { const today = store._state.currentDate; const results = await Promise.allSettled([ API.inventory.list(), API.sales.list(today), API.payments.list(today) ]); const [inventory, sales, payments] = results.map(r => r.status==='fulfilled' ? (r.value||[]) : []); store.set('inventory', inventory); store.set('sales', sales); store.set('payments', payments); }

const RBAC = { can(action) { const role = currentUser?.role; if(!role) return true; const perms = { owner:['*'], admin:['read','write','delete','manage_employees','manage_partners'], accountant:['read','write','invoices','payments','reports'], worker:['read','sales','inventory_add'] }; const p = perms[role]||['*']; return p.includes('*') || p.includes(action); } };

function refreshLocal(key, newData) { store.set(key, newData); if(typeof Cache!=='undefined') Cache.invalidate(key); }

window.S = S; window.store = store; window.currentUser = currentUser; window.Toast = Toast; window.AppError = AppError; window.syncUI = syncUI; window.loadUserProfile = loadUserProfile; window.loadAppData = loadAppData; window.RBAC = RBAC; window.refreshLocal = refreshLocal;
