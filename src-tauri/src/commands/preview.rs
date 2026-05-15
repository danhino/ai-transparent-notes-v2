use std::path::PathBuf;
use tauri::Manager;

#[tauri::command]
pub async fn open_html_preview(
    app: tauri::AppHandle,
    html: String,
    state: tauri::State<'_, crate::PreviewHtmlState>,
) -> Result<(), String> {
    *state.html.lock().map_err(|e| e.to_string())? = html;

    if let Some(window) = app.get_webview_window("html-preview") {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    tauri::WebviewWindowBuilder::new(
        &app,
        "html-preview",
        tauri::WebviewUrl::App(PathBuf::from("html-preview.html")),
    )
    .title("HTML Preview")
    .inner_size(800.0, 600.0)
    .min_inner_size(600.0, 400.0)
    .resizable(true)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_preview_html(
    state: tauri::State<'_, crate::PreviewHtmlState>,
) -> String {
    state.html.lock().map(|g| g.clone()).unwrap_or_default()
}

#[tauri::command]
pub fn close_html_preview(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("html-preview") {
        let _ = w.close();
    }
}
