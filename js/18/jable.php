<?php
header('Access-Control-Allow-Origin: *');

define('HOST', 'https://jable.tv');
define('UA',   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

// ── 图片代理（最先处理，不输出JSON header）─────────────────
if (isset($_GET['img'])) {
    $imgUrl = $_GET['img'];
    if (!preg_match('#^https://assets-cdn\.jable\.tv/#', $imgUrl)) {
        http_response_code(403); exit;
    }
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $imgUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER     => [
            'User-Agent: ' . UA,
            'Referer: https://jable.tv/',
        ],
    ]);
    $data = curl_exec($ch);
    $mime = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: 'image/jpeg';
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($data && $code === 200) {
        header('Content-Type: ' . $mime);
        header('Cache-Control: public, max-age=86400');
        echo $data;
    } else {
        http_response_code(502);
    }
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$FIXED_CLASSES = [
    ['type_id' => 'top:new-release', 'type_name' => '🎬 新片优先'],
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
            'User-Agent: ' . UA,
            'Accept: text/html,application/xhtml+xml,application/json,*/*;q=0.9',
            'Accept-Language: zh-TW,zh;q=0.9,en;q=0.8',
            'Referer: ' . HOST . '/',
        ],
    ]);
    $body = curl_exec($ch);
    curl_close($ch);
    return $body ?: '';
}

// 图片：换小图 + 走服务器代理
function optimize_pic($url) {
    if (!$url) return '';
    if (strpos($url, 'preview.jpg') !== false) {
        $url = str_replace('preview.jpg', '320x180/1.jpg', $url);
    }
    // 走本机代理
    $protocol = (($_SERVER['HTTPS'] ?? 'off') === 'on') ? 'https://' : 'http://';
    $base = $protocol . $_SERVER['HTTP_HOST'] . $_SERVER['SCRIPT_NAME'];
    return $base . '?img=' . urlencode($url);
}

function parse_video_list($html) {
    $list = [];
    $pics = [];
    preg_match_all('/data-src="([^"]+)"/i', $html, $pm);
    foreach ($pm[1] as $src) {
        if (stripos($src, '.gif') !== false) continue;
        if (stripos($src, 'placeholder') !== false) continue;
        $pics[] = optimize_pic($src);
    }

    preg_match_all(
        '/<div[^>]+class="detail"[^>]*>[\s\S]*?<h6[^>]*>[\s\S]*?<a\s[^>]*href="https:\/\/jable\.tv\/videos\/([^"\/]+)[^"]*"[^>]*>([^<]+)<\/a>/i',
        $html, $dm
    );

    $count = count($dm[1]);
    for ($i = 0; $i < $count; $i++) {
        $vod_id = trim($dm[1][$i]);
        $title  = trim($dm[2][$i]);
        if (!$vod_id || !$title) continue;
        $list[] = [
            'vod_id'      => $vod_id,
            'vod_name'    => $title,
            'vod_pic'     => $pics[$i] ?? '',
            'vod_remarks' => '',
        ];
    }
    return $list;
}

function fetch_dynamic_classes() {
    $html = http_get(HOST . '/categories/');
    if (!$html) return [];
    $classes = [];
    preg_match_all(
        '/<div[^>]+class="[^"]*img-box[^"]*"[^>]*>[\s\S]*?href="https:\/\/jable\.tv\/categories\/([^"\/]+)[^"]*"[\s\S]*?<\/div>/i',
        $html, $cm
    );
    preg_match_all(
        '/<div[^>]+class="[^"]*absolute-center[^"]*"[^>]*>[\s\S]*?<h4[^>]*>([^<]+)<\/h4>/i',
        $html, $nm
    );
    $count = min(count($cm[1]), count($nm[1]));
    for ($i = 0; $i < $count; $i++) {
        $id = trim($cm[1][$i]); $name = trim($nm[1][$i]);
        if ($id && $name) $classes[] = ['type_id' => 'cat:' . $id, 'type_name' => $name];
    }
    return $classes;
}

function build_category_url($type_id, $pg) {
    $from = sprintf('%02d', $pg);
    $ts   = round(microtime(true) * 1000);
    $ajax = '?mode=async&function=get_block&block_id=list_videos_common_videos_list&sort_by=post_date&from=' . $from . '&_=' . $ts;
    if (strpos($type_id, 'cat:') === 0) return HOST . '/categories/' . substr($type_id, 4) . '/' . $ajax;
    if (strpos($type_id, 'tag:') === 0) return HOST . '/tags/' . substr($type_id, 4) . '/' . $ajax;
    if (strpos($type_id, 'top:') === 0) return HOST . '/' . substr($type_id, 4) . '/' . $ajax;
    return HOST . '/categories/' . $type_id . '/' . $ajax;
}

function extract_hls_url($html) {
    if (preg_match("/var\s+hlsUrl\s*=\s*['\"]([^'\"]+\.m3u8[^'\"]*)['\"];/i", $html, $m)) return $m[1];
    if (preg_match('/(https?:\/\/[^\s"\'<>]+\.m3u8[^\s"\'<>]*)/i', $html, $m)) return $m[1];
    return '';
}

function do_home() {
    global $FIXED_CLASSES;
    $html    = http_get(HOST);
    $list    = $html ? parse_video_list($html) : [];
    $dynamic = fetch_dynamic_classes();
    return ['class' => array_merge($FIXED_CLASSES, $dynamic), 'filters' => new stdClass(), 'list' => $list];
}

function do_category($type_id, $page) {
    $pg   = max(1, (int)$page);
    $html = http_get(build_category_url($type_id, $pg));
    if (!$html) return ['list' => [], 'page' => $pg, 'pagecount' => $pg];
    $list = parse_video_list($html);
    return ['list' => $list, 'page' => $pg, 'pagecount' => count($list) > 0 ? $pg + 1 : $pg, 'limit' => 20, 'total' => 9999];
}

function do_search($wd, $page) {
    $pg  = max(1, (int)$page);
    $kw  = urlencode($wd);
    if ($pg === 1) {
        $url = HOST . '/search/' . $kw . '/';
    } else {
        $from = sprintf('%02d', $pg);
        $ts   = round(microtime(true) * 1000);
        $url  = HOST . '/search/' . $kw . '/?mode=async&function=get_block&block_id=list_videos_common_videos_list&sort_by=post_date&from=' . $from . '&_=' . $ts;
    }
    $html = http_get($url);
    if (!$html) return ['list' => [], 'page' => $pg, 'pagecount' => $pg];
    $list = parse_video_list($html);
    return ['list' => $list, 'page' => $pg, 'pagecount' => count($list) > 0 ? $pg + 1 : $pg, 'limit' => 20];
}

function do_detail($ids) {
    $results = [];
    foreach ($ids as $vod_id) {
        $vod_id = trim($vod_id);
        if (!$vod_id) continue;
        $html = http_get(HOST . '/videos/' . $vod_id . '/');
        if (!$html) continue;

        $title = $vod_id;
        if (preg_match('/property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']/i', $html, $m) ||
            preg_match('/content=["\']([^"\']+)["\'][^>]+property=["\']og:title["\']/i', $html, $m)) {
            $title = trim($m[1]);
        }

        $pic = '';
        if (preg_match('/property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']/i', $html, $m) ||
            preg_match('/content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']/i', $html, $m)) {
            $pic = optimize_pic($m[1]);
        }

        $year = '';
        if (preg_match('/<span[^>]+class="[^"]*inactive-color[^"]*"[^>]*>\s*([^<]+)\s*<\/span>/i', $html, $m)) {
            $year = str_replace('上市於 ', '', trim($m[1]));
        }

        $results[] = [
            'vod_id'        => $vod_id,
            'vod_name'      => $title,
            'vod_pic'       => $pic,
            'vod_year'      => $year,
            'vod_content'   => '',
            'vod_remarks'   => '',
            'vod_play_from' => 'Jable',
            'vod_play_url'  => '播放$' . extract_hls_url($html),
        ];
    }
    return ['list' => $results];
}

function do_play($url) {
    return ['parse' => 0, 'url' => $url, 'header' => ['User-Agent' => UA, 'Referer' => HOST . '/']];
}

// ── 路由 ─────────────────────────────────────────────────────
$ac   = $_GET['ac']   ?? '';
$t    = $_GET['t']    ?? '';
$pg   = $_GET['pg']   ?? '1';
$ids  = $_GET['ids']  ?? '';
$play = $_GET['play'] ?? '';
$wd   = $_GET['wd']   ?? '';

try {
    if ($play) { echo json_encode(do_play($play), JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); exit; }
    if ($wd)   { echo json_encode(do_search($wd, $pg), JSON_UNESCAPED_UNICODE); exit; }
    if (!$ac)  { echo json_encode(do_home(), JSON_UNESCAPED_UNICODE); exit; }
    if ($ac === 'detail') {
        if ($t)   { echo json_encode(do_category($t, $pg), JSON_UNESCAPED_UNICODE); exit; }
        if ($ids) {
            $id_list = array_filter(array_map('trim', explode(',', $ids)));
            echo json_encode(do_detail($id_list), JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
    echo json_encode(['code' => 400, 'msg' => 'bad request'], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    echo json_encode(['code' => 500, 'msg' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
