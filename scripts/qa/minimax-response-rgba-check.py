from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[2]
old=Image.open(root/'pet/assets/minimax-responding-v001.png').convert('RGBA')
new=Image.open(root/'pet/assets/minimax-responding-v002.png').convert('RGBA')
assert old.size==(1600,400)
assert new.size==(2000,400)
for i in range(4):
 rect=(i*400,0,(i+1)*400,400)
 assert old.crop(rect).tobytes()==new.crop(rect).tobytes(),i
print('PASS: all4 original400x400 RGBA cells preserved exactly; fifth cell added')
