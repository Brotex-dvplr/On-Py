#!/usr/bin/env python3
"""On-py local runner. Executes code only on the user's own computer."""
import json
import os
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = 8765
ALLOWED_ORIGINS = {"https://brotex-dvplr.github.io", "http://localhost:8000", "http://127.0.0.1:8000"}
MAX_CODE_BYTES = 100_000
TIMEOUT_SECONDS = 8

class Handler(BaseHTTPRequestHandler):
    server_version = "OnPyLocalRunner/1.0"

    def headers(self, origin=None):
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("X-Content-Type-Options", "nosniff")

    def reply(self, status, payload, origin=None):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.headers(origin)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def origin_ok(self):
        origin = self.headers_origin()
        return origin in ALLOWED_ORIGINS, origin

    def headers_origin(self):
        return self.headers_value("Origin")

    def headers_value(self, name):
        return self.headers.get(name, "")

    def do_OPTIONS(self):
        ok, origin = self.origin_ok()
        if not ok:
            self.reply(403, {"error": "این مبدأ اجازه اتصال ندارد."})
            return
        self.send_response(204)
        self.headers(origin)
        self.end_headers()

    def do_GET(self):
        ok, origin = self.origin_ok()
        if not ok:
            self.reply(403, {"error": "مبدأ غیرمجاز است."})
            return
        if self.path != "/health":
            self.reply(404, {"error": "مسیر پیدا نشد."}, origin)
            return
        self.reply(200, {"python": True, "version": sys.version.split()[0]}, origin)

    def do_POST(self):
        ok, origin = self.origin_ok()
        if not ok:
            self.reply(403, {"error": "مبدأ غیرمجاز است."})
            return
        if self.path != "/run":
            self.reply(404, {"error": "مسیر پیدا نشد."}, origin)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_CODE_BYTES:
                self.reply(413, {"error": "حجم کد خالی یا بیش از 100 کیلوبایت است."}, origin)
                return
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            code = body.get("code", "")
            if not isinstance(code, str) or not code.strip():
                self.reply(400, {"error": "کدی برای اجرا ارسال نشده است."}, origin)
                return
            with tempfile.TemporaryDirectory(prefix="onpy_") as folder:
                script = os.path.join(folder, "main.py")
                with open(script, "w", encoding="utf-8") as f:
                    f.write(code)
                try:
                    proc = subprocess.run(
                        [sys.executable, "-I", script], cwd=folder,
                        capture_output=True, text=True, encoding="utf-8",
                        errors="replace", timeout=TIMEOUT_SECONDS,
                        env={"PATH": os.environ.get("PATH", ""), "PYTHONIOENCODING": "utf-8"}
                    )
                    self.reply(200, {"stdout": proc.stdout, "stderr": proc.stderr,
                                     "returncode": proc.returncode}, origin)
                except subprocess.TimeoutExpired as exc:
                    stdout = exc.stdout.decode("utf-8", "replace") if isinstance(exc.stdout, bytes) else (exc.stdout or "")
                    stderr = exc.stderr.decode("utf-8", "replace") if isinstance(exc.stderr, bytes) else (exc.stderr or "")
                    self.reply(200, {"stdout": stdout, "stderr": stderr + "\nخطا: زمان اجرا از 8 ثانیه گذشت و متوقف شد.",
                                     "returncode": -1}, origin)
        except Exception as exc:
            self.reply(400, {"error": "درخواست نامعتبر: " + str(exc)}, origin)

    def log_message(self, fmt, *args):
        print("[On-py]", fmt % args)

if __name__ == "__main__":
    print("On-py local runner")
    print("Python:", sys.version.split()[0])
    print("Listening only on http://127.0.0.1:%s" % PORT)
    print("Keep this terminal open while using the local Python connection.")
    print("WARNING: your code runs on this computer with your user permissions.")
    try:
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    except OSError as exc:
        print("Could not start local runner:", exc)
        input("Press Enter to close...")
