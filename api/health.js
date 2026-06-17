import { getCookieEnvironmentStatus } from "../lib/youtube.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    return res.status(200).json({
      ok: true,
      node: process.version,
      engine: process.env.DOWNLOAD_ENGINE || "ytdl-core",
      cookies: getCookieEnvironmentStatus(),
    });
  } catch (error) {
    console.error("health error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
