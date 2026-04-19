window.onload = function () {


  const app = document.getElementById("app");

  document.querySelectorAll("[data-nav]").forEach(btn => {
    btn.onclick = function () {
      const page = this.getAttribute("data-nav");
      app.innerHTML = `<h2>${page}</h2>`;
    };
  });

};
