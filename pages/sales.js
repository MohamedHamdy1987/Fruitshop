import { supabase, dbUpdate } from "../data.js";
import { toast, formatCurrency } from "../ui.js";

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

    ${!invoices?.length ? empty("لا توجد فواتير مفتوحة") : invoices.map(renderCard).join("")}
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
      <button class="btn" onclick="openSalesInvoice('${inv.id}')">🛒 بيع</button>
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
    <button class="btn btn-outline" onclick="navigate('sales')">⬅️ رجوع</button>

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
          const remaining = p.qty - (p.sold || 0) - (p.returned || 0);

          return `
            <tr>
              <td>${p.name}</td>
              <td>${remaining}</td>
              <td>
                <button class="btn" onclick="sellProduct('${p.id}', '${invoiceId}', ${remaining})">
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
  if (!qty || qty <= 0) return;
  if (qty > maxQty) {
    toast("الكمية أكبر من المتاح", "error");
    return;
  }

  const price = Number(prompt("السعر"));
  if (!price) return;

  const type = prompt("نوع البيع: cash / credit / shop");
  if (!["cash", "credit", "shop"].includes(type)) {
    toast("نوع بيع غير صحيح", "error");
    return;
  }

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
      toast("العميل غير موجود", "error");
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
      toast("المحل غير موجود", "error");
      return;
    }

    shopId = shop.id;
  }

  await processSale(productId, invoiceId, qty, price, type, customerId, customerName, shopId);
};

// ===============================
// ⚙️ PROCESS SALE
// ===============================

async function processSale(productId, invoiceId, qty, price, type, customerId, customerName, shopId) {
  const total = qty * price;
  const today = new Date().toISOString().split("T")[0];

  // الحصول على المنتج لمعرفة اسمه
  const { data: product } = await supabase
    .from("invoice_products")
    .select("*")
    .eq("id", productId)
    .single();

  // 1. تسجيل البيع
  await supabase.from("sales").insert({
    product_id: productId,
    invoice_id: invoiceId,
    qty,
    price,
    total,
    type,
    customer_id: customerId,
    shop_id: shopId,
    created_at: new Date().toISOString()
  });

  // 2. تحديث المنتج (المباع والإجمالي)
  const newSold = (product.sold || 0) + qty;
  const newSalesTotal = (product.sales_total || 0) + total;

  await dbUpdate("invoice_products", productId, {
    sold: newSold,
    sales_total: newSalesTotal
  });

  // ===============================
  // 👤 ترحيل للعميل (آجل)
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
  // 🏬 ترحيل للمحل (دائن للمحل)
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

  toast("تم البيع بنجاح");
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

  // الفاتورة تغلق فقط إذا تم بيع أو إرجاع كل الكمية
  const allDone = products.every(p => {
    const remaining = p.qty - (p.sold || 0) - (p.returned || 0);
    return remaining <= 0;
  });

  if (!allDone) return;

  // حساب الإجمالي
  let gross = 0;
  products.forEach(p => {
    gross += Number(p.sales_total || 0);
  });

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  const commissionRate = invoice.commission_rate || 0.07;
  const commission = gross * commissionRate;
  const expenses = commission + (invoice.noulon || 0) + (invoice.mashal || 0);
  const net = gross - expenses - (invoice.advance_payment || 0);

  await dbUpdate("invoices", invoiceId, {
    status: "closed",
    gross,
    total_expenses: expenses,
    net
  });

  toast("تم إغلاق الفاتورة تلقائياً");
}

// ===============================
// 🧩 EMPTY
// ===============================

function empty(msg) {
  return `<p style="text-align:center">${msg}</p>`;
}
