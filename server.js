import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import { execFile } from "child_process";

// Necesario para __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear app de Express
const app = express();
app.use(express.json()); // <- Para poder leer JSON de req.body

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// Servir index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Endpoint para descarga
app.post("/download", (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL missing" });

  // Ejecuta yt-dlp
  execFile("yt-dlp", ["-J", url], (error, stdout, stderr) => {
    if (error) {
      console.error("yt-dlp ERROR:", stderr);
      return res
        .status(500)
        .json({ error: "Failed to fetch video info", details: stderr });
    }

    try {
      const info = JSON.parse(stdout);
      res.json({
        title: info.title,
        ext: info.ext || "mp4",
        downloadUrl: info.url || url,
      });
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "stdout:", stdout);
      res.status(500).json({ error: "Failed to parse yt-dlp output" });
    }
  });
});

// Servidor HTTP
const server = http.createServer(app);

// WebSocket
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("Cliente conectado via WebSocket");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === "download") {
        ws.send(
          JSON.stringify({
            type: "info",
            title: "video_prueba",
            ext: "mp4",
            downloadUrl: "https://example.com/video.mp4",
          }),
        );
      }
    } catch (err) {
      console.error("WS parse error:", err);
    }
  });

  ws.on("close", () => console.log("Cliente desconectado"));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor listo en puerto ${PORT}`));

/*git add server.js
  git commit -m "Fix server.js: serve frontend + WebSocket"
  git push origin main*/
