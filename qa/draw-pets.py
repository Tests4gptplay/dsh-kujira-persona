"""Build-time original vector character drafts; no upstream image pixels used."""
from pathlib import Path
import cairosvg
P=Path('candidate/pet/assets');P.mkdir(parents=True,exist_ok=True)
roles={
'deepseek':('#3152a1','#96d8f6','#3251a0','whale','maid'),
'gpt':('#eeeaf7','#c2a6ef','#f5f0ff','dragon','dress'),
'gemini':('#7464d9','#f1a7d9','#38366a','cat','star'),
'claude':('#c7754f','#f3b078','#683e3c','flower','book'),
'glm':('#343546','#e8e5ef','#eeeeef','fox','book'),
'kimi':('#d6dcec','#b1bded','#23345e','moon','star'),
'qwen':('#6860b4','#b1a2f2','#493f8b','fan','hanfu'),
'grok':('#f3cc70','#f08a91','#282537','bat','dress'),
'minimax':('#df965f','#8cd6d5','#e8d6b5','beret','camera'),
'llama':('#f1e6d6','#bfbaa7','#faf8ed','llama','sweater'),
'doubao':('#6876ba','#a1e5ed','#4c557b','seed','tech'),
'mistral':('#e3ba60','#ef9389','#bf3d4c','hat','dress'),
'hunyuan':('#343d4c','#dc6668','#e9edef','penguin','hanfu'),
'mimo':('#e6e9ee','#f49b5e','#373843','rabbit','tech'),
'unknown':('#758c96','#9fd6ce','#e4f2ef','spark','sweater')}
def path(d,fill,stroke='#343a55',sw=2.6,extra=''):
 return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round" {extra}/>'
def circle(x,y,r,fill,stroke='none'):
 return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
def star(x,y,scale=1,color='#f9d585'):
 return f'<path d="M0 -9 L2 -2 L9 0 L2 2 L0 9 L-2 2 L-9 0 L-2 -2 Z" transform="translate({x} {y}) scale({scale})" fill="{color}"/>'
for name,(hair,accent,cloth,trait,outfit) in roles.items():
 a=['<svg xmlns="http://www.w3.org/2000/svg" width="320" height="380" viewBox="0 0 320 380">',f'<defs><linearGradient id="hair" x2=".8" y2="1"><stop stop-color="{hair}"/><stop offset="1" stop-color="{hair}"/></linearGradient><linearGradient id="skin" x2="0" y2="1"><stop stop-color="#fff4e8"/><stop offset="1" stop-color="#f5d6c7"/></linearGradient></defs>']
 a+=['<ellipse cx="160" cy="354" rx="81" ry="9" fill="#72839a" opacity=".12"/>']
 if trait=='whale':
  a += [path('M194 271 Q285 326 269 240 Q288 219 297 226 Q295 253 277 260 Q291 280 278 291 Q261 289 254 269 Q253 320 209 321 Z',hair),path('M270 242 Q280 236 290 234','none',accent,3)]
 if trait in ['dragon','bat']:
  for sign in [1,-1]:
   a+= [f'<g transform="translate(160 0) scale({sign} 1) translate(-160 0)">',path('M198 218 Q218 163 286 150 L271 210 Q246 191 233 226 Q213 208 203 243 Z',accent),path('M202 224 L276 158 M234 220 L248 184','none',hair,2),'</g>']
  a += [path('M194 291 Q279 326 263 266 Q256 281 242 280 Q258 318 207 307',hair)]
 if trait in ['cat','fox','llama']:
  a += [path('M207 278 Q282 239 267 204 Q256 193 249 204 Q243 214 255 223 Q265 252 206 258',hair,sw=9 if trait=='cat' else 22)]
 if trait=='rabbit':
  a += [path('M114 86 Q88 8 106 12 Q129 24 131 78',hair),path('M185 78 Q187 9 210 13 Q224 31 205 92',hair),path('M109 31 L123 76 M204 32 L195 78','none',accent,7)]
 a += [path('M95 107 Q87 63 151 59 Q217 54 228 111 L230 245 Q221 275 199 276 L195 170 L123 170 L120 275 Q88 266 91 239 Z','url(#hair)')]
 if trait=='bat':
  a += [path('M98 102 Q57 79 56 141 L71 227 Q94 219 92 177 Q78 149 103 136',hair),path('M222 102 Q263 79 264 141 L249 227 Q226 219 228 177 Q242 149 217 136',hair)]
 a += [path('M128 284 L126 333 Q119 339 127 345 L148 345 L150 283','#f9e9dc'),path('M173 282 L173 335 Q175 347 196 343 Q199 338 188 332 L192 282','#f9e9dc'),path('M124 328 L150 328 L149 345 Q127 351 118 344 Z','#3f4257'),path('M172 328 L194 328 L203 342 Q190 351 173 345 Z','#3f4257')]
 a += [path('M127 195 Q107 206 102 241 L114 250 L102 302 Q156 324 215 302 L203 249 L216 241 Q211 206 188 195 Z',cloth)]
 a += [path('M126 196 L151 219 L162 201 L174 220 L189 196 L171 192 L146 192 Z','#fff9ef')]
 a += [path('M129 216 L122 274 M190 214 L195 274','none',accent,3),path('M106 298 Q156 312 211 298','none',accent,4)]
 a += [path('M120 208 Q107 203 101 227 L99 255 Q104 262 115 259 L131 220',cloth),path('M193 208 Q211 205 216 227 L222 250 Q220 259 207 259 L187 220',cloth),path('M100 249 Q88 253 96 269 Q102 276 113 269 L116 253','url(#skin)'),path('M208 252 Q208 270 219 269 Q231 263 220 249','url(#skin)')]
 if outfit=='maid':
  a += [path('M138 225 L182 225 L192 289 Q164 302 129 289 Z','#fffdf9'),path('M120 285 L128 298 L138 292 L150 302 L161 295 L174 302 L186 292 L198 296 L202 284','#fffdf9'),path('M153 224 L137 215 L138 231 Z M165 224 L183 215 L182 232 Z',accent)]
 elif outfit=='hanfu':
  a += [path('M128 200 L176 249 L170 302 L145 304 L151 247 L187 199','#f0eee9'),path('M121 248 L201 248 L204 260 L118 260 Z',accent),path('M176 258 L191 286 L185 291 L168 259',accent)]
 elif outfit=='tech':
  a += [path('M136 211 L143 296 M185 211 L180 296','none',accent,6),path('M141 245 L185 245 L185 270 L141 270 Z','#eff6fa'),f'<text x="163" y="261" text-anchor="middle" fill="{hair}" font-family="sans-serif" font-size="10">'+('SEED' if trait=='seed' else 'Mi')+'</text>']
 elif outfit=='star':
  a += [path('M132 211 Q161 238 189 212 L181 286 Q157 298 140 283 Z',cloth),star(161,239,1,accent),star(188,284,.6),star(129,281,.4)]
 elif outfit=='sweater':
  a += [path('M131 205 Q158 226 187 205','none',accent,6),path('M127 270 Q159 280 194 269','none',accent,5)]
 else:
  a += [path('M135 237 Q158 248 187 237 L186 248 L135 248 Z',accent),star(161,224,.8)]
 a += [circle(100,139,12,'#f3d8c9'),circle(220,139,12,'#f3d8c9'),path('M104 111 Q160 75 216 111 L212 157 Q207 191 161 198 Q112 192 108 160 Z','url(#skin)')]
 a += [path('M98 133 Q87 75 142 63 Q208 50 224 102 L225 139 Q207 125 202 103 L185 121 L175 92 Q157 125 138 123 L138 99 Q123 130 104 139 Z','url(#hair)'),path('M111 93 Q146 64 185 79','none','#ffffff',5,extra='opacity=".35"')]
 for x in [133,189]:
  a += [f'<ellipse cx="{x}" cy="151" rx="10" ry="14" fill="#fbfbff"/>',f'<ellipse cx="{x+1}" cy="153" rx="7.5" ry="11" fill="{hair if trait not in ["dragon","llama","moon","rabbit"] else "#82639e"}"/>',circle(x+2,154,4,'#34384e'),circle(x-2,147,3.5,'white'),circle(x+4,158,1.7,'white'),path(f'M{x-11} 139 Q{x} 134 {x+11} 140','none',sw=3.5)]
 a += ['<ellipse cx="119" cy="168" rx="10" ry="5" fill="#e99c9c" opacity=".45"/><ellipse cx="202" cy="168" rx="10" ry="5" fill="#e99c9c" opacity=".45"/>',path('M153 178 Q160 185 169 178','none','#ae726c',2.5)]
 if trait=='dragon':
  a += [path('M108 81 Q91 64 100 34 Q114 51 126 65','#a4a0b4'),path('M194 66 Q213 49 222 34 Q230 67 212 84','#a4a0b4'),path('M103 48 L119 68 M219 50 L205 70','none','#d6d0e8',4)]
 elif trait in ['cat','fox','llama']:
  if trait=='llama':a += [path('M113 80 Q79 30 99 29 Q120 31 128 76',hair),path('M190 76 Q199 28 218 30 Q239 36 207 85',hair)]
  else:a += [path('M100 94 L95 44 L137 70 Z',hair),path('M185 70 L226 42 L222 99 Z',hair),path('M105 78 L104 58 L125 73',accent),path('M196 74 L217 58 L214 82',accent)]
 elif trait=='whale':
  a += [path('M98 122 Q69 103 72 88 Q94 88 108 111',accent),path('M222 123 Q251 104 249 87 Q226 88 215 112',accent),path('M117 70 L123 56 L133 62 L143 50 L155 57 L168 49 L180 59 L192 57 L200 76','#fffdf8')]
 elif trait=='beret':a += [path('M105 78 Q108 35 164 42 Q216 37 225 78 Q179 96 105 78 Z','#fffdf0'),path('M154 43 L164 30','none',cloth,5),circle(203,75,8,accent)]
 elif trait=='hat':a += [path('M113 71 L127 24 Q170 13 206 32 L214 80',cloth),path('M92 80 Q147 57 231 84 L234 99 Q153 74 92 95 Z',cloth),path('M118 62 Q165 53 211 68','none','#f8ecd7',8)]
 elif trait=='flower':
  for dx,dy in [(0,-10),(10,0),(0,10),(-10,0)]:a+=[circle(211+dx,86+dy,8,accent)]
  a += [circle(211,86,7,'#ffddb4')]
 elif trait=='moon':a += [path('M210 76 Q187 86 207 99 Q189 97 190 84 Q192 70 210 76','#f6d88a'),star(221,105,.55)]
 elif trait=='rabbit':a += [path('M95 90 Q64 101 76 163 Q82 180 94 186 L97 148',hair),path('M221 90 Q254 101 244 163 Q238 180 226 186 L222 147',hair),circle(99,101,7,accent),circle(220,101,7,accent)]
 else:a += [star(211,87,1.15,accent)]
 if outfit=='book':a += [path('M128 245 L160 240 L193 245 L192 275 L160 270 L128 276 Z','#eee4c9'),path('M160 242 L160 270 M135 251 L153 248 M170 249 L185 252','none','#9e846b',2)]
 if trait=='fan':a += [path('M204 278 L177 250 Q210 221 237 253 Z',accent),path('M204 277 L186 249 M204 277 L207 239 M204 277 L228 249','none','#f4eee1',2)]
 if outfit=='camera':a += [path('M143 245 L148 237 L174 237 L179 245 L191 245 L191 272 L133 272 L133 245 Z','#4c5864'),circle(163,258,11,'#bed9da'),circle(163,258,6,'#628594')]
 if trait=='penguin':a += [path('M125 204 Q160 223 194 204 L193 215 L170 223 L177 250 L164 254 L155 224 L125 217 Z','#c83d50'),'<ellipse cx="195" cy="282" rx="12" ry="16" fill="#394450"/><ellipse cx="195" cy="286" rx="8" ry="11" fill="#faf7ed"/>',circle(191,277,2,'white'),circle(199,277,2,'white')]
 if trait=='bat':a += [path('M146 216 L160 223 L146 232 Z M176 216 L161 223 L177 232 Z','#e74b69')]
 a+=['</svg>'];svg=''.join(a);(P/(name+'.svg')).write_text(svg)
 cairosvg.svg2png(bytestring=svg.encode(),write_to=str(P/(name+'.png')),output_width=480,output_height=570)
print('Created',len(roles),'SVG + PNG drafts')
