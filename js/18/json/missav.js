const host = 'www.missav2.icu/cn';

const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": host + "/cn"
};

// 辅助函数：正则提取

const m = (s, r, i = 1) => (s.match(r) || [])[i] || "";

async function init(cfg) {}

// 1. 首页分类定义

async function home(filter) {
    const classes = [
        {"type_id": "chinese-subtitle", "type_name": "中文字幕"},
        {"type_id": "new", "type_name": "最近更新"},
        {"type_id": "release", "type_name": "新作上市"},
        {"type_id": "uncensored-leak", "type_name": "无码流出"},
        {"type_id": "today-hot", "type_name": "今日热门"}
    ];
    return JSON.stringify({ class: classes });
}

// 2. 获取分类列表

async function category(tid, pg, filter, extend = {}) {
    const p = pg || 1;
    // 构造 URL: https://missav.ws/cn/chinese-subtitle?page=1
    const url = `${host}/cn/${tid}?page=${p}`;

    const r = await req(url, { headers });
    const html = r.content;

    // 使用 pdfa 找到影片卡片块，MissAV 的卡片通常在 div.thumbnail
    const items = pdfa(html, "div.thumbnail");
   
    const list = items.map(it => {
        // 提取影片 ID (从 href="/cn/ID" 中提取)
        let id = m(it, /href=".*?\/cn\/(.*?)"/);
        // 提取标题 (从 img alt 提取)
        let name = m(it, /alt="(.*?)"/);
        // 提取封面 (从 data-src 提取)
        let pic = m(it, /data-src="(.*?)"/);
        // 提取时长 (从 span 提取)
        let remarks = m(it, /<span.*?>(.*?)<\/span>/);


        if (!id || !name) return null;
        return {
            vod_id: id,
            vod_name: name,
            vod_pic: pic,
            vod_remarks: remarks
        };
    }).filter(Boolean);

    return JSON.stringify({ page: p, list: list });
}

// 3. 详情页逻辑
async function detail(id) {
    // 这里传入的 id 就是类似 jur-577-uncensored-leak

    return JSON.stringify({
        list: [{
            vod_id: id,
            vod_name: id, // 简单处理，播放器会自动显示
            vod_play_from: "MissAV-Surrit",
            vod_play_url: "播放$" + id
        }]
    });
}

// 4. 核心：播放解析（改用 req 和你发现的 UUID 规律）

async function play(flag, id, flags) {
    // 1. 请求详情页拿到 UUID
    const detailUrl = `${host}/cn/${id}`;
    const r = await req(detailUrl, { headers });
    const html = r.content;

    // 2. 正则抠取 UUID (8-4-4-4-12格式)
    let uuid = m(html, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/, 0);

    if (uuid) {
        // 3. 构造你抓包成功的 surrit 地址
        const playUrl = `https://surrit.com/${uuid}/playlist.m3u8`;

        return JSON.stringify({
            parse: 0,
            url: playUrl,
            header: {
                "Referer": detailUrl,
                "User-Agent": headers["User-Agent"]
            }
        });
    }

    return JSON.stringify({ parse: 1, url: detailUrl });
}

// 5. 搜索功能
async function search(wd, quick, pg = 1) {
    const url = `${host}/cn/search/${encodeURIComponent(wd)}?page=${pg}`;

    const r = await req(url, { headers });
    // 搜索结果的 HTML 结构通常和列表页一致
    // 这里为了偷懒直接复用逻辑或手动写一段简单的匹配
    const html = r.content;
    const items = pdfa(html, "div.thumbnail");
    const list = items.map(it => {
        let id = m(it, /href=".*?\/cn\/(.*?)"/);
        let name = m(it, /alt="(.*?)"/);

        return {
            vod_id: id,
            vod_name: name,
            vod_pic: m(it, /data-src="(.*?)"/),
            vod_remarks: "搜索结果"
        };
    }).filter(Boolean);

    return JSON.stringify({ page: pg, list: list });
}

export default { init, home, category, detail, search, play };