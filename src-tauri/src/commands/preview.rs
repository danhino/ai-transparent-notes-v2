use tauri::Manager;

fn temp_html_path() -> std::path::PathBuf {
    std::env::temp_dir().join("ai-notes-preview.html")
}

fn file_url(path: &std::path::Path) -> String {
    format!("file:///{}", path.to_string_lossy().replace('\\', "/"))
}

fn toolbar_script(url: &str) -> String {
    // Use placeholder replacement to avoid escaping every JS brace in format!
    let safe_url = url.replace('\'', "\\'");
    r#"(function(){
  function inject(){
    if(document.getElementById('__ai-bar__'))return;
    var bar=document.createElement('div');
    bar.id='__ai-bar__';
    bar.style.cssText='position:fixed;top:0;left:0;right:0;height:38px;background:#16161e;border-bottom:1px solid #45475a;display:flex;align-items:center;gap:8px;padding:0 12px;z-index:2147483647;font-family:system-ui,sans-serif;box-sizing:border-box;';
    var title=document.createElement('span');
    title.textContent='HTML Preview';
    title.style.cssText='color:#89b4fa;font-size:13px;flex:1;';
    function btn(label,fn){
      var b=document.createElement('button');
      b.textContent=label;
      b.style.cssText='background:#313244;color:#cdd6f4;border:1px solid #45475a;padding:3px 12px;cursor:pointer;border-radius:3px;font-size:12px;height:26px;font-family:inherit;';
      b.onmouseover=function(){b.style.background='#45475a';};
      b.onmouseout=function(){b.style.background='#313244';};
      b.onclick=fn;
      return b;
    }
    bar.appendChild(title);
    bar.appendChild(btn('Refresh',function(){window.location.href='__FILE_URL__';}));
    bar.appendChild(btn('Open in browser',function(){
      try{window.__TAURI_INTERNALS__.invoke('plugin:shell|open',{path:'__FILE_URL__',with:null});}catch(e){console.error('open in browser:',e);}
    }));
    bar.appendChild(btn('Close',function(){
      try{window.__TAURI_INTERNALS__.invoke('close_html_preview',{});}catch(e){window.close();}
    }));
    document.documentElement.style.paddingTop='38px';
    if(document.body)document.body.prepend(bar);
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',inject);}
  else{inject();}
})();"#
        .replace("__FILE_URL__", &safe_url)
}

#[tauri::command]
pub async fn open_html_preview(
    app: tauri::AppHandle,
    html: String,
) -> Result<String, String> {
    use std::io::Write;

    let path = temp_html_path();
    let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(html.as_bytes()).map_err(|e| e.to_string())?;

    let url = file_url(&path);

    if let Some(win) = app.get_webview_window("html-preview") {
        let _ = win.eval(&format!("window.location.href={:?};", url));
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(url);
    }

    let script = toolbar_script(&url);
    let parsed_url = url.parse().map_err(|e| format!("Invalid URL: {}", e))?;
    tauri::WebviewWindowBuilder::new(
        &app,
        "html-preview",
        tauri::WebviewUrl::External(parsed_url),
    )
    .title("HTML Preview")
    .inner_size(1000.0, 700.0)
    .min_inner_size(600.0, 400.0)
    .resizable(true)
    .initialization_script(&script)
    .on_navigation(|_| true)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(url)
}

#[tauri::command]
pub fn close_html_preview(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("html-preview") {
        let _ = w.close();
    }
}

#[tauri::command]
pub fn open_preview_in_browser(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let url = file_url(&temp_html_path());
    app.opener()
        .open_url(url, None::<String>)
        .map_err(|e| e.to_string())
}
