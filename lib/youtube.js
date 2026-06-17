import ytdl from "@distube/ytdl-core";

const MP4_MUXED_FORMATS = new Set(["18", "22"]);

export function assertYoutubeUrl(url) {
  if (!url || typeof url !== "string") {
    throw createHttpError(400, "Pega una URL de YouTube.");
  }

  const trimmedUrl = url.trim();
  if (!ytdl.validateURL(trimmedUrl)) {
    throw createHttpError(400, "La URL no parece ser un video valido de YouTube.");
  }

  return trimmedUrl;
}

export async function getFullVideoDownload(url) {
  const videoUrl = assertYoutubeUrl(url);
  const info = await ytdl.getInfo(videoUrl);

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
