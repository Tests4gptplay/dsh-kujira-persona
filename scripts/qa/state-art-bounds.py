"""Optional QA dependency: Pillow. No production dependency or asset mutation."""
import json, subprocess
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[2]
art=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {ART} from './pet/art.js'; console.log(JSON.stringify(ART))"],cwd=root))
fringe=0;count=0
for role in ['deepseek','minimax','claude']:
    for name,clip in art[role]['clips'].items():
        if not name.startswith('authored_'): continue
        for i,f in enumerate(clip['frames']):
            im=Image.open(root/'pet/assets'/art[role]['sheets'][f['sheet']]);x,y,w,h=f['rect']
            assert x>=0 and y>=0 and x+w<=im.width and y+h<=im.height,(role,name,i,'source rectangle')
            alpha=im.crop((x,y,x+w,y+h)).getchannel('A');sx,sy=f['size'][0]/w,f['size'][1]/h
            for threshold in [0,8,32,64]:
                b=alpha.point(lambda v:255 if v>threshold else 0).getbbox();assert b
                bounds=[f['at'][0]+b[0]*sx,f['at'][1]+b[1]*sy,f['at'][0]+b[2]*sx,f['at'][1]+b[3]*sy]
                inside=all(0<=v<=[320,380][j%2] for j,v in enumerate(bounds))
                if threshold==0: fringe+=not inside
                else: assert inside,(role,name,i,threshold,bounds)
            count+=1
print(f'PASS {count} source rectangles and alpha>8/32/64 bounds. NOTE {fringe} alpha>0 near-transparent fringe entries cross canvas; original RGBA preserved.')
