/**
 * Gaze 影视 — https://gaze.run/
 *
 * 纯 WebView DOM 模式：通过浏览器渲染页面后直接解析 DOM 获取数据，
 * 不调用后端 API，所有数据均从页面元素中提取。
 *
 * @config
 * debug: true
 * returnType: dom
 * timeout: 30
 * blockImages: true
 * blockList: *google*|*facebook*|*analytics*|*beacon*|*advertisement*
 */

var BASE = 'https://gaze.run';

// ==================== 爬虫方法 ====================

function init(cfg) {
    return {};
}

/**
 * 首页分类 + 筛选项（从 DOM 动态提取）
 */
async function homeContent(filter) {
    var areas = extractFilter('.mcountry');
    var genres = extractFilter('.mtag');
    var sorts = extractFilter('.sort');
    var years = extractFilter('.years');
    if (!areas.length) areas = [{ n: '全部地区', v: 'all' }];
    if (!genres.length) genres = [{ n: '全部类型', v: 'all' }];
    if (!sorts.length) sorts = [{ n: '默认排序', v: 'default' }];
    if (!years.length) years = [{ n: '全部年份', v: 'all' }];
    var shared = [
        { key: 'area', name: '地区', value: areas },
        { key: 'genre', name: '类型', value: genres },
        { key: 'sort', name: '排序', value: sorts },
        { key: 'year', name: '年份', value: years }
    ];
    return {
        class: [
            { type_id: '1', type_name: '电影' },
            { type_id: '2', type_name: '电视剧' },
            { type_id: 'bangumi', type_name: '番剧' },
            { type_id: 'chinese_cartoon', type_name: '国漫' }
        ],
        filters: { '1': shared, '2': shared, 'bangumi': shared, 'chinese_cartoon': shared }
    };
}

/**
 * 首页推荐列表
 */
async function homeVideoContent() {
    await delay(500);
    return { list: parseCards() };
}

/**
 * 分类筛选列表
 */
async function categoryContent(tid, pg, filter, extend) {
    var ext = extend || {};
    // 依次点击筛选项，每次触发站点 AJAX 刷新
    await clickFilter('.mform', tid || 'all');
    if (ext.area && ext.area !== 'all') await clickFilter('.mcountry', ext.area);
    if (ext.genre && ext.genre !== 'all') await clickFilter('.mtag', ext.genre);
    if (ext.sort) await clickFilter('.sort', ext.sort);
    if (ext.year && ext.year !== 'all') await clickFilter('.years', ext.year);
    await delay(1200);
    // 翻页
    var page = parseInt(pg) || 1;
    if (page > 1) {
        var pageBtn = document.querySelector('.ui-pagination-page-item[data-current="' + page + '"]');
        if (pageBtn) {
            pageBtn.click();
            await delay(1200);
        }
    }
    return { page: page, pagecount: getLastPage(), list: parseCards() };
}

/**
 * 详情页（从播放页 DOM 解析标题、集数）
 */
async function detailContent(ids) {
    var mid = Array.isArray(ids) ? ids[0] || '' : ids || '';
    await delay(800);
    var h5 = document.querySelector('h5');
    var title = h5 ? h5.textContent.trim() : mid;
    var coverImg = document.querySelector('img[alt="' + title + '"]')
        || document.querySelector('img.mcoverimg')
        || document.querySelector('img.img-responsive');
    var pic = coverImg ? (coverImg.getAttribute('data-src') || coverImg.src || '') : '';
    var h5s = document.querySelectorAll('h5');
    var remarks = h5s.length > 1 ? h5s[1].textContent.trim() : '';
    // 集数列表（用 data-id 区分每集）
    var buttons = document.querySelectorAll('button.playbtn');
    var episodes = [];
    var isFirst = true;
    for (var i = 0; i < buttons.length; i++) {
        var text = buttons[i].textContent.trim();
        var dataId = buttons[i].getAttribute('data-id');
        if (/^第\d+集$/.test(text) && dataId) {
            episodes.push(text + '$' + mid + ':' + dataId);
            isFirst = false;
        }
    }
    if (episodes.length === 0) episodes.push('播放$' + mid);
    return {
        list: [{
            vod_id: mid,
            vod_name: title,
            vod_pic: pic,
            vod_remarks: remarks,
            vod_play_from: 'Gaze',
            vod_play_url: episodes.join('#')
        }]
    };
}

/**
 * 搜索
 */
async function searchContent(key, quick, pg) {
    var input = document.querySelector('input[placeholder*="影视"]');
    if (input) setInputValue(input, key);
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.indexOf('搜索') >= 0) {
            btns[i].click();
            break;
        }
    }
    await delay(1500);
    var page = parseInt(pg) || 1;
    if (page > 1) {
        var pageBtn = document.querySelector('.ui-pagination-page-item[data-current="' + page + '"]');
        if (pageBtn) {
            pageBtn.click();
            await delay(1200);
        }
    }
    return { list: parseCards(), page: page, pagecount: getLastPage() };
}

/**
 * 播放（全屏 WebView）
 */
async function playerContent(flag, id, vipFlags) {
    var sep = id.indexOf(':');
    var mid = sep > 0 ? id.substring(0, sep) : id;
    var dataId = sep > 0 ? id.substring(sep + 1) : '';
    openPlayer(mid, dataId);
    return {};
}

/**
 * 列表项点击直接播放
 */
async function action(mid) {
    // 不再直接 openPlayer，让宿主走正常的 detailContent → playerContent 流程
    return;
}

// ==================== 内部工具 ====================

function parseCards() {
    var items = document.querySelectorAll('.Movie-item');
    var list = [];
    for (var i = 0; i < items.length; i++) {
        var card = items[i];
        var parent = card.parentElement;
        var link = card.querySelector('a[href*="play/"]');
        if (!link) continue;
        var href = link.getAttribute('href') || '';
        var mid = href.replace(/.*play\//, '');
        var titleEl = parent ? parent.querySelector('.rs-title') : null;
        var name = titleEl ? titleEl.textContent.trim() : (link.getAttribute('title') || '');
        var img = card.querySelector('img.mcoverimg, img[data-src]');
        var pic = img ? (img.getAttribute('data-src') || img.src || '') : '';
        var badge = card.querySelector('.triangle-cornermark');
        var def = card.querySelector('.dbadges');
        var remarks = '';
        if (badge) remarks += badge.textContent.trim() + ' ';
        if (def) remarks += def.textContent.trim();
        list.push({
            vod_id: mid, vod_name: name, vod_pic: pic,
            vod_remarks: remarks.trim(),
            style: { type: 'rect', ratio: 0.7 }
        });
    }
    return list;
}

function extractFilter(parentClass) {
    var items = document.querySelectorAll(parentClass + ' .filter-item a');
    var result = [];
    for (var i = 0; i < items.length; i++) {
        result.push({ n: items[i].textContent.trim(), v: items[i].getAttribute('data-filter') || '' });
    }
    return result;
}

function clickFilter(parentClass, value) {
    var items = document.querySelectorAll(parentClass + ' .filter-item a');
    for (var i = 0; i < items.length; i++) {
        if (items[i].getAttribute('data-filter') === String(value)) {
            items[i].click();
            return delay(200);
        }
    }
    return Promise.resolve();
}

function getLastPage() {
    var items = document.querySelectorAll('.ui-pagination-page-item');
    if (items.length === 0) return 1;
    return parseInt(items[items.length - 1].getAttribute('data-current')) || 1;
}

function setInputValue(input, value) {
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function openPlayer(mid, dataId) {
    var opts = {
        url: BASE + '/play/' + mid,
        headers: { Referer: BASE + '/' },
        timeout: 25,
        selector: 'video',
        selectors: ['video', 'iframe video', '.art-video'],
        allowInteraction: true,
        blockList: ['*google*', '*facebook*', '*analytics*']
    };
    // 有 dataId 时注入脚本，等待 jQuery 就绪后点击对应集数按钮
    if (dataId) {
        opts.script = "(function clickEp(){" +
            "var b=document.querySelector('button.playbtn[data-id=\"" + dataId + "\"]');" +
            "if(b&&typeof jQuery!=='undefined'){" +
            "if(!b.classList.contains('playbtn_active'))jQuery(b).trigger('click');" +
            "return;}" +
            "setTimeout(clickEp,300);" +
            "})();";
    }
    host.player.open(opts);
}

// ==================== 路由（WebView 先导航到对应页面） ====================

var spider = {
    routes: {
        homeContent: function () { return BASE + '/filter'; },
        homeVideoContent: function () { return BASE + '/filter'; },
        categoryContent: function () { return BASE + '/filter'; },
        detailContent: function (ids) {
            var mid = Array.isArray(ids) ? ids[0] || '' : ids || '';
            return BASE + '/play/' + mid;
        },
        searchContent: function () { return BASE + '/filter'; }
    }
};

spider;
