import json
import unittest
from server import RecognitionPool, SpeechError

class Recognizer:
    def __init__(self): self.calls = 0
    def AcceptWaveform(self, _audio): self.calls += 1; return self.calls == 2
    def PartialResult(self): return json.dumps({'partial': 'hello'})
    def Result(self): return json.dumps({'text': 'hello world'})
    def FinalResult(self): return json.dumps({'text': 'again'})

class PoolTests(unittest.TestCase):
    def test_stream_and_final_are_idempotent(self):
        pool = RecognitionPool(Recognizer)
        pool.start('one')
        self.assertEqual(pool.process('one', b'\0\0', 0)['text'], 'hello')
        self.assertEqual(pool.process('one', b'\0\0', 0)['text'], 'hello')
        self.assertEqual(pool.process('one', b'\0\0', 1)['text'], 'hello world')
        self.assertEqual(pool.process('one', final=True)['text'], 'hello world again')
        self.assertEqual(pool.process('one', final=True)['text'], 'hello world again')
        self.assertIsNone(pool.sessions['one']['recognizer'])

    def test_order_limits_expiry_and_cleanup(self):
        clock = [0]
        pool = RecognitionPool(Recognizer, capacity=1, clock=lambda: clock[0])
        pool.start('one')
        with self.assertRaises(SpeechError): pool.start('two')
        with self.assertRaises(SpeechError): pool.process('one', b'\0\0', 1)
        with self.assertRaises(SpeechError): pool.process('one', b'\0', 0)
        with self.assertRaises(SpeechError): pool.process('one', b'\0' * 32002, 0)
        clock[0] = 91
        pool.start('two')
        self.assertNotIn('one', pool.sessions)
        pool.cancel('two')
        self.assertEqual(len(pool.sessions), 0)

if __name__ == '__main__': unittest.main()
