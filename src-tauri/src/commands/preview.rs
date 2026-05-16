use tauri::Manager;

fn temp_html_path() -> std::path::PathBuf {
    std::env::temp_dir().join("ai-notes-preview.html")
}

#[tauri::command]
pub async fn open_html_preview(
    app: tauri::AppHandle,
    html: String,
    opacity: f64,
) -> Result<(), String> {
    use std::io::Write;

    // Write to temp file so "Open in browser" has a file:// URL to open
    let path = temp_html_path();
    let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(html.as_bytes()).map_err(|e| e.to_string())?;

    let html_json = serde_json::to_string(&html).map_err(|e| e.to_string())?;

    if let Some(win) = app.get_webview_window("html-preview") {
        let js = format!(
            "document.documentElement.style.opacity='{}';if(window._updatePreview){{window._updatePreview({});}}",
            opacity, html_json
        );
        let _ = win.eval(&js);
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }

    let init_script = format!(
        "window._htmlContent={};window._initialOpacity={};",
        html_json, opacity
    );

    let _win = tauri::WebviewWindowBuilder::new(
        &app,
        "html-preview",
        tauri::WebviewUrl::App("preview.html".into()),
    )
    .title("HTML Preview")
    .inner_size(1000.0, 700.0)
    .min_inner_size(600.0, 400.0)
    .resizable(true)
    .transparent(true)
    .initialization_script(&init_script)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn set_preview_opacity(
    app: tauri::AppHandle,
    opacity: f64,
) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("html-preview") {
        let js = format!("document.documentElement.style.opacity='{}';", opacity);
        win.eval(&js).map_err(|e| e.to_string())?;
    }
    Ok(())
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
    let path = temp_html_path();
    let url = format!(
        "file:///{}",
        path.to_string_lossy().replace('\\', "/")
    );
    app.opener()
        .open_url(url, None::<String>)
        .map_err(|e| e.to_string())
}
