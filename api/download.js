import { getFullVideoDownload } from "../lib/youtube.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo no permitido." });
  }

  try {
    const result = await getFullVideoDownload(req.body?.url);
    return res.status(200).json(result);
  } catch (error) {
    console.error("download error:", error);
    return res.status(error.statusCode || 500).json({
      error:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "No se pudo preparar la descarga. Prueba con otro video o intenta de nuevo.",
    });
  }
}
