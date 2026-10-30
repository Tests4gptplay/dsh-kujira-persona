// Companion window behavior for each desktop platform.
function prepareApp(app,platform){if(platform==='darwin')app.setActivationPolicy('accessory')}
function windowOptions(platform){return platform==='darwin'?{acceptFirstMouse:true,fullscreenable:false}:{} }
function prepareWindow(window,platform){if(platform==='darwin')window.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:false})}
function mouseOptions(platform){return platform==='darwin'?{forward:true}:undefined}
module.exports={prepareApp,windowOptions,prepareWindow,mouseOptions};
