import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getCookieEnvironmentStatus, getFullVideoDownload, getPublicError } from "./lib/youtube.js";
import { getFullVideoDownloadWithYtDlp } from "./lib/ytdlp.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/health", (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  try {
    res.json({
      ok: true,
      node: process.version,
      engine: process.env.DOWNLOAD_ENGINE || "auto",
      cookies: getCookieEnvironmentStatus(),
    });
  } catch (error) {
    console.error("health error:", error);
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.post(["/download", "/api/download"], async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  try {
    const result =
      process.env.DOWNLOAD_ENGINE === "ytdl-core"
        ? await getFullVideoDownload(req.body?.url)
        : await getFullVideoDownloadWithFallback(req.body?.url);
    res.json(result);
  } catch (error) {
    console.error("download error:", error);
    res.status(error.statusCode || 500).json({
      error: getPublicError(error),
    });
  }
});

async function getFullVideoDownloadWithFallback(url) {
  try {
    return await getFullVideoDownloadWithYtDlp(url);
  } catch (error) {
    if (error.statusCode === 503 && error.message.includes("yt-dlp")) {
      return getFullVideoDownload(url);
    }

    throw error;
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor listo en puerto ${PORT}`));
