import { supabase } from "../core/data.js"

// ===============================
// 🎯 RENDER CUSTOMERS
// ===============================

export async function renderCustomersPage(app) {
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  app.innerHTML = `
    <div class="header">
      <h2>👥 العملاء</h2>
      <button onclick="openAddCustomer()">➕ إضافة عميل</button>
    </div>

    ${!customers?.length ? empty() : customers.map(renderCard).join("")}
  `;
}

// ===============================
// 📦 CARD
// ===============================

function renderCard(c) {
  return `
    <div class="card">
      <h3>${c.name}</h3>
      <button onclick="openCustomer('${c.id}', '${c.name}', ${c.opening_balance || 0})">
        📂 عرض الحساب
      </button>
    </div>
  `;
}

// ===============================
// ➕ ADD CUSTOMER
// ===============================

window.openAddCustomer = function () {
  const name = prompt("اسم العميل");
  const phone = prompt("الموبايل");
  const opening = Number(prompt("رصيد مبدئي") || 0);

  if (!name) return;

  dbInsert("customers", {
    name,
    phone,
    opening_balance: opening
  });

  navigate("customers");
};

// ===============================
// 📂 OPEN CUSTOMER
// ===============================

window.openCustomer = async function (id, name, opening) {
  const app = document.getElementById("app");

  // 🔥 كل يوميات العميل (مش يوم واحد)
  const daily = await getAllDailySales(id);

  // 💰 تحصيلات
  const collections = await getCollections(id);

  // 🧾 قطعية / سماح
  const adjustments = await getAdjustments(id);

  const totalDaily = sum(daily, "total");
  const totalCollected = sum(collections, "amount");
  const totalAdj = sum(adjustments, "amount");

  const total = opening + totalDaily;
  const net = total - totalCollected - totalAdj;

  app.innerHTML = `
    <button onclick="navigate('customers')">⬅️ رجوع</button>

    <h2>${name}</h2>

    <div class="card">

      <p>💰 ${opening} رصيد مبدئي</p>

      ${renderDailyLines(daily)}

      <hr>

      <p>📊 الإجمالي: ${total}</p>
      <p>💸 خصم: ${totalCollected}</p>
      <p>🧾 قطعية: ${totalAdj}</p>

      <hr>

      <h3>🔵 ${net} الباقي</h3>
    </div>
  `;
};

// ===============================
// 📊 DAILY SALES (ALL DAYS)
// ===============================

async function getAllDailySales(customerId) {
  const { data } = await supabase
    .from("daily_sales")
    .select("*")
    .eq("customer_id", customerId)
    .order("date", { ascending: true });

  return data || [];
}

// ===============================
// 💰 COLLECTIONS
// ===============================

async function getCollections(customerId) {
  const { data } = await supabase
    .from("collections")
    .select("*")
    .eq("customer_id", customerId);

  return data || [];
}

// ===============================
// 🧾 ADJUSTMENTS
// ===============================

async function getAdjustments(customerId) {
  const { data } = await supabase
    .from("adjustments")
    .select("*")
    .eq("customer_id", customerId);

  return data || [];
}

// ===============================
// 📋 RENDER DAILY
// ===============================

function renderDailyLines(daily) {
  if (!daily.length) return `<p>لا يوجد يوميات</p>`;

  // group by date
  const map = {};

  daily.forEach(d => {
    if (!map[d.date]) {
      map[d.date] = 0;
    }
    map[d.date] += Number(d.total || 0);
  });

  return Object.keys(map).map(date => `
    <p onclick="openTarhilDetails('${date}')">
      📅 ${map[date]} يومية ${date}
    </p>
  `).join("");
}

// ===============================
// 🔍 OPEN DAY DETAILS
// ===============================

window.openTarhilDetails = async function (date) {
  const app = document.getElementById("app");

  const { data } = await supabase
    .from("daily_sales")
    .select("*")
    .eq("date", date);

  app.innerHTML = `
    <button onclick="navigate('customers')">⬅️ رجوع</button>

    <h2>📋 تفاصيل يوم ${date}</h2>

    ${data.map(i => `
      <div class="card">
        ${i.product_name} - ${i.qty} × ${i.price} = ${i.total}
      </div>
    `).join("")}
  `;
};

// ===============================
// 🔢 SUM
// ===============================

function sum(arr, key) {
  return arr.reduce((s, x) => s + Number(x[key] || 0), 0);
}

// ===============================
// 🧩 EMPTY
// ===============================

function empty() {
  return `<p>لا يوجد عملاء</p>`;
}