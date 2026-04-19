import { supabase } from "./data.js";

// ===============================
// 🎯 CHECK SUBSCRIPTION
// ===============================

export async function checkSubscription() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) return false;

  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("active", true)
    .single();

  if (!data) return false;

  const today = new Date();
  const end = new Date(data.end_date);

  if (end < today) {
    await expireSubscription(user.id);
    return false;
  }

  return true;
}

// ===============================
// ⛔ EXPIRE
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
// 🆕 CREATE TRIAL
// ===============================

export async function createTrial(userId) {
  const today = new Date();
  const end = new Date();
  end.setDate(today.getDate() + 7);

  await supabase.from("subscriptions").insert({
    user_id: userId,
    plan: "trial",
    start_date: today.toISOString(),
    end_date: end.toISOString(),
    active: true
  });
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
    .single();

  if (!data) return { status: "none" };

  const today = new Date();
  const end = new Date(data.end_date);

  if (end < today) {
    return { status: "expired", plan: data.plan, endDate: data.end_date };
  }

  return {
    status: "active",
    plan: data.plan,
    endDate: data.end_date,
    daysLeft: Math.ceil((end - today) / (1000 * 60 * 60 * 24))
  };
}
