"""PyWebView entry point. Starts uvicorn in a background thread, opens a
window pointing at it.

For dev iteration without rebuilding: set GRINDHOLM_DEV_URL=http://127.0.0.1:5173
to point the window at the vite dev server instead of the bundled dist.
"""
from __future__ import annotations

import os
import sys
import threading
import time
from pathlib import Path

# Make project root importable so `import server` and `import shared` work.
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import uvicorn  # noqa: E402
import webview  # noqa: E402


HOST = "127.0.0.1"
PORT = 8000


def _start_server() -> None:
    config = uvicorn.Config(
        "server.main:app",
        host=HOST,
        port=PORT,
        log_level="info",
        access_log=False,
    )
    server = uvicorn.Server(config)
    server.run()


def _wait_for_server(timeout: float = 10.0) -> None:
    import urllib.request

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://{HOST}:{PORT}/api/tiles", timeout=0.5) as r:
                if r.status < 500:
                    return
        except Exception:
            time.sleep(0.1)
    print(f"[grindholm] WARNING: server didn't respond at /api/tiles within {timeout}s")


def main() -> None:
    server_thread = threading.Thread(target=_start_server, daemon=True)
    server_thread.start()
    _wait_for_server()

    target = os.environ.get("GRINDHOLM_DEV_URL") or f"http://{HOST}:{PORT}/"
    print(f"[grindholm] window -> {target}")

    webview.create_window(
        title="GrindHolm",
        url=target,
        width=1280,
        height=800,
        resizable=True,
        confirm_close=False,
    )
    webview.start(debug=os.environ.get("GRINDHOLM_DEBUG") == "1")


if __name__ == "__main__":
    main()
