// Main application file
const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const WebSocket = require('ws');
const YoutubeDlWrap = require('youtube-dl-wrap');

const youtubeDlWrap = new YoutubeDlWrap();
const app = express();
const port = process.env.PORT || 3000;

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const downloadsDir = path.join(os.tmpdir(), 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const { type, url } = JSON.parse(message);

        if (type === 'download') {
            if (!url) {
                ws.send(JSON.stringify({ type: 'error', message: 'No URL provided' }));
                return;
            }
            
            const outputTemplate = path.join(downloadsDir, '%(title)s.%(ext)s');
            
            // Use the new library's exec method
            const ytdlpEmitter = youtubeDlWrap.exec([
                url,
                '--progress',
                '-o',
                outputTemplate
            ]);

            // Get the raw child process to attach listeners
            const ytdlp = ytdlpEmitter.childProcess;

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
                // Only log stderr, don't send as a client-side error
                console.error(`stderr: ${data}`);
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

    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });
});

const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
        if (ws.isAlive === false) return ws.terminate();

        ws.isAlive = false;
        ws.ping(() => {});
    });
}, 30000);

wss.on('close', function close() {
    clearInterval(interval);
});

app.get('/downloads/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(downloadsDir, fileName);
  
    if (fs.existsSync(filePath)) {
      res.download(filePath, (err) => {
        if (err) {
          console.error('Error sending file:', err);
        }
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
          else console.log(`Temp file deleted: ${fileName}`);
        });
      });
    } else {
      res.status(404).send('File not found.');
    }
  });

async function initialize() {
    try {
        const platform = os.platform();
        const binaryName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
        const binaryPath = path.join(os.tmpdir(), binaryName);

        if (!fs.existsSync(binaryPath)) {
            console.log(`Downloading yt-dlp binary to: ${binaryPath}`);
            const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${binaryName}`;
            await YoutubeDlWrap.downloadFile(downloadUrl, binaryPath);
            console.log('yt-dlp binary downloaded successfully.');
            if (platform !== 'win32') {
                fs.chmodSync(binaryPath, '755');
                console.log('Set execute permissions for yt-dlp binary.');
            }
        } else {
            console.log(`yt-dlp binary already exists at: ${binaryPath}`);
        }
        
        youtubeDlWrap.setBinaryPath(binaryPath);

        server.listen(port, () => {
            console.log(`Server listening at http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Error in server initialization:', error);
        process.exit(1);
    }
}

initialize();
