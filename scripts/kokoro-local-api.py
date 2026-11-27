"""Development-only Kokoro speech API on loopback. No paid cloud services."""
import argparse
import hmac
import io
import json
import math
import secrets
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlsplit

MAX_BODY = 16000
MAX_TEXT = 1500
SAMPLE_RATE = 24000

def synthesize_factory():
    from kokoro import KPipeline
    import numpy as np
    import soundfile as sf
    pipeline = KPipeline(lang_code="p", repo_id="hexgrad/Kokoro-82M")
    def synthesize(text, speed):
        chunks = [np.asarray(audio, dtype=np.float32).reshape(-1)
                  for _, _, audio in pipeline(text, voice="pm_alex", speed=speed)
                  if audio is not None]
        if not chunks:
            raise RuntimeError("Kokoro did not produce audio")
        samples = np.concatenate(chunks)
        if not samples.size or not np.isfinite(samples).all() or samples.size > SAMPLE_RATE * 180:
            raise RuntimeError("Invalid audio length")
        output = io.BytesIO()
        sf.write(output, samples, SAMPLE_RATE, format="WAV", subtype="PCM_16")
        return output.getvalue()
    return synthesize

def validate_body(value):
    if not isinstance(value, dict) or set(value) - {"text", "speed", "voice"}:
        raise ValueError("Invalid request fields")
    text = value.get("text")
    speed = value.get("speed", 1.0)
    if not isinstance(text, str) or not 1 <= len(text.strip()) <= MAX_TEXT:
        raise ValueError("Use 1–1500 characters")
    if type(speed) not in (int, float) or not math.isfinite(speed) or not .75 <= speed <= 1.25:
        raise ValueError("Speed must be 0.75–1.25")
    if value.get("voice", "pm_alex") != "pm_alex":
        raise ValueError("Only pm_alex is enabled")
    return text.strip(), float(speed)

def handler_factory(origin, token, synthesize):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            # Never log private narration or access tokens.
            pass

        def allowed_origin(self):
            return self.headers.get("Origin") == origin

        def respond(self, status, body=b"", mime="application/json"):
            self.send_response(status)
            if self.allowed_origin():
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if body:
                self.wfile.write(body)

        def error(self, status, message):
            self.respond(status, json.dumps({"error": message}).encode())

        def do_OPTIONS(self):
            if self.path != "/v1/speech" or not self.allowed_origin():
                self.error(403, "Origin not allowed")
                return
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            if self.headers.get("Access-Control-Request-Private-Network") == "true":
                self.send_header("Access-Control-Allow-Private-Network", "true")
            self.end_headers()

        def do_POST(self):
            if self.path != "/v1/speech" or not self.allowed_origin():
                self.error(403, "Origin not allowed")
                return
            supplied = self.headers.get("Authorization", "")
            if not hmac.compare_digest(supplied.encode(), ("Bearer " + token).encode()):
                self.error(401, "Invalid local token")
                return
            if self.headers.get_content_type() != "application/json":
                self.error(415, "Expected JSON")
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= MAX_BODY:
                    raise ValueError()
                text, speed = validate_body(json.loads(self.rfile.read(length)))
            except (ValueError, UnicodeError, TypeError):
                self.error(400, "Invalid narration request")
                return
            try:
                wav = synthesize(text, speed)
            except Exception:
                self.error(500, "Local synthesis failed")
                return
            self.respond(200, wav, "audio/wav")
    return Handler

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origin", required=True, help="Exact CrieSeuVideo origin, e.g. http://localhost:5173")
    args = parser.parse_args()
    parsed = urlsplit(args.origin)
    if parsed.scheme not in ("http", "https") or not parsed.netloc or parsed.path or parsed.query or parsed.fragment or parsed.username:
        parser.error("Use an exact HTTP(S) origin without path")
    token = secrets.token_urlsafe(24)
    print("Loading local Kokoro pm_alex. First use may download model weights.", flush=True)
    synthesize = synthesize_factory()
    with HTTPServer(("127.0.0.1", 8765), handler_factory(args.origin, token, synthesize)) as server:
        print("Local voice token (paste into studio): " + token, flush=True)
        print("Listening at http://127.0.0.1:8765/v1/speech (loopback only)", flush=True)
        server.serve_forever()

if __name__ == "__main__":
    main()
