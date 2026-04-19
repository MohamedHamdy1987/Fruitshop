import { supabase } from "../data.js";

// ===============================
// 🎯 RENDER DASHBOARD
// ===============================

export async function renderDashboard(app) {
  // تحميل Chart.js إذا لم يكن موجوداً
  if (!window.Chart) {
    await loadChartJS();
  }

  app.innerHTML = `
    <div class="grid">
      <div class="card">
        <h3>📊 المبيعات اليومية</h3>
        <canvas id="salesChart"></canvas>
      </div>
      <div class="card">
        <h3>💰 الأرباح</h3>
        <canvas id="profitChart"></canvas>
      </div>
    </div>
    <div class="grid" style="margin-top: 20px;">
      <div class="card">
        <h3>📈 ملخص سريع</h3>
        <div id="summary-stats">جاري التحميل...</div>
      </div>
    </div>
  `;

  await loadCharts();
  await loadSummary();
}

// ===============================
// 📊 LOAD CHARTS
// ===============================

async function loadCharts() {
  const { data: sales } = await supabase.from("sales").select("*");
  const { data: invoices } = await supabase.from("invoices").select("*");

  const daily = groupByDate(sales);
  const profit = groupProfit(invoices);

  drawSalesChart(daily);
  drawProfitChart(profit);
}

// ===============================
// 📈 GROUP DATA
// ===============================

function groupByDate(data) {
  const map = {};

  data?.forEach(s => {
    const d = s.created_at?.split("T")[0];
    if (!map[d]) map[d] = 0;
    map[d] += Number(s.total || 0);
  });

  // ترتيب التواريخ
  return Object.keys(map).sort().reduce((obj, key) => {
    obj[key] = map[key];
    return obj;
  }, {});
}

function groupProfit(data) {
  const map = {};

  data?.forEach(i => {
    if (i.status !== "closed") return;
    const d = i.date;
    if (!map[d]) map[d] = 0;
    map[d] += Number(i.net || 0);
  });

  return Object.keys(map).sort().reduce((obj, key) => {
    obj[key] = map[key];
    return obj;
  }, {});
}

// ===============================
// 📊 DRAW CHARTS
// ===============================

function drawSalesChart(data) {
  const ctx = document.getElementById("salesChart");
  if (!ctx) return;

  new Chart(ctx, {
    type: "line",
    data: {
      labels: Object.keys(data),
      datasets: [{
        label: "المبيعات",
        data: Object.values(data),
        borderWidth: 3,
        borderColor: "#14b8a6",
        tension: 0.3,
        fill: false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: 'white' } }
      },
      scales: {
        x: { ticks: { color: 'white' } },
        y: { ticks: { color: 'white' } }
      }
    }
  });
}

function drawProfitChart(data) {
  const ctx = document.getElementById("profitChart");
  if (!ctx) return;

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(data),
      datasets: [{
        label: "الأرباح",
        data: Object.values(data),
        backgroundColor: "#22c55e",
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: 'white' } }
      },
      scales: {
        x: { ticks: { color: 'white' } },
        y: { ticks: { color: 'white' } }
      }
    }
  });
}

// ===============================
// 📋 LOAD SUMMARY
// ===============================

async function loadSummary() {
  const container = document.getElementById("summary-stats");
  if (!container) return;

  // إحصائيات سريعة
  const { data: sales } = await supabase.from("sales").select("total");
  const { data: customers } = await supabase.from("customers").select("id");
  const { data: invoices } = await supabase.from("invoices").select("status");

  const totalSales = sales?.reduce((s, x) => s + Number(x.total || 0), 0) || 0;
  const activeInvoices = invoices?.filter(i => i.status === "open").length || 0;

  container.innerHTML = `
    <p>💰 إجمالي المبيعات: ${totalSales.toLocaleString()} ج.م</p>
    <p>👥 عدد العملاء: ${customers?.length || 0}</p>
    <p>📄 فواتير مفتوحة: ${activeInvoices}</p>
  `;
}

// ===============================
// 📦 LOAD CHART.JS
// ===============================

function loadChartJS() {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
    script.onload = resolve;
    document.head.appendChild(script);
  });
}
