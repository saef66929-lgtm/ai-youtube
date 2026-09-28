"""
AI YouTube - Engine Loopback API Server
Stage 0: Project Foundation
Strictly binds to 127.0.0.1 (Loopback only).
Handles health checks, status queries, configuration inspection, and graceful shutdown requests.
"""

from __future__ import annotations
import json
import os
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from threading import Thread
from typing import Optional
from urllib.parse import urlparse

from engine.config import config
from engine.logger import logger
from engine.hardware import get_hardware_status, run_hardware_scan

START_TIME = time.time()


class EngineRequestHandler(BaseHTTPRequestHandler):
    # Enforce HTTP 1.1
    protocol_version = "HTTP/1.1"

    def log_message(self, format_str: str, *args: object) -> None:
        """Redirect default HTTP logging to our structured logger."""
        logger.debug(f"[API Request] {self.address_string()} - {format_str % args}")

    def _set_headers(self, status_code: int = 200, content_type: str = "application/json; charset=utf-8") -> None:
        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        # Security headers
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:3000")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Connection", "close")
        self.end_headers()

    def do_OPTIONS(self) -> None:
        self._set_headers(204)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/health":
            self._handle_health()
        elif path == "/api/status":
            self._handle_status()
        elif path == "/api/config":
            self._handle_config()
        elif path == "/api/hardware":
            self._handle_hardware()
        elif path == "/api/hardware/scan":
            self._handle_hardware_scan()
        else:
            self._send_json({"error": "Endpoint not found", "path": path}, status_code=404)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/shutdown":
            self._handle_shutdown()
        elif path == "/api/hardware/scan":
            self._handle_hardware_scan()
        elif path == "/api/config/language":
            self._handle_set_language()
        else:
            self._send_json({"error": "Endpoint not found", "path": path}, status_code=404)

    def _handle_health(self) -> None:
        uptime = round(time.time() - START_TIME, 2)
        self._send_json({
            "status": "ok",
            "app": "AI YouTube",
            "uptime_seconds": uptime,
            "version": config.data.get("app_version", "0.1.0"),
            "pid": os.getpid()
        })

    def _handle_status(self) -> None:
        hardware = get_hardware_status()
        hw_status = hardware.get("overall_status", "Ready") if hardware.get("scanned") else "Not Scanned Yet"
        self._send_json({
            "app_name": "AI YouTube",
            "status": "Application Ready",
            "engine": {
                "name": "Python Sidecar",
                "status": "Connected",
                "host": config.host,
                "port": config.port,
                "pid": os.getpid(),
                "uptime_seconds": round(time.time() - START_TIME, 2)
            },
            "hardware": hw_status,
            "language": config.language
        })

    def _handle_hardware(self) -> None:
        self._send_json(get_hardware_status())

    def _handle_hardware_scan(self) -> None:
        fresh_profile = run_hardware_scan(force_refresh=True)
        self._send_json(fresh_profile)

    def _handle_set_language(self) -> None:
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            data = json.loads(body) if body else {}
            new_lang = data.get("language")
            if new_lang in ("ar", "en"):
                config.save_language(new_lang)
                self._send_json({"success": True, "language": new_lang})
            else:
                self._send_json({"error": "Invalid language, must be 'ar' or 'en'"}, status_code=400)
        except Exception as e:
            self._send_json({"error": str(e)}, status_code=500)

    def _handle_config(self) -> None:
        # Return sanitized configuration
        self._send_json({
            "app_name": config.data.get("app_name"),
            "app_version": config.data.get("app_version"),
            "environment": config.data.get("environment"),
            "language": config.language,
            "paths": {
                "models_dir": str(config.models_dir),
                "outputs_dir": str(config.outputs_dir),
                "logs_dir": str(config.logs_dir),
                "cache_dir": str(config.cache_dir)
            },
            "hardware_status": get_hardware_status().get("overall_status", "Not Scanned Yet")
        })

    def _handle_shutdown(self) -> None:
        logger.info("Shutdown command received via localhost API.")
        self._send_json({"status": "shutting_down", "message": "Sidecar stopping gracefully"})

        def trigger_shutdown():
            time.sleep(0.2)
            if self.server:
                self.server.shutdown()

        Thread(target=trigger_shutdown, daemon=True).start()

    def _send_json(self, payload: dict, status_code: int = 200) -> None:
        try:
            body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
            self._set_headers(status_code)
            self.wfile.write(body)
        except Exception as e:
            logger.error(f"Failed to send JSON response: {e}")


class SidecarServer:
    def __init__(self, host: str = "127.0.0.1", port: int = 8765):
        # Enforce loopback address
        if host not in ("127.0.0.1", "localhost"):
            logger.warning(f"Restricting host binding from {host} to 127.0.0.1 for security.")
            host = "127.0.0.1"

        self.host = host
        self.port = port
        self.httpd: Optional[HTTPServer] = None
        self._thread: Optional[Thread] = None

    def start(self, block: bool = True) -> None:
        logger.info(f"Starting Python Sidecar API Server on {self.host}:{self.port}...")
        try:
            self.httpd = HTTPServer((self.host, self.port), EngineRequestHandler)
        except OSError as e:
            logger.critical(f"Failed to bind Sidecar server to {self.host}:{self.port}: {e}")
            sys.exit(1)

        logger.info(f"Sidecar HTTP Server listening strictly on http://{self.host}:{self.port}")
        # Stdout handshake token for Electron parent process
        print(f"AI_YOUTUBE_SIDECAR_READY:{self.host}:{self.port}", flush=True)

        if block:
            try:
                self.httpd.serve_forever()
            except KeyboardInterrupt:
                logger.info("KeyboardInterrupt received. Stopping sidecar server...")
            finally:
                self.stop()
        else:
            self._thread = Thread(target=self.httpd.serve_forever, daemon=True)
            self._thread.start()

    def stop(self) -> None:
        if self.httpd:
            logger.info("Shutting down Sidecar HTTP Server...")
            self.httpd.shutdown()
            self.httpd.server_close()
            self.httpd = None
            logger.info("Sidecar HTTP Server stopped cleanly.")


_global_server: Optional[SidecarServer] = None


def start_api_server(host: str = "127.0.0.1", port: int = 8765, block: bool = True) -> SidecarServer:
    global _global_server
    _global_server = SidecarServer(host=host, port=port)
    _global_server.start(block=block)
    return _global_server


def stop_api_server() -> None:
    global _global_server
    if _global_server:
        _global_server.stop()
        _global_server = None
