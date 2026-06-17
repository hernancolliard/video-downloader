import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getFullVideoDownload } from "./lib/youtube.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post(["/download", "/api/download"], async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  try {
    const result = await getFullVideoDownload(req.body?.url);
    res.json(result);
  } catch (error) {
    console.error("download error:", error);
    res.status(error.statusCode || 500).json({
      error:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "No se pudo preparar la descarga. Prueba con otro video o intenta de nuevo.",
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor listo en puerto ${PORT}`));
