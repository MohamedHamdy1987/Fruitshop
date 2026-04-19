import { supabase } from "./data.js";

// ===============================
// 🎯 CHECK SUBSCRIPTION (مع إنشاء تلقائي)
// ===============================

export async function checkSubscription() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) return false;

  // 1. البحث عن اشتراك نشط
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle(); // use maybeSingle to avoid error if not found

  // 2. إذا لم يوجد اشتراك نشط، ننشئ اشتراك تجريبي جديد
  if (!data) {
    console.log("No active subscription found, creating trial...");
    const created = await createTrialSubscriptionForUser(user.id);
    if (created) return true;
    
    // إذا فشل الإنشاء، نتحقق من وجود اشتراك منتهي ويمكن تمديده
    const { data: expiredSub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (expiredSub) {
      // نتحقق مما إذا كان ما زال في فترة السماح (مثلاً 7 أيام بعد الانتهاء)
      const end = new Date(expiredSub.end_date);
      const today = new Date();
      if (end >= today) {
        // لو ما زال التاريخ صالح، نعيد تنشيطه
        await supabase
          .from("subscriptions")
          .update({ active: true })
          .eq("id", expiredSub.id);
        return true;
      }
    }
    return false;
  }

  const today = new Date();
  const end = new Date(data.end_date);

  if (end < today) {
    await expireSubscription(user.id);
    return false;
  }

  return true;
}

// ===============================
// 🆕 CREATE TRIAL SUBSCRIPTION FOR USER
// ===============================

export async function createTrialSubscriptionForUser(userId) {
  const today = new Date();
  const end = new Date();
  end.setDate(today.getDate() + 7);

  const { error } = await supabase.from("subscriptions").insert({
    user_id: userId,
    plan: "trial",
    start_date: today.toISOString(),
    end_date: end.toISOString(),
    active: true
  });

  if (error) {
    console.error("Failed to create trial subscription:", error.message);
    return false;
  }
  return true;
}

// ===============================
// ⛔ EXPIRE SUBSCRIPTION
// ===============================

async function expireSubscription(userId) {
  await supabase
    .from("subscriptions")
    .update({ active: false })
    .eq("user_id", userId);

  await supabase
    .from("profiles")
    .update({ subscription_status: "expired" })
    .eq("id", userId);
}

// ===============================
// 📊 GET SUBSCRIPTION STATUS
// ===============================

export async function getSubscriptionStatus() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) return null;

  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { status: "none" };

  const today = new Date();
  const end = new Date(data.end_date);

  if (end < today) {
    return { status: "expired", plan: data.plan, endDate: data.end_date };
  }

  return {
    status: data.active ? "active" : "inactive",
    plan: data.plan,
    endDate: data.end_date,
    daysLeft: Math.ceil((end - today) / (1000 * 60 * 60 * 24))
  };
}
