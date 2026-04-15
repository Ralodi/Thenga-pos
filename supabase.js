// ==================== SUPABASE CONFIG ====================
const SUPABASE_URL = 'fiarguztbpkevntmtbzo'; // from Supabase > Settings > API
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpYXJndXp0YnBrZXZudG10YnpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTIyODgsImV4cCI6MjA4ODEyODI4OH0.MmeJdbqVUcgfYdy3PJPOqI1h6zs4Tf2VXT6-piL96JU'; // from Supabase > Settings > API

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== BUSINESS ====================
async function sbRegisterBusiness(data) {
    const { data: result, error } = await db
        .from('pos_businesses')
        .insert([data])
        .select()
        .single();
    if (error) throw error;
    return result;
}

async function sbGetBusiness(id) {
    const { data, error } = await db
        .from('pos_businesses')
        .select('*')
        .eq('id', id)
        .single();
    if (error) throw error;
    return data;
}

async function sbUpdateBusiness(id, updates) {
    const { error } = await db
        .from('pos_businesses')
        .update(updates)
        .eq('id', id);
    if (error) throw error;
}

// ==================== INVENTORY ====================
async function sbGetInventory(businessId) {
    const { data, error } = await db
        .from('pos_inventory')
        .select('*')
        .eq('business_id', businessId)
        .order('name');
    if (error) throw error;
    return data;
}

async function sbSaveInventory(businessId, items) {
    // Delete all and re-insert (simplest sync strategy)
    await db.from('pos_inventory').delete().eq('business_id', businessId);
    if (items.length === 0) return;
    const rows = items.map(p => ({
        business_id: businessId,
        name: p.name,
        price: p.price,
        cost: p.cost,
        stock: p.stock,
        category: p.category,
        barcode: p.barcode || null,
        pack_size: p.packSize || 1,
        icon: p.icon || null
    }));
    const { error } = await db.from('pos_inventory').insert(rows);
    if (error) throw error;
}

// ==================== SALES ====================
async function sbSaveSale(businessId, sale) {
    const { error } = await db.from('pos_sales').insert([{
        business_id: businessId,
        total: sale.total,
        profit: sale.profit,
        items: sale.items,
        created_at: sale.date
    }]);
    if (error) throw error;
}

async function sbGetSales(businessId) {
    const { data, error } = await db
        .from('pos_sales')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(s => ({
        id: s.id,
        date: s.created_at,
        total: s.total,
        profit: s.profit,
        items: s.items
    }));
}

// ==================== CREDIT CUSTOMERS ====================
async function sbGetCustomers(businessId) {
    const { data, error } = await db
        .from('pos_credit_customers')
        .select('*')
        .eq('business_id', businessId)
        .order('name');
    if (error) throw error;
    return data;
}

async function sbSaveCustomers(businessId, customers) {
    await db.from('pos_credit_customers').delete().eq('business_id', businessId);
    if (customers.length === 0) return;
    const rows = customers.map(c => ({
        business_id: businessId,
        name: c.name,
        phone: c.phone || null,
        balance: c.balance || 0
    }));
    const { error } = await db.from('pos_credit_customers').insert(rows);
    if (error) throw error;
}

// ==================== ONLINE CHECK ====================
function isOnline() { return navigator.onLine; }