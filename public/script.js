document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("download-form");
  const urlInput = document.getElementById("url-input");
  const statusMessage = document.getElementById("status-message");
  const downloadLinkContainer = document.getElementById("download-link-container");
  const submitButton = document.getElementById("submit-button");
  const preview = document.getElementById("preview");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    submitButton.disabled = true;
    statusMessage.className = "";
    statusMessage.textContent = "Preparando enlace...";
    downloadLinkContainer.innerHTML = "";
    preview.innerHTML = "";

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.value.trim() }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "No se pudo preparar la descarga.");
      }

      statusMessage.textContent = "Enlace listo. Si el navegador abre el video, usa Guardar como.";
      preview.innerHTML = renderPreview(data);

      const a = document.createElement("a");
      a.href = data.downloadUrl;
      a.textContent = `Descargar video (${data.quality || "MP4"})`;
      a.download = data.filename || "";
      a.rel = "noopener";
      downloadLinkContainer.appendChild(a);
    } catch (error) {
      statusMessage.className = "error";
      statusMessage.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });
});

function renderPreview(data) {
  const thumbnail = data.thumbnail ? `<img src="${escapeHtml(data.thumbnail)}" alt="">` : "";

  return `
    ${thumbnail}
    <div>
      <strong>${escapeHtml(data.title || "Video de YouTube")}</strong>
      <span>${escapeHtml([data.author, formatDuration(data.lengthSeconds)].filter(Boolean).join(" - "))}</span>
    </div>
  `;
}

function formatDuration(totalSeconds) {
  const seconds = Number(totalSeconds || 0);
  if (!seconds) return "";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  return [hours, minutes, remainder]
    .filter((part, index) => part || index > 0)
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
