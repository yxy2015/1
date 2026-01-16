/**
 * LIBVIO (libvio.site) 爬虫
 * 作者：deepseek-adapter
 * 版本：2.0
 * 适配说明：基于低端影视模板，针对 LIBVIO 结构进行数据提取、路径补全及多线路合并
 * 更新到最新 WvSpider 版本 写法
 * 
 * @config
 * debug: true
 * showWebView: false
 * blockImages: true
 */

const baseUrl = 'https://www.libvio.site';
const headers =  {
    'Referer': baseUrl,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/000000000 Safari/537.36'
};

/**
 * 初始化配置
 */
async function init(cfg) {
    return {};
}

/**
 * 首页分类及筛选配置
 * 对应链接：/show/2-韩国-time--韩语----2---2025.html
 */
async function homeContent(filter) {
    return {
        class: [
            { type_id: "1", type_name: "电影" },
            { type_id: "2", type_name: "剧集" },
            { type_id: "4", type_name: "动漫" },
            { type_id: "15", type_name: "日韩剧" },
            { type_id: "16", type_name: "欧美剧" }
        ],
        filters: {
            "1": [
                { key: "class", name: "类型", value: [{n:"全部",v:""},{n:"动作片",v:"动作片"},{n:"喜剧片",v:"喜剧片"},{n:"爱情片",v:"爱情片"},{n:"科幻片",v:"科幻片"},{n:"恐怖片",v:"恐怖片"},{n:"剧情片",v:"剧情片"},{n:"战争片",v:"战争片"},{n:"惊悚片",v:"惊悚片"},{n:"犯罪片",v:"犯罪片"},{n:"悬疑片",v:"悬疑片"},{n:"动画片",v:"动画片"},{n:"奇幻片",v:"奇幻片"}] },
                { key: "area",  name: "地区", value: [{n:"全部",v:""},{n:"大陆",v:"大陆"},{n:"香港",v:"香港"},{n:"台湾",v:"台湾"},{n:"美国",v:"美国"},{n:"韩国",v:"韩国"},{n:"日本",v:"日本"},{n:"泰国",v:"泰国"},{n:"英国",v:"英国"},{n:"法国",v:"法国"},{n:"德国",v:"德国"},{n:"印度",v:"印度"}] },
                { key: "year",  name: "年份", value: [{n:"全部",v:""},{n:"2025",v:"2025"},{n:"2024",v:"2024"},{n:"2023",v:"2023"},{n:"2022",v:"2022"},{n:"2021",v:"2021"},{n:"2020",v:"2020"},{n:"2019",v:"2019"},{n:"2018",v:"2018"},{n:"2017",v:"2017"}] },
                { key: "sort",  name: "排序", value: [{n:"时间",v:"time"},{n:"人气",v:"hits"},{n:"评分",v:"score"}] }
            ],
            "2": [
                { key: "class", name: "类型", value: [{n:"全部",v:""},{n:"古装",v:"古装"},{n:"战争",v:"战争"},{n:"青春",v:"青春"},{n:"偶像",v:"偶像"},{n:"喜剧",v:"喜剧"},{n:"家庭",v:"家庭"},{n:"犯罪",v:"犯罪"},{n:"动作",v:"动作"},{n:"奇幻",v:"奇幻"},{n:"剧情",v:"剧情"},{n:"历史",v:"历史"},{n:"悬疑",v:"悬疑"},{n:"武侠",v:"武侠"}] },
                { key: "area",  name: "地区", value: [{n:"全部",v:""},{n:"国产",v:"国产"},{n:"香港",v:"香港"},{n:"台湾",v:"台湾"},{n:"韩国",v:"韩国"},{n:"日本",v:"日本"},{n:"美国",v:"美国"},{n:"泰国",v:"泰国"},{n:"英国",v:"英国"},{n:"新加坡",v:"新加坡"}] },
                { key: "lang",  name: "语言", value: [{n:"全部",v:""},{n:"国语",v:"国语"},{n:"英语",v:"英语"},{n:"粤语",v:"粤语"},{n:"韩语",v:"韩语"},{n:"日语",v:"日语"},{n:"泰语",v:"泰语"}] },
                { key: "year",  name: "年份", value: [{n:"全部",v:""},{n:"2025",v:"2025"},{n:"2024",v:"2024"},{n:"2023",v:"2023"},{n:"2022",v:"2022"},{n:"2021",v:"2021"},{n:"2020",v:"2020"},{n:"2019",v:"2019"}] },
                { key: "sort",  name: "排序", value: [{n:"时间",v:"time"},{n:"人气",v:"hits"},{n:"评分",v:"score"}] }
            ],
            "15": [
                { key: "area",  name: "地区", value: [{n:"全部",v:""},{n:"韩国",v:"韩国"},{n:"日本",v:"日本"}] },
                { key: "year",  name: "年份", value: [{n:"全部",v:""},{n:"2025",v:"2025"},{n:"2024",v:"2024"},{n:"2023",v:"2023"},{n:"2022",v:"2022"}] },
                { key: "sort",  name: "排序", value: [{n:"时间",v:"time"},{n:"人气",v:"hits"},{n:"评分",v:"score"}] }
            ],
            "16": [
                { key: "area",  name: "地区", value: [{n:"全部",v:""},{n:"美国",v:"美国"},{n:"英国",v:"英国"},{n:"法国",v:"法国"},{n:"德国",v:"德国"}] },
                { key: "year",  name: "年份", value: [{n:"全部",v:""},{n:"2025",v:"2025"},{n:"2024",v:"2024"},{n:"2023",v:"2023"},{n:"2022",v:"2022"}] },
                { key: "sort",  name: "排序", value: [{n:"时间",v:"time"},{n:"人气",v:"hits"},{n:"评分",v:"score"}] }
            ],
            "4": [
                { key: "area",  name: "地区", value: [{n:"全部",v:""},{n:"中国",v:"中国"},{n:"日本",v:"日本"},{n:"欧美",v:"欧美"},{n:"其他",v:"其他"}] },
                { key: "year",  name: "年份", value: [{n:"全部",v:""},{n:"2025",v:"2025"},{n:"2024",v:"2024"},{n:"2023",v:"2023"},{n:"2022",v:"2022"}] },
                { key: "sort",  name: "排序", value: [{n:"时间",v:"time"},{n:"人气",v:"hits"},{n:"评分",v:"score"}] }
            ]
        }
    };
}

async function homeVideoContent() {
    const document = await Java.wvOpen(`${baseUrl}`);
    return { list: parseVideoList(document) };
}

/**
 * 分类列表页：修复翻页
 */
async function categoryContent(tid, pg, filter, extend) {
    const area = extend.area || '';
    const year = extend.year || '';
    const cat = extend.class || '';
    const sort = extend.sort || 'time';
    const lang = extend.lang || '';
    
    // LIBVIO 标准 URL 模式
    //const url = `${baseUrl}/show/${tid}-${encodeURIComponent(area)}-${sort}-${encodeURIComponent(cat)}-${encodeURIComponent(lang)}----${pg}---${year}.html`;
    // wvSpider 新版本, url必须写在 wvOpen 括号内,用 `` 包裹. ↓ ↓ ↓ 并且,不需要 encodeURIComponent,会自动转码
    const document = await Java.wvOpen(`${baseUrl}/show/${tid}-${area}-${sort}-${cat}-${lang}----${pg}---${year}.html`);
    const videos = parseVideoList(document);
    
    // --- 核心修复：更健壮的总页数提取逻辑 ---
    let pageCount = parseInt(pg);
    try {
        const pageLinks = Array.from(document.querySelectorAll('.stui-page li a, .stui-page__item a'));
        
        // 策略1：寻找包含 "1/40" 这种格式的文本
        const activeText = document.querySelector('.stui-page li.active, .stui-page__item.active')?.textContent || "";
        if (activeText.includes('/')) {
            const total = activeText.split('/')[1].replace(/\D/g, '');
            if (total) pageCount = parseInt(total);
        } 
        
        // 策略2：如果策略1失败，寻找“尾页”或最后一个数字按钮
        if (pageCount <= parseInt(pg)) {
            for (let a of pageLinks) {
                const txt = a.textContent.trim();
                if (txt === '尾页' || txt === '末页') {
                    const href = a.getAttribute('href') || "";
                    const match = href.match(/----(\d+)---/);
                    if (match) {
                        pageCount = parseInt(match[1]);
                        break;
                    }
                }
            }
        }
        
        // 策略3：取页面上所有数字按钮的最大值
        if (pageCount <= parseInt(pg)) {
            const nums = pageLinks.map(a => parseInt(a.textContent.trim())).filter(n => !isNaN(n));
            if (nums.length > 0) pageCount = Math.max(...nums, pageCount);
        }
    } catch (e) {
        pageCount = parseInt(pg) + 1; // 兜底：允许至少翻到下一页
    }

    return { 
        list: videos, 
        page: parseInt(pg), 
        pagecount: pageCount, 
        limit: videos.length || 20,
        total: pageCount * (videos.length || 20)
    };
}

/**
 * 5. 详情/播放页全内容提取 (重点修正线路问题)
 */
async function detailContent(ids) {
    const document = await Java.wvOpen(ids[0]);
    
    // --- 1. 基本信息提取 ---
    const detailBox = document.querySelector('.stui-content__detail');
    const vod_name = detailBox?.querySelector('.title')?.textContent.trim() || '';
    const vod_pic = document.querySelector('.stui-content__thumb img')?.getAttribute('data-original') || '';
    
    const infoNodes = Array.from(detailBox?.querySelectorAll('.data') || []);
    let vod_year = '', vod_area = '', vod_actor = '', vod_director = '';
    infoNodes.forEach(node => {
        const t = node.textContent;
        if (t.includes('年份：')) vod_year = t.replace('年份：', '').trim();
        if (t.includes('地区：')) vod_area = t.replace('地区：', '').trim();
        if (t.includes('主演：')) vod_actor = t.replace('主演：', '').trim();
        if (t.includes('导演：')) vod_director = t.replace('导演：', '').trim();
    });

    const vod_content = document.querySelector('.detail-content')?.textContent.trim() || 
                        document.querySelector('.detail-sketch')?.textContent.trim() || '';

    // --- 2. 线路全量提取逻辑 ---
    let froms = [];
    let urls = [];

    // 获取所有选集列表容器 (每一个 ul 对应一个线路)
    const playlistUls = Array.from(document.querySelectorAll('ul.stui-content__playlist'));
    
    // 获取对应的线路标题
    // 在 Libvio 播放页，标题通常在面板头部 h3 中
    const playlistHeads = Array.from(document.querySelectorAll('.stui-pannel_hd .stui-pannel__head h3.title, .stui-pannel__head h3'));

    playlistUls.forEach((ul, index) => {
        // 获取线路名：优先从对应的头部取，取不到则编号
        let name = '线路 ' + (index + 1);
        if (playlistHeads[index]) {
            name = playlistHeads[index].textContent.trim().replace('播放列表', '');
        }
        
        // 过滤非播放内容的面板 (如猜你喜欢)
        if (name.includes('猜你喜欢') || name.includes('推荐')) return;

        froms.push(name);

        // 提取该线路下所有集数
        const episodes = Array.from(ul.querySelectorAll('li a')).map(a => {
            let epName = a.textContent.trim();
            let epHref = a.getAttribute('href');
            
            // 数据替换：补全绝对路径
            if (epHref && !epHref.startsWith('http')) {
                epHref = baseUrl + (epHref.startsWith('/') ? '' : '/') + epHref;
            }
            return `${epName}$${epHref}`;
        });
        urls.push(episodes.join('#'));
    });

    return {
        code: 1,
        list: [{
            vod_id: ids[0],
            vod_name: vod_name,
            vod_pic: vod_pic,
            vod_year: vod_year,
            vod_area: vod_area,
            vod_actor: vod_actor,
            vod_director: vod_director,
            vod_content: vod_content,
            vod_play_from: froms.join('$$$'), // 这里的 $$$ 会让播放器显示多线路切换
            vod_play_url: urls.join('$$$')    // 对应线路的选集
        }]
    };
}

/**
 * 6. 搜索功能
 */
async function searchContent(key, quick, pg) {
    // const url = `${baseUrl}/search.html?wd=${encodeURIComponent(key)}&page=${pg}`;
    //  这里也一样, url写在 wvOpen 括号内,并且去掉 encodeURIComponent
    const document = await Java.wvOpen(`${baseUrl}/search/${key}----------${pg}---.html`);
    const videos = parseVideoList(document);
    return { code: 1, list: videos };
}

/**
 * 7. 播放解析
 */
async function playerContent(flag, id, vipFlags) {
    try {
        const document = await Java.wvOpen(id);
        const html = document.documentElement.outerHTML;
        const match = html.match(/var\s+player_aaaa\s*=\s*({.*?});/);
        if (match) {
            const playerConfig = JSON.parse(match[1]);
            let videoUrl = playerConfig.url;
            if (playerConfig.encrypt == '1') videoUrl = decodeURIComponent(Java.base64Decode(videoUrl));
            if (playerConfig.encrypt == '2') videoUrl = decodeURIComponent(videoUrl);

            // 针对 vbing.me (BD5) 线路的关键修复
            // 需要带上特定的 Referer 才能绕过 403 错误
            let headers = {
                'Referer': 'https://www.libvio.site/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };

            // 如果是 vbing.me 的 mp4 直链，parse 必须设为 0 并带上正确的 Header
            const isDirect = videoUrl.indexOf('.m3u8') > -1 || videoUrl.indexOf('.mp4') > -1;
            return { 
                url: videoUrl, 
                parse: isDirect ? 0 : 1, 
                header: headers 
            };
        }
    } catch (e) {}
    return { url: id, parse: 1, header: { 'Referer': baseUrl } };
}

/* ---------------- 辅助工具函数 ---------------- */

function parseVideoList(document) {
    // 使用 Map 确保 vod_id 唯一，解决重复抓取问题
    const results = new Map();
    // 针对 LIBVIO 列表结构的精准选择器
    const items = Array.from(document.querySelectorAll('.stui-vodlist > li, .stui-vodlist__item, .stui-vodlist__box'));

    items.forEach(item => {
        const a = item.querySelector('a.stui-vodlist__thumb, a.pic');
        const titleA = item.querySelector('.title a, .stui-vodlist__detail .title a');
        
        let id = a?.getAttribute('href') || titleA?.getAttribute('href') || '';
        if (!id) return;
        
        // 统一处理为相对路径作为 Key 进行去重
        const cleanId = id.replace(baseUrl, '');
        
        if (!results.has(cleanId)) {
            results.set(cleanId, {
                vod_id: cleanId,
                vod_name: titleA?.textContent.trim() || a?.getAttribute('title')?.trim() || '',
                vod_pic: a?.getAttribute('data-original') || a?.getAttribute('src') || '',
                vod_remarks: item.querySelector('.pic-text')?.textContent.trim() || ''
            });
        }
    });

    return Array.from(results.values());
}