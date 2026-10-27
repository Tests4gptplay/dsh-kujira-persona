import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {pathToFileURL} from 'node:url';
const [modulePath,home,body,mode]=process.argv.slice(2); let trapped=false;
const original=fs.readFile;fs.readFile=async function(file,...args){const result=await original.call(this,file,...args);if(mode!=='plain'&&!trapped&&String(file).endsWith('/long/2026-10-25.md')){trapped=true;process.send({stage:'snapshot-read'});await new Promise(resolve=>process.once('message',resolve));}return result;};syncBuiltinESMExports();
const {openDiary}=await import(pathToFileURL(modulePath));const d=openDiary({home,timeZone:'UTC',now:()=>new Date('2026-10-25T12:00:00Z')});await d.ready;process.send({stage:'ready'});await new Promise(resolve=>process.once('message',resolve));const value=await d.appendOwn({id:'gpt',label:'GPT'},body,body,{operationId:body});process.send({stage:'done',value});process.disconnect();
