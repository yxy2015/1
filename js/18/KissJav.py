# -*- coding: utf-8 -*-
import re
import json
import threading
import time
import requests
import base64
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlencode
from base.spider import Spider


class Spider(Spider):

    def init(self, extend=""):
        if extend:
            hosts = json.loads(extend).get('site', "")
        else:
            hosts = "https://kissjav.com"
        self.host = self.host_late(hosts) if isinstance(hosts, (str, list)) and len(hosts.split(',')) > 1 else hosts.strip()
        self.session = requests.Session()
        self.session.headers.update(self.getheaders())

    def getName(self):
        return "KissJAV"

    def isVideoFormat(self, url):
        return ".mp4" in url or ".m3u8" in url

    def manualVideoCheck(self):
        pass

    def destroy(self):
        pass

    # -------------------- 1. 首页分类 --------------------
    def homeContent(self, filter):
        classes = [
            {"type_name": "HOT", "type_id": "most-popular/?sort_by=video_viewed_today"},
            {"type_name": "Latest", "type_id": "latest-updates"},
            {"type_name": "Top Rated", "type_id": "top-rated"},
            {"type_name": "Most Viewed", "type_id": "most-popular"},
            {"type_name": "KBJ", "type_id": "categories/korean-bj"},
            {"type_name": "KAV", "type_id": "categories/korean-porn"},
            {"type_name": "JAV", "type_id": "categories/jav"},
            {"type_name": "KVIP", "type_id": "categories/vip"},
            {"type_name": "JVIP", "type_id": "categories/jvip"},
            {"type_name": "CHINA", "type_id": "categories/china"},
            {"type_name": "IPCAM", "type_id": "categories/ipcam"},
            {"type_name": "FC2PPV", "type_id": "categories/fc2ppv"},
            {"type_name": "TOILET", "type_id": "categories/toilet"},
            {"type_name": "SIAN-LEAK", "type_id": "categories/sian-leak"},
            {"type_name": "VOYEUR-JP", "type_id": "categories/voyeur-jp"}          
        ]
        filters = {
            "latest-updates": [{"key": "sort", "name": "排序", "value": [
                {"n": "最新", "v": "post_date"}, {"n": "最多观看", "v": "video_viewed"},
                {"n": "最高评分", "v": "rating"}, {"n": "最长", "v": "duration"}
            ]}],
        }
        return {"class": classes, "filters": filters}

    # -------------------- 辅助: 解析视频列表 --------------------
    def _parse_videos(self, soup):
        videos = []
        for div in soup.select("div.thumb"):
            a = div.select_one("a")
            img = div.select_one("img")
            if a and img:
                videos.append({
                    "vod_id": a["href"].split("/")[-2],
                    "vod_name": a["title"],
                    "vod_pic": img.get("data-original") or img["src"],
                    "vod_remarks": div.select_one("div.time").get_text(strip=True) if div.select_one("div.time") else ""
                })
        return videos

    # -------------------- 2. 首页推荐 --------------------
    def homeVideoContent(self):
        url = urljoin(self.host, "/")
        r = self.fetch(url)
        soup = BeautifulSoup(r.text, "html.parser")
        return {"list": self._parse_videos(soup)}

    # -------------------- 3. 分类页 --------------------
    def categoryContent(self, tid, pg, filter, extend):
        sort = extend.get("sort", None)
        pg = int(pg)
        base_path = tid.split('?')[0]
        query_params = {}
        if '?' in tid:
            query_str = tid.split('?', 1)[1]
            query_params = dict(p.split('=') for p in query_str.split('&') if p)
        if sort:
            query_params['sort_by'] = sort
        url_path = f"{base_path.rstrip('/')}/" if pg == 1 else f"{base_path.rstrip('/')}/{pg}/"
        query = urlencode(query_params) if query_params else ''
        path = url_path + ('?' + query if query else '')
        url = urljoin(self.host, path)
        r = self.fetch(url)
        soup = BeautifulSoup(r.text, "html.parser")
        videos = self._parse_videos(soup)
        last_pg = 999
        pages = soup.select("div.pagination a")
        if pages:
            nums = [int(p.text) for p in pages if p.text.isdigit()]
            last_pg = max(nums) if nums else 999
        return {
            "list": videos,
            "page": pg,
            "pagecount": last_pg,
            "limit": 48,
            "total": 999999
        }

    # -------------------- 4. 详情页（已合并方案1：正確解析 flashvars + base64 解碼） --------------------
    def detailContent(self, ids):
        vid = ids[0]
        url = urljoin(self.host, f"/video/{vid}/")
        r = self.fetch(url)
        text = r.text
        soup = BeautifulSoup(text, "html.parser")

        mp4 = ""
        mp4_hd = ""
        preview_url = ""

        # ==================== 核心：解析 flashvars 並解碼 base64 ====================
        flashvars_match = re.search(r'var\s+flashvars\s*=\s*({.*?});', text, re.DOTALL | re.MULTILINE)
        if flashvars_match:
            flashvars_block = flashvars_match.group(1)
            
            # 穩健提取 key: 'value' 對
            flashvars = {}
            pairs = re.findall(r'(\w+):\s*([\'"])(.*?)\2\s*(?:,|\s*$)', flashvars_block, re.DOTALL)
            for key, quote, value in pairs:
                flashvars[key] = value.strip()

            # 處理 video_url (base64 解碼)
            encoded_url = flashvars.get("video_url", "")
            if encoded_url and encoded_url.strip():
                try:
                    # 自動補齊 base64 padding
                    padding = '=' * ((4 - len(encoded_url) % 4) % 4)
                    decoded_bytes = base64.b64decode(encoded_url + padding, validate=False)
                    mp4 = decoded_bytes.decode('utf-8', errors='ignore').strip()
                    # 基本驗證
                    if not (mp4.startswith(('http://', 'https://')) and ('.mp4' in mp4 or '.m3u8' in mp4)):
                        mp4 = ""
                except Exception as e:
                    print(f"video_url decode failed for {vid}: {e}")
                    mp4 = ""

            # 處理 video_url_hd (如果存在且不是占位 'MQ==')
            encoded_hd = flashvars.get("video_url_hd", "")
            if encoded_hd and encoded_hd != 'MQ==':
                try:
                    padding_hd = '=' * ((4 - len(encoded_hd) % 4) % 4)
                    decoded_hd_bytes = base64.b64decode(encoded_hd + padding_hd, validate=False)
                    mp4_hd = decoded_hd_bytes.decode('utf-8', errors='ignore').strip()
                    if mp4_hd.startswith(('http://', 'https://')) and ('.mp4' in mp4_hd or '.m3u8' in mp4_hd):
                        mp4 = mp4_hd  # 優先使用 HD
                except Exception as e:
                    print(f"video_url_hd decode failed for {vid}: {e}")

        # ==================== 備用1：直接從 text 找 video_url ====================
        if not mp4:
            video_url_match = re.search(r"video_url\s*:\s*['\"]([^'\"]+)['\"]", text)
            if video_url_match:
                encoded = video_url_match.group(1).strip()
                try:
                    padding = '=' * ((4 - len(encoded) % 4) % 4)
                    mp4 = base64.b64decode(encoded + padding, validate=False).decode('utf-8', errors='ignore').strip()
                except:
                    pass

        # ==================== 預覽圖 ====================
        preview_match = re.search(r"preview_url\s*:\s*['\"]([^'\"]+)['\"]", text)
        if preview_match:
            preview_url = preview_match.group(1).strip()
        else:
            og_image = soup.select_one("meta[property='og:image']")
            if og_image and "content" in og_image.attrs:
                preview_url = urljoin(self.host, og_image["content"])

        # ==================== 最終降級（舊路徑，大概率已失效，僅作備份） ====================
        if not mp4:
            if vid.isdigit():
                seg = str(int(vid) // 1000 * 1000)
                mp4 = f"{self.host}/get_file/7/5950d917fc788e62949551789342b7ba/{seg}/{vid}/{vid}.mp4/"
            else:
                mp4 = ""

        # ==================== 標題與描述 ====================
        title = vid
        title_elem = soup.select_one("h1.title")
        if title_elem:
            title = title_elem.get_text(strip=True)

        description = ""
        desc_elem = soup.select_one("meta[property='og:description']")
        if desc_elem and "content" in desc_elem.attrs:
            description = desc_elem["content"].strip()

        # ==================== 組裝播放地址（支援 HD/SD 分開） ====================
        play_url_str = f"在线播放${mp4}"
        if mp4_hd and mp4_hd != mp4:
            play_url_str = f"HD${mp4_hd}#SD${mp4}"

        vod = {
            "vod_id": vid,
            "vod_name": title,
            "vod_pic": preview_url,
            "vod_content": description,
            "vod_play_from": "KissJAV",
            "vod_play_url": play_url_str
        }

        return {"list": [vod]}

    # -------------------- 5. 搜索 --------------------
    def searchContent(self, key, quick, pg="1"):
        url = urljoin(self.host, f"/search/{key}/")
        r = self.fetch(url)
        soup = BeautifulSoup(r.text, "html.parser")
        return {"list": self._parse_videos(soup), "page": pg}

    # -------------------- 6. 播放 --------------------
    def playerContent(self, flag, id, vipFlags):
        return {"parse": 0, "url": id, "header": self.getheaders()}

    # -------------------- 7. 工具 --------------------
    def localProxy(self, param):
        pass

    def host_late(self, hosts):
        if isinstance(hosts, str):
            urls = [u.strip() for u in hosts.split(',')]
        else:
            urls = hosts
        if len(urls) <= 1:
            return urls[0] if urls else ''

        results = {}
        def test_host(url):
            try:
                start = time.time()
                requests.head(url, timeout=1.0, allow_redirects=False)
                results[url] = (time.time() - start) * 1000
            except Exception:
                results[url] = float('inf')

        threads = [threading.Thread(target=test_host, args=(u,)) for u in urls]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        return min(results, key=results.get)

    def fetch(self, url):
        return self.session.get(url, timeout=10)

    def getheaders(self, param=None):
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "Referer": self.host + "/"
        }