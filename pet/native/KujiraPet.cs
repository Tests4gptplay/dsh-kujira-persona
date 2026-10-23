// Build-only source. Shipped EXE has no QA routines.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Media.Animation;
public class KujiraPet : Window {
  readonly JavaScriptSerializer json=new JavaScriptSerializer();
  readonly Image image=new Image { Stretch=Stretch.Uniform,Width=210,Height=250 };
  readonly TextBlock text=new TextBlock { TextWrapping=TextWrapping.Wrap,Foreground=new SolidColorBrush(Color.FromRgb(42,57,75)),FontSize=14 };
  readonly Border bubble=new Border { Background=new SolidColorBrush(Color.FromRgb(255,253,248)),CornerRadius=new CornerRadius(16),Padding=new Thickness(15),BorderBrush=new SolidColorBrush(Color.FromRgb(218,211,204)),BorderThickness=new Thickness(1),Width=250 };
  readonly Canvas canvas=new Canvas();
  readonly TranslateTransform motion=new TranslateTransform();
  string imagePath="",lastPhase="idle";bool moved=false;Point origin;bool initialized=false;double savedX=Double.NaN,savedY=Double.NaN;
  static IDictionary<string,object> Map(object o){return o as IDictionary<string,object>??new Dictionary<string,object>();}
  static object Get(IDictionary<string,object> m,string k,object fallback=null){object v;return m.TryGetValue(k,out v)?v:fallback;}
  static string Str(IDictionary<string,object> m,string k,string f=""){return Convert.ToString(Get(m,k,f));}
  static bool Bool(IDictionary<string,object> m,string k){return Get(m,k,false) is bool&&(bool)Get(m,k);}
  static double Num(IDictionary<string,object> m,string k,double f){try {return Convert.ToDouble(Get(m,k,f));}catch{return f;}}
  static void Emit(string message){try{Console.WriteLine(message);Console.Out.Flush();}catch{}}
  KujiraPet(){
    Title="Kujira 桌宠";Width=290;Height=540;AllowsTransparency=true;WindowStyle=WindowStyle.None;Background=Brushes.Transparent;Topmost=true;ShowActivated=false;ShowInTaskbar=false;ResizeMode=ResizeMode.NoResize;
    Content=canvas;bubble.Child=text;canvas.Children.Add(bubble);canvas.Children.Add(image);image.RenderTransform=motion;
    image.MouseLeftButtonDown+=(s,e)=>{origin=PointToScreen(e.GetPosition(this));moved=false;try{DragMove();var end=PointToScreen(e.GetPosition(this));moved=(end-origin).Length>4;}catch{};if(moved)Emit(json.Serialize(new {type="action",action="position",x=Left,y=Top}));else if(GetCurrentMotion())Bounce();};
    var menu=new ContextMenu();var refresh=new MenuItem { Header="刷新余额／套餐" };refresh.Click+=(s,e)=>Emit("{\"type\":\"action\",\"action\":\"refresh\"}");
    var close=new MenuItem { Header="关闭桌宠" };close.Click+=(s,e)=>{Emit("{\"type\":\"action\",\"action\":\"close\"}");Close();};menu.Items.Add(refresh);menu.Items.Add(close);image.ContextMenu=menu;
    Loaded+=(s,e)=>{if(!initialized){Left=Math.Max(0,SystemParameters.WorkArea.Right-Width-24);Top=Math.Max(0,SystemParameters.WorkArea.Bottom-Height-16);}Emit("{\"type\":\"ready\"}");};
  }
  bool reduced=false;string activity="normal";
  bool GetCurrentMotion(){return !reduced;}
  void Bounce(){var a=new DoubleAnimationUsingKeyFrames();a.Duration=TimeSpan.FromMilliseconds(600);a.KeyFrames.Add(new LinearDoubleKeyFrame(0,KeyTime.FromPercent(0)));a.KeyFrames.Add(new LinearDoubleKeyFrame(-12,KeyTime.FromPercent(.4)));a.KeyFrames.Add(new LinearDoubleKeyFrame(0,KeyTime.FromPercent(1)));a.Completed+=(s,e)=>StartMotion();motion.BeginAnimation(TranslateTransform.YProperty,a);}
  void StartMotion(){motion.BeginAnimation(TranslateTransform.YProperty,null);if(reduced)return;var a=new DoubleAnimation(0,activity=="quiet"?-2:-5,TimeSpan.FromSeconds(activity=="quiet"?4.5:activity=="lively"?1.4:2.5)){AutoReverse=true,RepeatBehavior=RepeatBehavior.Forever};motion.BeginAnimation(TranslateTransform.YProperty,a);}
  public void Apply(IDictionary<string,object> state){
    var cfg=Map(Get(state,"config"));var route=Map(Get(state,"route"));var task=Map(Get(state,"task"));var usage=Map(Get(state,"usage"));
    string persona=Str(route,"name","Kujira"),phase=Str(task,"phase","idle");Title="Kujira · "+persona+" · "+phase;
    var path=Str(state,"image");if(path!=imagePath){try{var bitmap=new BitmapImage();bitmap.BeginInit();bitmap.CacheOption=BitmapCacheOption.OnLoad;bitmap.UriSource=new Uri(path,UriKind.Absolute);bitmap.EndInit();bitmap.Freeze();image.Source=bitmap;imagePath=path;}catch{}}
    double scale=Num(cfg,"scale",1);image.Width=190*scale;image.Height=image.Width*380/320; double right=Left+Width,bottom=Top+Height; Width=Math.Max(290,image.Width+20);
    Canvas.SetLeft(image,(Width-image.Width)/2);Canvas.SetTop(image,Height-image.Height-5);
    bubble.Width=Math.Min(280,245*Num(cfg,"bubbleScale",1));text.FontSize=13*Num(cfg,"bubbleScale",1);
    Canvas.SetLeft(bubble,(Width-bubble.Width)/2);Canvas.SetBottom(bubble,image.Height-5);
    bool nextReduced=Bool(cfg,"reducedMotion");string nextActivity=Str(cfg,"activity","normal");if(!initialized||reduced!=nextReduced||activity!=nextActivity){reduced=nextReduced;activity=nextActivity;StartMotion();}
    var sb=new StringBuilder(persona+"\n"+Str(task,"text","等你开始"));
    var progress=Map(Get(task,"progress"));if(progress.Count>0)sb.Append("\n"+Get(progress,"done",0)+" / "+Get(progress,"total",0)+" 项");
    var stats=Map(Get(state,"stats"));
    if(Bool(cfg,"showStats")&&phase!="idle"){
      var readings=Get(stats,"lines") as IEnumerable;
      if(readings!=null){sb.Append("\n");foreach(var line in readings)sb.Append("\n"+line);}
    }
    if(Bool(cfg,"showUsage")&&usage.Count>0){sb.Append("\n\n"+Str(usage,"title"));var lines=Get(usage,"lines") as IEnumerable;if(lines!=null)foreach(var line in lines)sb.Append("\n"+line);}
    text.Text=sb.ToString();var bm=Str(cfg,"bubble","always");bubble.Visibility=bm=="hidden"||(bm=="tasks"&&phase=="idle")?Visibility.Hidden:Visibility.Visible;
    bubble.Measure(new Size(bubble.Width,Double.PositiveInfinity));
    var work=SystemParameters.WorkArea;
    Height=Math.Min(work.Height,Math.Max(image.Height+24,image.Height+(bubble.Visibility==Visibility.Visible?bubble.DesiredSize.Height:0)+20));
    Canvas.SetTop(image,Height-image.Height-5);
    double nextX=Get(cfg,"desktopX")==null?Double.NaN:Num(cfg,"desktopX",Double.NaN);
    double nextY=Get(cfg,"desktopY")==null?Double.NaN:Num(cfg,"desktopY",Double.NaN);
    bool positionChanged=!nextX.Equals(savedX)||!nextY.Equals(savedY);
    if(!initialized||positionChanged){Left=Double.IsNaN(nextX)?work.Right-Width-24:nextX;Top=Double.IsNaN(nextY)?work.Bottom-Height-16:nextY;}
    else {Left=right-Width;Top=bottom-Height;}
    Left=Math.Max(work.Left,Math.Min(work.Right-Width,Left));Top=Math.Max(work.Top,Math.Min(work.Bottom-Height,Top));
    savedX=nextX;savedY=nextY;
    if(initialized&&Bool(cfg,"sound")&&phase!=lastPhase&&(phase=="completed"||phase=="error"))System.Media.SystemSounds.Asterisk.Play();
    lastPhase=phase;initialized=true;
  }
  [STAThread] public static void Main(){ Console.SetIn(new StreamReader(Console.OpenStandardInput(),new UTF8Encoding(false))); Console.SetOut(new StreamWriter(Console.OpenStandardOutput(),new UTF8Encoding(false)){AutoFlush=true});
    bool owned;using(var mutex=new Mutex(true,"Local\\KujiraSinglePet-"+Environment.UserName,out owned)){
      if(!owned){Emit("{\"type\":\"already-open\"}");return;}
      var app=new Application();var w=new KujiraPet();
      var thread=new Thread(()=>{string line;try{while((line=Console.ReadLine())!=null){var captured=line;app.Dispatcher.BeginInvoke(new Action(()=>{try{w.Apply(Map(w.json.DeserializeObject(captured)));}catch{}}));}}catch{}finally{app.Dispatcher.BeginInvoke(new Action(()=>app.Shutdown()));}});thread.IsBackground=true;thread.Start();app.Run(w);mutex.ReleaseMutex();
    }
  }
}
