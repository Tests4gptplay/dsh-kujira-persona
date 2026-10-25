import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
const source=readFileSync(new URL('../../pet/native/KujiraPet.cs',import.meta.url),'utf8')
test('native source contract: exactly three shared WPF menu actions',()=>{
  assert.equal((source.match(/menu.Items.Add\(/g)||[]).length,3)
  for(const action of ['toggle-pet','toggle-bubble','close'])assert.ok(source.includes(`action="${action}"`))
  assert.ok(source.includes('image.ContextMenu=menu;bubble.ContextMenu=menu'))
  assert.ok(!source.includes('刷新余额／套餐'))
})
test('native source contract: visibility determines window size and hit testing',()=>{
  assert.ok(source.includes('image.Visibility=showPet?Visibility.Visible:Visibility.Collapsed'))
  assert.ok(source.includes('image.IsHitTestVisible=showPet'))
  assert.ok(source.includes('petHeight=showPet?image.Height:0'))
  assert.ok(source.includes('showPet?image.Width:0'))
  assert.ok(source.includes('Math.Max(1,petHeight+bubbleHeight)'))
  assert.ok(source.includes('if(showPet||showBubble){if(!IsVisible)Show();}else Hide()'))
  assert.ok(!source.includes('Visibility.Hidden'))
})
test('native source contract: both surfaces drag and restored geometry clamps',()=>{
  assert.ok(source.includes('BindDrag(image,true);BindDrag(bubble,false)'))
  assert.ok(source.includes('keepPosition?before.Left'))
  assert.ok(source.includes('keepPosition?before.Top'))
  assert.ok(source.includes('SetBounds(FitBounds('))
  assert.ok(source.includes('lastShowPet=showPet'))
})

test('native source contract: DSH colors bridge into standard WPF styles, without custom templates',()=>{
  assert.ok(source.includes('Map(Get(state,"menuTheme"))'))
  for(const key of ['background','foreground','border','hover','hoverForeground'])assert.ok(source.includes(`ThemeBrush(theme,"${key}")`))
  assert.ok(source.includes('Property=MenuItem.IsHighlightedProperty'))
  assert.ok(source.includes('menu.Resources[SystemColors.HighlightBrushKey]=hover'))
  assert.ok(!source.includes('ControlTemplate'))
})
test('native source contract: ready is once-only and initialized precedes showing',()=>{
  assert.ok(source.includes('if(!readySent){readySent=true;Emit('))
  assert.ok(source.indexOf('lastPulse=pulseId;lastPhase=phase;initialized=true;')<source.indexOf('if(showPet||showBubble){if(!IsVisible)Show();}else Hide();'))
})

test('native source contract: long bubbles scroll within available work area',()=>{
  assert.ok(source.includes('VerticalScrollBarVisibility=ScrollBarVisibility.Auto'))
  assert.ok(source.includes('bubble.MaxHeight=Math.Max(1,work.Height/dpi-petHeight)'))
  assert.ok(source.includes('bubble.Measure(new Size(bubble.Width,bubble.MaxHeight))'))
})
