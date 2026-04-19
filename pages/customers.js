import { supabase } from "../data.js";
import { toast, formatCurrency } from "../ui.js";

export async function renderCustomersPage(app) {
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  app.innerHTML = `
    <div class="header">
      <h2>👥 العملاء</h2>
      <button class="btn" onclick="openAddCustomerForm()">➕ إضافة عميل</button>
    </div>

    <div id="addCustomerForm" style="display: none;" class="card">
      <h3>إضافة عميل جديد</h3>
      <div style="display: grid; gap: 16px;">
        <input type="text" id="customerName" placeholder="الاسم" class="form-control">
        <input type="tel" id="customerPhone" placeholder="الهاتف" class="form-control">
        <input type="number" id="customerOpening" placeholder="رصيد مبدئي" value="0" class="form-control">
        <div style="display: flex; gap: 12px;">
          <button class="btn" onclick="submitCustomer()">إضافة</button>
          <button class="btn btn-secondary" onclick="hideAddCustomerForm()">إلغاء</button>
        </div>
      </div>
    </div>

    <input type="text" id="customerSearch" placeholder="بحث..." class="form-control" style="margin: 16px 0;" oninput="filterCustomers()">

    <div id="customersList">
      ${!customers?.length ? empty() : customers.map(renderCard).join("")}
    </div>
  `;

  window.filterCustomers = () => {
    const search = document.getElementById("customerSearch")?.value.toLowerCase() || "";
    const cards = document.querySelectorAll(".customer-card");
    cards.forEach(card => {
      const name = card.dataset.name?.toLowerCase() || "";
      const phone = card.dataset.phone?.toLowerCase() || "";
      card.style.display = (name.includes(search) || phone.includes(search)) ? "block" : "none";
    });
  };
}

function renderCard(c) {
  return `
    <div class="card customer-card" data-name="${c.name}" data-phone="${c.phone || ''}">
      <div style="display: flex; justify-content: space-between;">
        <h3>${c.name}</h3>
        <span style="color: #8B5E3C; font-weight: bold;">${formatCurrency(c.opening_balance || 0)}</span>
      </div>
      <p>📞 ${c.phone || "-"}</p>
      <button class="btn btn-secondary" onclick="openCustomer('${c.id}', '${c.name}', ${c.opening_balance || 0})">📂 عرض الحساب</button>
    </div>
  `;
}

window.openAddCustomerForm = () => {
  document.getElementById("addCustomerForm").style.display = "block";
};

window.hideAddCustomerForm = () => {
  document.getElementById("addCustomerForm").style.display = "none";
  document.getElementById("customerName").value = "";
  document.getElementById("customerPhone").value = "";
  document.getElementById("customerOpening").value = "0";
};

window.submitCustomer = async () => {
  const name = document.getElementById("customerName").value.trim();
  const phone = document.getElementById("customerPhone").value.trim();
  const opening = Number(document.getElementById("customerOpening").value) || 0;

  if (!name) {
    toast("الاسم مطلوب", "error");
    return;
  }

  const { error } = await supabase.from("customers").insert({
    name,
    phone,
    opening_balance: opening
  });

  if (!error) {
    toast("تم إضافة العميل");
    navigate("customers");
  } else {
    toast("فشل الإضافة: " + error.message, "error");
  }
};

// دوال openCustomer و getDailySales إلخ تبقى كما هي مع تعديل الألوان
// يمكن تضمينها من النسخة السابقة