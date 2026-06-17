import { execFile } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { getRawCookieEnvironment } from "./cookie-env.js";
import { assertYoutubeUrl, createHttpError } from "./youtube.js";

const execFileAsync = promisify(execFile);
const YT_DLP_BINARY = process.env.YT_DLP_BINARY || "yt-dlp";
const YT_DLP_FORMAT =
  process.env.YT_DLP_FORMAT ||
  "18/22/best[ext=mp4][vcodec!=none][acodec!=none][protocol=https]/best[vcodec!=none][acodec!=none][protocol=https]/best";

export async function getFullVideoDownloadWithYtDlp(url) {
  const videoUrl = await assertYoutubeUrl(url);
  const cookieContext = await createCookieFile();

  try {
    const args = [
      "--dump-json",
      "--no-playlist",
      "--no-warnings",
      "--js-runtimes",
      `node:${process.execPath}`,
      "--format",
      YT_DLP_FORMAT,
      "--user-agent",
      getUserAgent(),
    ];

    if (process.env.YT_DLP_NO_CHECK_CERTIFICATES === "1") {
      args.push("--no-check-certificates");
    }

    if (cookieContext.path) {
      args.push("--cookies", cookieContext.path);
    }

    if (process.env.YOUTUBE_PROXY_URL) {
      args.push("--proxy", process.env.YOUTUBE_PROXY_URL);
    }

    args.push(videoUrl);

    const { stdout } = await execFileAsync(YT_DLP_BINARY, args, {
      timeout: Number(process.env.YT_DLP_TIMEOUT_MS || 60000),
      maxBuffer: 1024 * 1024 * 16,
    });

    const info = JSON.parse(stdout);
    const selectedFormat = getSelectedFormat(info);

    if (!selectedFormat?.url) {
      throw createHttpError(404, "yt-dlp no devolvio un enlace descargable para este video.");
    }

    const extension = selectedFormat.ext || info.ext || "mp4";

    return {
      title: info.title,
      author: info.uploader || info.channel || "",
      lengthSeconds: Number(info.duration || 0),
      thumbnail: info.thumbnail || "",
      quality: selectedFormat.format_note || selectedFormat.resolution || selectedFormat.format || "video",
      mimeType: selectedFormat.http_headers?.["Content-Type"] || "video/mp4",
      extension,
      filename: `${safeFilename(info.title || "youtube-video")}.${extension}`,
      downloadUrl: selectedFormat.url,
      engine: "yt-dlp",
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      throw createHttpError(503, "yt-dlp no esta instalado en este entorno.");
    }

    const stderr = String(error.stderr || "");
    const stdout = String(error.stdout || "");
    const message = [error.message, stderr, stdout].filter(Boolean).join("\n");
    const wrapped = createHttpError(error.statusCode || 500, message || "yt-dlp fallo.");
    wrapped.cause = error;
    throw wrapped;
  } finally {
    await cookieContext.cleanup();
  }
}

function getSelectedFormat(info) {
  if (Array.isArray(info.requested_downloads) && info.requested_downloads[0]?.url) {
    return info.requested_downloads[0];
  }

  if (info.url) return info;

  if (Array.isArray(info.formats)) {
    return info.formats
      .filter((format) => format.url && format.vcodec !== "none" && format.acodec !== "none")
      .sort((a, b) => (Number(b.height) || 0) - (Number(a.height) || 0))[0];
  }

  return null;
}

async function createCookieFile() {
  const rawCookies = getRawCookieEnvironment().trim();
  if (!rawCookies) return { path: "", cleanup: async () => {} };

  const dir = await mkdtemp(path.join(os.tmpdir(), "yt-cookies-"));
  const cookiePath = path.join(dir, "cookies.txt");
  await writeFile(cookiePath, rawCookies, "utf8");

  return {
    path: cookiePath,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

function getUserAgent() {
  return (
    process.env.YOUTUBE_USER_AGENT ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
  );
}

function safeFilename(value) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\w\s.-]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120)
      .replace(/[. ]+$/g, "") || "youtube-video"
  );
}
