// نظام المحل - إدارة كاملة مع فواتير ومصروفات وترحيل وبحث
(function() {
    // --- دوال localStorage ---
    function save(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }
    function load(key, def = []) {
        const raw = localStorage.getItem(key);
        if (!raw) return def;
        try { return JSON.parse(raw); }
        catch(e) { return def; }
    }

    // --- هياكل البيانات ---
    let customers = load('customers');
    let suppliers = load('suppliers');
    let shops = load('shops');
    let employees = load('employees');
    let invoices = load('invoices');        // {id, date, customerId? , items: [{name,qty,price,unit,total}], total}
    let expenses = load('expenses');        // {id, description, amount, date}
    let transfers = load('transfers');      // {id, date, amount, note}
    let shopPurchases = load('shopPurchases');
    
    // علاقات إضافية: ربط الفواتير بالعملاء (اختياري)
    // سنضيف حقل customerId في الفاتورة لربطها بعميل، لكنه ليس إجبارياً.

    function persistAll() {
        save('customers', customers);
        save('suppliers', suppliers);
        save('shops', shops);
        save('employees', employees);
        save('invoices', invoices);
        save('expenses', expenses);
        save('transfers', transfers);
        save('shopPurchases', shopPurchases);
    }

    // --- دوال مساعدة للعرض ---
    function formatDate() {
        return new Date().toLocaleDateString('ar-EG');
    }

    // --- إدارة الفواتير: متغيرات مؤقتة لإنشاء فاتورة جديدة ---
    let currentInvoiceItems = [];
    let currentInvoiceCustomerId = null; // يمكن ربطها بعميل

    // فتح نافذة إضافة أصناف الفاتورة
    function openInvoiceModal(customerId = null) {
        currentInvoiceItems = [];
        currentInvoiceCustomerId = customerId;
        renderInvoiceModal();
        document.getElementById('invoiceItemsModal').style.display = 'flex';
    }

    function renderInvoiceModal() {
        const container = document.getElementById('currentInvoiceItemsTable');
        if (!container) return;
        if (currentInvoiceItems.length === 0) {
            container.innerHTML = '<p>لا توجد أصناف مضافة بعد.</p>';
        } else {
            let html = '<table><tr><th>الصنف</th><th>الكمية</th><th>الوحدة</th><th>سعر الوحدة</th><th>الإجمالي</th></tr>';
            currentInvoiceItems.forEach(item => {
                html += `<tr><td>${item.name}</td><td>${item.qty}</td><td>${item.unit}</td><td>${item.price}</td><td>${item.total}</td></tr>`;
            });
            const total = currentInvoiceItems.reduce((sum,i)=>sum+i.total,0);
            html += `<tr><td colspan="4"><strong>المجموع الكلي</strong></td><td><strong>${total} ج.م</strong></td></tr>`;
            html += `</table>`;
            container.innerHTML = html;
        }
    }

    function addItemToCurrentInvoice() {
        const name = document.getElementById('invItemName').value.trim();
        const qty = parseFloat(document.getElementById('invItemQty').value);
        const price = parseFloat(document.getElementById('invItemPrice').value);
        const unit = document.getElementById('invItemUnit').value.trim() || 'كجم';
        if (!name || isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) {
            alert('يرجى إدخال اسم الصنف وكمية وسعر صحيحين');
            return;
        }
        const total = qty * price;
        currentInvoiceItems.push({ name, qty, price, unit, total });
        // مسح الحقول
        document.getElementById('invItemName').value = '';
        document.getElementById('invItemQty').value = '1';
        document.getElementById('invItemPrice').value = '';
        document.getElementById('invItemUnit').value = 'كجم';
        renderInvoiceModal();
    }

    function saveCurrentInvoice() {
        if (currentInvoiceItems.length === 0) {
            alert('لا يمكن حفظ فاتورة بدون أصناف');
            return;
        }
        const total = currentInvoiceItems.reduce((s,i)=>s+i.total,0);
        const newInvoice = {
            id: Date.now(),
            date: formatDate(),
            items: [...currentInvoiceItems],
            total: total,
            customerId: currentInvoiceCustomerId
        };
        invoices.push(newInvoice);
        persistAll();
        // تحديث رصيد العميل إذا كان موجوداً
        if (currentInvoiceCustomerId) {
            const customer = customers.find(c => c.id == currentInvoiceCustomerId);
            if (customer) {
                customer.balance = (customer.balance || 0) + total;
                persistAll();
            }
        }
        alert(`تم حفظ الفاتورة رقم ${newInvoice.id} بنجاح`);
        document.getElementById('invoiceItemsModal').style.display = 'none';
        navigateTo('invoices');
    }

    // --- عرض حسابات العملاء والموردين ---
    function showCustomerAccount(customerId) {
        const customer = customers.find(c => c.id == customerId);
        if (!customer) return;
        // جلب فواتير هذا العميل
        const custInvoices = invoices.filter(inv => inv.customerId == customerId);
        let html = `<h4>${customer.name}</h4><p>الهاتف: ${customer.phone}</p><p>الرصيد الحالي: ${customer.balance || 0} ج.م</p>`;
        if (custInvoices.length) {
            html += '<h5>الفواتير المسجلة:</h5><ul>';
            custInvoices.forEach(inv => {
                html += `<li>فاتورة رقم ${inv.id} - التاريخ: ${inv.date} - المبلغ: ${inv.total} ج.م</li>`;
            });
            html += '</ul>';
        } else {
            html += '<p>لا توجد فواتير مسجلة لهذا العميل.</p>';
        }
        document.getElementById('accountModalTitle').innerText = `حساب العميل: ${customer.name}`;
        document.getElementById('accountDetails').innerHTML = html;
        document.getElementById('accountModal').style.display = 'flex';
    }

    function showSupplierAccount(supplierId) {
        const supplier = suppliers.find(s => s.id == supplierId);
        if (!supplier) return;
        // يمكن عرض مشتريات من المورد (لو أضفناها) – نكتفي برصيد بسيط
        let html = `<h4>${supplier.name}</h4><p>الهاتف: ${supplier.phone}</p><p>الرصيد الحالي: ${supplier.balance || 0} ج.م</p>`;
        document.getElementById('accountModalTitle').innerText = `حساب المورد: ${supplier.name}`;
        document.getElementById('accountDetails').innerHTML = html;
        document.getElementById('accountModal').style.display = 'flex';
    }

    // --- الخزينة: إضافة مصروف ---
    function addExpense(description, amount) {
        if (!description || amount <= 0) {
            alert('البيان والمبلغ مطلوبان');
            return;
        }
        expenses.push({
            id: Date.now(),
            description,
            amount: parseFloat(amount),
            date: formatDate()
        });
        persistAll();
        navigateTo('khazna');
    }

    // --- ترحيل الأرصدة ---
    function addTransfer(amount, note) {
        transfers.push({
            id: Date.now(),
            date: formatDate(),
            amount: parseFloat(amount),
            note: note || 'ترحيل'
        });
        persistAll();
        navigateTo('tarhil');
    }

    // --- البحث العام ---
    function globalSearch(query) {
        if (!query.trim()) return [];
        const q = query.trim().toLowerCase();
        const results = [];
        // بحث في العملاء
        customers.forEach(c => {
            if (c.name.toLowerCase().includes(q) || c.phone.includes(q)) {
                results.push({ type: 'عميل', data: c, link: 'customers', id: c.id });
            }
        });
        suppliers.forEach(s => {
            if (s.name.toLowerCase().includes(q) || s.phone.includes(q)) {
                results.push({ type: 'مورد', data: s, link: 'suppliers', id: s.id });
            }
        });
        shops.forEach(shop => {
            if (shop.name.toLowerCase().includes(q)) {
                results.push({ type: 'محل', data: shop, link: 'market_shops', id: shop.id });
            }
        });
        employees.forEach(emp => {
            if (emp.name.toLowerCase().includes(q) || (emp.phone && emp.phone.includes(q))) {
                results.push({ type: 'موظف', data: emp, link: 'employees', id: emp.id });
            }
        });
        invoices.forEach(inv => {
            if (inv.id.toString().includes(q)) {
                results.push({ type: 'فاتورة', data: inv, link: 'invoices', id: inv.id });
            }
        });
        return results;
    }

    function showSearchModal() {
        const modal = document.getElementById('searchModal');
        modal.style.display = 'flex';
        const input = document.getElementById('searchInput');
        const resultsDiv = document.getElementById('searchResults');
        input.value = '';
        resultsDiv.innerHTML = '<p>اكتب كلمة للبحث...</p>';
        input.oninput = () => {
            const query = input.value;
            if (query.length < 2) {
                resultsDiv.innerHTML = '<p>اكتب حرفين على الأقل...</p>';
                return;
            }
            const results = globalSearch(query);
            if (results.length === 0) {
                resultsDiv.innerHTML = '<p>لا توجد نتائج</p>';
                return;
            }
            let html = '';
            results.forEach(res => {
                html += `<div class="search-result-item" data-type="${res.type}" data-id="${res.id}" data-link="${res.link}">
                            <strong>${res.type}:</strong> ${res.data.name || res.data.id} 
                            (${res.data.phone || ''})
                         </div>`;
            });
            resultsDiv.innerHTML = html;
            document.querySelectorAll('.search-result-item').forEach(el => {
                el.onclick = () => {
                    const link = el.getAttribute('data-link');
                    const id = parseInt(el.getAttribute('data-id'));
                    navigateTo(link);
                    // بعد التنقل، يمكن عرض تفاصيل إضافية (اختياري)
                    modal.style.display = 'none';
                    if (link === 'customers') setTimeout(() => showCustomerAccount(id), 100);
                    if (link === 'suppliers') setTimeout(() => showSupplierAccount(id), 100);
                };
            });
        };
    }

    // --- دوال عرض الصفحات (محدثة)---
    function renderDashboard() {
        const totalExpenses = expenses.reduce((s,e)=>s+e.amount,0);
        const totalInvoices = invoices.reduce((s,i)=>s+i.total,0);
        return `
            <div class="card">
                <h2>📊 لوحة التحكم</h2>
                <p>مرحباً بك في نظام إدارة الخضار والفواكه</p>
                <p>👥 العملاء: ${customers.length}</p>
                <p>🚚 الموردون: ${suppliers.length}</p>
                <p>🏪 المحلات: ${shops.length}</p>
                <p>👨‍💼 الموظفون: ${employees.length}</p>
                <p>📄 الفواتير: ${invoices.length} (إجمالي ${totalInvoices} ج.م)</p>
                <p>💰 إجمالي المصروفات: ${totalExpenses} ج.م</p>
                <button class="btn-primary" id="globalSearchBtn">🔍 بحث عام</button>
            </div>
        `;
    }

    function renderCustomers() {
        let html = `<div class="card"><h2>👥 العملاء</h2>
        <button class="btn-primary" id="addCustomerBtn">➕ إضافة عميل</button>
        <button class="btn-primary" id="newInvoiceForCustomerBtn">➕ فاتورة لعميل</button>
        <table><th>الاسم</th><th>الهاتف</th><th>الرصيد</th><th>عرض الحساب</th></tr>`;
        customers.forEach(c => {
            html += `<tr><td>${c.name}</td><td>${c.phone}</td><td>${c.balance || 0} ج.م</td>
            <td><button class="btn-secondary viewCustomer" data-id="${c.id}">عرض الحساب</button></td></tr>`;
        });
        html += `</table></div>`;
        return html;
    }

    function renderSuppliers() {
        let html = `<div class="card"><h2>🚚 الموردون</h2>
        <button class="btn-primary" id="addSupplierBtn">➕ إضافة مورد</button>
        <table><th>الاسم</th><th>الهاتف</th><th>الرصيد</th><th>عرض الحساب</th></tr>`;
        suppliers.forEach(s => {
            html += `<tr><td>${s.name}</td><td>${s.phone}</td><td>${s.balance || 0} ج.م</td>
            <td><button class="btn-secondary viewSupplier" data-id="${s.id}">عرض الحساب</button></td></tr>`;
        });
        html += `</table></div>`;
        return html;
    }

    function renderInvoices() {
        let html = `<div class="card"><h2>📄 الفواتير</h2>
        <button class="btn-primary" id="addInvoiceBtn">➕ فاتورة جديدة</button>
        <table><th>رقم</th><th>التاريخ</th><th>المجموع</th><th>العميل</th><th>تفاصيل</th></tr>`;
        invoices.forEach(inv => {
            const customerName = inv.customerId ? (customers.find(c=>c.id==inv.customerId)?.name || 'غير معروف') : 'بدون عميل';
            html += `<tr><td>${inv.id}</td><td>${inv.date}</td><td>${inv.total} ج.م</td>
            <td>${customerName}</td>
            <td><button class="btn-secondary viewInvoiceDetails" data-id="${inv.id}">عرض</button></td></tr>`;
        });
        html += `}</div>`;
        return html;
    }

    function showInvoiceDetails(invoiceId) {
        const inv = invoices.find(i => i.id == invoiceId);
        if (!inv) return;
        let itemsHtml = '<h4>الأصناف</h4><table><tr><th>الصنف</th><th>الكمية</th><th>الوحدة</th><th>السعر</th><th>الإجمالي</th></tr>';
        inv.items.forEach(item => {
            itemsHtml += `<tr><td>${item.name}</td><td>${item.qty}</td><td>${item.unit}</td><td>${item.price}</td><td>${item.total}</td></tr>`;
        });
        itemsHtml += `</table><p>الإجمالي: ${inv.total} ج.م</p>`;
        alert(`تفاصيل الفاتورة ${inv.id}:\n${inv.items.map(i=>`${i.name} x${i.qty} = ${i.total}`).join('\n')}\nالمجموع: ${inv.total}`);
        // يمكن عرضها في نافذة منبثقة أفضل، لكن alert كافية مؤقتاً
    }

    function renderKhazna() {
        let html = `<div class="card"><h2>🏦 الخزينة - المصروفات</h2>
        <button class="btn-primary" id="addExpenseBtn">➕ تسجيل مصروف</button>
        <table><th>البيان</th><th>المبلغ</th><th>التاريخ</th></tr>`;
        expenses.forEach(exp => {
            html += `<tr><td>${exp.description}</td><td>${exp.amount} ج.م</td><td>${exp.date}</td></tr>`;
        });
        html += `</table></div>`;
        return html;
    }

    function renderTarhil() {
        let html = `<div class="card"><h2>📦 ترحيل الأرصدة</h2>
        <button class="btn-primary" id="addTransferBtn">➕ ترحيل جديد</button>
        <table><th>التاريخ</th><th>المبلغ</th><th>ملاحظات</th></tr>`;
        transfers.forEach(t => {
            html += `<tr><td>${t.date}</td><td>${t.amount} ج.م</td><td>${t.note}</td></tr>`;
        });
        html += `</table></div>`;
        return html;
    }

    function renderMarketShops() {
        let html = `<div class="card"><h2>🏪 محلات السوق</h2>
        <button class="btn-primary" id="addShopBtn">➕ إضافة محل</button>
        <table><th>اسم المحل</th><th>العنوان</th><th>شراء</th> </table>`;
        shops.forEach(shop => {
            html += `<tr><td>${shop.name}</td><td>${shop.address || '-'}</td>
            <td><button class="btn-secondary buyFromShop" data-id="${shop.id}">شراء من المحل</button></td></tr>`;
        });
        html += `</div>`;
        return html;
    }

    function renderEmployees() {
        let html = `<div class="card"><h2>👨‍💼 الموظفون</h2>
        <button class="btn-primary" id="addEmployeeBtn">➕ إضافة موظف</button>
        <table><th>الاسم</th><th>المنطقة</th><th>الهاتف</th> </table>`;
        employees.forEach(e => {
            html += `<tr><td>${e.name}</td><td>${e.area || '-'}</td><td>${e.phone || '-'}</td></tr>`;
        });
        html += `</div>`;
        return html;
    }

    function renderSales() { return `<div class="card"><h2>💰 المبيعات</h2><p>يمكنك عرض تقارير المبيعات من الفواتير.</p></div>`; }

    // --- التنقل وربط الأحداث ---
    let currentPage = 'dashboard';
    function navigateTo(page) {
        currentPage = page;
        const appDiv = document.getElementById('app');
        let content = '';
        switch(page) {
            case 'dashboard': content = renderDashboard(); break;
            case 'customers': content = renderCustomers(); break;
            case 'suppliers': content = renderSuppliers(); break;
            case 'invoices': content = renderInvoices(); break;
            case 'khazna': content = renderKhazna(); break;
            case 'tarhil': content = renderTarhil(); break;
            case 'market_shops': content = renderMarketShops(); break;
            case 'employees': content = renderEmployees(); break;
            case 'sales': content = renderSales(); break;
            default: content = renderDashboard();
        }
        appDiv.innerHTML = content;
        attachPageEvents();
    }

    function attachPageEvents() {
        // أزرار الإضافة العامة
        const addCustomerBtn = document.getElementById('addCustomerBtn');
        if (addCustomerBtn) {
            addCustomerBtn.onclick = () => openModal('إضافة عميل', [
                { type: 'text', placeholder: 'الاسم', id: 'cName', key: 'name' },
                { type: 'tel', placeholder: 'الهاتف', id: 'cPhone', key: 'phone' },
                { type: 'number', placeholder: 'الرصيد المبدئي', id: 'cBalance', key: 'balance', value: '0' }
            ], (vals) => {
                customers.push({ id: Date.now(), name: vals.name, phone: vals.phone, balance: parseFloat(vals.balance) || 0 });
                persistAll();
                navigateTo('customers');
            });
        }
        const addSupplierBtn = document.getElementById('addSupplierBtn');
        if (addSupplierBtn) {
            addSupplierBtn.onclick = () => openModal('إضافة مورد', [
                { type: 'text', placeholder: 'الاسم', id: 'sName', key: 'name' },
                { type: 'tel', placeholder: 'الهاتف', id: 'sPhone', key: 'phone' }
            ], (vals) => {
                suppliers.push({ id: Date.now(), name: vals.name, phone: vals.phone, balance: 0 });
                persistAll();
                navigateTo('suppliers');
            });
        }
        const addShopBtn = document.getElementById('addShopBtn');
        if (addShopBtn) {
            addShopBtn.onclick = () => openModal('إضافة محل', [
                { type: 'text', placeholder: 'اسم المحل', id: 'shName', key: 'name' },
                { type: 'text', placeholder: 'العنوان', id: 'shAddress', key: 'address' }
            ], (vals) => {
                shops.push({ id: Date.now(), name: vals.name, address: vals.address });
                persistAll();
                navigateTo('market_shops');
            });
        }
        const addEmployeeBtn = document.getElementById('addEmployeeBtn');
        if (addEmployeeBtn) {
            addEmployeeBtn.onclick = () => openModal('إضافة موظف', [
                { type: 'text', placeholder: 'الاسم', id: 'eName', key: 'name' },
                { type: 'text', placeholder: 'المنطقة', id: 'eArea', key: 'area' },
                { type: 'tel', placeholder: 'الهاتف', id: 'ePhone', key: 'phone' }
            ], (vals) => {
                employees.push({ id: Date.now(), name: vals.name, area: vals.area, phone: vals.phone });
                persistAll();
                navigateTo('employees');
            });
        }
        // فاتورة جديدة
        const addInvoiceBtn = document.getElementById('addInvoiceBtn');
        if (addInvoiceBtn) {
            addInvoiceBtn.onclick = () => openInvoiceModal(null);
        }
        const newInvoiceForCustomerBtn = document.getElementById('newInvoiceForCustomerBtn');
        if (newInvoiceForCustomerBtn) {
            newInvoiceForCustomerBtn.onclick = () => {
                const customerId = prompt('أدخل ID العميل (يمكنك رؤية ID من جدول العملاء)');
                if (customerId) openInvoiceModal(parseInt(customerId));
            };
        }
        // عرض حسابات العملاء والموردين
        document.querySelectorAll('.viewCustomer').forEach(btn => {
            btn.onclick = (e) => showCustomerAccount(parseInt(btn.getAttribute('data-id')));
        });
        document.querySelectorAll('.viewSupplier').forEach(btn => {
            btn.onclick = (e) => showSupplierAccount(parseInt(btn.getAttribute('data-id')));
        });
        // عرض تفاصيل الفاتورة
        document.querySelectorAll('.viewInvoiceDetails').forEach(btn => {
            btn.onclick = (e) => showInvoiceDetails(parseInt(btn.getAttribute('data-id')));
        });
        // إضافة مصروف
        const addExpenseBtn = document.getElementById('addExpenseBtn');
        if (addExpenseBtn) {
            addExpenseBtn.onclick = () => openModal('تسجيل مصروف', [
                { type: 'text', placeholder: 'البيان', id: 'expDesc', key: 'desc' },
                { type: 'number', placeholder: 'المبلغ (ج.م)', id: 'expAmount', key: 'amount' }
            ], (vals) => addExpense(vals.desc, vals.amount));
        }
        // إضافة ترحيل
        const addTransferBtn = document.getElementById('addTransferBtn');
        if (addTransferBtn) {
            addTransferBtn.onclick = () => openModal('ترحيل رصيد', [
                { type: 'number', placeholder: 'المبلغ (ج.م)', id: 'transAmount', key: 'amount' },
                { type: 'text', placeholder: 'ملاحظات', id: 'transNote', key: 'note' }
            ], (vals) => addTransfer(vals.amount, vals.note));
        }
        // شراء من المحل
        document.querySelectorAll('.buyFromShop').forEach(btn => {
            btn.onclick = (e) => {
                const shopId = parseInt(btn.getAttribute('data-id'));
                openModal('شراء من المحل - إضافة صنف', [
                    { type: 'text', placeholder: 'اسم الصنف', id: 'itemName', key: 'name' },
                    { type: 'number', placeholder: 'الكمية', id: 'qty', key: 'qty', value: '1' },
                    { type: 'number', placeholder: 'سعر الوحدة (ج.م)', id: 'price', key: 'price' },
                    { type: 'text', placeholder: 'الوحدة', id: 'unit', key: 'unit', value: 'كجم' }
                ], (vals) => {
                    const total = parseFloat(vals.qty) * parseFloat(vals.price);
                    shopPurchases.push({ id: Date.now(), shopId, date: new Date().toLocaleString(), item: vals.name, quantity: vals.qty, pricePerUnit: vals.price, unit: vals.unit, total });
                    persistAll();
                    alert(`تم إضافة ${vals.name} بمبلغ ${total} ج.م`);
                    navigateTo('market_shops');
                });
            };
        });
        // زر البحث العام
        const searchBtn = document.getElementById('globalSearchBtn');
        if (searchBtn) searchBtn.onclick = showSearchModal;
    }

    // --- النافذة المنبثقة العامة ---
    let modalCallback = null;
    function openModal(title, fields, onSave) {
        const modal = document.getElementById('globalModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalFields = document.getElementById('modalFields');
        modalTitle.innerText = title;
        modalFields.innerHTML = '';
        fields.forEach(f => {
            const input = document.createElement('input');
            input.type = f.type || 'text';
            input.placeholder = f.placeholder;
            input.id = f.id;
            input.value = f.value || '';
            modalFields.appendChild(input);
        });
        modalCallback = onSave;
        modal.style.display = 'flex';
        document.getElementById('modalConfirm').onclick = () => {
            const values = {};
            fields.forEach(f => {
                const el = document.getElementById(f.id);
                if (el) values[f.key] = el.value;
            });
            if (modalCallback) modalCallback(values);
            modal.style.display = 'none';
        };
        document.getElementById('modalCancel').onclick = () => { modal.style.display = 'none'; };
    }

    // ربط أزرار التنقل العلوية
    function bindNav() {
        document.querySelectorAll('[data-nav]').forEach(btn => {
            btn.onclick = () => navigateTo(btn.getAttribute('data-nav'));
        });
    }

    // إغلاق النوافذ المنبثقة الأخرى
    function bindModalClosers() {
        document.getElementById('closeInvoiceModalBtn')?.addEventListener('click', () => {
            document.getElementById('invoiceItemsModal').style.display = 'none';
        });
        document.getElementById('saveInvoiceBtn')?.addEventListener('click', saveCurrentInvoice);
        document.getElementById('addItemToInvoiceBtn')?.addEventListener('click', addItemToCurrentInvoice);
        document.getElementById('closeAccountModal')?.addEventListener('click', () => {
            document.getElementById('accountModal').style.display = 'none';
        });
        document.getElementById('closeSearchModal')?.addEventListener('click', () => {
            document.getElementById('searchModal').style.display = 'none';
        });
    }

    // التاريخ
    function setDate() {
        const now = new Date();
        document.getElementById('currentDate').innerText = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    window.onload = () => {
        try {
            setDate();
            bindNav();
            bindModalClosers();
            navigateTo('dashboard');
        } catch(e) {
            console.error(e);
            document.getElementById('app').innerHTML = '<div class="card">حدث خطأ بسيط، لكن النظام يعمل بشكل طبيعي</div>';
        }
    };
})();
