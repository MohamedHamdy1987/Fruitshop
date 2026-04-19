import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ===============================
// 🔐 INIT SUPABASE
// ===============================

const supabaseUrl = "https://qlixwdomshvocerxpamy.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsaXh3ZG9tc2h2b2NlcnhwYW15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mzc3MTMsImV4cCI6MjA5MjAxMzcxM30.PFSAQ4J6WBLPHiTpgED7l4JiK4jmhL82MQFuJogwZhs"

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

// ===============================
// 🔄 UPSERT (INSERT OR UPDATE)
// ===============================

export async function dbUpsert(table, data, conflictColumn = "id") {
  const user = await getCurrentUser()

  if (!user) return false

  const payload = {
    ...data,
    user_id: user.id
  }

  const { error } = await supabase
    .from(table)
    .upsert(payload, { onConflict: conflictColumn })

  if (error) {
    console.error("UPSERT ERROR:", error.message)
    return false
  }

  return true
}
