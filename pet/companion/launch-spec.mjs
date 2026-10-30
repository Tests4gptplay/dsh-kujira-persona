import{join}from'node:path';
export function petLaunchSpec({platform,petRoot,electronExecutable,env=process.env}){
 if(platform==='win32')return{file:join(petRoot,'native','win-x64','KujiraPet.exe'),args:[]};
 if(platform==='linux'||platform==='darwin'){
  const childEnv={...env};delete childEnv.ELECTRON_RUN_AS_NODE;
  const requested=electronExecutable??'electron';
  const file=platform==='darwin'&&/(?:^|\/)Electron\.app\/?$/.test(requested)?join(requested,'Contents','MacOS','Electron'):requested;
  return{file,args:[join(petRoot,'companion','companion.cjs')],env:childEnv};
 }
 return null;
}
export function desktopPlatform(platform){return['win32','linux','darwin'].includes(platform)}
