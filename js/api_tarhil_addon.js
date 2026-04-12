// ============================================================
// إضافات API.tarhil — تُضاف في نهاية api.js
// جلب مبيعات الآجل مجمعة حسب العميل واليوم
// ============================================================

// ─── إضافة namespace tarhil لكائن API الموجود ───────────────
API.tarhil = {

  // جلب ترحيلات يوم محدد (آجل فقط، مجمعة حسب العميل)
  async getByDate(date) {
    const { data, error } = await sb
      .from('daily_sales')
      .select(`
        id,
        sale_date,
        customer_id,
        quantity,
        weight_kg,
        unit_price,
        total_amount,
        is_cash,
        product:products(name, unit),
        customer:customers(name, phone)
      `)
      .eq('company_id', currentUser.company_id)
      .eq('sale_date',  date)
      .eq('is_cash',    false)
      .order('customer_id', { ascending: true })
      .order('created_at',  { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // إجمالي ترحيلات يوم (للـ KPI)
  async getDayTotal(date) {
    const { data, error } = await sb
      .from('daily_sales')
      .select('total_amount')
      .eq('company_id', currentUser.company_id)
      .eq('sale_date',  date)
      .eq('is_cash',    false);
    if (error) throw error;
    return (data||[]).reduce((s,x) => s + parseFloat(x.total_amount||0), 0);
  }
};

// ─── إضافة جلب مبيعات دفعة واحدة (batch) ────────────────────
API.sales.listByBatch = async function(batchId) {
  const { data, error } = await sb
    .from('daily_sales')
    .select(`
      id,
      quantity,
      weight_kg,
      unit_price,
      total_amount,
      is_cash,
      sale_date,
      customer_id,
      customer:customers(name)
    `)
    .eq('company_id', currentUser.company_id)
    .eq('batch_id',   batchId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};
