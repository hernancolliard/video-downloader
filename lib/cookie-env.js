export function getRawCookieEnvironment() {
  const encodedCookies = process.env.YOUTUBE_COOKIES_BASE64;
  return encodedCookies ? decodeCookieEnvironment(encodedCookies) : process.env.YOUTUBE_COOKIES || "";
}

export function decodeCookieEnvironment(value) {
  const trimmedValue = String(value || "").trim();
  if (!trimmedValue) return "";

  if (looksLikeRawCookies(trimmedValue)) return trimmedValue;

  return Buffer.from(trimmedValue, "base64").toString("utf8");
}

export function looksLikeRawCookies(value) {
  return (
    value.includes("Netscape HTTP Cookie File") ||
    value.includes(".youtube.com") ||
    value.includes("youtube.com") ||
    value.trim().startsWith("[") ||
    value.trim().startsWith("{")
  );
}
