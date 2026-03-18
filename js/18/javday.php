<?php
/**
 * JavDay (javday.tv) - PHP T4 接口 (精简版 - 已移除简介与番号)，注意，开启了图片代理
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

define('HOST',     'https://javday.tv');
define('IMG_HOST', 'https://javday.tv');
define('UA',       'Mozilla/5.0 (Linux; Android 15; PHK110 Build/AP3A.240617.008; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/145.0.7632.79 Mobile Safari/537.36');

$CLASSES = [
    ['type_id' => 'new-release',       'type_name' => '新作上市'],
    ['type_id' => 'censored',          'type_name' => '有碼'],
    ['type_id' => 'chinese-av',        'type_name' => '國產AV'],
    ['type_id' => 'uncensored-leaked', 'type_name' => '無碼流出'],
];

function http_get($url) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_HTTPHEADER     => [
            'User-Agent: '      . UA,
            'Accept: text/html,application/xhtml+xml,*/*;q=0.9',
            'Referer: '         . IMG_HOST . '/',
        ],
    ]);
    $body = curl_exec($ch);
    curl_close($ch);
    return $body ?: '';
}

function fix_pic($url) {
    if (!$url) return '';
    if (strpos($url, 'http') !== 0) $url = IMG_HOST . $url;
    $self = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http')
          . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['SCRIPT_NAME'];
    return $self . '?ac=img&url=' . urlencode($url);
}

function do_img($url) {
    if (!$url) { http_response_code(400); exit; }
    $host = parse_url($url, PHP_URL_HOST);
    if (!$host || strpos($host, 'javday') === false) { http_response_code(403); exit; }
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER     => ['User-Agent: '.UA, 'Referer: '.IMG_HOST.'/'],
    ]);
    $body = curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);
    if (!$body || $info['http_code'] !== 200) { http_response_code(404); exit; }
    header('Content-Type: ' . ($info['content_type'] ?: 'image/jpeg'));
    header('Cache-Control: public, max-age=86400');
    echo $body;
    exit;
}

function parse_video_list($html) {
    $list = [];
    $blocks = preg_split('/class="col-style[^"]*lazy loaded"/i', $html);
    array_shift($blocks);
    foreach ($blocks as $block) {
        if (!preg_match('#href="/videos/([^"/]+)/"#i', $block, $hm)) continue;
        $pic = '';
        if (preg_match('/background-image:\s*url\(([^)]+)\)/i', $block, $pm)) $pic = fix_pic(trim($pm[1], " '\""));
        $title = '';
        if (preg_match('/class="title"[^>]*>([\s\S]*?)<\/span>/i', $block, $tm)) $title = trim(strip_tags($tm[1]));
        if (!$title) continue;
        $list[] = ['vod_id' => $hm[1], 'vod_name' => $title, 'vod_pic' => $pic, 'vod_remarks' => ''];
    }
    return $list;
}

function do_home() {
    global $CLASSES;
    $html = http_get(HOST . '/');
    return ['class' => $CLASSES, 'list' => $html ? parse_video_list($html) : []];
}

function do_category($type_id, $page) {
    $pg = max(1, (int)$page);
    $html = http_get(HOST . '/category/' . $type_id . '/page/' . $pg . '/');
    if (!$html) return ['list' => [], 'page' => $pg];
    $list = parse_video_list($html);
    return ['list' => $list, 'page' => $pg, 'pagecount' => $pg + 1, 'limit' => 24];
}

function do_search($wd, $page) {
    $pg = max(1, (int)$page);
    $url = HOST . '/search/wd/' . urlencode($wd) . '/' . ($pg > 1 ? "page/$pg/" : "");
    $html = http_get($url);
    return ['list' => $html ? parse_video_list($html) : [], 'page' => $pg, 'pagecount' => $pg + 1];
}

function do_detail($ids) {
    $results = [];
    foreach ($ids as $vod_id) {
        $html = http_get(HOST . '/videos/' . trim($vod_id) . '/');
        if (!$html) continue;

        $title = preg_match('/<h1[^>]+class="video-title"[^>]*>([\s\S]*?)<\/h1>/i', $html, $m) ? trim(strip_tags($m[1])) : $vod_id;
        $pic = '';
        if (preg_match('/property="og:image"\s+content="([^"]+)"/i', $html, $m)) $pic = $m[1];

        $year = preg_match('/(\d{4}-\d{2}-\d{2})/', $html, $m) ? $m[1] : '';
        
        // 关键修改：将 vod_remarks 设为空，不再解析页面中的番号
        $remarks = ''; 
        
        $play_url = '';
        if (preg_match("/url:\s*['\"]([^'\"]+\.m3u8[^'\"]*)['\"],/i", $html, $m)) $play_url = $m[1];

        $results[] = [
            'vod_id'        => $vod_id,
            'vod_name'      => $title,
            'vod_pic'       => $pic,
            'vod_year'      => $year,
            'vod_content'   => '', // 已去掉简介
            'vod_remarks'   => $remarks, // 红圈处对应的番号字段已清空
            'vod_play_from' => 'JavDay',
            'vod_play_url'  => '播放$' . $play_url,
        ];
    }
    return ['list' => $results];
}

// 路由逻辑
$ac = $_GET['ac'] ?? '';
$pg = $_GET['pg'] ?? '1';

if (($_GET['ac'] ?? '') === 'img') do_img($_GET['url'] ?? '');
if (isset($_GET['play'])) { echo json_encode(['parse'=>0,'url'=>$_GET['play'],'header'=>['User-Agent'=>UA,'Referer'=>IMG_HOST.'/']], 320); exit; }
if (isset($_GET['wd'])) { echo json_encode(do_search($_GET['wd'], $pg), 320); exit; }
if (!$ac) { echo json_encode(do_home(), 320); exit; }
if ($ac === 'detail') {
    if (isset($_GET['t'])) echo json_encode(do_category($_GET['t'], $pg), 320);
    elseif (isset($_GET['ids'])) echo json_encode(do_detail(explode(',', $_GET['ids'])), 320);
    exit;
}
