#!/usr/bin/python
# -*- coding: utf-8 -*-
import re
import urllib.parse
import requests
from lxml import etree

class Spider:
    def __init__(self):
        self.host = "https://www.dzwhs.com"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.dzwhs.com/"
        }
        self.categories = [
            {"type_id": "1", "type_name": "电影"},
            {"type_id": "2", "type_name": "电视剧"},
            {"type_id": "3", "type_name": "综艺"},
            {"type_id": "4", "type_name": "动漫"},
            {"type_id": "5", "type_name": "短剧"}
        ]
        self.filters = {
            "1": [
                {"key": "class", "name": "分类", "value": [
                    {"n": "全部", "v": ""},
                    {"n": "动作片", "v": "6"},
                    {"n": "喜剧片", "v": "7"},
                    {"n": "爱情片", "v": "8"},
                    {"n": "科幻片", "v": "9"},
                    {"n": "恐怖片", "v": "10"},
                    {"n": "剧情片", "v": "11"},
                    {"n": "战争片", "v": "12"},
                    {"n": "纪录片", "v": "13"}
                ]}
            ],
            "2": [
                {"key": "class", "name": "分类", "value": [
                    {"n": "全部", "v": ""},
                    {"n": "国产剧", "v": "17"},
                    {"n": "港台剧", "v": "18"},
                    {"n": "日韩剧", "v": "20"},
                    {"n": "欧美剧", "v": "21"},
                    {"n": "海外剧", "v": "22"}
                ]}
            ],
            "3": [
                {"key": "class", "name": "分类", "value": [
                    {"n": "全部", "v": ""},
                    {"n": "大陆综艺", "v": "23"},
                    {"n": "日韩综艺", "v": "24"},
                    {"n": "欧美综艺", "v": "25"},
                    {"n": "港台综艺", "v": "26"}
                ]}
            ],
            "4": [
                {"key": "class", "name": "分类", "value": [
                    {"n": "全部", "v": ""},
                    {"n": "国产动漫", "v": "27"},
                    {"n": "日韩动漫", "v": "28"},
                    {"n": "欧美动漫", "v": "29"},
                    {"n": "其他动漫", "v": "30"}
                ]}
            ]
        }

    def getName(self):
        return "月光影视"

    def init(self, extend=""):
        pass

    def _get(self, url):
        try:
            r = requests.get(url, headers=self.headers, timeout=15)
            r.encoding = "utf-8"
            return r.text
        except Exception:
            return None

    def _fix_url(self, u):
        if not u:
            return ""
        if u.startswith("//"):
            return "https:" + u
        if u.startswith("/"):
            return self.host + u
        return u

    def _parse_list(self, html):
        if not html:
            return []
        tree = etree.HTML(html)
        results = []
        items = tree.xpath('//ul[contains(@class,"stui-vodlist")]//li')
        for item in items:
            try:
                a = item.xpath('.//a[contains(@class,"stui-vodlist__thumb")]')
                if not a:
                    continue
                a = a[0]
                href = a.get("href", "")
                m = re.search(r"/(\d+)\.html", href)
                if not m:
                    continue
                title = a.get("title", "")
                if not title:
                    t = item.xpath('.//h4[@class="title"]/a/text()')
                    if t:
                        title = t[0].strip()
                pic = a.get("data-original", "") or a.get("data-src", "") or a.get("src", "")
                remark = "".join(a.xpath('.//span[contains(@class,"pic-text")]/text()')).strip()
                results.append({
                    "vod_id": m.group(1),
                    "vod_name": title,
                    "vod_pic": self._fix_url(pic),
                    "vod_remarks": remark
                })
            except Exception:
                continue
        return results

    def homeContent(self, filter):
        html = self._get(self.host + "/")
        if not html:
            return {"class": self.categories, "list": [], "filters": self.filters}
        video_list = self._parse_list(html)
        return {"class": self.categories, "list": video_list[:36], "filters": self.filters}

    def homeVideoContent(self):
        return self.homeContent(False)

    def categoryContent(self, tid, pg, filter, extend):
        page = int(pg) if pg else 1
        class_filter = ""
        if extend and extend.get("class"):
            class_filter = extend.get("class")
        if class_filter:
            url = f"{self.host}/zwhssw/{class_filter}-----------.html"
        else:
            url = f"{self.host}/zwhstp/{tid}.html"
        if page > 1:
            url = url.replace(".html", f"-{page}.html")
        html = self._get(url)
        video_list = self._parse_list(html) if html else []
        return {
            "page": page,
            "pagecount": 50,
            "limit": 36,
            "total": 999,
            "list": video_list
        }

    def _parse_search_result(self, html):
        if not html:
            return []
        tree = etree.HTML(html)
        results = []
        items = tree.xpath('//ul[contains(@class, "stui-vodlist__media")]/li')
        for item in items:
            try:
                a = item.xpath('.//a[contains(@class, "stui-vodlist__thumb")]')
                if not a:
                    continue
                a = a[0]
                href = a.get("href", "")
                m = re.search(r"/(\d+)\.html", href)
                if not m:
                    continue
                title = a.get("title", "")
                if not title:
                    t = item.xpath('.//h3[@class="title"]/a/text()')
                    if t:
                        title = t[0].strip()
                pic = a.get("data-original", "") or a.get("data-src", "") or a.get("src", "")
                remark = "".join(a.xpath('.//span[contains(@class,"pic-text")]/text()')).strip()
                results.append({
                    "vod_id": m.group(1),
                    "vod_name": title,
                    "vod_pic": self._fix_url(pic),
                    "vod_remarks": remark
                })
            except Exception:
                continue
        return results

    def searchContent(self, key, quick, pg="1"):
        if not key:
            return {"list": []}
        page = int(pg) if pg else 1
        search_url = f"{self.host}/zwhssc/-------------.html?wd={urllib.parse.quote(key)}"
        if page > 1:
            search_url += f"&page={page}"
        html = self._get(search_url)
        if not html:
            return {"list": [], "page": page}
        video_list = self._parse_search_result(html)
        return {"list": video_list, "page": page}

    def _parse_detail(self, html, vid):
        if not html:
            return None
        tree = etree.HTML(html)
        name = "".join(tree.xpath('//div[@class="stui-pannel__head"]//h3[@class="title"]//text()')).strip()
        if not name:
            name = "".join(tree.xpath('//h1/text()')).strip()
        pic = ""
        img = tree.xpath('//div[@class="stui-vodlist__thumb"]//img')
        if img:
            pic = img[0].get("data-original", "") or img[0].get("src", "")
        content = "".join(tree.xpath('//div[@class="stui-content__detail"]//span[@class="detail-content"]/text()')).strip()
        if not content:
            content = "".join(tree.xpath('//div[@class="stui-content__detail"]/p/text()')).strip()
        play_from_list = []
        play_url_list = []
        playlist = tree.xpath('//div[contains(@class,"playlist")]')
        if not playlist:
            playlist = tree.xpath('//div[contains(@class,"stui-play__list")]/..')
        for idx, pl in enumerate(playlist):
            source_name = "".join(pl.xpath('.//a[contains(@class,"active")]/text()')).strip()
            if not source_name:
                source_name = f"线路{idx+1}"
            eps = pl.xpath('.//ul//li//a')
            if not eps:
                eps = pl.xpath('.//a[contains(@href,"/zwhsdt/")]')
            if eps:
                ep_list = []
                for a in eps:
                    ep_name = "".join(a.xpath('.//text()')).strip()
                    ep_url = a.get("href", "")
                    if ep_url and not ep_url.startswith("http"):
                        ep_url = self.host + ep_url
                    if ep_name and ep_url:
                        ep_list.append(f"{ep_name}${ep_url}")
                if ep_list:
                    play_from_list.append(source_name)
                    play_url_list.append("#".join(ep_list))
        if not play_from_list:
            default_eps = []
            for a in tree.xpath('//div[@class="stui-content__play"]//a'):
                ep_name = "".join(a.xpath('.//text()')).strip()
                ep_url = a.get("href", "")
                if ep_url and not ep_url.startswith("http"):
                    ep_url = self.host + ep_url
                if ep_name and ep_url:
                    default_eps.append(f"{ep_name}${ep_url}")
            if default_eps:
                play_from_list.append("默认")
                play_url_list.append("#".join(default_eps))
        return {
            "vod_id": vid,
            "vod_name": name,
            "vod_pic": self._fix_url(pic),
            "vod_content": content,
            "vod_play_from": "$$$".join(play_from_list),
            "vod_play_url": "$$$".join(play_url_list)
        }

    def detailContent(self, ids):
        result = {"list": []}
        for vid in ids:
            url = f"{self.host}/zwhsdt/{vid}.html"
            html = self._get(url)
            if html:
                vod = self._parse_detail(html, vid)
                if vod:
                    result["list"].append(vod)
        return result

    def playerContent(self, flag, id, vipFlags):
        url = id if id.startswith("http") else self._fix_url(id)
        return {"parse": 1, "url": url, "header": self.headers}

    def getDependence(self):
        return ["requests", "lxml"]