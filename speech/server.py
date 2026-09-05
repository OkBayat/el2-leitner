"""Private streaming speech service. Audio is processed in memory, never retained."""
import hashlib
import json
import os
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

MAX_CHUNK = 32000
MAX_AUDIO = 16000 * 2 * 30


class SpeechError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


class RecognitionPool:
    def __init__(self, factory, capacity=8, clock=time.monotonic):
        self.factory, self.capacity, self.clock = factory, capacity, clock
        self.sessions = {}
        self.lock = threading.RLock()

    def sweep(self):
        now = self.clock()
        for key, state in list(self.sessions.items()):
            if now - state['touched'] > 90:
                del self.sessions[key]

    def start(self, key):
        with self.lock:
            self.sweep()
            if key not in self.sessions:
                if len(self.sessions) >= self.capacity:
                    raise SpeechError(429, 'All speech slots are occupied.')
                self.sessions[key] = {
                    'recognizer': self.factory(), 'touched': self.clock(),
                    'bytes': 0, 'sequence': 0, 'committed': [], 'final': None, 'cached': None,
                }
            return {'status': 'ready'}

    def cancel(self, key):
        with self.lock:
            self.sessions.pop(key, None)
        return {'status': 'closed'}

    def process(self, key, audio=None, sequence=None, final=False):
        # Bound CPU parallelism as well as the number of recognizers.
        with self.lock:
            self.sweep()
            state = self.sessions.get(key)
            if state is None:
                raise SpeechError(404, 'Recording expired.')
            state['touched'] = self.clock()
            recognizer = state['recognizer']
            if final:
                if state['final'] is None:
                    state['committed'].append(json.loads(recognizer.FinalResult()).get('text', ''))
                    state['final'] = ' '.join(filter(None, state['committed']))
                    state['recognizer'] = None
                return {'text': state['final']}
            if audio is None or not 0 < len(audio) <= MAX_CHUNK or len(audio) % 2:
                raise SpeechError(400, 'Expected PCM16 mono audio.')
            digest = hashlib.sha256(audio).hexdigest()
            cached = state['cached']
            if cached and cached[:2] == (sequence, digest):
                return cached[2]
            if state['final'] is not None or sequence != state['sequence']:
                raise SpeechError(409, 'Audio is out of order.')
            if state['bytes'] + len(audio) > MAX_AUDIO:
                raise SpeechError(413, 'Recording exceeds 30 seconds.')
            if recognizer.AcceptWaveform(audio):
                state['committed'].append(json.loads(recognizer.Result()).get('text', ''))
                partial = ''
            else:
                partial = json.loads(recognizer.PartialResult()).get('partial', '')
            result = {'text': ' '.join(filter(None, [*state['committed'], partial]))}
            state['bytes'] += len(audio)
            state['sequence'] += 1
            state['cached'] = (sequence, digest, result)
            return result


def make_handler(pool):
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def log_message(self, *_args):
            pass

        def reply(self, status, data):
            payload = json.dumps(data).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(payload)

        def dispatch(self):
            try:
                parsed = urlparse(self.path)
                if self.command == 'GET' and parsed.path == '/health':
                    return self.reply(200, {'status': 'ok'})
                match = re.fullmatch(r'/sessions/([0-9a-f-]{36})(?:/(chunks|finish))?', parsed.path)
                if not match:
                    raise SpeechError(404, 'Not found.')
                key, action = match.groups()
                if self.command == 'PUT' and action is None:
                    result = pool.start(key)
                elif self.command == 'DELETE' and action is None:
                    result = pool.cancel(key)
                elif self.command == 'POST' and action == 'finish':
                    result = pool.process(key, final=True)
                elif self.command == 'POST' and action == 'chunks':
                    length = int(self.headers.get('Content-Length', '0'))
                    if not 0 < length <= MAX_CHUNK:
                        raise SpeechError(413, 'Invalid audio size.')
                    sequence = int(parse_qs(parsed.query).get('sequence', ['-1'])[0])
                    audio = self.rfile.read(length)
                    if len(audio) != length:
                        raise SpeechError(400, 'Incomplete audio.')
                    result = pool.process(key, audio, sequence)
                else:
                    raise SpeechError(405, 'Method not allowed.')
                self.reply(200, result)
            except SpeechError as exc:
                self.reply(exc.status, {'error': str(exc)})
            except (ValueError, TimeoutError):
                self.reply(400, {'error': 'Invalid request.'})
            except (BrokenPipeError, ConnectionResetError):
                pass
            except Exception:
                self.reply(500, {'error': 'Speech processing failed.'})

        do_GET = dispatch
        do_PUT = dispatch
        do_POST = dispatch
        do_DELETE = dispatch
    return Handler


if __name__ == '__main__':
    from vosk import KaldiRecognizer, Model, SetLogLevel
    SetLogLevel(-1)
    model = Model(os.environ.get('VOSK_MODEL_PATH', '/opt/model'))
    pool = RecognitionPool(lambda: KaldiRecognizer(model, 16000))
    server = ThreadingHTTPServer(('0.0.0.0', 8080), make_handler(pool))
    server.daemon_threads = True
    server.serve_forever()
