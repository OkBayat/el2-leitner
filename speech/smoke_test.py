"""Exercise the actual recognizer with Vosk's pinned public example (not user audio)."""
import hashlib
import io
import json
import sys
import urllib.request
import uuid
import wave

SOURCE = 'https://raw.githubusercontent.com/alphacep/vosk-api/cf2560c9f8a49d3d366b433fdabd78c518231bec/python/example/test.wav'
BLOB_SHA = 'c41144a21710590e568e4e612d2a40baf9a71223'


def main(base):
    with urllib.request.urlopen(SOURCE, timeout=60) as response:
        audio = response.read(1_000_000)
    assert hashlib.sha1(b'blob ' + str(len(audio)).encode() + b'\0' + audio).hexdigest() == BLOB_SHA
    key = str(uuid.uuid4())

    def call(suffix='', method='POST', body=None):
        request = urllib.request.Request(f'{base}/sessions/{key}{suffix}', method=method, data=body,
                                         headers={'Content-Type': 'application/octet-stream'})
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)

    call(method='PUT')
    try:
        with wave.open(io.BytesIO(audio)) as source:
            assert (source.getnchannels(), source.getsampwidth(), source.getframerate()) == (1, 2, 16000)
            sequence = 0
            while chunk := source.readframes(8000):
                result = call(f'/chunks?sequence={sequence}', body=chunk)
                assert result == call(f'/chunks?sequence={sequence}', body=chunk)
                sequence += 1
        result = call('/finish')
        assert result == call('/finish'), 'Finalization must be repeatable without duplicating speech.'
        assert {'one', 'zero', 'eight'}.issubset(set(result['text'].split())), result
        print('Real streaming recognition, chunk retries and final-result retries passed.')
    finally:
        call(method='DELETE')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:18080')
