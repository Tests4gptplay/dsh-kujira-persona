using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;

public static class KujiraNativeQa {
  static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
  static void Require(bool ok,string message) { if(!ok)throw new Exception(message); }
  static IDictionary<string,object> Packet(object value) { return (IDictionary<string,object>)Json.DeserializeObject(Json.Serialize(value)); }
  static void StopOwned(Process process) { if(process!=null){try{if(!process.HasExited)process.Kill();}catch{}process.Dispose();} }
  static Process Start(string path) {
    var info=new ProcessStartInfo(path){UseShellExecute=false,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,CreateNoWindow=true};
    return Process.Start(info);
  }
  static string FirstLine(Process process) {
    var read=process.StandardOutput.ReadLineAsync();
    Require(read.Wait(10000),"Native stdout did not respond within 10 seconds");
    return read.Result??"";
  }
  [STAThread] public static int Main(string[] args) {
    try { Run(args[0]);return 0; }
    catch(Exception error) { Console.Error.WriteLine(error.ToString());return 1; }
  }
  static void Run(string root) {
    var results=new Dictionary<string,object>();
    var fixture=Path.Combine(root,"protocol-fixture.png");
    var pixels=new byte[4*2*4];
    for(int i=0;i<8;i++){pixels[i*4+((i%4)<2?2:0)]=255;pixels[i*4+3]=255;}
    var bitmap=BitmapSource.Create(4,2,96,96,PixelFormats.Bgra32,null,pixels,16);
    var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(bitmap));
    using(var file=File.Create(fixture))encoder.Save(file);

    var app=new Application();
    var window=(KujiraPet)Activator.CreateInstance(typeof(KujiraPet),true);
    try {
      Require(window.AllowsTransparency&&window.WindowStyle==WindowStyle.None&&!window.ShowInTaskbar&&!window.ShowActivated,"Unexpected desktop window configuration");
      window.Apply(Packet(new {image=fixture,config=new {scale=1,bubble="hidden",sound=false,showUsage=false},route=new {name="Protocol QA"},task=new {phase="idle",text="QA"}}));
      var geometry=new[]{window.Left,window.Top,window.Width,window.Height};
      var first=new {image=fixture,rect=new[]{0,0,2,2},at=new[]{10,20},size=new[]{20,30},opacity=.25};
      var second=new {image=fixture,rect=new[]{2,0,2,2},at=new[]{10,20},size=new[]{20,30},opacity=.75};
      var frame=new {type="frame",canvas=new[]{320,380},layers=new[]{first,second}};
      window.Apply(Packet(frame));
      Require(window.Left==geometry[0]&&window.Top==geometry[1]&&window.Width==geometry[2]&&window.Height==geometry[3],"Frame packet moved or resized the window");
      var image=(Image)typeof(KujiraPet).GetField("image",BindingFlags.Instance|BindingFlags.NonPublic).GetValue(window);
      var drawing=(DrawingGroup)((DrawingImage)image.Source).Drawing;
      Require(drawing.IsFrozen&&drawing.Children.Count==3,"Expected a frozen canvas and two actual layers");
      Require(drawing.Bounds==new Rect(0,0,320,380),"Canvas geometry changed");
      var left=(DrawingGroup)drawing.Children[1];var right=(DrawingGroup)drawing.Children[2];
      Require(left.Opacity==.25&&right.Opacity==.75,"Crossfade opacity was not applied");
      var red=(ImageDrawing)left.Children[0];var blue=(ImageDrawing)right.Children[0];
      Require(((CroppedBitmap)red.ImageSource).SourceRect==new Int32Rect(0,0,2,2),"First source rectangle mismatch");
      Require(((CroppedBitmap)blue.ImageSource).SourceRect==new Int32Rect(2,0,2,2),"Second source rectangle mismatch");
      Require(red.Rect==new Rect(10,20,20,30)&&blue.Rect==red.Rect,"Destination position or scale mismatch");
      var visual=new DrawingVisual();using(var dc=visual.RenderOpen())dc.DrawDrawing(drawing);
      var render=new RenderTargetBitmap(320,380,96,96,PixelFormats.Pbgra32);render.Render(visual);
      var rgba=new byte[320*380*4];render.CopyPixels(rgba,320*4,0);
      int at=(25*320+15)*4;
      Require(Math.Abs(rgba[at]-191)<=2&&Math.Abs(rgba[at+2]-16)<=2&&Math.Abs(rgba[at+3]-207)<=2,"Rendered layers do not contain expected premultiplied crossfade colors");
      Require(rgba[(25*320+35)*4+3]==0,"Pixels leaked beyond the destination rectangle");
      var rendered=new PngBitmapEncoder();rendered.Frames.Add(BitmapFrame.Create(render));using(var file=File.Create(Path.Combine(root,"protocol-crossfade.png")))rendered.Save(file);
      results["frameLayersCropScaleAlpha"]=true;results["framePreservesWindowGeometry"]=true;
      results["renderedPixelBGRA"]=new[]{(int)rgba[at],(int)rgba[at+1],(int)rgba[at+2],(int)rgba[at+3]};
      window.Apply(Packet(new {type="frame",canvas=new[]{320,380},image=fixture,rect=new[]{2,0,2,2},at=new[]{0,0}}));
      drawing=(DrawingGroup)((DrawingImage)image.Source).Drawing;
      Require(drawing.Children.Count==2,"Legacy frame packet failed");
      Require(((ImageDrawing)((DrawingGroup)drawing.Children[1]).Children[0]).Rect==new Rect(0,0,2,2),"Legacy intrinsic size failed");
      results["legacySingleFrame"]=true;
      var sprite=Path.Combine(root,"gpt-core-v1.png");
      window.Apply(Packet(new {type="frame",canvas=new[]{320,380},image=sprite,rect=new[]{49,2,301,368},at=new[]{48.87,45.08},size=new[]{252.84,309.12}}));
      drawing=(DrawingGroup)((DrawingImage)image.Source).Drawing;
      var artVisual=new DrawingVisual();using(var dc=artVisual.RenderOpen())dc.DrawDrawing(drawing);
      var artRender=new RenderTargetBitmap(320,380,96,96,PixelFormats.Pbgra32);artRender.Render(artVisual);
      var artPixels=new byte[320*380*4];artRender.CopyPixels(artPixels,320*4,0);
      int visible=0;for(int i=3;i<artPixels.Length;i+=4)if(artPixels[i]>32)visible++;
      Require(visible>10000&&artPixels[3]==0,"Actual GPT sprite did not render with expected transparency");
      var artPng=new PngBitmapEncoder();artPng.Frames.Add(BitmapFrame.Create(artRender));using(var file=File.Create(Path.Combine(root,"native-gpt-preview.png")))artPng.Save(file);
      results["actualGptRaster"]=true;results["actualGptVisiblePixels"]=visible;
    } finally {window.Close();app.Shutdown();}

    Process process=null,other=null;
    try {
      process=Start(Path.Combine(root,"KujiraPet.exe"));
      var first=FirstLine(process);
      if(first.Contains("already-open")) {
        Require(process.WaitForExit(5000),"Existing-instance refusal did not exit");
        results["ipc"]="skipped-existing-user-instance";
      } else {
        Require(first.Contains("ready"),"Native process did not emit ready");
        process.StandardInput.WriteLine(Json.Serialize(new {image=fixture,config=new {scale=.55,bubble="hidden",sound=false,showUsage=false},route=new {name="Protocol QA"},task=new {phase="idle",text="QA"}}));
        process.StandardInput.WriteLine(Json.Serialize(new {type="frame",canvas=new[]{320,380},layers=new[]{new {image=fixture,rect=new[]{0,0,2,2},at=new[]{10,20},size=new[]{20,30},opacity=.5},new {image=fixture,rect=new[]{2,0,2,2},at=new[]{10,20},size=new[]{20,30},opacity=.5}}}));
        process.StandardInput.Flush();
        other=Start(Path.Combine(root,"KujiraPet.exe"));
        Require(FirstLine(other).Contains("already-open"),"Second native process did not respect the single-instance mutex");
        Require(other.WaitForExit(5000)&&other.ExitCode==0,"Second native process did not exit cleanly");
        Thread.Sleep(150);
        process.StandardInput.Close();
        Require(process.WaitForExit(5000)&&process.ExitCode==0,"Native process did not exit on stdin EOF");
        Require(String.IsNullOrWhiteSpace(process.StandardError.ReadToEnd()),"Native process wrote stderr");
        results["ipc"]="ready-frame-eof-pass";results["singleInstance"]=true;
      }
    } finally {StopOwned(other);StopOwned(process);}
    results["windowPolicy"]=true;results["qaRoutinesShipped"]=false;
    var output=Json.Serialize(results);File.WriteAllText(Path.Combine(root,"native-result.json"),output);Console.WriteLine("KUJIRA_NATIVE_RESULT="+output);
  }
}
