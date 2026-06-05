"""Capture screenshots for guguFly docs using Playwright Python."""
import json
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "screenshots"
URL = "http://localhost:5173"
OUT_DIR.mkdir(parents=True, exist_ok=True)

MOCK_TASKS = [
    {"id": 1, "type": "alarm", "label": "晨会", "msg": "准时上线哦", "enabled": True,
     "flightMode": "once", "loopCount": 3, "loopInterval": 5, "intervalCount": 10,
     "hour": 9, "minute": 0, "repeat": [1, 2, 3, 4, 5], "color": "blue",
     "imageData": None, "useImage": False, "_lastTriggeredDate": None},
    {"id": 2, "type": "countdown", "label": "番茄钟", "msg": "专注 25 分钟",
     "enabled": True, "flightMode": "once", "loopCount": 3, "loopInterval": 5,
     "intervalCount": 10, "duration": 1500, "color": "green",
     "imageData": None, "useImage": False},
    {"id": 3, "type": "holiday", "label": "国庆节", "msg": "", "enabled": True,
     "flightMode": "once", "loopCount": 3, "loopInterval": 5, "intervalCount": 10,
     "holidayKey": "national_day", "month": 10, "day": 1, "hour": 9, "minute": 0,
     "color": "red", "imageData": None, "useImage": False, "_lastTriggeredDate": None},
    {"id": 4, "type": "anniversary", "label": "结婚纪念日", "msg": "我们的日子",
     "enabled": True, "flightMode": "once", "loopCount": 3, "loopInterval": 5,
     "intervalCount": 10, "month": 5, "day": 20, "hour": 10, "minute": 0,
     "color": "pink", "imageData": None, "useImage": False, "_lastTriggeredDate": None},
    {"id": 5, "type": "alarm", "label": "喝水", "msg": "记得补水", "enabled": False,
     "flightMode": "once", "loopCount": 3, "loopInterval": 5, "intervalCount": 10,
     "hour": 15, "minute": 0, "repeat": [], "color": None,
     "imageData": None, "useImage": False, "_lastTriggeredDate": None},
]


def snap(page, name):
    file = OUT_DIR / name
    page.screenshot(path=str(file))
    print(f"saved {file}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": 560, "height": 730},
            device_scale_factor=2,
        )
        page = ctx.new_page()
        page.add_init_script(
            f"window.localStorage.setItem('gugufly:_tasks', {json.dumps(json.dumps(MOCK_TASKS))});"
        )

        # 1. Home (default state: config panel collapsed)
        page.goto(URL)
        page.on("console", lambda msg: print(f"[browser {msg.type}] {msg.text}"))
        page.on("pageerror", lambda exc: print(f"[browser error] {exc}"))
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        # Wait for tasks to render
        try:
            page.wait_for_selector(".task-card", timeout=10000)
        except Exception as e:
            print("task-card not found:", e)
        snap(page, "home.png")

        # 2. Flight settings (expand config panel)
        page.click("#configToggle", force=True)
        page.wait_for_timeout(500)
        snap(page, "flight-settings.png")

        # Collapse again for next shots
        page.click("#configToggle", force=True)
        page.wait_for_timeout(300)

        # 3. New task modal
        page.click("#addTaskBtn", force=True)
        page.wait_for_timeout(500)
        snap(page, "task-modal.png")

        # 4. Settings modal - reload page to reset state
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)
        page.wait_for_selector(".task-card", timeout=10000)
        page.click("#settingsBtn", force=True)
        page.wait_for_timeout(500)
        snap(page, "settings-modal.png")

        browser.close()
        print("Done.")


if __name__ == "__main__":
    main()
