document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("download-form");
  const urlInput = document.getElementById("url-input");
  const cookieInput = document.getElementById("cookie-input");
  const statusMessage = document.getElementById("status-message");
  const downloadLinkContainer = document.getElementById(
    "download-link-container",
  );
  const submitButton = document.getElementById("submit-button");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    submitButton.disabled = true;
    statusMessage.textContent = "Descargando...";
    downloadLinkContainer.innerHTML = "";

    const res = await fetch("/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: urlInput.value.trim(),
        cookies: cookieInput.value.trim(),
        proxy: document.getElementById("proxy-input").value.trim(),
        downloadType: document.getElementById("audio-only-checkbox").checked
          ? "audio"
          : "video",
      }),
    });

    const data = await res.json();

    if (data.error) {
      statusMessage.textContent = data.error;
      submitButton.disabled = false;
      return;
    }

    statusMessage.textContent = "Listo ✅";
    const a = document.createElement("a");
    a.href = data.downloadUrl;
    a.textContent = "Descargar archivo";
    a.download = "";
    downloadLinkContainer.appendChild(a);

    submitButton.disabled = false;
  });
});
