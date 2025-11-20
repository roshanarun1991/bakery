console.log("window.dataSdk at start:", window.dataSdk);

// --- Global state ---
let products = []; // from products.json
let cart = []; // cart items: {productId, name, price, quantity}
let orders = []; // admin/backend table rows (one per item)
let nextBackendId = 1;
let hideCompleted = false;
let isSubmitting = false;

let isAdmin = false;
const ADMIN_PASSWORD = "mamaranta2024"; // change if you want

// Remember last order details for Swish box (if needed)
let lastOrderAmount = null;
let lastOrderId = null;

const defaultConfig = {
  bakery_name: "Mama Ranta Bakery",
  tagline: "Authentic Swedish Baked Goods",
  contact_phone: "+46 8 123 4567",
  contact_email: "hello@mamaranta.se",
  contact_address: "Storgatan 12, Stockholm",
  background_color: "#f9f6f2",
  surface_color: "#ffffff",
  text_color: "#2c1810",
  primary_action_color: "#8b4513",
  secondary_action_color: "#d4a574"
};

const hasBackend =
  typeof window.dataSdk !== "undefined" &&
  typeof window.dataSdk.init === "function" &&
  typeof window.dataSdk.create === "function";

// Sample static reviews
const sampleReviews = [
  {
    text: "The kanelbullar taste just like my mormor used to make. Soft, warm and full of cardamom.",
    author: "Sara L.",
    meta: "Regular since 2022"
  },
  {
    text: "We ordered a prinsesstårta for a birthday – it looked beautiful and disappeared in minutes.",
    author: "Jonas P.",
    meta: "Birthday catering"
  },
  {
    text: "Perfect little fika stop. The home-baked feel makes it special.",
    author: "Emma K.",
    meta: "Neighbourhood guest"
  }
];

function updateBackendStatus(ok) {
  const el = document.getElementById("backend-status");
  if (!el) return;
  if (!hasBackend) {
    el.textContent = "Backend: not configured – using local storage only";
    el.style.color = "#a15b00";
  } else if (!ok) {
    el.textContent = "Backend: error – using local storage only";
    el.style.color = "#a15b00";
  } else {
    el.textContent = "Backend: connected to Supabase";
    el.style.color = "#0b7a2a";
  }
}

// --- Load products from JSON file ---
async function loadProducts() {
  try {
    const response = await fetch("products.json");
    if (!response.ok) {
      throw new Error("Failed to load products.json");
    }
    const data = await response.json();
    products = data.products || [];
    renderProducts();
    renderInventoryPanel();
  } catch (error) {
    console.error("Error loading products:", error);
    const grid = document.getElementById("products-grid");
    grid.innerHTML = "<p>Could not load products at the moment. Please try again later.</p>";
  }
}

// --- Render products grid with image + quantity + add-to-cart + stock ---
function renderProducts() {
  const grid = document.getElementById("products-grid");
  grid.innerHTML = products
    .map(
      (product) => `
      <div class="product-card">
        <div class="product-image">
          ${
            product.image
              ? `<img src="${product.image}" alt="${product.name}">`
              : product.emoji || ""
          }
        </div>
        <div class="product-info">
          <h3>${product.name}</h3>
          <p>${product.description || ""}</p>
          <div class="product-footer">
            <div>
              <div class="price">${product.price} SEK</div>
              <div class="stock-label">
                ${
                  product.stock > 0
                    ? product.stock + " available"
                    : "<span style='color:#b00020;'>Sold out</span>"
                }
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:0.3rem;align-items:flex-end;">
              <select class="qty-select" id="qty-${product.id}" ${
        product.stock === 0 ? "disabled" : ""
      }>
                ${[...Array(10)]
                  .map((_, i) => `<option value="${i + 1}">${i + 1}</option>`)
                  .join("")}
              </select>
              <button
                class="add-cart-btn"
                type="button"
                onclick="addToCart('${product.id}')"
                ${product.stock === 0 ? "disabled" : ""}
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    `
    )
    .join("");
}

// --- Render reviews ---
function renderReviews() {
  const strip = document.getElementById("reviews-strip");
  if (!strip) return;

  const all = sampleReviews;
  if (!all.length) {
    strip.innerHTML = "<p style='color:#666;'>No reviews yet.</p>";
    return;
  }

  strip.innerHTML = all
    .map(
      (r) => `
      <article class="review-card">
        <p class="review-text">${r.text}</p>
        <p class="review-author">${r.author}</p>
        <p class="review-meta">${r.meta}</p>
      </article>
    `
    )
    .join("");
}

// --- Cart helpers ---
function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.getElementById("cart-count");
  if (badge) badge.textContent = count;
}

function addToCart(productId) {
  const product = products.find((p) => p.id === productId);
  if (!product) return;
  if (product.stock <= 0) {
    alert("This item is currently sold out.");
    return;
  }

  const qtySelect = document.getElementById(`qty-${productId}`);
  let quantity = 1;
  if (qtySelect && qtySelect.value) {
    quantity = parseInt(qtySelect.value, 10) || 1;
  }

  const existing = cart.find((item) => item.productId === productId);
  const alreadyInCart = existing ? existing.quantity : 0;
  if (alreadyInCart + quantity > product.stock) {
    alert(`Only ${product.stock} available. You already have ${alreadyInCart} in your cart.`);
    return;
  }

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity
    });
  }

  updateCartCount();
}

function calculateCartTotals() {
  const itemTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = itemTotal >= 500 || itemTotal === 0 ? 0 : 99;
  const grandTotal = itemTotal + shipping;
  return { itemTotal, shipping, grandTotal };
}

function renderCartModal() {
  const emptyMsg = document.getElementById("cart-empty-message");
  const itemsContainer = document.getElementById("cart-items-container");
  const totalEl = document.getElementById("cart-total");
  const shippingEl = document.getElementById("cart-shipping");
  const grandTotalEl = document.getElementById("cart-grand-total");

  if (!cart.length) {
    if (itemsContainer) itemsContainer.innerHTML = "";
    if (totalEl) totalEl.textContent = "";
    if (shippingEl) shippingEl.textContent = "";
    if (grandTotalEl) grandTotalEl.textContent = "";
    if (emptyMsg) emptyMsg.style.display = "block";
    return;
  }

  if (emptyMsg) emptyMsg.style.display = "none";

  if (itemsContainer) {
    itemsContainer.innerHTML =
      `
      <div class="cart-header-row">
        <div>Item</div>
        <div style="text-align:center;">Quantity</div>
        <div style="text-align:right;">Total</div>
      </div>
    ` +
      cart
        .map(
          (item) => `
        <div class="cart-item-row">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-qty">
            <button type="button" class="qty-btn" onclick="changeCartQuantity('${
              item.productId
            }', -1)">-</button>
            <span>${item.quantity}</span>
            <button type="button" class="qty-btn" onclick="changeCartQuantity('${
              item.productId
            }', 1)">+</button>
          </div>
          <div class="cart-item-total">${item.price * item.quantity} SEK</div>
        </div>
      `
        )
        .join("");
  }

  const { itemTotal, shipping, grandTotal } = calculateCartTotals();
  if (totalEl) totalEl.textContent = `Items total: ${itemTotal} SEK`;
  if (shippingEl)
    shippingEl.textContent = shipping === 0 ? "Delivery: Free" : `Delivery: 99 SEK`;
  if (grandTotalEl) grandTotalEl.textContent = `Grand total: ${grandTotal} SEK`;
}

function openCartModal() {
  const modal = document.getElementById("cartModal");
  renderCartModal();
  const success = document.getElementById("successMessage");
  if (success) success.style.display = "none";
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeCartModal() {
  const modal = document.getElementById("cartModal");
  modal.classList.remove("active");
  document.body.style.overflow = "";
  const form = document.getElementById("orderForm");
  if (form) form.reset();
  const success = document.getElementById("successMessage");
  if (success) success.style.display = "none";
  isSubmitting = false;
}

function changeCartQuantity(productId, delta) {
  const item = cart.find((i) => i.productId === productId);
  if (!item) return;

  const product = products.find((p) => p.id === productId);
  const maxStock = product ? product.stock : Infinity;

  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    cart = cart.filter((i) => i.productId !== productId);
  } else if (newQty > maxStock) {
    alert(`Only ${maxStock} available.`);
    return;
  } else {
    item.quantity = newQty;
  }

  updateCartCount();
  renderCartModal();
}

// --- Order ID ---
function generateOrderId() {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${random}`;
}

// --- Swish UI helpers ---
function updateSwishBox(amount, orderId) {
  lastOrderAmount = amount;
  lastOrderId = orderId;

  const swishBox = document.getElementById("swish-box");
  const phoneEl = document.getElementById("swish-phone");
  const amountEl = document.getElementById("swish-amount");
  const orderEl = document.getElementById("swish-order-id");

  if (!swishBox || !phoneEl || !amountEl || !orderEl) return;

  phoneEl.textContent = "0728 359 978";
  amountEl.textContent = `${amount} kr`;
  orderEl.textContent = orderId;

  swishBox.style.display = "block";
}

function copySwishField(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const text = el.textContent.trim();
  if (!text) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert(`Copied: ${text}`);
      })
      .catch(() => {
        fallbackCopyText(text);
      });
  } else {
    fallbackCopyText(text);
  }
}

function fallbackCopyText(text) {
  const tempInput = document.createElement("input");
  tempInput.style.position = "fixed";
  tempInput.style.opacity = "0";
  tempInput.value = text;
  document.body.appendChild(tempInput);
  tempInput.select();
  try {
    document.execCommand("copy");
    alert(`Copied: ${text}`);
  } catch (e) {
    alert("Could not copy automatically, please select and copy manually.");
  }
  document.body.removeChild(tempInput);
}

// --- Local order row ---
function addOrderRowLocally(orderData) {
  const orderRow = {
    __backendId: nextBackendId++,
    ...orderData
  };
  orders.push(orderRow);
}

// --- Needed to fulfil orders table (pending only) ---
function renderNeededTable() {
  const tbody = document.querySelector("#neededTable tbody");
  if (!tbody) return;

  const pending = orders.filter((o) => o.status !== "completed");
  const map = new Map();

  pending.forEach((o) => {
    const key = o.product_name || o.product_id;
    if (!key) return;
    const qty = Number(o.quantity || 0);
    map.set(key, (map.get(key) || 0) + qty);
  });

  tbody.innerHTML = "";
  for (const [name, qty] of map.entries()) {
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    tdName.textContent = name;
    const tdQty = document.createElement("td");
    tdQty.textContent = qty;
    tr.appendChild(tdName);
    tr.appendChild(tdQty);
    tbody.appendChild(tr);
  }

  if (map.size === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 2;
    td.textContent = "No pending orders.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
}

// --- Checkout handler ---
async function handleOrderSubmit(event) {
  event.preventDefault();

  if (isSubmitting) return;
  if (!cart.length) {
    alert("Your cart is empty.");
    return;
  }

  isSubmitting = true;

  const submitBtn = document.getElementById("submitBtn");
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Processing<span class="loading-spinner"></span>';

  try {
    const customerName = document.getElementById("customerName").value;
    const customerEmail = document.getElementById("customerEmail").value;
    const customerPhone = document.getElementById("customerPhone").value;
    const customerAddress = document.getElementById("customerAddress").value;
    const deliveryDate = document.getElementById("deliveryDate").value;
    const reviewOptIn = document.getElementById("reviewOptIn").checked;
    const orderDate = new Date().toISOString();
    const orderId = generateOrderId();

    const { itemTotal, shipping, grandTotal } = calculateCartTotals();

    // Check stock again before finalising
    for (const item of cart) {
      const product = products.find((p) => p.id === item.productId);
      if (!product || product.stock < item.quantity) {
        alert(
          `Not enough stock for ${item.name}. Available: ${product ? product.stock : 0}`
        );
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        isSubmitting = false;
        return;
      }
    }

    const rowsToCreate = cart.map((item) => ({
      order_id: orderId,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      product_id: item.productId,
      product_name: item.name,
      quantity: item.quantity,
      total_price: item.price * item.quantity,
      payment_amount: grandTotal, // same grand total on each line
      shipping_fee: shipping,
      payment_status: "unpaid",
      delivery_date: deliveryDate,
      order_date: orderDate,
      status: "pending",
      review_opt_in: reviewOptIn ? "yes" : "no"
    }));

    if (hasBackend) {
      let backendOk = true;
      for (const row of rowsToCreate) {
        const result = await window.dataSdk.create(row);
        if (!result || !result.isOk) {
          backendOk = false;
          console.error("Error saving order row to backend:", result && result.error);
          break;
        }
        addOrderRowLocally(row);
      }
      updateBackendStatus(backendOk);
    } else {
      rowsToCreate.forEach((row) => addOrderRowLocally(row));
      updateBackendStatus(false);
    }

    // Deduct stock
    cart.forEach((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (product) {
        product.stock -= item.quantity;
        if (product.stock < 0) product.stock = 0;
      }
    });

    renderProducts();
    renderInventoryPanel();
    renderOrdersTable();
    renderStats();
    renderNeededTable();

    // Update Swish details box
    updateSwishBox(grandTotal, orderId);

    const success = document.getElementById("successMessage");
    if (success) success.style.display = "block";

    const form = document.getElementById("orderForm");
    if (form) form.reset();
    cart = [];
    updateCartCount();
    renderCartModal();
  } catch (err) {
    console.error(err);
    alert("Unexpected error while placing your order.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    isSubmitting = false;
  }
}

// --- Smooth scrolling ---
function scrollToSection(sectionId) {
  const element = document.getElementById(sectionId);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth" });
}

// --- Admin login / toggle ---
function toggleAdminLogin() {
  if (isAdmin) {
    const adminSection = document.getElementById("admin");
    if (adminSection) {
      adminSection.style.display = "block";
      adminSection.scrollIntoView({ behavior: "smooth" });
    }
    return;
  }

  const input = prompt("Enter admin password:");
  if (input === null) return;

  if (input === ADMIN_PASSWORD) {
    isAdmin = true;
    const adminSection = document.getElementById("admin");
    if (adminSection) {
      adminSection.style.display = "block";
      adminSection.scrollIntoView({ behavior: "smooth" });
    }
  } else {
    alert("Incorrect password.");
  }
}

function toggleHideCompleted(checked) {
  hideCompleted = checked;
  renderOrdersTable();
  renderStats();
  renderNeededTable();
}

function toggleOrderStatus(backendId) {
  const order = orders.find((o) => o.__backendId === backendId);
  if (!order) return;
  order.status = order.status === "completed" ? "pending" : "completed";
  renderOrdersTable();
  renderStats();
  renderNeededTable();
}

function togglePaymentStatus(backendId) {
  const order = orders.find((o) => o.__backendId === backendId);
  if (!order) return;
  order.payment_status = order.payment_status === "paid" ? "unpaid" : "paid";
  renderOrdersTable();
  renderStats();
}

// --- Analytics cards ---
function renderStats() {
  const container = document.getElementById("stats-grid");
  if (!container) return;

  const visibleOrders = orders; // stats always over all orders

  const totalOrdersAllTime = visibleOrders.length;
  const ordersLeft = visibleOrders.filter((o) => o.status !== "completed").length;
  const totalItemsAll = visibleOrders.reduce(
    (sum, o) => sum + Number(o.quantity || 0),
    0
  );
  const totalRevenueAll = visibleOrders.reduce((sum, o) => {
    const pay = Number(o.payment_amount || 0);
    return sum + (isNaN(pay) ? 0 : pay);
  }, 0);

  const byProduct = new Map();
  visibleOrders.forEach((o) => {
    const key = o.product_name || o.product_id;
    if (!key) return;
    const qty = Number(o.quantity || 0);
    byProduct.set(key, (byProduct.get(key) || 0) + qty);
  });

  let bestProduct = "-";
  let bestQty = 0;
  let worstProduct = "-";
  let worstQty = 0;

  if (byProduct.size > 0) {
    for (const [name, qty] of byProduct.entries()) {
      if (qty > bestQty) {
        bestQty = qty;
        bestProduct = name;
      }
    }
    const positive = [...byProduct.entries()].filter(([, qty]) => qty > 0);
    if (positive.length > 0) {
      worstQty = positive[0][1];
      worstProduct = positive[0][0];
      positive.forEach(([name, qty]) => {
        if (qty < worstQty) {
          worstQty = qty;
          worstProduct = name;
        }
      });
    }
  }

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total orders (all time)</div>
      <div class="stat-value">${totalOrdersAllTime}</div>
      <div class="stat-sub">All orders placed</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Orders left</div>
      <div class="stat-value">${ordersLeft}</div>
      <div class="stat-sub">Orders not marked completed</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Items sold</div>
      <div class="stat-value">${totalItemsAll}</div>
      <div class="stat-sub">Sum of quantities (all)</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Revenue (SEK)</div>
      <div class="stat-value">${totalRevenueAll}</div>
      <div class="stat-sub">Items + delivery fees</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Best seller</div>
      <div class="stat-value">${bestProduct}</div>
      <div class="stat-sub">${
        bestQty ? bestQty + " pcs" : "No data yet"
      }</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Least ordered</div>
      <div class="stat-value">${worstProduct}</div>
      <div class="stat-sub">${
        worstQty ? worstQty + " pcs" : "No data yet"
      }</div>
    </div>
  `;
}

// --- Inventory panel (ADMIN: edit stock) ---
function renderInventoryPanel() {
  const panel = document.getElementById("inventory-panel");
  if (!panel) return;
  if (!products.length) {
    panel.innerHTML =
      "<p style='font-size:0.9rem;color:#666;'>No products loaded yet.</p>";
    return;
  }

  panel.innerHTML = products
    .map(
      (prod) => `
    <div style="
      display:flex;
      justify-content:space-between;
      align-items:center;
      padding:0.6rem 0;
      border-bottom:1px solid #eee;
    ">
      <div><strong>${prod.name}</strong></div>
      <div style="display:flex; gap:0.5rem; align-items:center;">
        <span style="font-size:0.8rem;color:#666;">Stock:</span>
        <input
          type="number"
          min="0"
          value="${prod.stock}"
          style="width:80px; padding:0.3rem;"
          onchange="updateStock('${prod.id}', this.value)"
        >
      </div>
    </div>
  `
    )
    .join("");
}

function updateStock(productId, value) {
  const product = products.find((p) => p.id === productId);
  if (!product) return;
  const newStock = Number(value);
  if (Number.isNaN(newStock) || newStock < 0) return;
  product.stock = newStock;
  renderProducts();
  renderInventoryPanel();
}

// --- Render backend orders table ---
function renderOrdersTable() {
  const tbody = document.querySelector("#ordersTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const sorted = [...orders].sort((a, b) => {
    const da = a.delivery_date || "";
    const db = b.delivery_date || "";
    if (da < db) return -1;
    if (da > db) return 1;
    const oa = a.order_date || "";
    const ob = b.order_date || "";
    if (oa < ob) return -1;
    if (oa > ob) return 1;
    return 0;
  });

  const filtered = hideCompleted
    ? sorted.filter((o) => o.status !== "completed")
    : sorted;

  filtered.forEach((order) => {
    const tr = document.createElement("tr");
    if (order.status === "completed") {
      tr.classList.add("order-row-completed");
    }

    const cells = [
      order.order_id,
      order.customer_name,
      order.customer_email,
      order.customer_phone,
      order.customer_address,
      order.product_name,
      order.quantity,
      order.payment_amount,
      order.payment_status,
      order.delivery_date,
      order.order_date,
      order.status,
      order.review_opt_in
    ];

    cells.forEach((value, idx) => {
      const td = document.createElement("td");

      if (idx === 8) {
        // payment_status
        const span = document.createElement("span");
        span.classList.add(
          "order-tag",
          value === "paid" ? "tag-paid" : "tag-unpaid"
        );
        span.textContent = value || "unpaid";
        td.appendChild(span);
      } else if (idx === 11) {
        // status
        const span = document.createElement("span");
        span.classList.add(
          "order-tag",
          value === "completed" ? "tag-completed" : "tag-pending"
        );
        span.textContent = value || "pending";
        td.appendChild(span);
      } else {
        td.textContent = value;
      }

      tr.appendChild(td);
    });

    const actionsTd = document.createElement("td");
    actionsTd.classList.add("admin-actions");

    const statusBtn = document.createElement("button");
    statusBtn.textContent =
      order.status === "completed" ? "Mark pending" : "Mark done";
    statusBtn.onclick = () => toggleOrderStatus(order.__backendId);

    const payBtn = document.createElement("button");
    payBtn.textContent =
      order.payment_status === "paid" ? "Set unpaid" : "Set paid";
    payBtn.onclick = () => togglePaymentStatus(order.__backendId);

    actionsTd.appendChild(statusBtn);
    actionsTd.appendChild(payBtn);

    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  });
}

// --- Download orders as CSV ---
function downloadOrdersCsv() {
  if (orders.length === 0) {
    alert("No orders to download yet.");
    return;
  }

  const headers = [
    "order_id",
    "customer_name",
    "customer_email",
    "customer_phone",
    "customer_address",
    "product_name",
    "quantity",
    "payment_amount",
    "payment_status",
    "delivery_date",
    "order_date",
    "status",
    "review_opt_in"
  ];

  const rows = orders.map((order) => [
    order.order_id,
    order.customer_name,
    order.customer_email,
    order.customer_phone,
    order.customer_address,
    order.product_name,
    order.quantity,
    order.payment_amount,
    order.payment_status,
    order.delivery_date,
    order.order_date,
    order.status,
    order.review_opt_in
  ]);

  const csvContent = [headers.join(";"), ...rows.map((r) => r.map(String).join(";"))].join(
    "\n"
  );

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "orders.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Backend data handler ---
const dataHandler = {
  onDataChanged(data) {
    if (!Array.isArray(data)) {
      console.error("onDataChanged expected an array, got:", data);
      return;
    }

    orders = data.map((row, index) => {
      const backendId =
        row.__backendId != null && row.__backendId !== ""
          ? row.__backendId
          : index + 1;

      return {
        __backendId: backendId,
        order_id: row.order_id || "",
        customer_name: row.customer_name || "",
        customer_email: row.customer_email || "",
        customer_phone: row.customer_phone || "",
        customer_address: row.customer_address || "",
        product_id: row.product_id || "",
        product_name: row.product_name || "",
        quantity: Number(row.quantity || 0),
        total_price: Number(row.total_price || 0),
        payment_amount: Number(row.payment_amount || row.total_price || 0),
        shipping_fee: Number(row.shipping_fee || 0),
        payment_status: row.payment_status || "unpaid",
        delivery_date: row.delivery_date || "",
        order_date: row.order_date || "",
        status: row.status || "pending",
        review_opt_in: row.review_opt_in || "no"
      };
    });

    nextBackendId = orders.length + 1;
    renderOrdersTable();
    renderStats();
    renderNeededTable();
  }
};

// --- Init app ---
async function init() {
  await loadProducts();
  renderReviews();
  updateCartCount();
  renderStats();
  renderNeededTable();
  updateBackendStatus(false);

  if (hasBackend) {
    try {
      const dataResult = await window.dataSdk.init(dataHandler);
      if (!dataResult || !dataResult.isOk) {
        console.error("Failed to initialize data SDK", dataResult && dataResult.error);
        updateBackendStatus(false);
      } else {
        updateBackendStatus(true);
      }
    } catch (err) {
      console.error("Error during backend init:", err);
      updateBackendStatus(false);
    }
  } else {
    updateBackendStatus(false);
  }
}

init();
