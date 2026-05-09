from playwright.sync_api import sync_playwright
import os
import sys

html_name = sys.argv[1] if len(sys.argv) > 1 else "三角色海报_红队.html"
html_path = os.path.abspath(os.path.join("assets", "posters", html_name))
output_path = html_path.replace(".html", ".png")

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge")
    page = browser.new_page(
        viewport={"width": 1920, "height": 1080},
        device_scale_factor=2
    )
    page.goto("file:///" + html_path.replace("\\", "/"))
    page.wait_for_timeout(3000)
    page.screenshot(path=output_path, full_page=False)
    browser.close()

print(f"Screenshot saved: {output_path}")
print(f"Size: {os.path.getsize(output_path)} bytes")
