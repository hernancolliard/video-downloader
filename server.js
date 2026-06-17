import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getCookieEnvironmentStatus, getFullVideoDownload, getPublicError } from "./lib/youtube.js";

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
    const result = await getFullVideoDownload(req.body?.url);
    res.json(result);
  } catch (error) {
    console.error("download error:", error);
    res.status(error.statusCode || 500).json({
      error: getPublicError(error),
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor listo en puerto ${PORT}`));
