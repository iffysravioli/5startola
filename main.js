document.addEventListener("keydown", () => {
  document.getElementById("homeScreen").classList.add("hidden");
  document.getElementById("loadingScreen").classList.remove("hidden");

  let load = 0;
  const runner = document.getElementById("runner");

  const interval = setInterval(() => {
    load += 2;
    runner.style.width = load + "%";

    if (load >= 100) {
      clearInterval(interval);
      alert("Game select coming next");
    }
  }, 40);
});
