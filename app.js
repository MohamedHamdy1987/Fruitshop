window.addEventListener("DOMContentLoaded", () => {

  const app = document.getElementById("app");

  document.querySelectorAll("[data-nav]").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.getAttribute("data-nav");

      if (page === "dashboard") {
        app.innerHTML = "<h2>Dashboard شغال</h2>";
      }

      else if (page === "customers") {
        app.innerHTML = "<h2>صفحة العملاء</h2>";
      }

      else if (page === "sales") {
        app.innerHTML = "<h2>صفحة المبيعات</h2>";
      }

      else {
        app.innerHTML = `<h2>${page}</h2>`;
      }

    });
  });

});
