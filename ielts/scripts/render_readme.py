#!/usr/bin/env python3
"""Render the self-contained README as accessible HTML.
Optional dependency: pip install markdown-it-py
The course builder and validator do not depend on this renderer.
"""
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[1]

def main():
    try:
        from markdown_it import MarkdownIt
    except ImportError:
        print('Optional renderer needs markdown-it-py: python -m pip install markdown-it-py',file=sys.stderr)
        return 1
    parser=MarkdownIt('commonmark',{'html':True}).enable('table')
    text=(ROOT/'README.md').read_text(encoding='utf-8')
    tokens=parser.parse(text);nav=[];seen={}
    for i,t in enumerate(tokens):
        if t.type=='heading_open':
            title=tokens[i+1].content
            slug=re.sub(r'[^a-z0-9]+','-',title.lower()).strip('-')
            if slug in seen: seen[slug]+=1;slug+=f'-{seen[slug]}'
            else:seen[slug]=1
            t.attrSet('id',slug)
            if t.tag=='h2':nav.append((slug,title))
    body=parser.renderer.render(tokens,parser.options,{})
    from html import escape
    links=''.join(f'<a href="#{slug}">{escape(title)}</a>' for slug,title in nav)
    html='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Vocora IELTS Academic — Curriculum Design</title><style>
:root{--ink:#17232d;--muted:#5d6b74;--accent:#0d675f;--line:#dbe4e6;--paper:#fff;--wash:#f2f6f6}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--wash);color:var(--ink);font:16px/1.7 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:var(--accent);text-underline-offset:3px}aside{position:fixed;left:0;top:0;bottom:0;width:270px;overflow:auto;padding:26px 20px;background:#142d34;color:white}aside .brand{font-weight:800;font-size:24px;letter-spacing:-.7px}aside p{font-size:13px;color:#bdcfd3}aside a{display:block;color:#e3eff1;font-size:12px;line-height:1.4;padding:8px 0;text-decoration:none;border-bottom:1px solid #ffffff15}aside a:hover{color:white;text-decoration:underline}main{max-width:1250px;margin-left:270px;padding:48px 6vw 100px;background:var(--paper);min-height:100vh}h1{font-size:clamp(30px,4vw,46px);line-height:1.17;letter-spacing:-1.5px;max-width:900px;color:#103e46}h2{margin-top:68px;padding-top:18px;border-top:2px solid var(--accent);font-size:28px;line-height:1.3;scroll-margin-top:22px}h3{margin-top:34px;font-size:21px;line-height:1.4}h4{margin-top:36px;color:#0c5e60;font-size:19px}h5,h6{font-size:17px;margin-top:25px}p{max-width:980px}blockquote{margin:25px 0;padding:12px 22px;border-left:5px solid #b57835;background:#fbf5e9}blockquote p{margin:8px 0}table{border-collapse:collapse;width:100%;font-size:13px;line-height:1.6;margin:22px 0;display:block;overflow-x:auto}th,td{padding:12px 14px;border:1px solid var(--line);vertical-align:top;text-align:left}th{background:#e6f0ef;color:#164c50}tr:nth-child(even){background:#fafcfc}code{font:13px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;background:#edf2f3;padding:2px 4px;border-radius:3px;overflow-wrap:anywhere}pre{padding:20px;background:#edf2f3;overflow-x:auto;line-height:1.5}pre code{padding:0;white-space:pre;overflow-wrap:normal}details{margin:20px 0;border:1px solid var(--line);border-radius:8px;padding:12px 20px;background:#fff}summary{cursor:pointer;font-weight:700;color:var(--accent);padding:5px 0}details[open]>summary{border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:20px}li{margin-bottom:7px}hr{border:0;border-top:1px solid var(--line);margin:34px 0}.tools{display:flex;flex-wrap:wrap;gap:9px;margin:22px 0}.tools button{font:600 13px system-ui;border:1px solid #bdcfd3;border-radius:6px;padding:9px 13px;background:white;color:var(--accent);cursor:pointer}.eyebrow{font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--accent)}.status{font-size:13px;color:var(--muted)}@media(max-width:950px){aside{position:relative;width:auto;max-height:280px}aside nav{columns:2}main{margin:0;padding:30px 5vw 70px}}@media print{aside,.tools{display:none}main{margin:0;padding:10px;max-width:none}details{border:0;padding:0}a{color:inherit}h2{break-before:page}table{font-size:10px}}
</style></head><body><aside><div class="brand">vocora / IELTS</div><p>960-lesson course design<br>Academic · four skills · 3 → 9 readiness</p><nav>'''+links+'''</nav></aside><main><div class="eyebrow">Curriculum architecture & authoring specification</div><p class="status">Design package · 9 September 2026 · Not a deployed or score-guaranteed course</p><div class="tools"><button onclick="document.querySelectorAll('details').forEach(x=>x.open=true)">Expand lesson and example sections</button><button onclick="document.querySelectorAll('details').forEach(x=>x.open=false)">Collapse long sections</button><button onclick="window.print()">Print</button></div>'''+body+'''</main></body></html>'''
    (ROOT/'README.html').write_text(html,encoding='utf-8')
    print('Rendered README.html',len(html),'characters')
    return 0

if __name__=='__main__':sys.exit(main())
