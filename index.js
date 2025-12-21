// Main application file
const express = require('express');
// Usamos 'node:child_process' para evitar conflictos de nombres
const childProcess = require('node:child_process'); 
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const WebSocket = require('ws');
const YTDlpWrap = require('yt-dlp-wrap').default;
const helmet = require('helmet');

// Inicialización de la app
const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configuración de middleware y estáticos
app.use(helmet()); // Eliminar Content Security Policy para no generar conflictos con el servidor de yt-dlp
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Directorio temporal seguro
const downloadsDir = path.join(os.tmpdir(), 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

wss.on('connection', (ws) => {
    ws.on('message', async (messageBuffer) => {
        try {
            const messageString = messageBuffer.toString();
            const parsedMessage = JSON.parse(messageString);
            const { type, url, cookies, proxy, downloadType } = parsedMessage;

            if (type === 'download') {
                if (!url) {
                    ws.send(JSON.stringify({ type: 'error', message: 'No URL provided' }));
                    return;
                }

                // yt-dlp se espera que esté en el PATH o accesible globalmente
                const ytdlp = new YTDlpWrap();
                
                const outputTemplate = path.join(downloadsDir, '%(title)s.%(ext)s');
                const args = [url, '-o', outputTemplate];

                if (proxy) {
                    args.push('--proxy', proxy);
                }

                if (downloadType === 'audio') {
                    args.push(
                        '-f', 'bestaudio/best',
                        '--extract-audio',
                        '--audio-format', 'mp3',
                        '--audio-quality', '192'
                    );
                } else {
                    args.push(
                        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                        '--merge-output-format', 'mp4'
                    );
                }
                

                try {
                    // Limpiar directorio de descargas antiguo para evitar servir archivos viejos
                    fs.readdirSync(downloadsDir).forEach(f => fs.unlinkSync(path.join(downloadsDir, f)));

                    console.log(`Ejecutando yt-dlp con: ${args.join(' ')}`);
                    await ytdlp.execPromise(args);

                    const files = fs.readdirSync(downloadsDir)
                        .map(name => ({
                            name,
                            time: fs.statSync(path.join(downloadsDir, name)).mtime.getTime()
                        }))
                        .sort((a, b) => b.time - a.time);

                    if (files.length === 0) {
                        ws.send(JSON.stringify({ type: 'error', message: 'La descarga falló, no se generó ningún archivo.' }));
                        return;
                    }

                    const downloadedFile = files[0].name;
                    const ext = path.extname(downloadedFile).replace('.', '');
                    const title = path.basename(downloadedFile, '.' + ext);

                    ws.send(JSON.stringify({
                        type: 'info',
                        downloadUrl: `/downloads/${encodeURIComponent(downloadedFile)}`,
                        title,
                        ext
                    }));

                } catch (error) {
                    console.error('Error detallado con yt-dlp:', error);
                    ws.send(JSON.stringify({ type: 'error', message: 'Error durante la descarga. Revisa los logs del servidor para más detalles.' }));
                }
            }
        } catch (e) {
            console.error('Error procesando mensaje:', e);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid request' }));
        }
    });

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
});

// Ping keep-alive
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping(() => {});
    });
}, 30000);

wss.on('close', () => clearInterval(interval));

// Ruta de descarga
app.get('/downloads/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const safeFileName = req.params.fileName; // Usar req.params.fileName directamente
    const filePath = path.join(downloadsDir, safeFileName);
  
    if (fs.existsSync(filePath)) {
      res.download(filePath, (err) => {
        if (err) console.error('Error al enviar archivo:', err);
        // Limpieza
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) console.error('Error al borrar temporal:', unlinkErr);
        });
      });
    } else {
      res.status(404).send('Archivo no encontrado.');
    }
});

// Inicialización del servidor
server.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});