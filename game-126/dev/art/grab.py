#!/usr/bin/env python3
"""Download the images from a saved fal wait_for_jobs result.  python3 -I grab.py RESULT.json  (run in the folder that holds jobs.txt: "name request_id" lines)."""
import json,sys,re,subprocess,os
f=sys.argv[1]
txt=open(f).read()
# file may be a JSON array of content blocks or plain JSON
try:
    d=json.loads(txt)
    if isinstance(d,list): d=json.loads(d[0]['text'])
except Exception:
    d=json.loads(txt[txt.index('{'):])
names={l.split()[1]:l.split()[0] for l in open('jobs.txt') if l.strip()}
os.makedirs('raw',exist_ok=True)
for j in d['jobs']:
    rid=j['request_id']; n=names.get(rid,rid)
    if j.get('status')!='completed' or not j.get('result'):
        print('NOT DONE',n,j.get('status'),j.get('queue_status')); continue
    url=j['result']['images'][0]['url']
    out=f'raw/{n}.png'
    if not os.path.exists(out):
        subprocess.run(['curl','-sS','-o',out,url],check=True)
    print('ok',n)
