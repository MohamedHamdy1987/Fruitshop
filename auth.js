import { supabase } from "./data.js";

// ===============================
// 🔐 SIGN UP
// ===============================

export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (error) {
    console.error("SIGNUP ERROR:", error.message);
    return { success: false, error: error.message };
  }

  // إنشاء بروفايل للمستخدم
  if (data?.user) {
    await supabase.from("profiles").insert({
      id: data.user.id,
      full_name: fullName,
      email: email,
      subscription_status: "trial"
    });

    // إنشاء تجربة مجانية
    await createTrialSubscription(data.user.id);
  }

  return { success: true, user: data?.user };
}

// ===============================
// 🔑 SIGN IN
// ===============================

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error("SIGNIN ERROR:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, user: data?.user };
}

// ===============================
// 🚪 SIGN OUT
// ===============================

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error("SIGNOUT ERROR:", error.message);
    return false;
  }

  window.location.href = "index.html";
  return true;
}

// ===============================
// 🔄 RESET PASSWORD
// ===============================

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/reset-password.html"
  });

  if (error) {
    console.error("RESET ERROR:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ===============================
// 🆕 CREATE TRIAL SUBSCRIPTION
// ===============================

async function createTrialSubscription(userId) {
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
// 👤 GET USER PROFILE
// ===============================

export async function getUserProfile() {
  const user = await supabase.auth.getUser();
  
  if (!user?.data?.user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.data.user.id)
    .single();

  return data;
}

// ===============================
// ✏️ UPDATE PROFILE
// ===============================

export async function updateProfile(updates) {
  const user = await supabase.auth.getUser();
  
  if (!user?.data?.user) return false;

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.data.user.id);

  if (error) {
    console.error("UPDATE PROFILE ERROR:", error.message);
    return false;
  }

  return true;
}

// ===============================
// ✅ CHECK AUTH
// ===============================

export async function checkAuth() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user || null;
}

// ===============================
// 🛡️ REQUIRE AUTH (للصفحات المحمية)
// ===============================

export async function requireAuth() {
  const user = await checkAuth();
  
  if (!user) {
    window.location.href = "index.html";
    return null;
  }

  return user;
}
