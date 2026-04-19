import { supabase, dbInsert, dbUpdate } from "../data.js";
import { toast, formatCurrency } from "../ui.js";

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
      <button class="btn" onclick="openAddCustomer()">➕ إضافة عميل</button>
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
      <p>📞 ${c.phone || "-"}</p>
      <p>💰 رصيد مبدئي: ${c.opening_balance || 0}</p>
      <button class="btn" onclick="openCustomer('${c.id}', '${c.name}', ${c.opening_balance || 0})">
        📂 عرض الحساب
      </button>
    </div>
  `;
}

// ===============================
// ➕ ADD CUSTOMER
// ===============================

window.openAddCustomer = async function () {
  const name = prompt("اسم العميل");
  if (!name) return;

  const phone = prompt("الموبايل");
  const opening = Number(prompt("رصيد مبدئي") || 0);

  const ok = await dbInsert("customers", {
    name,
    phone,
    opening_balance: opening
  });

  if (ok) {
    toast("تم إضافة العميل");
    navigate("customers");
  } else {
    toast("فشل الإضافة", "error");
  }
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
    <button class="btn btn-outline" onclick="navigate('customers')">⬅️ رجوع</button>

    <h2>${name}</h2>

    <div class="card">
      <p>💰 ${formatCurrency(opening)} رصيد مبدئي</p>

      ${renderDailyLines(daily)}

      <hr>

      <p>📊 الإجمالي: ${formatCurrency(total)}</p>
      <p>💸 تحصيلات: ${formatCurrency(totalCollected)}</p>
      <p>🧾 خصومات: ${formatCurrency(totalAdj)}</p>

      <hr>

      <h3>🔵 الباقي: ${formatCurrency(net)}</h3>

      <div style="margin-top: 20px;">
        <button class="btn" onclick="addCollection('${id}')">💰 تحصيل</button>
        <button class="btn btn-outline" onclick="addAdjustment('${id}')">🧾 خصم / قطعية</button>
      </div>
    </div>
  `;
};

// ===============================
// 💰 ADD COLLECTION
// ===============================

window.addCollection = async function (customerId) {
  const amount = Number(prompt("المبلغ المحصل"));
  if (!amount || amount <= 0) return;

  const ok = await dbInsert("collections", {
    customer_id: customerId,
    amount,
    date: new Date().toISOString()
  });

  if (ok) {
    toast("تم تسجيل التحصيل");
    const { data: c } = await supabase.from("customers").select("*").eq("id", customerId).single();
    openCustomer(customerId, c.name, c.opening_balance);
  } else {
    toast("فشل التسجيل", "error");
  }
};

// ===============================
// 🧾 ADD ADJUSTMENT
// ===============================

window.addAdjustment = async function (customerId) {
  const amount = Number(prompt("قيمة الخصم"));
  if (!amount) return;

  const reason = prompt("السبب (اختياري)");

  const ok = await dbInsert("adjustments", {
    customer_id: customerId,
    amount,
    reason,
    date: new Date().toISOString()
  });

  if (ok) {
    toast("تم تسجيل الخصم");
    const { data: c } = await supabase.from("customers").select("*").eq("id", customerId).single();
    openCustomer(customerId, c.name, c.opening_balance);
  } else {
    toast("فشل التسجيل", "error");
  }
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
    <p onclick="openTarhilDetails('${date}')" style="cursor:pointer; color:#14b8a6;">
      📅 ${date}: ${formatCurrency(map[date])}
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
    <button class="btn btn-outline" onclick="navigate('customers')">⬅️ رجوع</button>

    <h2>📋 تفاصيل يوم ${date}</h2>

    ${data?.length ? data.map(i => `
      <div class="card">
        <strong>${i.customer_name}</strong> - ${i.product_name} - ${i.qty} × ${i.price} = ${formatCurrency(i.total)}
      </div>
    `).join("") : "<p>لا توجد مبيعات</p>"}
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
