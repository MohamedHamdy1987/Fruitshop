import { supabase, dbInsert } from "../data.js";
import { toast, formatCurrency } from "../ui.js";

// ===============================
// 🎯 RENDER PAGE
// ===============================

export async function renderKhaznaPage(app) {
  const { data: collections } = await supabase.from("collections").select("*");
  const { data: expenses } = await supabase.from("expenses").select("*");

  const stats = calcStats(collections, expenses);

  app.innerHTML = `
    <div class="header">
      <h2>💰 الخزنة</h2>

      <div>
        <button class="btn" onclick="openAddCollection()">➕ تحصيل من عميل</button>
        <button class="btn btn-outline" onclick="openAddExpense()">➖ مصروف</button>
      </div>
    </div>

    <div class="grid">
      ${card("كاش وارد", stats.cash)}
      ${card("مصروفات", stats.expenses)}
      ${card("الصافي", stats.net)}
    </div>

    <div class="card">
      <h3>📥 التحصيلات</h3>
      ${renderCollections(collections)}
    </div>

    <div class="card">
      <h3>📤 المصروفات</h3>
      ${renderExpenses(expenses)}
    </div>
  `;
}

// ===============================
// 📊 CALC
// ===============================

function calcStats(c, e) {
  let cash = 0, expenses = 0;

  c?.forEach(x => cash += Number(x.amount || 0));
  e?.forEach(x => expenses += Number(x.amount || 0));

  return {
    cash,
    expenses,
    net: cash - expenses
  };
}

// ===============================
// 💰 ADD COLLECTION (من عميل)
// ===============================

window.openAddCollection = async function () {
  const name = prompt("اسم العميل");
  if (!name) return;

  const amount = Number(prompt("المبلغ"));
  if (!amount || amount <= 0) return;

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("name", name)
    .single();

  if (!customer) {
    toast("العميل غير موجود", "error");
    return;
  }

  const ok = await dbInsert("collections", {
    customer_id: customer.id,
    amount,
    date: new Date().toISOString()
  });

  if (ok) {
    toast("تم التحصيل");
    navigate("khazna");
  } else {
    toast("فشل التحصيل", "error");
  }
};

// ===============================
// 💸 EXPENSE
// ===============================

window.openAddExpense = async function () {
  const desc = prompt("الوصف");
  if (!desc) return;

  const amount = Number(prompt("المبلغ"));
  if (!amount || amount <= 0) return;

  const ok = await dbInsert("expenses", {
    description: desc,
    amount,
    date: new Date().toISOString()
  });

  if (ok) {
    toast("تم إضافة المصروف");
    navigate("khazna");
  } else {
    toast("فشل الإضافة", "error");
  }
};

// ===============================
// 📋 RENDER
// ===============================

function renderCollections(list) {
  if (!list?.length) return empty();

  return list.map(x => `
    <div class="row">
      <span>💰 ${formatCurrency(x.amount)}</span>
      <span>${x.date?.split("T")[0]}</span>
    </div>
  `).join("");
}

function renderExpenses(list) {
  if (!list?.length) return empty();

  return list.map(x => `
    <div class="row">
      <span>❌ ${x.description}</span>
      <span>${formatCurrency(x.amount)}</span>
    </div>
  `).join("");
}

function card(title, val) {
  return `<div class="card"><h4>${title}</h4><h2>${formatCurrency(val)}</h2></div>`;
}

function empty() {
  return `<p>لا يوجد بيانات</p>`;
}
