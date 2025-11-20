// /_sdk/data_sdk.js

// --- Your Supabase credentials ---
const SUPABASE_URL = "https://hctorxtkxrcatpxcwyqq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjdG9yeHRreHJjYXRweGN3eXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MTg3MTcsImV4cCI6MjA3OTE5NDcxN30.lcfza0EuS-TKL_XCY3ZScM-q_KCWCrRypC4cXsb8V2A";

// --- Helper to call Supabase REST API ---
async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    console.error("Supabase error:", res.status, await res.text());
    throw new Error("Supabase request failed");
  }

  return res.json();
}

// Optional - manual cleanup trigger
async function deleteOldOrdersOneYear() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/delete_old_orders`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });

  if (!res.ok) {
    console.error("Failed to call delete_old_orders RPC", res.status, await res.text());
  }
}

// --- SDK exposed to index.html ---
window.dataSdk = {
  // Called on startup to fetch all orders
  async init(handler) {
    try {
      const data = await supabaseFetch("orders?select=*");
      handler.onDataChanged(data);
      return { isOk: true };
    } catch (e) {
      console.error("dataSdk.init error:", e);
      return { isOk: false, error: e.message };
    }
  },

  // Called every time you add a line-item to the DB
  async create(row) {
    try {
      const [inserted] = await supabaseFetch("orders", {
        method: "POST",
        body: JSON.stringify([row])
      });
      return { isOk: true, value: inserted };
    } catch (e) {
      console.error("dataSdk.create error:", e);
      return { isOk: false, error: e.message };
    }
  }
};
