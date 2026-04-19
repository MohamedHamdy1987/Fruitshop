import { supabase } from "../data.js";
import { formatCurrency } from "../ui.js";

export async function renderDashboard(app) {
  const today = new Date();
  const day = today.getDate();
  const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const month = monthNames[today.getMonth()];
  const year = today.getFullYear();
  const weekdays = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const weekday = weekdays[today.getDay()];

  // الحصول على اسم المحل من البروفايل
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .single();

  const shopName = profile?.full_name || "محل الحاج حمدي السنوسي وأولاده";

  app.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <!-- بطاقة الترحيب والتاريخ -->
      <div class="card" style="padding: 32px 28px; background: linear-gradient(135deg, #FDF8F2 0%, #F5EDE3 100%);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1 style="font-size: 32px; font-weight: 800; margin-bottom: 8px; color: #3E2E21;">${shopName}</h1>
            <p style="font-size: 18px; color: #6B4F32; margin-bottom: 20px;">إدارة متكاملة</p>
            <div style="display: flex; align-items: baseline; gap: 8px;">
              <span style="font-size: 64px; font-weight: 800; color: #8B5E3C;">${day}</span>
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 20px; font-weight: 600;">${weekday}</span>
                <span style="font-size: 18px; color: #6B4F32;">${month} ${year}</span>
              </div>
            </div>
          </div>
          <div style="background: white; padding: 12px 20px; border-radius: 60px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
            <span style="color: #C9A96E; font-weight: 700;">✓ محفوظ على السحابة</span>
          </div>
        </div>
      </div>

      <!-- ملخص سريع -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px,1fr)); gap: 20px;">
        ${await summaryCard("المبيعات اليوم", await getTodaySales())}
        ${await summaryCard("العملاء", await getCustomersCount())}
        ${await summaryCard("الفواتير المفتوحة", await getOpenInvoices())}
        ${await summaryCard("صافي الخزنة", await getNetCash())}
      </div>
    </div>
  `;
}

async function summaryCard(title, value) {
  return `
    <div class="card" style="text-align: center;">
      <h4 style="color: #6B4F32; margin-bottom: 12px;">${title}</h4>
      <div style="font-size: 36px; font-weight: 800; color: #8B5E3C;">${value}</div>
    </div>
  `;
}

async function getTodaySales() {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase.from("sales").select("total").gte("created_at", today);
  const sum = data?.reduce((s, x) => s + Number(x.total), 0) || 0;
  return formatCurrency(sum);
}

async function getCustomersCount() {
  const { count } = await supabase.from("customers").select("*", { count: "exact", head: true });
  return count || 0;
}

async function getOpenInvoices() {
  const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true }).eq("status", "open");
  return count || 0;
}

async function getNetCash() {
  const { data: col } = await supabase.from("collections").select("amount");
  const { data: exp } = await supabase.from("expenses").select("amount");
  const cash = col?.reduce((s, x) => s + Number(x.amount), 0) || 0;
  const expenses = exp?.reduce((s, x) => s + Number(x.amount), 0) || 0;
  return formatCurrency(cash - expenses);
}