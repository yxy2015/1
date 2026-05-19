/*!
 * @name 聆澜音源(公益版)
 * @description 支持网易云/酷我/咪咕，基于聚合音源核心，多链路自动回退
 * @version v6.0
 * @author 时迁酱&guoyue2010 / 重构: 全豆要聚合逻辑
 */

const DEV_ENABLE = false;
const UPDATE_ENABLE = true;
const SCRIPT_MD5 = "642a1ebc69d3665c5e4f07474470b14c"; // 保留原MD5用于更新检查
const MUSIC_QUALITY = {
  kw: ["128k", "320k", "flac"],
  mg: ["128k", "320k", "flac"],
  wy: ["128k", "320k", "flac"]
};
const MUSIC_SOURCE = Object.keys(MUSIC_QUALITY);

const { EVENT_NAMES, request, on, send, env, version } = globalThis.lx;

// ================== 聚合音源核心模块（从全豆要提取）==================
const HTTP_URL_REGEX = /^https?:\/\//i;

// API 端点
const XINGHAI_MAIN_API = "https://music-api.gdstudio.xyz/api.php?use_xbridge3=true&loader_name=forest&need_sec_link=1&sec_link_scene=im&theme=light";
const XINGHAI_BACKUP_API = "https://music-dl.sayqz.com/api/";
const SUYIN_163_API = "https://oiapi.net/api/Music_163";
const SUYIN_KUWO_API = "https://oiapi.net/api/Kuwo";
const SUYIN_MIGU_API = "https://api.xcvts.cn/api/music/migu";

// 平台映射
const PLATFORM_TO_XINGHAI = {
  wy: "netease",
  kw: "kuwo",
  mg: "migu"
};

const PLATFORM_TO_XINGHAI_BACKUP = {
  wy: "netease",
  kw: "kuwo"
  // mg 在备API中不支持，跳过
};

// 音质映射（星海主 br 参数）
const QUALITY_TO_BR = {
  "128k": "128",
  "192k": "192",
  "320k": "320",
  flac: "740",
  flac24bit: "999"
};

// 工具函数：标准化音质
function normalizeQuality(quality) {
  switch (String(quality || "").toLowerCase()) {
    case "128k": return "low";
    case "320k": return "standard";
    case "flac": return "lossless";
    default: return "128k";
  }
}

// 从歌曲信息中提取 ID（优先 hash, 其次 songmid, 最后 id）
function getSongId(songInfo) {
  return (songInfo?.hash || songInfo?.songmid || songInfo?.id || "").toString();
}

// 通用 http 请求（兼容 lx 环境）
function httpRequest(url, options = { method: "GET" }) {
  return new Promise((resolve, reject) => {
    request(url, { timeout: 8000, ...options }, (err, res) => {
      if (err) return reject(new Error("请求错误: " + err.message));
      let body = res?.body;
      if (typeof body === "string") {
        const trimmed = body.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try { body = JSON.parse(trimmed); } catch (e) {}
        }
      }
      resolve({ statusCode: res?.statusCode ?? 0, headers: res?.headers || {}, body });
    });
  });
}

// 带参数的 GET 请求
async function httpGet(url, params = {}) {
  const queryStr = Object.keys(params)
    .filter(k => params[k] !== undefined)
    .map(k => encodeURIComponent(k) + "=" + encodeURIComponent(params[k]))
    .join("&");
  const fullUrl = url + (queryStr ? (url.includes("?") ? "&" : "?") + queryStr : "");
  const res = await httpRequest(fullUrl, { method: "GET", timeout: 8000 });
  if (res.statusCode >= 400) throw new Error("HTTP错误: " + res.statusCode);
  return res.body;
}

// 从支持的音质列表中选择最佳匹配
function selectQuality(requestedQuality, supportedQualities) {
  if (!requestedQuality) requestedQuality = "128k";
  const normalized = String(requestedQuality).toLowerCase();
  if (supportedQualities.includes(normalized)) return normalized;
  const order = ["flac", "320k", "192k", "128k"];
  let idx = order.indexOf(normalized);
  if (idx < 0) idx = order.length - 1;
  for (let i = idx; i < order.length; i++) {
    if (supportedQualities.includes(order[i])) return order[i];
  }
  for (let i = order.length - 1; i >= 0; i--) {
    if (supportedQualities.includes(order[i])) return order[i];
  }
  return "128k";
}

// 校验 URL 合法性
function validateUrl(url, sourceName) {
  if (!url || typeof url !== "string") throw new Error(sourceName + "返回空URL");
  if (!HTTP_URL_REGEX.test(url.trim())) throw new Error(sourceName + "非法URL格式");
  return url;
}

// 星海主 API 获取 URL
async function xinghaiMainGetUrl(platform, songId, quality) {
  const source = PLATFORM_TO_XINGHAI[platform];
  if (!source) throw new Error("星海主不支持该平台");
  if (!songId) throw new Error("缺少songId");
  const selectedQuality = selectQuality(quality, ["128k", "192k", "320k", "flac"]);
  const br = QUALITY_TO_BR[selectedQuality];
  if (!br) throw new Error("星海主音质映射失败");
  const url = XINGHAI_MAIN_API + "&types=url&source=" + source + "&id=" + encodeURIComponent(songId) + "&br=" + br;
  const res = await httpRequest(url, {
    method: "GET",
    headers: { "User-Agent": "LX-Music-Mobile", Accept: "application/json" }
  });
  const body = res.body;
  if (!body || typeof body !== "object" || !body.url) throw new Error(body?.message || "星海主未返回URL");
  return body.url;
}

// 星海备 API 获取 URL（直接返回完整请求地址，然后获取）
async function xinghaiBackupGetUrl(platform, songId, quality) {
  const source = PLATFORM_TO_XINGHAI_BACKUP[platform];
  if (!source) throw new Error("星海备不支持该平台");
  if (!songId) throw new Error("缺少songId");
  const selectedQuality = selectQuality(quality, ["128k", "192k", "320k", "flac"]);
  const apiUrl = XINGHAI_BACKUP_API + "?source=" + encodeURIComponent(source) + "&id=" + encodeURIComponent(songId) + "&type=url&br=" + encodeURIComponent(selectedQuality);
  const res = await httpRequest(apiUrl, { method: "GET", timeout: 8000 });
  const body = res.body;
  if (!body || typeof body !== "object" || !body.url) throw new Error("星海备未返回URL");
  return body.url;
}

// 溯音 163 获取 URL
async function suyin163GetUrl(songInfo) {
  const id = songInfo?.songmid || songInfo?.id;
  if (!id) throw new Error("缺少网易云ID");
  const res = await httpGet(SUYIN_163_API, { id });
  if (res?.code === 0 && res?.data) {
    const item = Array.isArray(res.data) ? res.data[0] : res.data;
    if (item?.url) return item.url;
  }
  throw new Error("溯音163获取失败");
}

// 溯音酷我获取 URL（通过关键词搜索）
async function suyinKuwoGetUrl(songInfo, quality) {
  const keyword = (songInfo?.name || "") + (songInfo?.singer || "");
  if (!keyword) throw new Error("缺少歌曲名");
  const brMap = { flac: 1, "320k": 5, "128k": 7 };
  const targetQuality = selectQuality(quality, ["flac", "320k", "128k"]);
  const br = brMap[targetQuality] || 7;
  const res = await httpGet(SUYIN_KUWO_API, { msg: keyword, n: 1, br });
  if (res?.data?.url) return res.data.url;
  throw new Error("溯音酷我未找到链接");
}

// 溯音咪咕获取 URL
async function suyinMiguGetUrl(songInfo) {
  const keyword = (songInfo?.name || "") + (songInfo?.singer || "");
  if (!keyword) throw new Error("缺少歌曲名");
  const res = await httpGet(SUYIN_MIGU_API, { gm: keyword, n: 1, num: 1, type: "json" });
  if (res?.code === 200 && res?.musicInfo) return res.musicInfo;
  throw new Error("溯音咪咕未找到链接");
}

// 带 fallback 的统一获取 URL 函数（优先星海主 -> 星海备 -> 溯音对应平台）
async function getMusicUrlWithFallback(platform, musicInfo, quality) {
  const songId = getSongId(musicInfo);
  if (!songId) throw new Error("无法提取歌曲ID");

  // 1. 星海主
  try {
    const url = await xinghaiMainGetUrl(platform, songId, quality);
    return validateUrl(url, "星海主");
  } catch (e) {
    // fallback 继续
  }

  // 2. 星海备（仅支持 wy, kw）
  if (platform === "wy" || platform === "kw") {
    try {
      const url = await xinghaiBackupGetUrl(platform, songId, quality);
      return validateUrl(url, "星海备");
    } catch (e) {}
  }

  // 3. 溯音降级
  try {
    let url = null;
    if (platform === "wy") {
      url = await suyin163GetUrl(musicInfo);
    } else if (platform === "kw") {
      url = await suyinKuwoGetUrl(musicInfo, quality);
    } else if (platform === "mg") {
      url = await suyinMiguGetUrl(musicInfo);
    } else {
      throw new Error("平台不支持溯音降级");
    }
    if (url) return validateUrl(url, "溯音降级");
  } catch (e) {}

  throw new Error("所有音源链路均失败，无法获取播放地址");
}

// ================== 聆澜音源处理函数 ==================
const handleGetMusicUrl = async (source, musicInfo, quality) => {
  return getMusicUrlWithFallback(source, musicInfo, quality);
};

// 更新检查（保留原功能）
const checkUpdate = async () => {
  try {
    const API_URL_BASE = "https://source.shiqianjiang.cn/api";
    const requestRes = await new Promise((resolve, reject) => {
      request(`${API_URL_BASE}/script?checkUpdate=${SCRIPT_MD5}&key=`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `${env ? `lx-music-${env}/${version}` : `lx-music-request/${version}`}`
        }
      }, (err, resp) => {
        if (err) return reject(err);
        resolve(resp);
      });
    });
    const body = requestRes?.body;
    if (body?.data) {
      globalThis.lx.send(lx.EVENT_NAMES.updateAlert, {
        log: body.data.updateMsg,
        updateUrl: body.data.updateUrl
      });
    }
  } catch {}
};

// 构建 sources 配置
const musicSources = {};
MUSIC_SOURCE.forEach((item) => {
  musicSources[item] = {
    name: item,
    type: "music",
    actions: ["musicUrl"],
    qualitys: MUSIC_QUALITY[item]
  };
});

// 事件监听
on(EVENT_NAMES.request, ({ action, source, info }) => {
  if (action === "musicUrl") {
    return handleGetMusicUrl(source, info.musicInfo, info.type)
      .then(data => Promise.resolve(data))
      .catch(err => Promise.reject(err));
  }
  return Promise.reject("action not support");
});

if (UPDATE_ENABLE) checkUpdate();
send(EVENT_NAMES.inited, { status: true, openDevTools: false, sources: musicSources });