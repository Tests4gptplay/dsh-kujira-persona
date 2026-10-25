// Windows-only offline QA; never part of the npm runtime package.
using System;
using System.Collections.Generic;
using System.Reflection;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
public static class KujiraNativeVisibilityQa {
  static readonly JavaScriptSerializer Json=new JavaScriptSerializer();
  static void Require(bool ok,string message){if(!ok)throw new Exception(message);}
  static object Field(KujiraPet w,string key){return typeof(KujiraPet).GetField(key,BindingFlags.Instance|BindingFlags.NonPublic).GetValue(w);}
  static Rect Bounds(KujiraPet w){return (Rect)typeof(KujiraPet).GetMethod("Bounds",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(w,null);}
  static Rect Work(Rect bounds){return (Rect)typeof(KujiraPet).GetMethod("WorkArea",BindingFlags.Static|BindingFlags.NonPublic).Invoke(null,new object[]{bounds});}
  static void Apply(KujiraPet w,bool pet,string bubble,double? x=null,double? y=null,double bubbleScale=1,string text="A bubble"){
    w.Apply((IDictionary<string,object>)Json.DeserializeObject(Json.Serialize(new {animated=true,image="",config=new {showPet=pet,bubble=bubble,scale=1,bubbleScale=bubbleScale,showUsage=false,sound=false,desktopX=x,desktopY=y},route=new {name="Visibility QA",art="gpt"},task=new {phase="idle",text=text}})));
    w.UpdateLayout();
  }
  [STAThread] public static int Main(){
    var app=new Application();var w=(KujiraPet)Activator.CreateInstance(typeof(KujiraPet),true);
    try{
      Apply(w,true,"always");
      var image=(Image)Field(w,"image");var bubble=(Border)Field(w,"bubble");
      Require(image.ContextMenu.Items.Count==3&&Object.ReferenceEquals(image.ContextMenu,bubble.ContextMenu),"Both surfaces must share exactly three actions");
      var themed=(IDictionary<string,object>)Json.DeserializeObject(Json.Serialize(new {animated=true,image="",menuTheme=new {background="#123456",foreground="#ABCDEF",border="#345678",hover="#56789A",hoverForeground="#FFFFFF"},config=new {showPet=true,bubble="always"},route=new {name="Visibility QA",art="gpt"},task=new {phase="idle",text="A bubble"}}));
      w.Apply(themed);
      Require(((SolidColorBrush)image.ContextMenu.Background).Color==Color.FromRgb(0x12,0x34,0x56),"DSH background bridge was not applied");
      var style=(Style)image.ContextMenu.Resources[typeof(MenuItem)];
      Require(style.Triggers.Count==1&&((Trigger)style.Triggers[0]).Property==MenuItem.IsHighlightedProperty,"DSH hover colors lack a WPF highlight trigger");
      Apply(w,true,"always");
      var full=Bounds(w);
      Apply(w,false,"always");
      Require(image.Visibility==Visibility.Collapsed&&!image.IsHitTestVisible,"Hidden sprite still participates in layout or input");
      Require(Math.Abs(w.Height-bubble.DesiredSize.Height)<1,"Bubble-only window reserves sprite height");
      Require(Math.Abs(w.Width-bubble.Width)<1,"Bubble-only window reserves sprite width");
      var only=Bounds(w);Require(only.Height<full.Height,"Window did not shrink");
      var work=Work(only);
      var fit=typeof(KujiraPet).GetMethod("FitBounds",BindingFlags.Static|BindingFlags.NonPublic);
      var bottom=(Rect)fit.Invoke(null,new object[]{new Rect(only.Left,work.Bottom+100,only.Width,only.Height),work});
      Require(Math.Abs(bottom.Bottom-work.Bottom)<1,"Bubble cannot reach work-area bottom");
      typeof(KujiraPet).GetMethod("SetBounds",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(w,new object[]{bottom,false});
      Apply(w,true,"always");
      var restored=Bounds(w);Require(Work(restored).Contains(restored),"Restored pet is outside work area");
      Require(Math.Abs(restored.Left-bottom.Left)<1,"Restoring pet discarded valid horizontal position");
      foreach(var bubbleScale in new[]{.8,1.4}){
        Apply(w,false,"always",null,null,bubbleScale,"Short");
        Require(Math.Abs(w.Height-bubble.DesiredSize.Height)<1,"Scaled bubble retained sprite height");
        var small=Bounds(w);var screen=Work(small);
        typeof(KujiraPet).GetMethod("SetBounds",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(w,new object[]{new Rect(small.Left,screen.Bottom-small.Height,small.Width,small.Height),false});
        var shortBounds=Bounds(w);double shortHeight=w.Height;
        Apply(w,false,"always",null,null,bubbleScale,"One\nTwo\nThree\nFour");
        Require(Math.Abs(w.Height-bubble.DesiredSize.Height)<1,"Multiline scaled bubble retained sprite height");
        Require(w.Height>shortHeight,"Multiline bubble did not resize");
        Require(Math.Abs(Bounds(w).Bottom-shortBounds.Bottom)<1.1,"Bubble text resize moved its bottom anchor");
        var now=Bounds(w);var area=Work(now);var legal=new Rect(area.Left+10,area.Top+10,now.Width,now.Height);
        typeof(KujiraPet).GetMethod("SetBounds",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(w,new object[]{legal,false});
        Apply(w,true,"always",null,null,bubbleScale,"Short");
        var grown=Bounds(w);Require(Math.Abs(grown.Left-legal.Left)<1.1&&Math.Abs(grown.Top-legal.Top)<1.1,"Restoring sprite moved an already legal position");
      }
      Apply(w,false,"always",null,null,1.4,String.Join("\n",new string[500]).Replace("\n","Long line of status information\n"));
      var scroll=(ScrollViewer)Field(w,"bubbleScroll");var longBounds=Bounds(w);
      Require(w.Height<=Work(longBounds).Height/(double)typeof(KujiraPet).GetMethod("WindowScale",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(w,null)+1,"Long bubble exceeded work area");
      Require(Math.Abs(w.Height-bubble.DesiredSize.Height)<1,"Long bubble reserves hidden sprite space");
      Require(scroll.ScrollableHeight>0,"Long bubble has no scroll range");
      scroll.ScrollToBottom();w.UpdateLayout();Require(scroll.VerticalOffset>0,"Long bubble cannot scroll to lower content");
      Apply(w,true,"always",null,null,1.4,String.Join("\n",new string[500]).Replace("\n","Long status\n"));
      Require(scroll.ScrollableHeight>0&&bubble.MaxHeight+image.Height<=Work(Bounds(w)).Height/(double)typeof(KujiraPet).GetMethod("WindowScale",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(w,null)+1,"Pet plus long bubble did not share available height");
      Apply(w,false,"hidden");Require(!w.IsVisible,"Both hidden left a visible HWND");
      Apply(w,false,"always");Require(w.IsVisible&&image.Visibility==Visibility.Collapsed,"Bubble did not recover independently");
      for(int i=0;i<20;i++){Apply(w,true,"always");Apply(w,false,"always");}
      Require(Math.Abs(w.Height-bubble.DesiredSize.Height)<1,"Repeated toggles leaked sprite space");
      var oldOutput=Console.Out;var messages=new System.IO.StringWriter();Console.SetOut(messages);
      try{for(int i=0;i<5;i++){Apply(w,false,"hidden");Apply(w,false,"always");}}finally{Console.SetOut(oldOutput);}
      Require(!messages.ToString().Contains("ready"),"Visibility toggles re-emitted ready");

      Console.WriteLine("Native visibility/menu/layout QA passed");return 0;
    }catch(Exception e){Console.Error.WriteLine(e);return 1;}finally{w.Close();app.Shutdown();}
  }
}
