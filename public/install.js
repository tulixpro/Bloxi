(() => {
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {}));
  }
  let promptEvent = null;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "vaylox-install";
  button.textContent = "↓ Installieren";
  button.setAttribute("aria-label", "Vaylox installieren");
  button.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:9999;border:1px solid #ffffff35;border-radius:12px;padding:12px 16px;background:linear-gradient(110deg,#9478ff,#56dce9);color:#101326;font:700 13px system-ui;box-shadow:0 12px 36px #0005;cursor:pointer;display:none";
  document.addEventListener("DOMContentLoaded", () => document.body.append(button));
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    promptEvent = event;
    button.style.display = "block";
  });
  button.addEventListener("click", async () => {
    if (!promptEvent) {
      button.textContent = "Browser-Menü → Installieren";
      return;
    }
    promptEvent.prompt();
    await promptEvent.userChoice;
    promptEvent = null;
    button.style.display = "none";
  });
  window.addEventListener("appinstalled", () => { button.style.display = "none"; });
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) return;
  // Some browsers do not emit beforeinstallprompt (notably iOS); show a short manual hint.
  window.addEventListener("load", () => {
    if (!promptEvent && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      button.textContent = "Teilen → Zum Home-Bildschirm";
      button.style.display = "block";
      button.onclick = () => { button.textContent = "Im Teilen-Menü „Zum Home-Bildschirm“ wählen"; };
    }
  });
})();