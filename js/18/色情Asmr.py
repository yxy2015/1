# -*- coding: utf-8 -*-
# TVBox爬虫 - Hentai ASMR (修复列表解析)
# 网站: https://hentaiasmr.moe

import sys
import re
import json
import urllib.parse
from base.spider import Spider
from bs4 import BeautifulSoup
import requests


class Spider(Spider):
    def getName(self):
        return "Hentai ASMR"

    def init(self, extend=""):
        self.host = "https://hentaiasmr.moe"
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": self.host,
        })

        self.class_map = {
            "latest": "最新",
            "popular": "人気のある",
            "most-viewed": "最も見られました",
            "longest": "最長",
            "random": "ランダム",
        }
        self.debug = True  # 开启调试，便于查看日志

    def _log(self, msg):
        if self.debug:
            print(f"[HentaiASMR] {msg}")

    def _fetch(self, url, timeout=15):
        try:
            self._log(f"Fetch: {url}")
            resp = self.session.get(url, timeout=timeout)
            resp.encoding = "utf-8"
            return resp.text
        except Exception as e:
            self._log(f"Fetch error: {e}")
            return ""

    def _fix_url(self, url):
        if not url:
            return ""
        url = url.strip()
        if url.startswith("//"):
            return "https:" + url
        if url.startswith("/"):
            return self.host + url
        if not url.startswith("http"):
            return self.host + "/" + url
        return url

    def homeContent(self, filter=False):
        classes = [{"type_id": cid, "type_name": name} for cid, name in self.class_map.items()]
        return {"class": classes}

    def homeVideoContent(self):
        return self.categoryContent("latest", "1", False, {})

    # ---------- 分类列表（修复版） ----------
    def categoryContent(self, tid, pg, filter=False, extend=None):
        try:
            pg = int(pg) if pg else 1
            tid_str = str(tid)

            # 构建分类URL（参照网站实际链接）
            if pg <= 1:
                url = f"{self.host}/?ref=porndude&filter={tid_str}"
            else:
                url = f"{self.host}/page/{pg}/?ref=porndude&filter={tid_str}"

            self._log(f"分类URL: {url}")
            html = self._fetch(url)

            if not html:
                self._log("获取HTML失败，尝试无参数首页")
                html = self._fetch(self.host)
                if not html:
                    return {"list": [], "page": pg, "pagecount": 1, "limit": 0, "total": 0}

            # 解析列表
            videos = self._parse_list(html)

            # 分页信息
            pagecount = pg
            soup = BeautifulSoup(html, "html.parser")
            pagination = soup.select(".pagination li a")
            if pagination:
                max_page = pg
                for a in pagination:
                    href = a.get("href")
                    if not href:
                        continue
                    m = re.search(r"/page/(\d+)/", href)
                    if m:
                        num = int(m.group(1))
                        if num > max_page:
                            max_page = num
                if max_page > pg:
                    pagecount = max_page
            elif len(videos) >= 20:
                pagecount = pg + 1

            return {
                "list": videos,
                "page": pg,
                "pagecount": max(pagecount, pg),
                "limit": len(videos),
                "total": max(pagecount, pg) * 20
            }
        except Exception as e:
            self._log(f"categoryContent异常: {e}")
            return {"list": [], "page": 1, "pagecount": 1, "limit": 0, "total": 0}

    # ---------- 解析列表（多选择器回退） ----------
    def _parse_list(self, html):
        if not html:
            return []
        soup = BeautifulSoup(html, "html.parser")
        videos = []
        seen = set()

        # 选择器1：article 标签（最精确）
        items = soup.select("article.thumb-block")
        if not items:
            items = soup.select("article.loop-video")
        if not items:
            items = soup.select("article[data-video-uid]")
        if not items:
            # 选择器2：.thumb-block 类
            items = soup.select(".thumb-block")
        if not items:
            # 选择器3：直接找 .loop-video
            items = soup.select(".loop-video")
        if not items:
            # 选择器4：找包含 .post-thumbnail 的父级
            items = soup.select(".post-thumbnail")
            items = [item.parent for item in items if item.parent.name == "article"]

        self._log(f"找到 {len(items)} 个卡片")

        for item in items:
            try:
                # 提取链接
                a = item.find("a", href=True)
                if not a:
                    continue
                href = a.get("href")
                if not href or href in seen or href.startswith("#"):
                    continue
                seen.add(href)

                # 标题
                title_tag = item.select_one(".entry-header span")
                if not title_tag:
                    title_tag = item.select_one(".entry-header")
                title = title_tag.get_text(strip=True) if title_tag else a.get("title", "未知音频")

                # 封面
                img = item.find("img")
                pic = ""
                if img:
                    pic = img.get("data-src") or img.get("src") or ""
                    if pic.startswith("//"):
                        pic = "https:" + pic

                # 时长
                duration = ""
                duration_tag = item.select_one(".duration")
                if duration_tag:
                    duration = duration_tag.get_text(strip=True)

                # RJ编号（在卡片内可能有 .rjcodes 或直接文本）
                rj_code = ""
                rj_tag = item.select_one(".rjcodes")
                if rj_tag:
                    rj_code = rj_tag.get_text(strip=True)
                else:
                    # 尝试从标题或链接中提取 RJ
                    rj_match = re.search(r"(RJ\d+)", href)
                    if rj_match:
                        rj_code = rj_match.group(1)

                remark = ""
                if rj_code:
                    remark = rj_code
                if duration:
                    remark = remark + (" | " + duration if remark else duration)

                videos.append({
                    "vod_id": href,
                    "vod_name": title,
                    "vod_pic": pic,
                    "vod_remarks": remark[:100]
                })
            except Exception as e:
                self._log(f"解析单个卡片失败: {e}")
                continue

        self._log(f"解析到 {len(videos)} 个音频")
        return videos

    # ---------- 搜索 ----------
    def searchContent(self, key, quick=False, pg="1"):
        try:
            pg = int(pg) if pg else 1
            enc_key = urllib.parse.quote(key)
            url = f"{self.host}/?s={enc_key}&page={pg}"
            html = self._fetch(url)
            if not html:
                return {"list": [], "page": pg, "pagecount": 1, "limit": 0, "total": 0}
            videos = self._parse_list(html)
            pagecount = pg + 1 if len(videos) >= 20 else pg
            return {
                "list": videos,
                "page": pg,
                "pagecount": pagecount,
                "limit": len(videos),
                "total": pagecount * 20
            }
        except Exception as e:
            self._log(f"searchContent异常: {e}")
            return {"list": [], "page": 1, "pagecount": 1, "limit": 0, "total": 0}

    # ---------- 详情 ----------
    def detailContent(self, ids):
        try:
            if not ids:
                return {"list": []}
            vid = ids[0]
            if not vid.startswith("http"):
                url = self.host + vid if vid.startswith("/") else self.host + "/" + vid
            else:
                url = vid

            html = self._fetch(url)
            if not html:
                return {"list": []}

            soup = BeautifulSoup(html, "html.parser")

            title = ""
            title_tag = soup.find("h1")
            if title_tag:
                title = title_tag.get_text(strip=True)
            if not title:
                meta_title = soup.find("meta", property="og:title")
                if meta_title:
                    title = meta_title.get("content", "")

            pic = ""
            img_tag = soup.find("img", class_="post-thumbnail") or soup.find("img")
            if img_tag:
                pic = img_tag.get("data-src") or img_tag.get("src") or ""
                if pic.startswith("//"):
                    pic = "https:" + pic

            desc = ""
            meta_desc = soup.find("meta", attrs={"name": "description"})
            if meta_desc:
                desc = meta_desc.get("content", "")

            # 提取 RJ 编号
            rj_match = re.search(r"(RJ\d+)", vid)
            rj_code = rj_match.group(1) if rj_match else ""

            play_from = "Hentai ASMR"
            play_url = f"播放${url}"

            return {
                "list": [{
                    "vod_id": vid,
                    "vod_name": f"[{rj_code}] {title}" if rj_code else title,
                    "vod_pic": pic,
                    "vod_content": desc,
                    "vod_play_from": play_from,
                    "vod_play_url": play_url
                }]
            }
        except Exception as e:
            self._log(f"detailContent异常: {e}")
            return {"list": []}

    # ---------- 播放（WebView） ----------
    def playerContent(self, flag, id, vipFlags=None):
        try:
            if not id:
                return {"parse": 1, "url": "", "header": {}}
            if "$" in id:
                parts = id.split("$")
                id = parts[-1] if len(parts) > 1 else id
            if not id.startswith("http"):
                id = self._fix_url(id)
            return {
                "parse": 1,
                "url": id,
                "header": {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Referer": self.host
                }
            }
        except Exception as e:
            self._log(f"playerContent异常: {e}")
            return {"parse": 1, "url": id or "", "header": {}}

    def isVideoFormat(self, url):
        return False

    def manualVideoCheck(self):
        return False

    def destroy(self):
        if self.session:
            self.session.close()

    def localProxy(self, param):
        return None