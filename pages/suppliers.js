import { supabase, dbInsert } from "../data.js";
import { toast, formatCurrency } from "../ui.js";

// ===============================
// 🎯 RENDER SUPPLIERS PAGE
// ===============================

export async function renderSuppliersPage(app) {
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .order("created_at", { ascending: false });

  app.innerHTML = `
    <div class="header">
      <h2>🚚 الموردين</h2>
      <button class="btn btn-primary" onclick="openAddSupplier()">➕ إضافة مورد</button>
    </div>

    ${!suppliers?.length ? empty("لا يوجد موردين") : suppliers.map(renderCard).join("")}
  `;
}

// ===============================
// 📦 SUPPLIER CARD
// ===============================

function renderCard(s) {
  return `
    <div class="card">
      <h3>${s.name}</h3>
      <p>📞 ${s.phone || "-"}</p>

      <button class="btn" onclick="openSupplier('${s.id}', '${s.name}')">📂 عرض الحساب</button>
    </div>
  `;
}

// ===============================
// ➕ ADD SUPPLIER
// ===============================

window.openAddSupplier = async function () {
  const name = prompt("اسم المورد");
  if (!name) return;

  const phone = prompt("رقم الهاتف");

  const ok = await dbInsert("suppliers", { name, phone });

  if (ok) {
    toast("تم إضافة المورد");
    navigate("suppliers");
  } else {
    toast("فشل الإضافة", "error");
  }
};

// ===============================
// 📂 OPEN SUPPLIER ACCOUNT
// ===============================

window.openSupplier = async function (supplierId, supplierName) {
  const app = document.getElementById("app");

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });

  const balance = calculateBalance(invoices);

  app.innerHTML = `
    <button class="btn btn-outline" onclick="navigate('suppliers')">⬅️ رجوع</button>

    <h2>📊 حساب المورد: ${supplierName}</h2>

    <div class="card">
      <h3>الرصيد المستحق: ${formatCurrency(balance)}</h3>
    </div>

    ${renderInvoices(invoices)}
  `;
};

// ===============================
// 💰 CALCULATE BALANCE
// ===============================

function calculateBalance(invoices) {
  let total = 0;

  invoices?.forEach(inv => {
    if (inv.status === "closed") {
      total += Number(inv.net || 0);
    }
  });

  return total;
}

// ===============================
// 🧾 RENDER INVOICES
// ===============================

function renderInvoices(invoices) {
  if (!invoices?.length) return empty("لا توجد فواتير");

  return `
    <table class="table">
      <thead>
        <tr>
          <th>التاريخ</th>
          <th>الحالة</th>
          <th>الإجمالي</th>
          <th>الصافي</th>
        </tr>
      </thead>
      <tbody>
        ${invoices.map(inv => `
          <tr>
            <td>${inv.date}</td>
            <td>${status(inv.status)}</td>
            <td>${formatCurrency(inv.gross || 0)}</td>
            <td>${formatCurrency(inv.net || 0)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// ===============================
// 🎨 STATUS LABEL
// ===============================

function status(s) {
  if (s === "closed") return `<span style="color:#22c55e">منتهية</span>`;
  return `<span style="color:#f59e0b">مفتوحة</span>`;
}

// ===============================
// 🧩 EMPTY
// ===============================

function empty(msg) {
  return `<p style="text-align:center">${msg}</p>`;
}
