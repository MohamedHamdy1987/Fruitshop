import { supabase, dbUpdate } from "../data.js";
import { toast } from "../ui.js";

// ===============================
// 🎯 RENDER SETTINGS PAGE
// ===============================

export async function renderSettingsPage(app) {
  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .single();

  const defaultCommission = settings?.default_commission || 0.07;

  app.innerHTML = `
    <div class="header">
      <h2>⚙️ الإعدادات</h2>
    </div>

    <div class="card">
      <h3>إعدادات الفواتير</h3>
      
      <div class="form-group">
        <label>نسبة العمولة الافتراضية %</label>
        <input type="number" id="commission-rate" step="0.01" value="${defaultCommission * 100}" 
               style="width:100%; padding:10px; border-radius:8px; border:none;">
      </div>

      <button class="btn" onclick="saveSettings()">💾 حفظ الإعدادات</button>
    </div>

    <div class="card">
      <h3>معلومات الحساب</h3>
      <div id="account-info">جاري التحميل...</div>
    </div>
  `;

  loadAccountInfo();
}

// ===============================
// 💾 SAVE SETTINGS
// ===============================

window.saveSettings = async function () {
  const commissionPercent = Number(document.getElementById("commission-rate").value) || 7;
  const commissionRate = commissionPercent / 100;

  // Upsert settings
  const { data: existing } = await supabase.from("settings").select("id").single();
  
  if (existing) {
    await dbUpdate("settings", existing.id, { default_commission: commissionRate });
  } else {
    await supabase.from("settings").insert({ default_commission: commissionRate });
  }

  toast("تم حفظ الإعدادات");
};

// ===============================
// 👤 LOAD ACCOUNT INFO
// ===============================

async function loadAccountInfo() {
  const container = document.getElementById("account-info");
  
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) {
    container.innerHTML = "<p>غير متاح</p>";
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  container.innerHTML = `
    <p><strong>البريد:</strong> ${user.email}</p>
    <p><strong>الاسم:</strong> ${profile?.full_name || "-"}</p>
    <p><strong>حالة الاشتراك:</strong> ${profile?.subscription_status || "trial"}</p>
  `;
}
