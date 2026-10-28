// Fault injection only in this synthetic child. Never modifies production source.
import fs from 'node:fs/promises';import {syncBuiltinESMExports} from 'node:module';import {pathToFileURL} from 'node:url';
const [modulePath,home,mode,summary,basis]=process.argv.slice(2);const original=fs.writeFile;
if(mode==='crash') {fs.writeFile=async function(path,...args){if(String(path).replaceAll("\\", "/").includes('/index/receipt-'))process.exit(77);return original.call(this,path,...args)};syncBuiltinESMExports()}
const {openDiary}=await import(pathToFileURL(modulePath));const d=openDiary({home,timeZone:'UTC',now:()=>new Date('2026-10-28T12:00:00Z')});await d.ready;const role={id:'gpt',label:'GPT'};
if(mode==='race'){process.send({stage:'ready'});await new Promise(r=>process.once('message',r));const result=await d.updateSummary(role,summary,{basis});process.send({stage:'done',result});process.disconnect()}
else {if(mode==='append-race'){process.send({stage:'ready'});await new Promise(r=>process.once('message',r))}const result=await d.appendOwn(role,'CRASH_WINDOW_BODY','CRASH_WINDOW_SUMMARY',{operationId:'same-crash-operation'});process.send?.({stage:'done',result});process.disconnect?.()}
