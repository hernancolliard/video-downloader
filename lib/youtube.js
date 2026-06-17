process.env.YTDL_NO_UPDATE ||= "1";

const MP4_MUXED_FORMATS = new Set(["18", "22"]);
let ytdlPromise;
let agent;
let agentCacheKey;

async function getYtdl() {
  ytdlPromise ||= import("@distube/ytdl-core").then((module) => module.default || module);
  return ytdlPromise;
}

export async function assertYoutubeUrl(url) {
  if (!url || typeof url !== "string") {
    throw createHttpError(400, "Pega una URL de YouTube.");
  }

  const trimmedUrl = url.trim();
  const ytdl = await getYtdl();

  if (!ytdl.validateURL(trimmedUrl)) {
    throw createHttpError(400, "La URL no parece ser un video valido de YouTube.");
  }

  return trimmedUrl;
}

export async function getFullVideoDownload(url) {
  const videoUrl = await assertYoutubeUrl(url);
  const ytdl = await getYtdl();
  const info = await ytdl.getInfo(videoUrl, getYtdlOptions(ytdl));

  const format =
    chooseBestMuxedMp4(info.formats) ||
    ytdl.chooseFormat(info.formats, {
      quality: "highest",
      filter: (item) => item.hasVideo && item.hasAudio,
    });

  if (!format?.url) {
    throw createHttpError(404, "No se encontro un formato descargable para este video.");
  }

  const details = info.videoDetails;
  const extension = format.container || "mp4";

  return {
    title: details.title,
    author: details.author?.name || "",
    lengthSeconds: Number(details.lengthSeconds || 0),
    thumbnail:
      details.thumbnails?.slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url ||
      "",
    quality: format.qualityLabel || format.quality || "video",
    mimeType: format.mimeType || "video/mp4",
    extension,
    filename: `${safeFilename(details.title || "youtube-video")}.${extension}`,
    downloadUrl: format.url,
  };
}

function getYtdlOptions(ytdl) {
  const cookies = getConfiguredCookies();
  const proxy = process.env.YOUTUBE_PROXY_URL;

  if (!cookies.length && !proxy) return {};

  const cacheKey = `${proxy || ""}:${cookies.map((cookie) => cookie.name).join(",")}`;
  if (!agent || agentCacheKey !== cacheKey) {
    agent = proxy ? ytdl.createProxyAgent({ uri: proxy }, cookies) : ytdl.createAgent(cookies);
    agentCacheKey = cacheKey;
  }

  return { agent };
}

function getConfiguredCookies() {
  const encodedCookies = process.env.YOUTUBE_COOKIES_BASE64;
  const rawCookies = encodedCookies
    ? Buffer.from(encodedCookies, "base64").toString("utf8")
    : process.env.YOUTUBE_COOKIES;

  const normalizedRawCookies = rawCookies?.trim();
  if (!normalizedRawCookies) return [];

  if (normalizedRawCookies.startsWith("[") || normalizedRawCookies.startsWith("{")) {
    try {
      const parsed = JSON.parse(normalizedRawCookies);
      if (Array.isArray(parsed)) return normalizeCookies(parsed);
      if (Array.isArray(parsed.cookies)) return normalizeCookies(parsed.cookies);
    } catch {
      throw createHttpError(500, "YOUTUBE_COOKIES contiene JSON invalido.");
    }

    throw createHttpError(500, "YOUTUBE_COOKIES debe ser un array JSON o tener una propiedad cookies.");
  }

  if (looksLikeNetscapeCookies(normalizedRawCookies)) {
    return parseNetscapeCookies(normalizedRawCookies);
  }

  return parseCookieHeader(normalizedRawCookies);
}

function normalizeCookies(cookies) {
  return cookies
    .map((cookie) => ({
      domain: normalizeCookieDomain(cookie.domain || ".youtube.com"),
      expirationDate: cookie.expirationDate,
      hostOnly: cookie.hostOnly ?? false,
      httpOnly: cookie.httpOnly ?? false,
      name: sanitizeCookieName(cookie.name),
      path: cookie.path || "/",
      sameSite: cookie.sameSite || "unspecified",
      secure: cookie.secure ?? true,
      value: sanitizeCookieValue(cookie.value),
    }))
    .filter(isUsableCookie);
}

function looksLikeNetscapeCookies(rawCookies) {
  return rawCookies
    .split(/\r?\n/)
    .some((line) => line.trim() && !line.startsWith("# Netscape") && line.split("\t").length >= 7);
}

function parseNetscapeCookies(rawCookies) {
  return rawCookies
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && (!line.startsWith("#") || line.startsWith("#HttpOnly_")))
    .map((line) => {
      const fields = line.split("\t");
      if (fields.length < 7) return null;

      const [rawDomain, includeSubdomains, path, secure, expirationDate, name, ...valueParts] = fields;
      const domain = normalizeCookieDomain(rawDomain.replace(/^#HttpOnly_/, ""));

      return {
        domain,
        expirationDate: Number(expirationDate) || undefined,
        hostOnly: String(includeSubdomains).toUpperCase() !== "TRUE",
        httpOnly: rawDomain.startsWith("#HttpOnly_"),
        name: sanitizeCookieName(name),
        path: path || "/",
        sameSite: "unspecified",
        secure: String(secure).toUpperCase() === "TRUE",
        value: sanitizeCookieValue(valueParts.join("\t")),
      };
    })
    .filter(isUsableCookie);
}

function parseCookieHeader(rawCookies) {
  return rawCookies
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) return null;

      return {
        domain: ".youtube.com",
        hostOnly: false,
        httpOnly: false,
        name: sanitizeCookieName(part.slice(0, separatorIndex)),
        path: "/",
        sameSite: "unspecified",
        secure: true,
        value: sanitizeCookieValue(part.slice(separatorIndex + 1)),
      };
    })
    .filter(isUsableCookie);
}

function normalizeCookieDomain(domain) {
  return String(domain || ".youtube.com")
    .replace(/^#HttpOnly_/, "")
    .trim()
    .toLowerCase();
}

function sanitizeCookieName(name) {
  return String(name || "").trim();
}

function sanitizeCookieValue(value) {
  return String(value ?? "").replace(/[\r\n\t]/g, "").trim();
}

function isUsableCookie(cookie) {
  if (!cookie?.name || cookie.value === undefined) return false;
  return /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(cookie.name);
}

function chooseBestMuxedMp4(formats) {
  const candidates = formats
    .filter((item) => item.hasVideo && item.hasAudio && item.container === "mp4")
    .sort((a, b) => {
      const aPreferred = MP4_MUXED_FORMATS.has(String(a.itag)) ? 1 : 0;
      const bPreferred = MP4_MUXED_FORMATS.has(String(b.itag)) ? 1 : 0;
      return (
        bPreferred - aPreferred ||
        (Number(b.height) || 0) - (Number(a.height) || 0) ||
        (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0)
      );
    });

  return candidates[0];
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

export function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function getPublicError(error) {
  if (error.statusCode && error.statusCode < 500) return error.message;

  const message = `${error.message || ""} ${error.stack || ""}`.toLowerCase();

  if (
    message.includes("sign in") ||
    message.includes("confirm") ||
    message.includes("bot") ||
    message.includes("captcha") ||
    message.includes("403") ||
    message.includes("unrecoverable")
  ) {
    return "YouTube bloqueo la solicitud del servidor. Configura YOUTUBE_COOKIES en Vercel e intenta de nuevo.";
  }

  if (message.includes("invalid cookie header") || message.includes("und_err_invalid_arg")) {
    return "Las cookies configuradas en Vercel tienen formato invalido. Usa JSON exportado por Cookie Editor, formato Netscape o un header Cookie limpio.";
  }

  if (message.includes("private") || message.includes("members-only")) {
    return "Este video requiere acceso de una cuenta. Configura cookies de una cuenta con permiso para verlo.";
  }

  return "No se pudo preparar la descarga. Prueba con otro video o intenta de nuevo.";
}

export function getCookieEnvironmentStatus() {
  const cookies = getConfiguredCookies();

  return {
    hasCookies: cookies.length > 0,
    cookieCount: cookies.length,
    hasProxy: Boolean(process.env.YOUTUBE_PROXY_URL),
    source: process.env.YOUTUBE_COOKIES_BASE64
      ? "YOUTUBE_COOKIES_BASE64"
      : process.env.YOUTUBE_COOKIES
        ? "YOUTUBE_COOKIES"
        : "none",
  };
}
