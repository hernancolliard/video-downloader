import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";

// Necesario para __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear app de Express
const app = express();

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// Servir index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Servidor HTTP
const server = http.createServer(app);

// WebSocket
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("Cliente conectado via WebSocket");

  ws.on("message", (message) => {
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
  });

  ws.on("close", () => console.log("Cliente desconectado"));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor listo en puerto ${PORT}`));
/*git add server.js
  git commit -m "Fix server.js: serve frontend + WebSocket"
  git push origin main*/
