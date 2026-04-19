import { supabase, dbUpdate } from "..core/data.js";

// ===============================
// 🎯 RENDER SALES PAGE
// ===============================

export async function renderSalesPage(app) {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .neq("status", "closed")
    .order("created_at", { ascending: false });

  app.innerHTML = `
    <div class="header">
      <h2>🛒 المبيعات</h2>
    </div>

    ${!invoices?.length ? empty("لا توجد فواتير") : invoices.map(renderCard).join("")}
  `;
}

// ===============================
// 📦 INVOICE CARD
// ===============================

function renderCard(inv) {
  return `
    <div class="card">
      <h3>${inv.supplier_name}</h3>
      <p>📅 ${inv.date}</p>
      <button onclick="openSalesInvoice('${inv.id}')">🛒 بيع</button>
    </div>
  `;
}

// ===============================
// 📂 OPEN INVOICE FOR SALE
// ===============================

window.openSalesInvoice = async function (id) {
  const app = document.getElementById("app");

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();

  const { data: products } = await supabase
    .from("invoice_products")
    .select("*")
    .eq("invoice_id", id);

  app.innerHTML = `
    <button onclick="navigate('sales')">⬅️ رجوع</button>

    <h2>🛒 بيع من فاتورة: ${invoice.supplier_name}</h2>

    ${renderProducts(products, id)}
  `;
};

// ===============================
// 📦 RENDER PRODUCTS
// ===============================

function renderProducts(products, invoiceId) {
  if (!products?.length) return empty("لا توجد أصناف");

  return `
    <table class="table">
      <thead>
        <tr>
          <th>الصنف</th>
          <th>المتبقي</th>
          <th>بيع</th>
        </tr>
      </thead>
      <tbody>
        ${products.map(p => {
          const remaining = p.qty - p.sold - p.returned;

          return `
            <tr>
              <td>${p.name}</td>
              <td>${remaining}</td>
              <td>
                <button onclick="sellProduct('${p.id}', '${invoiceId}', ${remaining})">
                  بيع
                </button>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

// ===============================
// 💰 SELL PRODUCT
// ===============================

window.sellProduct = async function (productId, invoiceId, maxQty) {
  const qty = Number(prompt("الكمية"));
  const price = Number(prompt("السعر"));

  if (!qty || qty <= 0) return;
  if (qty > maxQty) {
    alert("الكمية أكبر من المتاح");
    return;
  }

  const type = prompt("نوع البيع: cash / credit / shop");

  let customerId = null;
  let customerName = null;
  let shopId = null;

  // ===============================
  // 👤 آجل
  // ===============================
  if (type === "credit") {
    customerName = prompt("اسم العميل");
    if (!customerName) return;

    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("name", customerName)
      .single();

    if (!customer) {
      alert("العميل غير موجود");
      return;
    }

    customerId = customer.id;
  }

  // ===============================
  // 🏬 محل
  // ===============================
  if (type === "shop") {
    const name = prompt("اسم المحل");

    const { data: shop } = await supabase
      .from("market_shops")
      .select("*")
      .eq("name", name)
      .single();

    if (!shop) {
      alert("المحل غير موجود");
      return;
    }

    shopId = shop.id;
  }

  processSale(productId, invoiceId, qty, price, type, customerId, customerName, shopId);
};

// ===============================
// ⚙️ PROCESS SALE
// ===============================

async function processSale(productId, invoiceId, qty, price, type, customerId, customerName, shopId) {
  const total = qty * price;

  // 1. تسجيل البيع
  await supabase.from("sales").insert({
    product_id: productId,
    invoice_id: invoiceId,
    qty,
    price,
    total,
    type,
    customer_id: customerId,
    shop_id: shopId
  });

  // 2. تحديث المنتج
  const { data: product } = await supabase
    .from("invoice_products")
    .select("*")
    .eq("id", productId)
    .single();

  await dbUpdate("invoice_products", productId, {
    sold: product.sold + qty,
    sales_total: (product.sales_total || 0) + total
  });

  const today = new Date().toISOString().split("T")[0];

  // ===============================
  // 👤 ترحيل للعميل
  // ===============================
  if (type === "credit") {
    await supabase.from("daily_sales").insert({
      customer_id: customerId,
      customer_name: customerName,
      product_name: product.name,
      qty,
      price,
      total,
      invoice_id: invoiceId,
      date: today
    });
  }

  // ===============================
  // 🏬 ترحيل للمحل
  // ===============================
  if (type === "shop") {
    await supabase.from("shop_credits").insert({
      shop_id: shopId,
      amount: total,
      date: today,
      source: "sale"
    });
  }

  // ===============================
  // 🔒 فحص إغلاق الفاتورة
  // ===============================
  await checkInvoiceClose(invoiceId);

  alert("تم البيع");

  openSalesInvoice(invoiceId);
}

// ===============================
// 🔒 AUTO CLOSE INVOICE
// ===============================

async function checkInvoiceClose(invoiceId) {
  const { data: products } = await supabase
    .from("invoice_products")
    .select("*")
    .eq("invoice_id", invoiceId);

  const allDone = products.every(p => {
    const remaining = p.qty - p.sold - p.returned;
    return remaining <= 0;
  });

  if (!allDone) return;

  let gross = 0;
  products.forEach(p => {
    gross += p.override_total ?? p.sales_total ?? 0;
  });

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  const commission = gross * (invoice.commission_rate || 0.07);
  const expenses = commission + invoice.noulon + invoice.mashal;
  const net = gross - expenses - invoice.advance_payment;

  await dbUpdate("invoices", invoiceId, {
    status: "closed",
    gross,
    total_expenses: expenses,
    net
  });
}

// ===============================
// 🧩 EMPTY
// ===============================

function empty(msg) {
  return `<p style="text-align:center">${msg}</p>`;
}