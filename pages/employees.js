import { supabase, dbInsert, dbUpdate } from "../data.js";
import { toast } from "../ui.js";

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
      <button class="btn" onclick="openAddEmployee()">➕ إضافة موظف</button>
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
      <p>حالة: ${e.active ? '✅ نشط' : '🚫 معطل'}</p>

      <div class="actions" style="margin-top:15px;">
        <button class="btn btn-outline" onclick="toggleEmployee('${e.id}', ${e.active})">
          ${e.active ? "🚫 تعطيل" : "✅ تفعيل"}
        </button>

        <button class="btn btn-outline" onclick="changeRole('${e.id}')">✏️ تعديل الصلاحية</button>
      </div>
    </div>
  `;
}

// ===============================
// ➕ ADD
// ===============================

window.openAddEmployee = async function () {
  const name = prompt("اسم الموظف");
  if (!name) return;

  const phone = prompt("الموبايل");
  const role = prompt("الدور (admin / cashier / worker)", "worker");

  const ok = await dbInsert("employees", { name, phone, role, active: true });

  if (ok) {
    toast("تم إضافة الموظف");
    navigate("employees");
  } else {
    toast("فشل الإضافة", "error");
  }
};

// ===============================
// 🔄 TOGGLE
// ===============================

window.toggleEmployee = async function (id, current) {
  const ok = await dbUpdate("employees", id, {
    active: !current
  });

  if (ok) {
    toast("تم التحديث");
    navigate("employees");
  } else {
    toast("فشل التحديث", "error");
  }
};

// ===============================
// ✏️ CHANGE ROLE
// ===============================

window.changeRole = async function (id) {
  const role = prompt("الدور الجديد (admin / cashier / worker)");
  if (!role) return;

  const ok = await dbUpdate("employees", id, { role });

  if (ok) {
    toast("تم تغيير الصلاحية");
    navigate("employees");
  } else {
    toast("فشل التغيير", "error");
  }
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
