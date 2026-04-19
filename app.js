window.onload = function () {

  alert("DOM LOADED");

  const app = document.getElementById("app");

  document.querySelectorAll("[data-nav]").forEach(btn => {
    btn.onclick = function () {
      const page = this.getAttribute("data-nav");
      app.innerHTML = `<h2>${page}</h2>`;
    };
  });

};
