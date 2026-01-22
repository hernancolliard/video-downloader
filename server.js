const express = require("express");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");

// Crear la app de Express
const app = express();

// Servir archivos estáticos de la carpeta "public"
app.use(express.static(path.join(__dirname, "public")));

// Servir index.html en la raíz
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Crear el servidor HTTP
const server = http.createServer(app);

// Configurar WebSocket
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Cliente conectado via WebSocket");

  ws.on("message", async (message) => {
    const data = JSON.parse(message);
    if (data.type === "download") {
      // Aquí va tu lógica de descarga con yt-dlp
      // Ejemplo de respuesta de prueba
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

  ws.on("close", () => {
    console.log("Cliente desconectado");
  });
});

// Puerto
const PORT = process.env.PORT || 3000;

// Arrancar servidor
server.listen(PORT, () => {
  console.log(`Servidor listo en puerto ${PORT}`);
});
