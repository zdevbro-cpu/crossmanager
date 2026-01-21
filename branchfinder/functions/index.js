const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const NAVER_API_HOST = "https://maps.apigw.ntruss.com";
const NAVER_SEARCH_HOST = "https://openapi.naver.com";
const NAVER_MAP_CLIENT_ID = defineSecret("NAVER_MAP_CLIENT_ID");
const NAVER_MAP_CLIENT_SECRET = defineSecret("NAVER_MAP_CLIENT_SECRET");
const NAVER_SEARCH_CLIENT_ID = defineSecret("NAVER_SEARCH_CLIENT_ID");
const NAVER_SEARCH_CLIENT_SECRET = defineSecret("NAVER_SEARCH_CLIENT_SECRET");

const getCredentials = () => {
  const clientId = (NAVER_MAP_CLIENT_ID.value() || "").trim();
  const clientSecret = (NAVER_MAP_CLIENT_SECRET.value() || "").trim();
  return { clientId, clientSecret };
};

const getQueryString = (originalUrl) => {
  const idx = originalUrl.indexOf("?");
  return idx >= 0 ? originalUrl.slice(idx) : "";
};

const getTargetPath = (path) => {
  const prefix = "/api/naver";
  let targetPath = path.startsWith(prefix) ? path.slice(prefix.length) : path;
  if (!targetPath) {
    targetPath = "/";
  }
  if (!targetPath.startsWith("/")) {
    targetPath = `/${targetPath}`;
  }
  return targetPath;
};

exports.naverProxy = onRequest(
  { region: "asia-northeast3", secrets: [NAVER_MAP_CLIENT_ID, NAVER_MAP_CLIENT_SECRET] },
  async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "GET") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const { clientId, clientSecret } = getCredentials();
  if (!clientId || !clientSecret) {
    logger.error("Missing NAVER_MAP_CLIENT_ID or NAVER_MAP_CLIENT_SECRET");
    res.status(500).send("Server misconfigured");
    return;
  }

  const targetPath = getTargetPath(req.path || "");
  const queryString = getQueryString(req.originalUrl || "");
  const targetUrl = `${NAVER_API_HOST}${targetPath}${queryString}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
        "Accept": "application/json",
      },
    });

    const contentType = response.headers.get("content-type") || "text/plain";
    const body = await response.text();

    res.status(response.status);
    res.set("Content-Type", contentType);
    res.send(body);
  } catch (error) {
    logger.error("Naver proxy error", error);
    res.status(502).send("Upstream request failed");
  }
  }
);

exports.naverSearchProxy = onRequest(
  { region: "asia-northeast3", secrets: [NAVER_SEARCH_CLIENT_ID, NAVER_SEARCH_CLIENT_SECRET] },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "GET") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const clientId = (NAVER_SEARCH_CLIENT_ID.value() || "").trim();
    const clientSecret = (NAVER_SEARCH_CLIENT_SECRET.value() || "").trim();
    if (!clientId || !clientSecret) {
      logger.error("Missing NAVER_SEARCH_CLIENT_ID or NAVER_SEARCH_CLIENT_SECRET");
      res.status(500).send("Server misconfigured");
      return;
    }

    const targetPath = (() => {
      const prefix = "/api/naver-search";
      let path = req.path.startsWith(prefix) ? req.path.slice(prefix.length) : req.path;
      if (!path || path === "/") {
        path = "/v1/search/local.json";
      }
      if (!path.startsWith("/")) {
        path = `/${path}`;
      }
      return path;
    })();

    const queryString = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
    const targetUrl = `${NAVER_SEARCH_HOST}${targetPath}${queryString}`;

    try {
      const response = await fetch(targetUrl, {
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
          "Accept": "application/json",
        },
      });

      const contentType = response.headers.get("content-type") || "text/plain";
      const body = await response.text();

      res.status(response.status);
      res.set("Content-Type", contentType);
      res.send(body);
    } catch (error) {
      logger.error("Naver search proxy error", error);
      res.status(502).send("Upstream request failed");
    }
  }
);
