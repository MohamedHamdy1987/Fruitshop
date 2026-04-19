window.addEventListener("DOMContentLoaded", () => {

  const app = document.getElementById("app");

  document.querySelectorAll("[data-nav]").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.getAttribute("data-nav");

      app.innerHTML = `<h2>فتحت صفحة: ${page}</h2>`;
    });
  });

});
