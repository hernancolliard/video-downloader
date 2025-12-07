const express = require('express');
const path = require('path');
const fs = require('fs');
const ytdlpexec = require('yt-dlp-exec');

const app = express();
const port = process.env.PORT || 3000;

// --- Middlewares de Express ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Rutas de la API ---

// Endpoint para la descarga de videos
app.post('/download', async (req, res) => {
  const videoUrl = req.body.url;
  if (!videoUrl) {
    return res.status(400).json({ success: false, error: 'URL no proporcionada.' });
  }

  const downloadsDir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }
  
  const outputName = `${Date.now()}.mp4`;
  const outputPath = path.join(downloadsDir, outputName);

  console.log(`Iniciando descarga de: ${videoUrl}`);

  try {
    // Usamos el nuevo paquete yt-dlp-exec
    await ytdlpexec(videoUrl, {
      output: outputPath,
      format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    });

    console.log(`Descarga completada: ${outputPath}`);
    res.json({ success: true, downloadUrl: `/downloads/${outputName}` });

  } catch (error) {
    console.error('Error al descargar el video con yt-dlp-exec:', error);
    const errorMessage = error.stderr.includes('Unsupported URL')
      ? 'La URL proporcionada no es compatible.'
      : 'Error al procesar el video.';
    res.status(500).json({ success: false, error: errorMessage, details: error.stderr });
  }
});

// Endpoint para servir el archivo de video descargado
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

// --- Inicio del Servidor ---
app.listen(port, () => {
  console.log(`Servidor iniciado en http://localhost:${port}`);
});
