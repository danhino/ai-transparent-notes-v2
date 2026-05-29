#[tauri::command]
pub async fn reveal_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let normalized = path.replace('/', "\\");
        // PowerShell executes the command string at shell level, bypassing
        // Rust's Win32 argument encoding which would double-escape the path.
        // Single-quoting the path handles spaces without further escaping.
        let cmd = format!("explorer.exe /select,'{}'", normalized);
        std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &cmd])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
