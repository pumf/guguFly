"""Capture screenshots for guguFly docs using Playwright Python."""
import json
import os
import sys
import datetime as _dt
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "screenshots"
URL = "http://localhost:5199"
OUT_DIR.mkdir(parents=True, exist_ok=True)

_today = _dt.date.today()

MOCK_TASKS = [
    {"id": 1, "type": "alarm", "label": "晨会", "msg": "准时上线哦", "enabled": True,
     "flightMode": "once", "loopCount": 3, "loopInterval": 5, "intervalCount": 10,
     "hour": 9, "minute": 0, "repeat": {"type": "weekly", "days": [1, 2, 3, 4, 5]},
     "color": "blue", "imageData": None, "useImage": False, "_lastTriggeredDate": None,
     "_status": "idle"},
    {"id": 2, "type": "countdown", "label": "番茄钟", "msg": "专注 25 分钟",
     "enabled": True, "flightMode": "once", "loopCount": 3, "loopInterval": 5,
     "intervalCount": 10, "duration": 1500, "color": "green",
     "imageData": None, "useImage": False, "_status": "idle", "_remaining": None},
    {"id": 3, "type": "holiday", "label": "国庆节", "msg": "", "enabled": True,
     "flightMode": "once", "loopCount": 3, "loopInterval": 5, "intervalCount": 10,
     "holidayKey": "national_day", "month": 10, "day": 1, "hour": 9, "minute": 0,
     "color": "red", "imageData": None, "useImage": False,
     "_lastTriggeredDate": None, "lunar": False},
    {"id": 4, "type": "anniversary", "label": "结婚纪念日", "msg": "我们的日子",
     "enabled": True, "flightMode": "once", "loopCount": 3, "loopInterval": 5,
     "intervalCount": 10, "month": 5, "day": 20, "hour": 10, "minute": 0,
     "color": "pink", "imageData": None, "useImage": False,
     "_lastTriggeredDate": None, "lunar": True},
    {"id": 5, "type": "alarm", "label": "喝水", "msg": "记得补水", "enabled": False,
     "flightMode": "once", "loopCount": 3, "loopInterval": 5, "intervalCount": 10,
     "hour": 15, "minute": 0, "repeat": {"type": "weekly", "days": []},
     "color": None, "imageData": None, "useImage": False,
     "_lastTriggeredDate": None, "_status": "idle"},
]

MOCK_FLIGHT_LOG = []
for i in range(7):
    d = _today - _dt.timedelta(days=6 - i)
    base = [3, 5, 2, 7, 4, 6, 8][i]
    by_type = {"alarm": 0, "countdown": 0, "holiday": 0, "anniversary": 0}
    by_type["alarm"] = max(0, base - 1)
    by_type["countdown"] = max(0, base - 3)
    if i == 6:
        by_type = {"alarm": 5, "countdown": 3, "holiday": 0, "anniversary": 0}
    MOCK_FLIGHT_LOG.append({
        "date": d.isoformat(),
        "totalCount": base,
        "byTask": {1: base - 1, 2: 1},
        "byType": by_type,
    })


def snap(page, name, full_page=False):
    file = OUT_DIR / name
    page.screenshot(path=str(file), full_page=full_page)
    print(f"saved {file}")


def inject_data(page):
    page.add_init_script(
        f"window.localStorage.setItem('gugufly:_tasks', {json.dumps(json.dumps(MOCK_TASKS))});"
        f"window.localStorage.setItem('gugufly:_flightLog', {json.dumps(json.dumps(MOCK_FLIGHT_LOG))});"
    )


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": 620, "height": 900},
            device_scale_factor=2,
        )
        page = ctx.new_page()

        # ── Light theme ──
        inject_data(page)

        page.goto(URL)
        page.on("console", lambda msg: print(f"[browser {msg.type}] {msg.text}"))
        page.on("pageerror", lambda exc: print(f"[browser error] {exc}"))
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        try:
            page.wait_for_selector(".task-card", timeout=10000)
        except Exception as e:
            print("task-card not found:", e)
        snap(page, "home.png")

        # Flight settings
        toggle = page.locator("#configToggle")
        if toggle.is_visible():
            toggle.click(force=True)
            page.wait_for_timeout(500)
            snap(page, "flight-settings.png", full_page=True)
            toggle.click(force=True)
            page.wait_for_timeout(300)

        # Stats panel
        stats_toggle = page.locator("#statsToggle")
        if stats_toggle.is_visible():
            stats_toggle.click(force=True)
            page.wait_for_timeout(500)
            snap(page, "stats.png", full_page=True)
            stats_toggle.click(force=True)

        # New task modal
        add_btn = page.locator("#addTaskBtn")
        if add_btn.is_visible():
            add_btn.click(force=True)
            page.wait_for_timeout(500)
            snap(page, "task-modal.png")

        # Settings modal
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        settings_btn = page.locator("#settingsBtn")
        if settings_btn.is_visible():
            settings_btn.click(force=True)
            page.wait_for_timeout(500)
            snap(page, "settings-modal.png")

        # ── Dark theme ──
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        # Switch to dark via settings
        settings_btn2 = page.locator("#settingsBtn")
        if settings_btn2.is_visible():
            settings_btn2.click(force=True)
            page.wait_for_timeout(500)

        theme_select = page.locator("#themeSelect")
        if theme_select.is_visible():
            theme_select.select_option("dark")
            page.wait_for_timeout(500)

        close_settings = page.locator("#settingsCloseBtn")
        if close_settings.is_visible():
            close_settings.click(force=True)
            page.wait_for_timeout(300)

        snap(page, "home-dark.png")

        browser.close()
        print("Done.")


if __name__ == "__main__":
    main()
