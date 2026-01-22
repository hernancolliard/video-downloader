// server.js
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

// Parsear JSON en POST
app.use(express.json());

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// Servir index.html en /
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Ruta POST /download
app.post("/download", async (req, res) => {
  const { url } = req.body;

  if (!url) return res.status(400).json({ error: "URL missing" });

  try {
    // Ejemplo: usar yt-dlp para obtener info del video
    execFile(
      "yt-dlp",
      ["-J", url], // -J devuelve info JSON del video
      (error, stdout, stderr) => {
        if (error) {
          console.error("yt-dlp error:", stderr);
          return res.status(500).json({ error: "Failed to fetch video info" });
        }

        const info = JSON.parse(stdout);

        // Respuesta al frontend
        res.json({
          title: info.title,
          ext: info.ext || "mp4",
          downloadUrl: info.url || url, // Temporalmente url si yt-dlp no da direct
        });
      },
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unexpected error" });
  }
});

// Crear servidor HTTP
const server = http.createServer(app);

// WebSocket para actualizaciones en tiempo real
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("Cliente conectado via WebSocket");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "download") {
        // Aquí también podrías ejecutar yt-dlp y enviar progreso
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
      console.error("WS error:", err);
    }
  });

  ws.on("close", () => console.log("Cliente desconectado"));
});

// Escuchar puerto de Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor listo en puerto ${PORT}`));

/*git add server.js
  git commit -m "Fix server.js: serve frontend + WebSocket"
  git push origin main*/
