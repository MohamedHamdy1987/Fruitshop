// ===============================
// 📦 IMPORTS
// ===============================

import { getCurrentUser } from "./data.js";
import { checkSubscription } from "./subscription.js";
import { requireAuth, signOut } from "./auth.js";

// الصفحات
import { renderDashboard } from "./pages/dashboard.js";
import { renderInvoicesPage } from "./pages/invoices.js";
import { renderSalesPage } from "./pages/sales.js";
import { renderSuppliersPage } from "./pages/suppliers.js";
import { renderCustomersPage } from "./pages/customers.js";
import { renderTarhilPage } from "./pages/tarhil.js";
import { renderKhaznaPage } from "./pages/khazna.js";
import { renderEmployeesPage } from "./pages/employees.js";
import { renderMarketShopsPage } from "./pages/market_shops.js";

// ===============================
// 🧭 ROUTES
// ===============================

const routes = {
  dashboard: renderDashboard,
  invoices: renderInvoicesPage,
  sales: renderSalesPage,
  suppliers: renderSuppliersPage,
  customers: renderCustomersPage,
  tarhil: renderTarhilPage,
  khazna: renderKhaznaPage,
  employees: renderEmployeesPage,
  market_shops: renderMarketShopsPage,
};

// ===============================
// 🚀 INIT APP
// ===============================

window.addEventListener("DOMContentLoaded", async () => {
  const app = document.getElementById("app");

  // 1️⃣ تحقق تسجيل الدخول
  const user = await requireAuth();

  if (!user) return;

  // 2️⃣ تحقق الاشتراك (مع إنشاء تلقائي إذا لزم)
  const isActive = await checkSubscription();

  if (!isActive) {
    app.innerHTML = `
      <div class="center" style="padding: 40px; text-align: center;">
        <h2>🚫 الاشتراك منتهي</h2>
        <p>يرجى تجديد الاشتراك للاستمرار</p>
        <button class="btn" onclick="window.location.href='index.html'">العودة للرئيسية</button>
      </div>
    `;
    return;
  }

  // 3️⃣ عرض اسم المستخدم
  displayUserInfo(user);

  // 4️⃣ تشغيل التطبيق
  setupNavigation();
  setupLogout();
  navigate("dashboard");
});

// ===============================
// 👤 DISPLAY USER INFO
// ===============================

async function displayUserInfo(user) {
  const userEl = document.querySelector(".user");
  if (userEl) {
    const email = user.email || "مستخدم";
    userEl.innerHTML = `👤 ${email.split('@')[0]}`;
  }
}

// ===============================
// 🚪 SETUP LOGOUT
// ===============================

function setupLogout() {
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      if (confirm("هل أنت متأكد من تسجيل الخروج؟")) {
        await signOut();
      }
    });
  }
}

// ===============================
// 🔁 NAVIGATION
// ===============================

window.navigate = async function (page) {
  const app = document.getElementById("app");

  try {
    app.innerHTML = `<div class="loading">جاري التحميل...</div>`;

    if (!routes[page]) {
      app.innerHTML = `<p>الصفحة غير موجودة</p>`;
      return;
    }

    await routes[page](app);

    setActive(page);
    updatePageTitle(page);

  } catch (err) {
    console.error("NAV ERROR:", err);
    app.innerHTML = `<p>حدث خطأ: ${err.message}</p>`;
  }
};

// ===============================
// 📌 MENU
// ===============================

function setupNavigation() {
  document.querySelectorAll("[data-nav]").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.getAttribute("data-nav");
      navigate(page);
    });
  });
}

function setActive(page) {
  document.querySelectorAll("[data-nav]").forEach(btn => {
    btn.classList.remove("active");

    if (btn.getAttribute("data-nav") === page) {
      btn.classList.add("active");
    }
  });
}

// ===============================
// 📄 PAGE TITLE
// ===============================

function updatePageTitle(page) {
  const titles = {
    dashboard: "الرئيسية",
    invoices: "الفواتير",
    sales: "المبيعات",
    suppliers: "الموردين",
    customers: "العملاء",
    tarhil: "الترحيلات",
    khazna: "الخزنة",
    employees: "الموظفين",
    market_shops: "محلات السوق"
  };

  const titleEl = document.getElementById("page-title");
  if (titleEl) {
    titleEl.textContent = titles[page] || page;
  }
}

// ===============================
// 🔍 SEARCH (GLOBAL)
// ===============================

window.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.querySelector(".search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      console.log("Search:", e.target.value);
    });
  }
});
