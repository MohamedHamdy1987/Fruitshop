import { supabase } from "../data.js";
import { toast, formatCurrency } from "../ui.js";

export async function renderSuppliersPage(app) {
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .order("created_at", { ascending: false });

  app.innerHTML = `
    <div class="header">
      <h2>🚚 الموردين</h2>
      <button class="btn" onclick="openAddSupplierForm()">➕ إضافة مورد</button>
    </div>

    <div id="addSupplierForm" style="display: none;" class="card">
      <h3>إضافة مورد جديد</h3>
      <div style="display: grid; gap: 16px;">
        <input type="text" id="supplierName" placeholder="الاسم" class="form-control">
        <input type="tel" id="supplierPhone" placeholder="الهاتف" class="form-control">
        <input type="number" id="supplierOpening" placeholder="رصيد مبدئي" value="0" class="form-control">
        <div style="display: flex; gap: 12px;">
          <button class="btn" onclick="submitSupplier()">إضافة</button>
          <button class="btn btn-secondary" onclick="hideAddSupplierForm()">إلغاء</button>
        </div>
      </div>
    </div>

    <input type="text" id="supplierSearch" placeholder="بحث..." class="form-control" style="margin: 16px 0;" oninput="filterSuppliers()">

    <div id="suppliersList">
      ${!suppliers?.length ? empty() : suppliers.map(renderCard).join("")}
    </div>
  `;

  window.filterSuppliers = () => {
    const search = document.getElementById("supplierSearch")?.value.toLowerCase() || "";
    const cards = document.querySelectorAll(".supplier-card");
    cards.forEach(card => {
      const name = card.dataset.name?.toLowerCase() || "";
      const phone = card.dataset.phone?.toLowerCase() || "";
      card.style.display = (name.includes(search) || phone.includes(search)) ? "block" : "none";
    });
  };
}

function renderCard(s) {
  return `
    <div class="card supplier-card" data-name="${s.name}" data-phone="${s.phone || ''}">
      <h3>${s.name}</h3>
      <p>📞 ${s.phone || "-"}</p>
      <p>💰 رصيد: ${formatCurrency(s.opening_balance || 0)}</p>
      <button class="btn btn-secondary" onclick="openSupplier('${s.id}', '${s.name}')">📂 عرض الحساب</button>
    </div>
  `;
}

window.openAddSupplierForm = () => {
  document.getElementById("addSupplierForm").style.display = "block";
};

window.hideAddSupplierForm = () => {
  document.getElementById("addSupplierForm").style.display = "none";
  document.getElementById("supplierName").value = "";
  document.getElementById("supplierPhone").value = "";
  document.getElementById("supplierOpening").value = "0";
};

window.submitSupplier = async () => {
  const name = document.getElementById("supplierName").value.trim();
  const phone = document.getElementById("supplierPhone").value.trim();
  const opening = Number(document.getElementById("supplierOpening").value) || 0;

  if (!name) {
    toast("الاسم مطلوب", "error");
    return;
  }

  const { error } = await supabase.from("suppliers").insert({
    name,
    phone,
    opening_balance: opening
  });

  if (!error) {
    toast("تم إضافة المورد");
    navigate("suppliers");
  } else {
    toast("فشل الإضافة: " + error.message, "error");
  }
};

// باقي الدوال مثل openSupplier تظل كما هي مع تحسينات الألوان