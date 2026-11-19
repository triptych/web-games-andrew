"""Pull image URLs for finished fal jobs out of a saved wait_for_jobs result and download them.

    python3 -I game-143/dev/art/grab.py RESULT.txt RAWDIR

jobs.txt (next to this script) maps names to request ids. Each finished job is saved as RAWDIR/<name>.png.
"""
import json, os, re, sys, urllib.request

here = os.path.dirname(os.path.abspath(__file__))
names = {}
for line in open(os.path.join(here, 'jobs.txt')):
    p = line.split()
    if len(p) >= 2:
        names[p[1]] = p[0]
text = open(sys.argv[1]).read()
out = sys.argv[2]
os.makedirs(out, exist_ok=True)
try:
    data = json.loads(text)
    if isinstance(data, list):
        data = json.loads(data[0]['text'])
    jobs = data['jobs']
except Exception:
    jobs = []
    for m in re.finditer(r'"request_id":\s*"([^"]+)".*?"url":\s*"(https://v3b\.fal\.media/[^"]+)"', text, re.S):
        jobs.append({'request_id': m.group(1), 'result': {'images': [{'url': m.group(2)}]}})
done = missing = 0
for j in jobs:
    rid = j.get('request_id')
    name = names.get(rid)
    imgs = (j.get('result') or {}).get('images') or []
    if not name or not imgs:
        print('pending/failed', rid, name, j.get('status'))
        missing += 1
        continue
    path = os.path.join(out, name + '.png')
    if not os.path.exists(path):
        urllib.request.urlretrieve(imgs[0]['url'], path)
    done += 1
print('saved', done, 'missing', missing)
