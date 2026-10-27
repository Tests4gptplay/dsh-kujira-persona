// Build-only source. Shipped EXE has no QA routines.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
[assembly: TargetFramework(".NETFramework,Version=v4.8")]
public class KujiraPet : Window {
  [StructLayout(LayoutKind.Sequential)] struct NativeRect { public int Left,Top,Right,Bottom; }
  [StructLayout(LayoutKind.Sequential)] struct MonitorInfo { public int Size;public NativeRect Monitor,Work;public uint Flags; }
  [DllImport("user32.dll")] static extern IntPtr MonitorFromRect(ref NativeRect rect,uint flags);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern bool GetMonitorInfo(IntPtr monitor,ref MonitorInfo info);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window,out NativeRect rect);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr window,IntPtr after,int x,int y,int width,int height,uint flags);
  [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr window);
  [DllImport("user32.dll")] static extern uint GetDpiForSystem();
  readonly JavaScriptSerializer json=new JavaScriptSerializer();
  readonly Image image=new Image { Stretch=Stretch.Uniform,Width=210,Height=250 };
  readonly TextBlock text=new TextBlock { TextWrapping=TextWrapping.Wrap,Foreground=new SolidColorBrush(Color.FromRgb(42,57,75)),FontSize=14 };
  readonly Border bubble=new Border { Background=new SolidColorBrush(Color.FromRgb(255,253,248)),CornerRadius=new CornerRadius(16),Padding=new Thickness(15),BorderBrush=new SolidColorBrush(Color.FromRgb(218,211,204)),BorderThickness=new Thickness(1),Width=250 };
  readonly ScrollViewer bubbleScroll=new ScrollViewer { VerticalScrollBarVisibility=ScrollBarVisibility.Auto,HorizontalScrollBarVisibility=ScrollBarVisibility.Disabled };
  readonly Canvas canvas=new Canvas();
  readonly ContextMenu menu=new ContextMenu();
  readonly Dictionary<string,BitmapSource> sheets=new Dictionary<string,BitmapSource>();
  string assetKey="",lastPhase="idle",lastPulse="",menuThemeKey="";bool pressed=false;Point origin;FrameworkElement pressedElement;bool initialized=false;double savedX=Double.NaN,savedY=Double.NaN;
  IntPtr handle;bool layoutQueued,lastShowPet=true,lastAnyVisible=true,readySent;IDictionary<string,object> lastState;
  readonly object inputGate=new object();IDictionary<string,object> pendingState,pendingFrame;bool inputQueued;string queuedAssetKey="";
  static IDictionary<string,object> Map(object o){return o as IDictionary<string,object>??new Dictionary<string,object>();}
  static object Get(IDictionary<string,object> m,string k,object fallback=null){object v;return m.TryGetValue(k,out v)?v:fallback;}
  static string Str(IDictionary<string,object> m,string k,string f=""){return Convert.ToString(Get(m,k,f));}
  static bool Bool(IDictionary<string,object> m,string k){var value=Get(m,k,false);return value is bool&&(bool)value;}
  static double Num(IDictionary<string,object> m,string k,double f){try {return Convert.ToDouble(Get(m,k,f));}catch{return f;}}
  static void Emit(string message){try{Console.WriteLine(message);Console.Out.Flush();}catch{}}
  static string AssetKey(IDictionary<string,object> state){return Str(Map(Get(state,"route")),"art")+"|"+Str(state,"image");}
  static double SystemScale(){return GetDpiForSystem()/96.0;}
  double WindowScale(){return handle==IntPtr.Zero?SystemScale():GetDpiForWindow(handle)/96.0;}
  Rect Bounds(){
    if(handle==IntPtr.Zero)new WindowInteropHelper(this).EnsureHandle();
    NativeRect rect;GetWindowRect(handle,out rect);return new Rect(rect.Left,rect.Top,rect.Right-rect.Left,rect.Bottom-rect.Top);
  }
  static Rect WorkArea(Rect bounds){
    var rect=new NativeRect {Left=(int)Math.Floor(bounds.Left),Top=(int)Math.Floor(bounds.Top),Right=(int)Math.Ceiling(bounds.Right),Bottom=(int)Math.Ceiling(bounds.Bottom)};
    var info=new MonitorInfo {Size=Marshal.SizeOf(typeof(MonitorInfo))};
    if(GetMonitorInfo(MonitorFromRect(ref rect,2),ref info))return new Rect(info.Work.Left,info.Work.Top,info.Work.Right-info.Work.Left,info.Work.Bottom-info.Work.Top);
    var work=SystemParameters.WorkArea;double scale=SystemScale();return new Rect(work.Left*scale,work.Top*scale,work.Width*scale,work.Height*scale);
  }
  static Rect FitBounds(Rect bounds,Rect work){
    double width=Math.Min(bounds.Width,work.Width),height=Math.Min(bounds.Height,work.Height);
    return new Rect(Math.Max(work.Left,Math.Min(work.Right-width,bounds.Left)),Math.Max(work.Top,Math.Min(work.Bottom-height,bounds.Top)),width,height);
  }
  void SetBounds(Rect bounds,bool moveOnly=false){SetWindowPos(handle,IntPtr.Zero,(int)Math.Round(bounds.Left),(int)Math.Round(bounds.Top),(int)Math.Round(bounds.Width),(int)Math.Round(bounds.Height),0x14u|(moveOnly?1u:0u));}
  IntPtr WindowMessage(IntPtr window,int message,IntPtr wParam,IntPtr lParam,ref bool handled){
    if((message==0x02e0||message==0x007e||message==0x001a)&&lastState!=null&&!layoutQueued){
      layoutQueued=true;Dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.Loaded,new Action(()=>{layoutQueued=false;if(lastState!=null)Apply(lastState);}));
    }
    return IntPtr.Zero;
  }
  void Queue(IDictionary<string,object> state){
    lock(inputGate){
      if(Str(state,"type")=="frame")pendingFrame=state;
      else {var key=AssetKey(state);if(key!=queuedAssetKey)pendingFrame=null;queuedAssetKey=key;pendingState=state;}
      if(inputQueued)return;inputQueued=true;
    }
    Dispatcher.BeginInvoke(new Action(()=>{
      IDictionary<string,object> statePacket,framePacket;
      lock(inputGate){statePacket=pendingState;framePacket=pendingFrame;pendingState=null;pendingFrame=null;inputQueued=false;}
      try{if(statePacket!=null)Apply(statePacket);if(framePacket!=null)Apply(framePacket);}catch{}
    }));
  }
  KujiraPet(){
    Title="Kujira 桌宠";Width=290;Height=540;AllowsTransparency=true;WindowStyle=WindowStyle.None;Background=Brushes.Transparent;Topmost=true;ShowActivated=false;ShowInTaskbar=false;ResizeMode=ResizeMode.NoResize;
    Content=canvas;bubbleScroll.Content=text;bubble.Child=bubbleScroll;canvas.Children.Add(bubble);canvas.Children.Add(image);
    BindDrag(image,true);BindDrag(bubble,false);
    // Keep native MenuItem input behavior; DSH supplies the visual theme.
    var petItem=new MenuItem();var bubbleItem=new MenuItem();var close=new MenuItem { Header="全部关闭" };
    petItem.Click+=(s,e)=>Emit(json.Serialize(new {type="action",action="toggle-pet"}));
    bubbleItem.Click+=(s,e)=>Emit(json.Serialize(new {type="action",action="toggle-bubble"}));
    close.Click+=(s,e)=>Emit(json.Serialize(new {type="action",action="close"}));
    menu.Items.Add(petItem);menu.Items.Add(bubbleItem);menu.Items.Add(close);
    menu.Opened+=(s,e)=>{
      var cfg=Map(Get(lastState??new Dictionary<string,object>(),"config"));
      petItem.Header=ShowPet(cfg)?"隐藏桌宠":"显示桌宠";
      bubbleItem.Header=Str(cfg,"bubble","always")=="hidden"?"显示气泡":"隐藏气泡";
    };
    image.ContextMenu=menu;bubble.ContextMenu=menu;
    SourceInitialized+=(s,e)=>{handle=new WindowInteropHelper(this).Handle;HwndSource.FromHwnd(handle).AddHook(WindowMessage);};
    Loaded+=(s,e)=>{if(!initialized){var work=WorkArea(Bounds());double scale=WindowScale();SetBounds(FitBounds(new Rect(work.Right-(Width+24)*scale,work.Bottom-(Height+16)*scale,Width*scale,Height*scale),work));}if(!readySent){readySent=true;Emit("{\"type\":\"ready\"}");}};
  }
  static Brush ThemeBrush(IDictionary<string,object> theme,string key){
    string value=Str(theme,key);
    if(value.Length!=7||value[0]!='#')return null;
    try{var brush=new SolidColorBrush((Color)ColorConverter.ConvertFromString(value));brush.Freeze();return brush;}catch{return null;}
  }
  MenuGeometry menuGeometry;
  sealed class MenuGeometry {
    public double[] SurfaceRadius,SurfacePadding,SurfaceBorderWidth,ItemRadius,ItemPadding;
    public double SurfaceMinWidth,ItemMinHeight,FontSize,FontWeight,LineHeight;
    public FontFamily FontFamily;
  }
  static bool Metric(double value){return !Double.IsNaN(value)&&!Double.IsInfinity(value)&&value>=0;}
  static double[] ThemeQuad(IDictionary<string,object> geometry,string key){
    var values=Get(geometry,key) as IList;if(values==null||values.Count!=4)return null;
    var result=new double[4];
    for(int i=0;i<4;i++){try{result[i]=Convert.ToDouble(values[i]);}catch{return null;}if(!Metric(result[i]))return null;}
    return result;
  }
  static FontFamily ThemeFont(string family){
    var names=new List<string>();
    foreach(var entry in family.Split(',')){
      string name=entry.Trim().Trim('\"','\'');
      if(name=="system-ui"||name=="-apple-system"||name=="BlinkMacSystemFont")name="Segoe UI";
      else if(name=="sans-serif")name="Global User Interface";
      else if(name=="serif")name="Global Serif";
      else if(name=="monospace")name="Global Monospace";
      if(name!=""&&!names.Contains(name))names.Add(name);
    }
    return names.Count==0?null:new FontFamily(String.Join(", ",names.ToArray()));
  }
  static MenuGeometry ReadMenuGeometry(object value){
    var m=Map(value);var g=new MenuGeometry {
      SurfaceRadius=ThemeQuad(m,"surfaceRadius"),SurfacePadding=ThemeQuad(m,"surfacePadding"),SurfaceBorderWidth=ThemeQuad(m,"surfaceBorderWidth"),
      ItemRadius=ThemeQuad(m,"itemRadius"),ItemPadding=ThemeQuad(m,"itemPadding"),
      SurfaceMinWidth=Num(m,"surfaceMinWidth",Double.NaN),ItemMinHeight=Num(m,"itemMinHeight",Double.NaN),
      FontSize=Num(m,"fontSize",Double.NaN),FontWeight=Num(m,"fontWeight",Double.NaN),LineHeight=Num(m,"lineHeight",Double.NaN)
    };
    if(g.SurfaceRadius==null||g.SurfacePadding==null||g.SurfaceBorderWidth==null||g.ItemRadius==null||g.ItemPadding==null||
       !Metric(g.SurfaceMinWidth)||!Metric(g.ItemMinHeight)||!Metric(g.FontSize)||g.FontSize==0||
       !Metric(g.FontWeight)||g.FontWeight<1||g.FontWeight>999||!Metric(g.LineHeight)||g.LineHeight==0)return null;
    try{g.FontFamily=ThemeFont(Str(m,"fontFamily"));}catch{return null;}
    return g.FontFamily==null?null:g;
  }
  static Thickness ThemeThickness(double[] css){return new Thickness(css[3],css[0],css[1],css[2]);}
  static CornerRadius ThemeRadius(double[] css){return new CornerRadius(css[0],css[1],css[2],css[3]);}
  void ApplyMenuTheme(IDictionary<string,object> state){
    var theme=Map(Get(state,"menuTheme"));
    string key=Str(theme,"background")+"|"+Str(theme,"foreground")+"|"+Str(theme,"border")+"|"+Str(theme,"hover")+"|"+Str(theme,"hoverForeground")+"|"+json.Serialize(Get(theme,"geometry"));
    if(key==menuThemeKey)return;
    var background=ThemeBrush(theme,"background");var foreground=ThemeBrush(theme,"foreground");
    var border=ThemeBrush(theme,"border");var hover=ThemeBrush(theme,"hover");var hoverForeground=ThemeBrush(theme,"hoverForeground");
    if(background==null||foreground==null||border==null||hover==null||hoverForeground==null)return;
    var geometryValue=Get(theme,"geometry");
    // A partial geometry snapshot must not block valid color updates. Keep the last complete geometry.
    var geometry=(geometryValue==null?null:ReadMenuGeometry(geometryValue))??menuGeometry;
    menu.Background=background;menu.Foreground=foreground;menu.BorderBrush=border;
    if(geometry!=null){
      // One rounded surface paints the popup; no system square background remains behind it.
      menu.Background=Brushes.Transparent;menu.Padding=ThemeThickness(geometry.SurfacePadding);
      menu.BorderThickness=ThemeThickness(geometry.SurfaceBorderWidth);menu.MinWidth=geometry.SurfaceMinWidth;
      menu.FontFamily=geometry.FontFamily;menu.FontSize=geometry.FontSize;menu.FontWeight=FontWeight.FromOpenTypeWeight((int)geometry.FontWeight);
      var surfaceTemplate=new ControlTemplate(typeof(ContextMenu));
      var surface=new FrameworkElementFactory(typeof(Border),"DshMenuSurface");
      surface.SetValue(Border.BackgroundProperty,background);surface.SetValue(Border.BorderBrushProperty,border);
      surface.SetValue(Border.BorderThicknessProperty,new TemplateBindingExtension(Control.BorderThicknessProperty));
      surface.SetValue(Border.PaddingProperty,new TemplateBindingExtension(Control.PaddingProperty));
      surface.SetValue(Border.CornerRadiusProperty,ThemeRadius(geometry.SurfaceRadius));
      surface.AppendChild(new FrameworkElementFactory(typeof(ItemsPresenter)));surfaceTemplate.VisualTree=surface;
      menu.Template=surfaceTemplate;
    }else{
      menu.ClearValue(Control.TemplateProperty);menu.ClearValue(Control.PaddingProperty);menu.ClearValue(Control.BorderThicknessProperty);
      menu.ClearValue(FrameworkElement.MinWidthProperty);menu.ClearValue(Control.FontFamilyProperty);menu.ClearValue(Control.FontSizeProperty);menu.ClearValue(Control.FontWeightProperty);
    }
    menu.Resources[SystemColors.MenuBrushKey]=background;menu.Resources[SystemColors.MenuTextBrushKey]=foreground;
    menu.Resources[SystemColors.HighlightBrushKey]=hover;menu.Resources[SystemColors.HighlightTextBrushKey]=hoverForeground;
    // Aero's built-in item template paints its own fixed hover brush. Keep MenuItem behavior,
    // replacing only that visual with a header and a border bound to the supplied DSH colors.
    var template=new ControlTemplate(typeof(MenuItem));
    var itemBorder=new FrameworkElementFactory(typeof(Border),"DshMenuBorder");
    itemBorder.SetValue(Border.BackgroundProperty,new TemplateBindingExtension(Control.BackgroundProperty));
    itemBorder.SetValue(Border.PaddingProperty,geometry==null?new Thickness(12,6,12,6):ThemeThickness(geometry.ItemPadding));
    if(geometry!=null)itemBorder.SetValue(Border.CornerRadiusProperty,ThemeRadius(geometry.ItemRadius));
    var header=new FrameworkElementFactory(geometry==null?typeof(ContentPresenter):typeof(TextBlock));
    if(geometry==null){header.SetValue(ContentPresenter.ContentSourceProperty,"Header");header.SetValue(ContentPresenter.RecognizesAccessKeyProperty,true);}
    else{
      header.SetBinding(TextBlock.TextProperty,new System.Windows.Data.Binding("Header"){RelativeSource=System.Windows.Data.RelativeSource.TemplatedParent});
      header.SetValue(TextBlock.LineHeightProperty,geometry.LineHeight);
      header.SetValue(TextBlock.LineStackingStrategyProperty,LineStackingStrategy.BlockLineHeight);
    }
    header.SetValue(FrameworkElement.HorizontalAlignmentProperty,HorizontalAlignment.Left);
    header.SetValue(FrameworkElement.VerticalAlignmentProperty,VerticalAlignment.Center);
    itemBorder.AppendChild(header);template.VisualTree=itemBorder;
    var itemStyle=new Style(typeof(MenuItem));
    itemStyle.Setters.Add(new Setter(Control.TemplateProperty,template));
    if(geometry!=null){
      itemStyle.Setters.Add(new Setter(FrameworkElement.MinHeightProperty,geometry.ItemMinHeight));
      itemStyle.Setters.Add(new Setter(Control.FontFamilyProperty,geometry.FontFamily));
      itemStyle.Setters.Add(new Setter(Control.FontSizeProperty,geometry.FontSize));
      itemStyle.Setters.Add(new Setter(Control.FontWeightProperty,FontWeight.FromOpenTypeWeight((int)geometry.FontWeight)));
    }
    itemStyle.Setters.Add(new Setter(Control.BackgroundProperty,Brushes.Transparent));
    itemStyle.Setters.Add(new Setter(Control.ForegroundProperty,foreground));
    var highlighted=new Trigger { Property=MenuItem.IsHighlightedProperty,Value=true };
    highlighted.Setters.Add(new Setter(Control.BackgroundProperty,hover));
    highlighted.Setters.Add(new Setter(Control.ForegroundProperty,hoverForeground));
    itemStyle.Triggers.Add(highlighted);menu.Resources[typeof(MenuItem)]=itemStyle;menuGeometry=geometry;menuThemeKey=key;
  }
  static bool ShowPet(IDictionary<string,object> cfg){return !cfg.ContainsKey("showPet")||Bool(cfg,"showPet");}
  void BindDrag(FrameworkElement target,bool interact){
    target.MouseLeftButtonDown+=(s,e)=>{origin=PointToScreen(e.GetPosition(this));pressed=true;pressedElement=target;target.CaptureMouse();e.Handled=true;};
    target.LostMouseCapture+=(s,e)=>{if(pressedElement==target){pressed=false;pressedElement=null;}};
    target.MouseMove+=(s,e)=>{
      if(!pressed||pressedElement!=target||e.LeftButton!=MouseButtonState.Pressed)return;
      if((PointToScreen(e.GetPosition(this))-origin).Length<4)return;
      pressed=false;target.ReleaseMouseCapture();
      if(interact)Emit(json.Serialize(new {type="action",action="drag-start"}));
      try{DragMove();}catch{}
      if(lastState!=null)Apply(lastState);var bounds=Bounds();double scale=SystemScale();
      Emit(json.Serialize(new {type="action",action="position",x=bounds.Left/scale,y=bounds.Top/scale}));
      if(interact)Emit(json.Serialize(new {type="action",action="drag-end"}));
    };
    target.MouseLeftButtonUp+=(s,e)=>{
      if(!pressed||pressedElement!=target)return;pressed=false;target.ReleaseMouseCapture();
      if(!interact)return;
      var point=e.GetPosition(image);string clip=point.Y/image.ActualHeight<.45?"head_pat":point.X/image.ActualWidth>.72&&point.Y/image.ActualHeight>.55?"tail":"poke";
      Emit(json.Serialize(new {type="action",action="interact",clip=clip}));
    };
  }
  static double Item(IList list,int index){return Convert.ToDouble(list[index]);}
  BitmapSource Sheet(string path){
    BitmapSource value;if(sheets.TryGetValue(path,out value))return value;
    var bitmap=new BitmapImage();bitmap.BeginInit();bitmap.CacheOption=BitmapCacheOption.OnLoad;bitmap.UriSource=new Uri(path,UriKind.Absolute);bitmap.EndInit();bitmap.Freeze();
    sheets[path]=bitmap;return bitmap;
  }
  Drawing DrawLayer(IDictionary<string,object> layer){
    var rect=Get(layer,"rect") as IList;var at=Get(layer,"at") as IList;var size=Get(layer,"size") as IList;
    if(rect==null||at==null)return null;
    var cropped=new CroppedBitmap(Sheet(Str(layer,"image")),new Int32Rect((int)Item(rect,0),(int)Item(rect,1),(int)Item(rect,2),(int)Item(rect,3)));cropped.Freeze();
    var drawing=new DrawingGroup();drawing.Opacity=Math.Max(0,Math.Min(1,Num(layer,"opacity",1)));
    drawing.Children.Add(new ImageDrawing(cropped,new Rect(Item(at,0),Item(at,1),size==null?Item(rect,2):Item(size,0),size==null?Item(rect,3):Item(size,1))));
    drawing.Freeze();return drawing;
  }
  void DrawFrame(IDictionary<string,object> state){
    var size=Get(state,"canvas") as IList;if(size==null)return;
    var drawing=new DrawingGroup();
    drawing.Children.Add(new GeometryDrawing(Brushes.Transparent,null,new RectangleGeometry(new Rect(0,0,Item(size,0),Item(size,1)))));
    var layers=Get(state,"layers") as IList;
    if(layers!=null){foreach(var layer in layers){var item=DrawLayer(Map(layer));if(item!=null)drawing.Children.Add(item);}}
    else {var item=DrawLayer(state);if(item!=null)drawing.Children.Add(item);}
    drawing.Freeze();var source=new DrawingImage(drawing);source.Freeze();image.Source=source;
  }
  public void Apply(IDictionary<string,object> state){
    if(Str(state,"type")=="frame"){DrawFrame(state);return;}
    lastState=state;ApplyMenuTheme(state);
    var cfg=Map(Get(state,"config"));var route=Map(Get(state,"route"));var task=Map(Get(state,"task"));var usage=Map(Get(state,"usage"));
    string persona=Str(route,"name","Kujira"),phase=Str(task,"phase","idle");Title="Kujira · "+persona+" · "+phase;
    string path=Str(state,"image"),key=AssetKey(state);if(key!=assetKey){sheets.Clear();image.Source=null;assetKey=key;}
    if(!Bool(state,"animated")&&image.Source==null&&path!="")try{image.Source=Sheet(path);}catch{}
    var before=Bounds();
    double nextX=Get(cfg,"desktopX")==null?Double.NaN:Num(cfg,"desktopX",Double.NaN);
    double nextY=Get(cfg,"desktopY")==null?Double.NaN:Num(cfg,"desktopY",Double.NaN);
    bool positionChanged=!nextX.Equals(savedX)||!nextY.Equals(savedY),restore=!initialized||positionChanged;
    double systemScale=SystemScale();
    // Saved coordinates retain the original system-DPI units. HWND placement is physical.
    if(restore&&(!Double.IsNaN(nextX)||!Double.IsNaN(nextY)))SetBounds(new Rect(Double.IsNaN(nextX)?before.Left:nextX*systemScale,Double.IsNaN(nextY)?before.Top:nextY*systemScale,before.Width,before.Height),true);
    var work=WorkArea(Bounds());double dpi=WindowScale();
    double scale=Num(cfg,"scale",1);image.Width=190*scale;image.Height=image.Width*380/320;
    bubble.Width=Math.Min(work.Width/dpi,Math.Min(280,245*Num(cfg,"bubbleScale",1)));text.FontSize=13*Num(cfg,"bubbleScale",1);
    var sb=new StringBuilder(persona+"\n"+Str(task,"text","等你开始"));
    var progress=Map(Get(task,"progress"));if(progress.Count>0)sb.Append("\n"+Get(progress,"done",0)+" / "+Get(progress,"total",0)+" 项");
    var stats=Map(Get(state,"stats"));
    if(Bool(cfg,"showStats")&&phase!="idle"){
      var readings=Get(stats,"lines") as IEnumerable;
      if(readings!=null){sb.Append("\n");foreach(var line in readings)sb.Append("\n"+line);}
    }
    if(Bool(cfg,"showUsage")&&usage.Count>0){sb.Append("\n\n"+Str(usage,"title"));var lines=Get(usage,"lines") as IEnumerable;if(lines!=null)foreach(var line in lines)sb.Append("\n"+line);}
    text.Text=sb.ToString();var bm=Str(cfg,"bubble","always");
    bool showPet=ShowPet(cfg),showBubble=bm!="hidden"&&(bm!="tasks"||phase!="idle");
    image.Visibility=showPet?Visibility.Visible:Visibility.Collapsed;
    image.IsHitTestVisible=showPet;
    bubble.Visibility=showBubble?Visibility.Visible:Visibility.Collapsed;
    bubble.IsHitTestVisible=showBubble;
    double petHeight=showPet?image.Height:0;
    bubble.MaxHeight=Math.Max(1,work.Height/dpi-petHeight);
    if(showBubble){
      // Text changes invalidate the child first; measure both ancestors now, before sizing the HWND.
      bubbleScroll.InvalidateMeasure();bubble.InvalidateMeasure();bubble.UpdateLayout();
      bubble.Measure(new Size(bubble.Width,bubble.MaxHeight));
    }
    double bubbleHeight=showBubble?bubble.DesiredSize.Height:0;
    Width=Math.Min(work.Width/dpi,Math.Max(1,Math.Max(showPet?image.Width:0,showBubble?bubble.Width:0)));
    Height=Math.Min(work.Height/dpi,Math.Max(1,petHeight+bubbleHeight));
    Canvas.SetLeft(image,(Width-image.Width)/2);Canvas.SetTop(image,bubbleHeight);
    Canvas.SetLeft(bubble,(Width-bubble.Width)/2);Canvas.SetTop(bubble,0);
    bool keepPosition=showPet!=lastShowPet||!lastAnyVisible||(!showPet&&!showBubble);
    // Visibility toggles retain the user position; ordinary bubble updates retain the desktop bottom-right anchor.
    double x=restore?(Double.IsNaN(nextX)?work.Right-(Width+24)*dpi:nextX*systemScale):(keepPosition?before.Left:before.Right-Width*dpi);
    double y=restore?(Double.IsNaN(nextY)?work.Bottom-(Height+16)*dpi:nextY*systemScale):(keepPosition?before.Top:before.Bottom-Height*dpi);
    SetBounds(FitBounds(new Rect(Math.Round(x),Math.Round(y),Math.Ceiling(Width*dpi),Math.Ceiling(Height*dpi)),work));
    savedX=nextX;savedY=nextY;lastShowPet=showPet;lastAnyVisible=showPet||showBubble;
    var pulse=Map(Get(task,"pulse"));string pulseId=Str(pulse,"id");
    if(initialized&&Bool(cfg,"sound")&&((phase!=lastPhase&&(phase=="completed"||phase=="error"))||(pulseId!=""&&pulseId!=lastPulse&&Str(pulse,"kind")=="error")))System.Media.SystemSounds.Asterisk.Play();
    lastPulse=pulseId;lastPhase=phase;initialized=true;
    if(showPet||showBubble){if(!IsVisible)Show();}else Hide();
  }
  [STAThread] public static void Main(){ Console.SetIn(new StreamReader(Console.OpenStandardInput(),new UTF8Encoding(false))); Console.SetOut(new StreamWriter(Console.OpenStandardOutput(),new UTF8Encoding(false)){AutoFlush=true});
    bool owned;using(var mutex=new Mutex(true,"Local\\KujiraSinglePet-"+Environment.UserName,out owned)){
      if(!owned){Emit("{\"type\":\"already-open\"}");return;}
      var app=new Application();var w=new KujiraPet();
      var thread=new Thread(()=>{var input=new JavaScriptSerializer();string line;try{while((line=Console.ReadLine())!=null)try{w.Queue(Map(input.DeserializeObject(line)));}catch{}}catch{}finally{if(!app.Dispatcher.HasShutdownStarted)app.Dispatcher.BeginInvoke(new Action(()=>app.Shutdown()));}});thread.IsBackground=true;thread.Start();app.Run(w);mutex.ReleaseMutex();
    }
  }
}


