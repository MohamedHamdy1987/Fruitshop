// ===============================
// 🔔 TOAST PRO
// ===============================
export function toast(msg, type = "success") {
  const container = document.getElementById("toast");
  if (!container) return;

  const el = document.createElement("div");

  el.className = "toast";
  el.innerText = msg;

  el.style.background = type === "error" ? "#ef4444" : "#22c55e";

  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 500);
  }, 2500);
}

// ===============================
// 📦 MODAL PRO
// ===============================
export function modal(content, options = {}) {
  const m = document.getElementById("modal");
  if (!m) return;

  const title = options.title || "";
  const showClose = options.showClose !== false;

  m.innerHTML = `
    <div class="card fade-in">
      ${title ? `<h3>${title}</h3>` : ""}
      ${content}
      <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
        ${showClose ? '<button class="btn" onclick="closeModal()">إغلاق</button>' : ""}
      </div>
    </div>
  `;

  m.classList.remove("hidden");
}

export function closeModal() {
  const m = document.getElementById("modal");
  if (m) m.classList.add("hidden");
}

// ===============================
// ❓ CONFIRM DIALOG
// ===============================
export function confirmDialog(message, onConfirm, onCancel) {
  const m = document.getElementById("modal");
  if (!m) return;

  m.innerHTML = `
    <div class="card fade-in">
      <h3>تأكيد</h3>
      <p>${message}</p>
      <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
        <button class="btn btn-outline" id="modal-cancel">إلغاء</button>
        <button class="btn btn-danger" id="modal-confirm">تأكيد</button>
      </div>
    </div>
  `;

  m.classList.remove("hidden");

  document.getElementById("modal-confirm").addEventListener("click", () => {
    closeModal();
    if (onConfirm) onConfirm();
  });

  document.getElementById("modal-cancel").addEventListener("click", () => {
    closeModal();
    if (onCancel) onCancel();
  });
}

// ===============================
// ⏳ LOADING
// ===============================
export function loading(el) {
  if (!el) return;
  el.innerHTML = `
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
  `;
}

// ===============================
// 🧹 SHOW GLOBAL LOADER
// ===============================
export function showLoader() {
  const loader = document.getElementById("global-loader");
  if (loader) loader.classList.remove("hidden");
}

export function hideLoader() {
  const loader = document.getElementById("global-loader");
  if (loader) loader.classList.add("hidden");
}

// ===============================
// 📱 IS MOBILE
// ===============================
export function isMobile() {
  return window.innerWidth <= 768;
}

// ===============================
// 💰 FORMAT CURRENCY
// ===============================
export function formatCurrency(amount) {
  return Number(amount).toLocaleString("ar-EG") + " ج.م";
}

// ===============================
// 📅 FORMAT DATE
// ===============================
export function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("ar-EG");
}
