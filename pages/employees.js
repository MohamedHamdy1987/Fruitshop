import { supabase, dbInsert, dbUpdate } from "..core/data.js";

// ===============================
// 🎯 RENDER PAGE
// ===============================

export async function renderEmployeesPage(app) {
  const { data } = await supabase
    .from("employees")
    .select("*")
    .order("created_at", { ascending: false });

  app.innerHTML = `
    <div class="header">
      <h2>👷 الموظفين</h2>
      <button onclick="openAddEmployee()">➕ إضافة موظف</button>
    </div>

    ${!data?.length ? empty() : data.map(renderCard).join("")}
  `;
}

// ===============================
// 📦 CARD
// ===============================

function renderCard(e) {
  return `
    <div class="card">
      <h3>${e.name}</h3>
      <p>📞 ${e.phone || "-"}</p>
      <p>👤 ${roleLabel(e.role)}</p>

      <div class="actions">
        <button onclick="toggleEmployee('${e.id}', ${e.active})">
          ${e.active ? "🚫 تعطيل" : "✅ تفعيل"}
        </button>

        <button onclick="changeRole('${e.id}')">✏️ تعديل الصلاحية</button>
      </div>
    </div>
  `;
}

// ===============================
// ➕ ADD
// ===============================

window.openAddEmployee = function () {
  const name = prompt("اسم الموظف");
  const phone = prompt("الموبايل");
  const role = prompt("الدور (admin / cashier / worker)", "worker");

  if (!name) return;

  dbInsert("employees", { name, phone, role });

  navigate("employees");
};

// ===============================
// 🔄 TOGGLE
// ===============================

window.toggleEmployee = async function (id, current) {
  await dbUpdate("employees", id, {
    active: !current
  });

  navigate("employees");
};

// ===============================
// ✏️ CHANGE ROLE
// ===============================

window.changeRole = async function (id) {
  const role = prompt("الدور الجديد (admin / cashier / worker)");

  if (!role) return;

  await dbUpdate("employees", id, { role });

  navigate("employees");
};

// ===============================
// 🎨 HELPERS
// ===============================

function roleLabel(r) {
  if (r === "admin") return "مدير";
  if (r === "cashier") return "كاشير";
  return "عامل";
}

function empty() {
  return `<p>لا يوجد موظفين</p>`;
}