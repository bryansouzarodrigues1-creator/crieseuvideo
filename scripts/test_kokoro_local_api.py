"""Local speech API contract test, without model download or inference."""
import importlib.util
import io
import json
from pathlib import Path
from threading import Thread
import unittest
import urllib.request
import urllib.error
import wave
from http.server import HTTPServer

spec = importlib.util.spec_from_file_location("local_api", Path(__file__).with_name("kokoro-local-api.py"))
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)

class LocalVoiceApiTest(unittest.TestCase):
    def test_validation(self):
        self.assertEqual(api.validate_body({"text":" Olá ", "voice":"pm_alex", "speed":1.1}), ("Olá",1.1))
        for invalid in [{"text":""},{"text":"x","voice":"other"},{"text":"x","speed":True},{"text":"x","speed":float("nan")},{"text":"x","speed":2},{"text":"x","url":"https://example.com"}]:
            with self.assertRaises(ValueError):
                api.validate_body(invalid)

    def test_http_contract(self):
        calls=[]
        def fake(text,speed):
            calls.append((text,speed))
            buf=io.BytesIO()
            with wave.open(buf,"wb") as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000)
                w.writeframes(bytes(4800))
            return buf.getvalue()
        origin="http://localhost:5173"
        token="only-test-token"
        server=HTTPServer(("127.0.0.1",0),api.handler_factory(origin,token,fake))
        thread=Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            url=f"http://127.0.0.1:{server.server_port}/v1/speech"
            def send(o,t,data):
                req=urllib.request.Request(url,data=json.dumps(data).encode(),headers={"Origin":o,"Authorization":"Bearer "+t,"Content-Type":"application/json"})
                return urllib.request.urlopen(req,timeout=5)
            payload={"text":"Uma pizzaria.","voice":"pm_alex","speed":1}
            for o,t,status in [("https://untrusted.example",token,403),(origin,"wrong",401)]:
                with self.assertRaises(urllib.error.HTTPError) as err:
                    send(o,t,payload)
                self.assertEqual(err.exception.code,status)
            self.assertEqual(calls,[])
            with send(origin,token,payload) as response:
                self.assertEqual(response.headers["Content-Type"],"audio/wav")
                self.assertEqual(response.headers["Access-Control-Allow-Origin"],origin)
                with wave.open(io.BytesIO(response.read()),"rb") as audio:
                    self.assertEqual(audio.getframerate(),24000)
                    self.assertEqual(audio.getnchannels(),1)
            self.assertEqual(calls,[("Uma pizzaria.",1.0)])
        finally:
            server.shutdown(); server.server_close();thread.join(timeout=5)

if __name__=="__main__":
    unittest.main()
