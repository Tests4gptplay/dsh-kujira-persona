import fs from 'node:fs/promises';import {syncBuiltinESMExports} from 'node:module';
const [home,mode]=process.argv.slice(2),rename=fs.rename,write=fs.writeFile;
if(mode==='external'){fs.rename=async function(src,dest){const r=await rename(src,dest);if(/\/index\/operation-[a-f0-9]{64}\.json$/.test(String(dest).replaceAll("\\", "/"))){process.send({stage:'intent-durable'});await new Promise(resolve=>process.once('message',resolve))}return r}}
if(mode==='pending-crash'){fs.writeFile=async function(path,...args){if(/\/short\/2026-10-28\.pending-/.test(String(path).replaceAll("\\", "/")))process.exit(78);return write(path,...args)}}syncBuiltinESMExports();
const {openDiary}=await import('../../../../daily-diary.js');const d=openDiary({home,timeZone:'UTC',now:()=>new Date('2026-10-28T12:00:00Z')});await d.ready;const result=await d.appendOwn({id:'gpt',label:'GPT'},'BODY','SHORT',{operationId:'boundary-operation'});process.send({stage:'done',result});process.disconnect();
