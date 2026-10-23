from pathlib import Path
p=Path('qa/ui-test.mjs');s=p.read_text(encoding='utf-8')
a="page.getByText(label,{exact:true}).click()"
b="page.getByRole('menuitemradio',{name:label,exact:true}).click()"
assert s.count(a)==1
p.write_text(s.replace(a,b),encoding='utf-8',newline='\n')
