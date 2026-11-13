#!/usr/bin/env python3
"""Download the images from a saved fal wait_for_jobs result.  python3 -I grab.py RESULT.txt  (jobs.txt: "name request_id key" lines)."""
import json, sys, subprocess, os
txt = open(sys.argv[1]).read()
try:
    d = json.loads(txt)
    if isinstance(d, list): d = json.loads(d[0]['text'])
except Exception:
    d = json.JSONDecoder().raw_decode(txt[txt.index('{'):])[0]
names = {l.split()[1]: l.split()[0] for l in open('jobs.txt') if l.strip()}
os.makedirs('raw', exist_ok=True)
urls = {}
for j in d['jobs']:
    rid = j['request_id']; n = names.get(rid, rid)
    if j.get('status') != 'completed' or not j.get('result'):
        print('NOT DONE', n, j.get('status'), j.get('queue_status')); continue
    url = j['result']['images'][0]['url']; urls[n] = url
    out = f'raw/{n}.png'
    if not os.path.exists(out): subprocess.run(['curl', '-sS', '-o', out, url], check=True)
    print('ok', n)
old = json.load(open('urls.json')) if os.path.exists('urls.json') else {}
old.update(urls); json.dump(old, open('urls.json', 'w'), indent=1)
