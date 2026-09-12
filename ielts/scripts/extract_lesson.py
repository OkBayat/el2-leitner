#!/usr/bin/env python3
"""Stream a single canonical lesson design from the bank. Python 3.10+."""
import argparse
import json
from pathlib import Path
import sys

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('lesson_id');ap.add_argument('--output',type=Path)
    args=ap.parse_args();root=Path(__file__).resolve().parents[1]
    try:
        with (root/'data/lesson_plans.jsonl').open(encoding='utf-8') as f:
            for line in f:
                p=json.loads(line)
                if p['lesson']['id']==args.lesson_id.upper():
                    result=json.dumps(p,indent=2,ensure_ascii=False)+'\n'
                    if args.output:args.output.write_text(result,encoding='utf-8')
                    else:sys.stdout.write(result)
                    return 0
        print('Unknown lesson ID: '+args.lesson_id,file=sys.stderr);return 1
    except (OSError,ValueError,KeyError) as exc:
        print(str(exc),file=sys.stderr);return 2

if __name__=='__main__':sys.exit(main())
