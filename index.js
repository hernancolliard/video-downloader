// Main application file
const express = require('express');
// Usamos 'node:child_process' para evitar conflictos de nombres
const childProcess = require('node:child_process'); 
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
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
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-eval'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                connectSrc: ["'self'", "wss:", "ws:"],
            },
        },
    })
);
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
            const { type, url, cookies, downloadType } = parsedMessage;

            if (type === 'download') {
                if (!url) {
                    ws.send(JSON.stringify({ type: 'error', message: 'No URL provided' }));
                    return;
                }

                const binaryName = os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
                const ytdlpPath = path.join(os.tmpdir(), binaryName);

                if (!fs.existsSync(ytdlpPath)) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Server error: yt-dlp binary not found' }));
                    return;
                }

                const ytdlp = new YTDlpWrap(ytdlpPath);
                
                try {
                    const metadata = await ytdlp.getVideoInfo(url);
                    
                    let format;
                    if (downloadType === 'audio') {
                        // Prioriza formatos de solo audio, m4a es común y de buena calidad
                        format = metadata.formats.find(f => f.acodec !== 'none' && f.vcodec === 'none' && f.ext === 'm4a');
                        // Si no encuentra m4a, busca cualquier formato de solo audio
                        if (!format) {
                            format = metadata.formats.find(f => f.acodec !== 'none' && f.vcodec === 'none');
                        }
                    } else {
                        // Busca un formato de video con audio, preferiblemente mp4 y una resolución decente (e.g. 720p)
                        format = metadata.formats.find(f => f.vcodec !== 'none' && f.acodec !== 'none' && f.ext === 'mp4' && f.height === 720);
                        // Si no, cualquier mp4 con video y audio
                        if (!format) {
                            format = metadata.formats.find(f => f.vcodec !== 'none' && f.acodec !== 'none' && f.ext === 'mp4');
                        }
                        // Si no, cualquier formato con video y audio
                        if (!format) {
                             format = metadata.formats.find(f => f.vcodec !== 'none' && f.acodec !== 'none');
                        }
                    }

                    if (format && format.url) {
                         ws.send(JSON.stringify({
                            type: 'info',
                            downloadUrl: format.url,
                            title: metadata.title,
                            ext: format.ext
                        }));
                    } else {
                        ws.send(JSON.stringify({ type: 'error', message: 'No se encontró un formato de descarga adecuado.' }));
                    }

                } catch (error) {
                    console.error('Error con yt-dlp:', error);
                    ws.send(JSON.stringify({ type: 'error', message: 'Error al obtener la información del video.' }));
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
    const safeFileName = path.basename(fileName);
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

// Inicialización del servidor y descarga del binario
async function initialize() {
    try {
        const binaryName = os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
        const binaryPath = path.join(os.tmpdir(), binaryName);
        
        if (!fs.existsSync(binaryPath)) {
            console.log('Descargando binario yt-dlp a:', binaryPath);
            
            // URL directa a la última versión para evitar el rate limit de la API de GitHub
            const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${binaryName}`;
            
            // Usamos https para descargar el archivo manualmente
            await new Promise((resolve, reject) => {
                https.get(downloadUrl, (res) => {
                    if (res.statusCode === 302) { // GitHub redirige
                        https.get(res.headers.location, (res2) => {
                            const fileStream = fs.createWriteStream(binaryPath);
                            res2.pipe(fileStream);
                            fileStream.on('finish', () => {
                                fileStream.close(resolve);
                            });
                        }).on('error', reject);
                    } else if (res.statusCode === 200) {
                        const fileStream = fs.createWriteStream(binaryPath);
                        res.pipe(fileStream);
                        fileStream.on('finish', () => {
                            fileStream.close(resolve);
                        });
                    } else {
                        reject(new Error(`Failed to download binary: Status Code ${res.statusCode}`));
                    }
                }).on('error', reject);
            });

            // Permisos de ejecución para Linux/Render
            if(os.platform() !== 'win32') {
                fs.chmodSync(binaryPath, '755');
            }
            console.log('Binario descargado y permisos asignados.');
        } else {
            console.log('Binario yt-dlp ya existe en:', binaryPath);
        }

        server.listen(port, () => {
            console.log(`Servidor escuchando en http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Error fatal iniciando el servidor:', error);
        process.exit(1);
    }
}

initialize();