import { supabase } from "..core/data.js";

// ===============================
// 🎯 RENDER PAGE
// ===============================

export async function renderTarhilPage(app) {
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("daily_sales")
    .select("*")
    .eq("date", today);

  const grouped = groupByCustomer(data);

  app.innerHTML = `
    <div class="header">
      <h2>📋 يومية العملاء (آجل)</h2>
    </div>

    ${renderCustomers(grouped)}
  `;
}

// ===============================
// 📊 GROUP BY CUSTOMER (BY ID)
// ===============================

function groupByCustomer(rows = []) {
  const map = {};

  rows.forEach(r => {
    if (!map[r.customer_id]) {
      map[r.customer_id] = {
        name: r.customer_name,
        total: 0,
        items: []
      };
    }

    map[r.customer_id].total += Number(r.total || 0);
    map[r.customer_id].items.push(r);
  });

  return map;
}

// ===============================
// 👥 RENDER CUSTOMERS
// ===============================

function renderCustomers(grouped) {
  const ids = Object.keys(grouped);

  if (!ids.length) return empty();

  return ids.map(id => {
    const g = grouped[id];

    return `
      <div class="card">
        <h3>${g.name}</h3>

        ${g.items.map(i => `
          <div class="row">
            ${i.product_name} - ${i.qty} × ${i.price} = ${i.total}
          </div>
        `).join("")}

        <hr>

        <h4>الإجمالي: ${g.total}</h4>
      </div>
    `;
  }).join("");
}

// ===============================
// 🧩 EMPTY
// ===============================

function empty() {
  return `<p>لا توجد بيانات اليوم</p>`;
}