const YTDlpWrap = require('yt-dlp-wrap');

const ytdlpWrap = new YTDlpWrap();
const app = express();
const port = 3000;

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

            const ytdlpPath = ytdlpWrap.getBinaryPath();
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

async function initialize() {
    try {
        const binaryPath = path.join(os.tmpdir(), os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
        ytdlpWrap.setBinaryPath(binaryPath);

        if (!fs.existsSync(binaryPath)) {
            console.log('Downloading yt-dlp binary to:', binaryPath);
            await ytdlpWrap.execPromise(['--version']);
            console.log('yt-dlp binary downloaded successfully.');
        } else {
            console.log('yt-dlp binary already exists at:', binaryPath);
        }

        server.listen(port, () => {
            console.log(`Server listening at http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Error in server initialization:', error);
        process.exit(1);
    }
}

initialize();
