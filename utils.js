// ===============================
// 🧰 UTILITIES
// ===============================

export function formatCurrency(amount) {
  return Number(amount).toLocaleString("ar-EG") + " ج.م";
}

export function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("ar-EG");
}

export function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function debounce(func, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

export function groupBy(array, key) {
  return array.reduce((result, item) => {
    (result[item[key]] = result[item[key]] || []).push(item);
    return result;
  }, {});
}

export function sumBy(array, key) {
  return array.reduce((sum, item) => sum + Number(item[key] || 0), 0);
}
