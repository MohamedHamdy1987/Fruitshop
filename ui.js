export function toast(msg, type = "success") {
  const container = document.getElementById("toast");
  if (!container) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.innerText = msg;
  el.style.background = type === "error" ? "#D32F2F" : "#8B5E3C";
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 500);
  }, 2500);
}

export function formatCurrency(amount) {
  return Number(amount).toLocaleString("ar-EG") + " ج.م";
}

export function modal(content, options = {}) {
  const m = document.getElementById("modal");
  if (!m) return;
  const title = options.title || "";
  m.innerHTML = `
    <div class="card fade-in">
      ${title ? `<h3>${title}</h3>` : ""}
      ${content}
      <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
        <button class="btn" onclick="closeModal()">إغلاق</button>
      </div>
    </div>
  `;
  m.classList.remove("hidden");
}

export function closeModal() {
  const m = document.getElementById("modal");
  if (m) m.classList.add("hidden");
}