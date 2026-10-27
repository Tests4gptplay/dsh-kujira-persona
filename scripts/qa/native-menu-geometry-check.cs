using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
public static class NativeMenuGeometryQa {
  static readonly JavaScriptSerializer Json=new JavaScriptSerializer();
  static void Require(bool ok,string text){if(!ok)throw new Exception(text);}
  static object Field(object obj,string name){return obj.GetType().GetField(name,BindingFlags.NonPublic|BindingFlags.Instance).GetValue(obj);}
  static IDictionary<string,object> State(double radius,double itemRadius){return (IDictionary<string,object>)Json.DeserializeObject(Json.Serialize(new {
    animated=true,image="",config=new {showPet=true,bubble="hidden",scale=1,sound=false},route=new {name="Theme QA",art="gpt"},task=new {phase="idle",text=""},
    menuTheme=new {background="#FAFAFC",foreground="#202024",border="#808088",hover="#507090",hoverForeground="#FFFFFF",geometry=new {
      surfaceRadius=new[]{radius,radius,radius,radius},surfacePadding=new[]{4,4,4,4},surfaceBorderWidth=new[]{.5,.5,.5,.5},surfaceMinWidth=144,
      itemRadius=new[]{itemRadius,itemRadius,itemRadius,itemRadius},itemPadding=new[]{6,8,6,8},itemMinHeight=34,fontFamily="system-ui, 'Microsoft YaHei', sans-serif",fontSize=13,fontWeight=400,lineHeight=20
    }}
  }));}
  static Border Border(Control control,string name){control.ApplyTemplate();return (Border)control.Template.FindName(name,control);}
  static RenderTargetBitmap Raster(FrameworkElement element,string file){
    element.UpdateLayout();var image=new RenderTargetBitmap((int)Math.Ceiling(element.ActualWidth),(int)Math.Ceiling(element.ActualHeight),96,96,PixelFormats.Pbgra32);image.Render(element);
    var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(image));using(var stream=File.Create(file))encoder.Save(stream);return image;
  }
  static int Alpha(BitmapSource image,int x,int y){var rgba=new byte[4];image.CopyPixels(new Int32Rect(x,y,1,1),rgba,4,0);return rgba[3];}
  static void Highlight(MenuItem item){
    var key=typeof(MenuItem).GetField("IsHighlightedPropertyKey",BindingFlags.NonPublic|BindingFlags.Static);
    Require(key!=null,"WPF highlight key missing");item.SetValue((DependencyPropertyKey)key.GetValue(null),true);item.UpdateLayout();
  }
  [STAThread] public static int Main(string[] args){
    var app=new Application();var pet=(KujiraPet)Activator.CreateInstance(typeof(KujiraPet),true);
    try{
      var invalidFirst=State(16,6);var firstTheme=(IDictionary<string,object>)invalidFirst["menuTheme"];
      ((IDictionary<string,object>)firstTheme["geometry"]).Remove("itemRadius");firstTheme["background"]="#D0D1D2";
      pet.Apply(invalidFirst);var initialMenu=(ContextMenu)Field(pet,"menu");
      Require(((SolidColorBrush)initialMenu.Background).Color==Color.FromRgb(0xD0,0xD1,0xD2),"First incomplete geometry blocked valid legacy colors");
      var state=State(16,6);pet.Apply(state);pet.UpdateLayout();var menu=(ContextMenu)Field(pet,"menu");menu.PlacementTarget=(Image)Field(pet,"image");menu.IsOpen=true;menu.UpdateLayout();
      var surface=Border(menu,"DshMenuSurface");Require(surface!=null,"System ContextMenu template was not replaced");
      Require(surface.CornerRadius==new CornerRadius(16)&&surface.Padding==new Thickness(4)&&surface.BorderThickness==new Thickness(.5),"Surface geometry does not match bridge");
      Require(((SolidColorBrush)menu.Background).Color.A==0,"Opaque system square remains behind rounded surface");Require(menu.MinWidth==144,"Surface min-width was not bridged");
      var item=(MenuItem)menu.Items[0];Highlight(item);var cell=Border(item,"DshMenuBorder");
      Require(cell.CornerRadius==new CornerRadius(6)&&cell.Padding==new Thickness(8,6,8,6),"Item radius or CSS TRBL padding mapping incorrect");
      Require(item.FontSize==13&&item.MinHeight==34&&item.FontWeight.ToOpenTypeWeight()==400,"Item text metrics incorrect");
      Require(item.FontFamily.Source.Contains("Segoe UI")&&item.FontFamily.Source.Contains("Microsoft YaHei")&&item.FontFamily.Source.Contains("Global User Interface"),"Font mapping dropped explicit family or generic fallback");
      Require(((SolidColorBrush)cell.Background).Color==Color.FromRgb(0x50,0x70,0x90),"Actual highlighted border did not take DSH color");
      var label=(TextBlock)cell.Child;Require(label.Text=="隐藏桌宠"&&label.LineHeight==20,"Header or line-height binding incorrect");
      var rounded=Raster(menu,Path.Combine(args[0],"menu-rounded.png"));Require(Alpha(rounded,1,1)<32,"Actual outer corner is not transparent");
      var originalTemplate=menu.Template;var originalStyle=menu.Resources[typeof(MenuItem)];for(int i=0;i<10;i++)pet.Apply(state);
      Require(Object.ReferenceEquals(originalTemplate,menu.Template)&&Object.ReferenceEquals(originalStyle,menu.Resources[typeof(MenuItem)]),"Unchanged geometry rebuilt templates");
      var incomplete=State(24,12);var incompleteTheme=(IDictionary<string,object>)incomplete["menuTheme"];
      ((IDictionary<string,object>)incompleteTheme["geometry"]).Remove("itemRadius");incompleteTheme["background"]="#E0E1E2";incompleteTheme["hover"]="#305070";
      pet.Apply(incomplete);menu.UpdateLayout();surface=Border(menu,"DshMenuSurface");item=(MenuItem)menu.Items[0];Highlight(item);cell=Border(item,"DshMenuBorder");
      Require(surface.CornerRadius==new CornerRadius(16)&&cell.CornerRadius==new CornerRadius(6),"Incomplete geometry discarded last valid shape");
      Require(((SolidColorBrush)surface.Background).Color==Color.FromRgb(0xE0,0xE1,0xE2)&&((SolidColorBrush)cell.Background).Color==Color.FromRgb(0x30,0x50,0x70),"Incomplete geometry blocked valid surface or hover colors");
      var missing=State(32,16);((IDictionary<string,object>)missing["menuTheme"]).Remove("geometry");pet.Apply(missing);menu.UpdateLayout();
      Require(Border(menu,"DshMenuSurface").CornerRadius==new CornerRadius(16),"Missing geometry discarded last valid shape");
      pet.Apply(State(0,0));menu.UpdateLayout();surface=Border(menu,"DshMenuSurface");item=(MenuItem)menu.Items[0];Highlight(item);cell=Border(item,"DshMenuBorder");
      Require(surface.CornerRadius==new CornerRadius(0)&&cell.CornerRadius==new CornerRadius(0),"Geometry-only theme change was cached away");
      var square=Raster(menu,Path.Combine(args[0],"menu-square.png"));Require(Alpha(square,1,1)>240,"Zero-radius theme did not produce a square corner");
      Require(!Object.ReferenceEquals(originalTemplate,menu.Template),"Geometry change did not rebuild surface");
      var changed=State(16,6);var geometry=(IDictionary<string,object>)((IDictionary<string,object>)changed["menuTheme"])["geometry"];
      geometry["surfaceRadius"]=new[]{16,12,8,4};geometry["itemPadding"]=new[]{2,3,4,5};pet.Apply(changed);menu.UpdateLayout();
      Require(Border(menu,"DshMenuSurface").CornerRadius==new CornerRadius(16,12,8,4),"Four-corner order changed");
      Require(Border((MenuItem)menu.Items[0],"DshMenuBorder").Padding==new Thickness(5,2,3,4),"Four-edge order changed");
      var output=Console.Out;var actions=new StringWriter();Console.SetOut(actions);try{foreach(MenuItem action in menu.Items){Require(action.Focusable&&action.IsEnabled,"Native MenuItem behavior lost");action.RaiseEvent(new RoutedEventArgs(MenuItem.ClickEvent));}}finally{Console.SetOut(output);}
      Require(actions.ToString().Contains("toggle-pet")&&actions.ToString().Contains("toggle-bubble")&&actions.ToString().Contains("close")&&menu.Items.Count==3,"Three actions changed");
      File.WriteAllText(Path.Combine(args[0],"menu-geometry-result.json"),Json.Serialize(new {surface=true,item=true,hover=true,geometryCache=true,fontStack=true,lineHeight=true,roundedRaster=true,zeroRadiusRaster=true,partialGeometryFallback=true,threeActions=true}));
      menu.IsOpen=false;Console.WriteLine("Native menu surface, hover, geometry cache, typography, raster corners and actions PASS");return 0;
    }catch(Exception ex){Console.Error.WriteLine(ex);return 1;}finally{pet.Close();app.Shutdown();}
  }
}
