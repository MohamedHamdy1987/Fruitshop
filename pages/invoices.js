import { supabase, dbInsert, dbUpdate } from "../data.js";
import { toast, formatCurrency } from "../ui.js";

// ===============================
// 🎯 RENDER PAGE
// ===============================

export async function renderInvoicesPage(app) {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });

  app.innerHTML = `
    <div class="header">
      <h2>📄 الفواتير</h2>
      <button class="btn btn-primary" onclick="openCreateInvoice()">➕ فاتورة جديدة</button>
    </div>

    ${!invoices?.length ? empty() : invoices.map(renderCard).join("")}
  `;
}

// ===============================
// 📦 CARD
// ===============================

function renderCard(inv) {
  const statusBadge = inv.status === "closed" 
    ? '<span style="color:#22c55e">● منتهية</span>' 
    : '<span style="color:#f59e0b">● مفتوحة</span>';

  return `
    <div class="card">
      <h3>${inv.supplier_name}</h3>
      <p>📅 ${inv.date} - ${statusBadge}</p>
      <button class="btn" onclick="openInvoice('${inv.id}')">📂 فتح</button>
    </div>
  `;
}

// ===============================
// ➕ CREATE INVOICE
// ===============================

window.openCreateInvoice = async function () {
  const name = prompt("اسم المورد");
  if (!name) return;

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*")
    .eq("name", name)
    .single();

  if (!supplier) {
    toast("المورد غير موجود", "error");
    return;
  }

  const ok = await dbInsert("invoices", {
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    date: new Date().toISOString().split("T")[0],
    status: "open",
    noulon: 0,
    mashal: 0,
    advance_payment: 0,
    commission_rate: 0.07 // افتراضي
  });

  if (ok) {
    toast("تم إنشاء الفاتورة");
    navigate("invoices");
  } else {
    toast("فشل الإنشاء", "error");
  }
};

// ===============================
// 📂 OPEN INVOICE
// ===============================

window.openInvoice = async function (id) {
  const app = document.getElementById("app");

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();

  const { data: products } = await supabase
    .from("invoice_products")
    .select("*")
    .eq("invoice_id", id);

  app.innerHTML = `
    <button class="btn btn-outline" onclick="navigate('invoices')">⬅️ رجوع</button>

    <h2>فاتورة: ${invoice.supplier_name} - ${invoice.date}</h2>

    <div class="card">
      <div class="grid" style="grid-template-columns: repeat(4,1fr);">
        <div>
          <label>نولون</label>
          <input id="noulon" type="number" value="${invoice.noulon || 0}" class="form-control" style="width:100%; padding:8px; border-radius:8px; border:none;">
        </div>
        <div>
          <label>مشال</label>
          <input id="mashal" type="number" value="${invoice.mashal || 0}" class="form-control" style="width:100%; padding:8px; border-radius:8px; border:none;">
        </div>
        <div>
          <label>دفعة مقدمة</label>
          <input id="advance" type="number" value="${invoice.advance_payment || 0}" class="form-control" style="width:100%; padding:8px; border-radius:8px; border:none;">
        </div>
        <div>
          <label>نسبة العمولة %</label>
          <input id="commission" type="number" step="0.01" value="${(invoice.commission_rate || 0.07) * 100}" class="form-control" style="width:100%; padding:8px; border-radius:8px; border:none;">
        </div>
      </div>
      <button class="btn" onclick="saveExpenses('${id}')" style="margin-top:15px;">💾 حفظ المصاريف</button>
    </div>

    <button class="btn btn-primary" onclick="openAddProduct('${id}')">
      ➕ إضافة صنف
    </button>

    ${renderProducts(products, id)}
  `;
};

// ===============================
// 💰 SAVE EXPENSES
// ===============================

window.saveExpenses = async function (id) {
  const noulon = Number(document.getElementById("noulon").value) || 0;
  const mashal = Number(document.getElementById("mashal").value) || 0;
  const advance = Number(document.getElementById("advance").value) || 0;
  const commissionPercent = Number(document.getElementById("commission").value) || 7;
  const commissionRate = commissionPercent / 100;

  const ok = await dbUpdate("invoices", id, {
    noulon,
    mashal,
    advance_payment: advance,
    commission_rate: commissionRate
  });

  if (ok) {
    toast("تم الحفظ");
    openInvoice(id);
  } else {
    toast("فشل الحفظ", "error");
  }
};

// ===============================
// ➕ ADD PRODUCT
// ===============================

window.openAddProduct = async function (invoiceId) {
  const name = prompt("اسم الصنف");
  if (!name) return;

  const qty = Number(prompt("الكمية"));
  if (!qty || qty <= 0) return;

  const unit = prompt("الوحدة (كرتونة/كيلو/...)");

  const { error } = await supabase.from("invoice_products").insert({
    invoice_id: invoiceId,
    name,
    qty,
    unit,
    sold: 0,
    returned: 0,
    sales_total: 0
  });

  if (!error) {
    toast("تم إضافة الصنف");
    openInvoice(invoiceId);
  } else {
    toast("فشل الإضافة: " + error.message, "error");
  }
};

// ===============================
// 📦 PRODUCTS TABLE
// ===============================

function renderProducts(products, invoiceId) {
  if (!products?.length) return empty("لا توجد أصناف");

  return `
    <table class="table">
      <thead>
        <tr>
          <th>الصنف</th>
          <th>الكمية</th>
          <th>المباع</th>
          <th>المرتجع</th>
          <th>المتبقي</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${products.map(p => {
          const remaining = p.qty - p.sold - (p.returned || 0);
          return `
            <tr>
              <td>${p.name}</td>
              <td>${p.qty}</td>
              <td>${p.sold || 0}</td>
              <td>${p.returned || 0}</td>
              <td>${remaining}</td>
              <td>${formatCurrency(p.sales_total || 0)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

// ===============================
// 🧩 EMPTY
// ===============================

function empty(msg = "لا يوجد بيانات") {
  return `<p style="text-align:center">${msg}</p>`;
}
