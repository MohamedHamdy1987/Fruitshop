import { supabase, dbInsert } from "..core/data.js";

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
        <button class="btn" onclick="openAddExpense()">➖ مصروف</button>
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
  const amount = Number(prompt("المبلغ"));

  if (!name || !amount) return;

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("name", name)
    .single();

  if (!customer) {
    alert("العميل غير موجود");
    return;
  }

  await dbInsert("collections", {
    customer_id: customer.id,
    amount,
    date: new Date().toISOString()
  });

  alert("تم التحصيل");
  navigate("khazna");
};

// ===============================
// 💸 EXPENSE
// ===============================

window.openAddExpense = function () {
  const desc = prompt("الوصف");
  const amount = Number(prompt("المبلغ"));

  if (!desc || !amount) return;

  addExpense(desc, amount);
};

async function addExpense(description, amount) {
  await dbInsert("expenses", {
    description,
    amount,
    date: new Date().toISOString()
  });

  navigate("khazna");
}

// ===============================
// 📋 RENDER
// ===============================

function renderCollections(list) {
  if (!list?.length) return empty();

  return list.map(x => `
    <div class="row">
      💰 ${x.amount} - ${x.date?.split("T")[0]}
    </div>
  `).join("");
}

function renderExpenses(list) {
  if (!list?.length) return empty();

  return list.map(x => `
    <div class="row">
      ❌ ${x.description} - ${x.amount}
    </div>
  `).join("");
}

function card(title, val) {
  return `<div class="card"><h4>${title}</h4><h2>${val}</h2></div>`;
}

function empty() {
  return `<p>لا يوجد بيانات</p>`;
}