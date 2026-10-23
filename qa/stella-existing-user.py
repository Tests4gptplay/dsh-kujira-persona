from pathlib import Path
p=Path('candidate/catalog.js');s=p.read_text(encoding='utf-8')
a="""return [...BUILTINS.map(p => ({ ...p, builtin: true })), ...state.personas
      .filter(p => safeId(p.id) && !BUILTINS.some(b => b.id === p.id))"""
b="""return [...BUILTINS.filter(b => !state.personas.some(p => safeId(p.id) && p.id === b.id))
      .map(p => ({ ...p, builtin: true })), ...state.personas
      .filter(p => safeId(p.id))"""
assert a in s;s=s.replace(a,b);p.write_text(s,encoding='utf-8')
p=Path('candidate/index.js');s=p.read_text(encoding='utf-8');a="packagedDir: id === 'deepseek' ? join(HERE, 'persona') : join(HERE, 'personas', id)";assert a in s;s=s.replace(a,"packagedDir: entry.builtin === false ? null : id === 'deepseek' ? join(HERE, 'persona') : join(HERE, 'personas', id)");p.write_text(s,encoding='utf-8')
p=Path('qa/stella.test.mjs');s=p.read_text(encoding='utf-8');s=s.replace('{mkdtemp,rm,readFile}','{mkdtemp,rm,readFile,mkdir,writeFile}')
s+='''\ntest('an existing user-created Stella keeps her chosen name and custom ownership',async()=>{
 const home=await mkdtemp(join(tmpdir(),'kujira-stella-existing-'))
 try{
  await mkdir(join(home,'personas'),{recursive:true})
  await writeFile(join(home,'personas/.kujira-catalog.json'),JSON.stringify({v:1,personas:[{id:'stella',label:'用户的星璃'}],bindings:[]}))
  const entry=await openCatalog(config(home)).resolve({provider:'x',model:'private'})
  assert.equal(entry.id,'stella');assert.equal(entry.label,'用户的星璃');assert.equal(entry.builtin,false)
 }finally{await rm(home,{recursive:true,force:true})}
})\n''';p.write_text(s,encoding='utf-8')
