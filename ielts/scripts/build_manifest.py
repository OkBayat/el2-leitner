#!/usr/bin/env python3
"""Create an auditable file manifest and a compressed distribution archive."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT=Path(__file__).resolve().parents[1]

def main():
    entries=[]
    for p in sorted(ROOT.rglob('*')):
        if not p.is_file() or '__pycache__' in p.parts or p.name=='manifest.json' or p.suffix=='.log':continue
        h=hashlib.sha256()
        with p.open('rb') as f:
            for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
        entries.append({'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':h.hexdigest()})
    m={'package':'Vocora IELTS Academic curriculum design','date':'2026-09-09','manifest_excludes_itself':True,'files':entries}
    (ROOT/'audit/manifest.json').write_text(json.dumps(m,indent=2)+'\n')
    dest=ROOT.parent/'Vocora_IELTS_3_to_9_Course_Design.zip'
    with zipfile.ZipFile(dest,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for e in entries:z.write(ROOT/e['path'],ROOT.name+'/'+e['path'])
        z.write(ROOT/'audit/manifest.json',ROOT.name+'/audit/manifest.json')
    print(dest, dest.stat().st_size, 'bytes;',len(entries)+1,'files')

if __name__=='__main__':main()
