import { supabase } from "../data.js";
import { formatCurrency } from "../ui.js";

// ===============================
// 🎯 RENDER PAGE
// ===============================

export async function renderTarhilPage(app) {
  const today = new Date().toISOString().split("T")[0];

  app.innerHTML = `
    <div class="header">
      <h2>📋 يومية العملاء (آجل)</h2>
      <div>
        <input type="date" id="tarhil-date" value="${today}" class="form-control" style="padding:8px; border-radius:8px; border:none;">
        <button class="btn" onclick="loadTarhilByDate()">عرض</button>
      </div>
    </div>

    <div id="tarhil-content">
      جاري التحميل...
    </div>
  `;

  await loadTarhilData(today);
}

// ===============================
// 🔄 LOAD BY DATE
// ===============================

window.loadTarhilByDate = async function () {
  const dateInput = document.getElementById("tarhil-date");
  if (dateInput) {
    await loadTarhilData(dateInput.value);
  }
};

async function loadTarhilData(date) {
  const container = document.getElementById("tarhil-content");
  if (!container) return;

  const { data } = await supabase
    .from("daily_sales")
    .select("*")
    .eq("date", date);

  const grouped = groupByCustomer(data);

  if (!Object.keys(grouped).length) {
    container.innerHTML = empty();
    return;
  }

  container.innerHTML = renderCustomers(grouped);
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

  return ids.map(id => {
    const g = grouped[id];

    return `
      <div class="card">
        <h3>👤 ${g.name}</h3>

        <table class="table">
          <thead>
            <tr>
              <th>الصنف</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${g.items.map(i => `
              <tr>
                <td>${i.product_name}</td>
                <td>${i.qty}</td>
                <td>${formatCurrency(i.price)}</td>
                <td>${formatCurrency(i.total)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <hr>

        <h4>الإجمالي: ${formatCurrency(g.total)}</h4>
      </div>
    `;
  }).join("");
}

// ===============================
// 🧩 EMPTY
// ===============================

function empty() {
  return `<p>لا توجد بيانات لهذا اليوم</p>`;
}
