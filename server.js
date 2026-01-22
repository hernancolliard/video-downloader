import express from "express";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "5mb" }));
app.use(express.static("public"));
app.use("/files", express.static("downloads"));

app.post("/download", (req, res) => {
  const { url, cookies, proxy, downloadType } = req.body;
  if (!url) return res.json({ error: "URL requerida" });

  const id = randomUUID();
  const downloadsDir = "downloads";
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);

  let cookieFile = null;
  if (cookies) {
    cookieFile = `cookies_${id}.txt`;
    fs.writeFileSync(cookieFile, cookies);
  }

  const format = downloadType === "audio" ? "-x --audio-format mp3" : "-f best";

  const cookieArg = cookieFile ? `--cookies ${cookieFile}` : "";
  const proxyArg = proxy ? `--proxy "${proxy}"` : "";
  const output = `${downloadsDir}/${id}.%(ext)s`;

  const cmd = `yt-dlp ${format} ${cookieArg} ${proxyArg} -o "${output}" "${url}"`;

  exec(cmd, (err) => {
    if (cookieFile && fs.existsSync(cookieFile)) fs.unlinkSync(cookieFile);

    if (err) return res.json({ error: "Error al descargar" });

    const file = fs.readdirSync(downloadsDir).find((f) => f.startsWith(id));
    res.json({
      downloadUrl: `/files/${file}`,
      title: file,
      ext: file.split(".").pop(),
    });
  });
});

app.listen(PORT, () => console.log("Servidor listo"));
