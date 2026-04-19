import { createClient } from '@supabase/supabase-js'

// ===============================
// 🔐 INIT SUPABASE
// ===============================

const supabaseUrl = "https://YOUR_PROJECT_ID.supabase.co"
const supabaseKey = "YOUR_ANON_KEY"
export const supabase = createClient(supabaseUrl, supabaseKey)

// ===============================
// 👤 GET CURRENT USER
// ===============================

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser()
  return data?.user || null
}

// ===============================
// 🧠 INSERT (AUTO user_id)
// ===============================

export async function dbInsert(table, data) {
  const user = await getCurrentUser()

  if (!user) {
    console.error("❌ No user")
    return false
  }

  const payload = {
    ...data,
    user_id: user.id
  }

  const { error } = await supabase
    .from(table)
    .insert(payload)

  if (error) {
    console.error("INSERT ERROR:", error.message)
    return false
  }

  return true
}

// ===============================
// ✏️ UPDATE (SAFE)
// ===============================

export async function dbUpdate(table, id, data) {
  const user = await getCurrentUser()

  if (!user) return false

  const { error } = await supabase
    .from(table)
    .update(data)
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error("UPDATE ERROR:", error.message)
    return false
  }

  return true
}

// ===============================
// ❌ DELETE (SAFE)
// ===============================

export async function dbDelete(table, id) {
  const user = await getCurrentUser()

  if (!user) return false

  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error("DELETE ERROR:", error.message)
    return false
  }

  return true
}

// ===============================
// 📥 SELECT (SAFE)
// ===============================

export async function dbSelect(table) {
  const user = await getCurrentUser()

  if (!user) return []

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("user_id", user.id)

  if (error) {
    console.error("SELECT ERROR:", error.message)
    return []
  }

  return data
}