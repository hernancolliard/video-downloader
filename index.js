const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = 3000;

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const { type, url } = JSON.parse(message);

        if (type === 'download') {
            if (!url) {
                ws.send(JSON.stringify({ type: 'error', message: 'No URL provided' }));
                return;
            }

            const ytdlpPath = path.join(__dirname, 'binaries', 'yt-dlp.exe');
            const outputTemplate = path.join(downloadsDir, '%(title)s.%(ext)s');
            const options = [
                '--progress',
                '-o',
                outputTemplate,
                url
            ];

            const ytdlp = spawn(ytdlpPath, options);

            let fileName = '';

            ytdlp.stdout.on('data', (data) => {
                const output = data.toString();
                
                if (!fileName) {
                    const fileNameMatch = output.match(/\[download\] Destination: (.*)/);
                    if (fileNameMatch) {
                        fileName = path.basename(fileNameMatch[1]);
                    }
                }

                const progressMatch = output.match(/\[download\]\s+(\d+\.\d+)% of/);
                if (progressMatch) {
                    const progress = progressMatch[1];
                    ws.send(JSON.stringify({ type: 'progress', progress }));
                }
            });

            ytdlp.stderr.on('data', (data) => {
                console.error(`stderr: ${data}`);
                ws.send(JSON.stringify({ type: 'error', message: data.toString() }));
            });

            ytdlp.on('close', (code) => {
                if (code === 0) {
                    const downloadUrl = `/downloads/${fileName}`;
                    ws.send(JSON.stringify({ type: 'completed', downloadUrl }));
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'Download failed' }));
                }
            });

            ws.on('close', () => {
                ytdlp.kill();
            });
        }
    });
});

app.get('/downloads/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(__dirname, 'downloads', fileName);
  
    if (fs.existsSync(filePath)) {
      res.download(filePath, (err) => {
        if (err) {
          console.error('Error al enviar el archivo:', err);
        }
        // Elimina el archivo después de que se complete la descarga
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) console.error('Error al eliminar el archivo temporal:', unlinkErr);
          else console.log(`Archivo temporal eliminado: ${fileName}`);
        });
      });
    } else {
      res.status(404).send('Archivo no encontrado.');
    }
  });

server.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
