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

// Inicialización de la app
const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configuración de middleware y estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Directorio temporal seguro
const downloadsDir = path.join(os.tmpdir(), 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

wss.on('connection', (ws) => {
    ws.on('message', (messageBuffer) => {
        try {
            // Convertir buffer a string explícitamente para evitar errores
            const messageString = messageBuffer.toString();
            const parsedMessage = JSON.parse(messageString);
            const { type, url } = parsedMessage;

            if (type === 'download') {
                if (!url) {
                    ws.send(JSON.stringify({ type: 'error', message: 'No URL provided' }));
                    return;
                }

                // Ruta al ejecutable
                const binaryName = os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
                const ytdlpPath = path.join(os.tmpdir(), binaryName);

                // Verificar que el binario exista antes de ejecutar
                if (!fs.existsSync(ytdlpPath)) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Server error: yt-dlp binary not found' }));
                    return;
                }

                const outputTemplate = path.join(downloadsDir, '%(title)s.%(ext)s');
                const options = [
                    '--progress',
                    '--newline', // Importante para parsear el output línea por línea
                    '-o', outputTemplate,
                    url
                ];

                console.log(`Iniciando descarga con: ${ytdlpPath}`);
                
                // Ejecución segura usando childProcess directamente
                const ytdlpProcess = childProcess.spawn(ytdlpPath, options);

                // Verificación de seguridad inmediata
                if (!ytdlpProcess || !ytdlpProcess.stdout) {
                    console.error('Error crítico: No se pudo iniciar el proceso de descarga');
                    ws.send(JSON.stringify({ type: 'error', message: 'Error interno al iniciar descarga' }));
                    return;
                }

                let fileName = '';

                ytdlpProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    
                    // Intentar capturar el nombre del archivo
                    if (!fileName) {
                        const fileNameMatch = output.match(/\[download\] Destination: (.*)/);
                        if (fileNameMatch) {
                            fileName = path.basename(fileNameMatch[1]);
                        } else {
                            // Intento secundario si el archivo ya existe
                            const fileExistsMatch = output.match(/\[download\] (.*) has already been downloaded/);
                            if (fileExistsMatch) {
                                fileName = path.basename(fileExistsMatch[1]);
                            }
                        }
                    }

                    // Capturar progreso
                    const progressMatch = output.match(/\[download\]\s+(\d+\.\d+)% of/);
                    if (progressMatch) {
                        const progress = progressMatch[1];
                        ws.send(JSON.stringify({ type: 'progress', progress }));
                    }
                });

                ytdlpProcess.stderr.on('data', (data) => {
                    console.error(`stderr: ${data}`);
                });

                ytdlpProcess.on('close', (code) => {
                    console.log(`Proceso terminado con código: ${code}`);
                    if (code === 0 && fileName) {
                        const downloadUrl = `/downloads/${encodeURIComponent(fileName)}`;
                        ws.send(JSON.stringify({ type: 'completed', downloadUrl }));
                    } else {
                        ws.send(JSON.stringify({ type: 'error', message: 'La descarga falló o no se encontró el nombre del archivo.' }));
                    }
                });

                // Matar proceso si el cliente se desconecta
                ws.on('close', () => {
                    if (ytdlpProcess && !ytdlpProcess.killed) {
                        ytdlpProcess.kill();
                    }
                });
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
            await YTDlpWrap.downloadFromGithub(binaryPath);
            // Permisos de ejecución para Linux/Render
            fs.chmodSync(binaryPath, '755');
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