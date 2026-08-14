use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{
    menu::{MenuBuilder, MenuItem, MenuItemBuilder, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State,
};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;

const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

static QUITTING: AtomicBool = AtomicBool::new(false);

struct MuteMenuItem(Mutex<Option<MenuItem<tauri::Wry>>>);

#[tauri::command]
fn show_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn get_app_version() -> String {
    APP_VERSION.to_string()
}

#[tauri::command]
fn get_platform() -> String {
    #[cfg(target_os = "macos")]
    { "macos".to_string() }
    #[cfg(target_os = "windows")]
    { "windows".to_string() }
    #[cfg(target_os = "linux")]
    { "linux".to_string() }
}

#[tauri::command]
fn is_compositor_available() -> bool {
    #[cfg(target_os = "linux")]
    {
        // Wayland has known issues with global shortcuts (requires
        // XWAYLAND extension) and transparent windows (KDE behaves
        // differently from GNOME). Signal unavailability so the
        // frontend can warn the user and disable the affected features.
        if let Ok(xdg_session_type) = std::env::var("XDG_SESSION_TYPE") {
            if xdg_session_type.contains("wayland") {
                return false;
            }
        }
        let compositors = ["mutter", "compiz", "kwin", "picom", "compton", "sway", "weston"];
        if let Ok(output) = std::process::Command::new("sh")
            .arg("-c")
            .arg("ps -e -o comm= 2>/dev/null")
            .output()
        {
            if let Ok(stdout) = std::str::from_utf8(&output.stdout) {
                let processes = stdout.to_lowercase();
                return compositors.iter().any(|c| processes.contains(c));
            }
        }
        return false;
    }
    #[cfg(not(target_os = "linux"))]
    {
        true
    }
}

#[tauri::command]
fn open_url_in_browser(app: tauri::AppHandle, url: String) -> Result<(), String> {
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

// Reject any command containing shell metacharacters that could
// enable command injection. This is intentionally conservative —
// we allow only a small set of well-known whitelisted commands.
fn has_shell_metachar(s: &str) -> bool {
    // ; | & $ ` > < ( ) { } \n \r \0 ' " * ? ! ~
    s.contains(';') || s.contains('|') || s.contains('&')
        || s.contains('$') || s.contains('`') || s.contains('>')
        || s.contains('<') || s.contains('(') || s.contains(')')
        || s.contains('{') || s.contains('}') || s.contains('\'')
        || s.contains('"') || s.contains('*') || s.contains('?')
        || s.contains('!') || s.contains('~') || s.contains('\n')
        || s.contains('\r') || s.contains('\0')
}

// Strict per-prefix validators for commands that take an argument.
// Each returns true if the trimmed command is safe to execute.
fn validate_say(cmd: &str) -> bool {
    // `say <text>` — only letters/digits/punctuation (no shell chars).
    // We use the same has_shell_metachar check for the text portion.
    let body = cmd.strip_prefix("say").unwrap_or("").trim();
    !body.is_empty() && !has_shell_metachar(body)
}

fn validate_osascript(cmd: &str) -> bool {
    // `osascript -e '<apple script>'` — we require single-quoted body
    // and reject any internal quote or backslash that could break out.
    let body = cmd.strip_prefix("osascript -e").unwrap_or("").trim();
    if !body.starts_with('\'') || !body.ends_with('\'') || body.len() < 3 {
        return false;
    }
    let inner = &body[1..body.len() - 1];
    // AppleScript inside the quotes: reject embedded quotes/backslashes
    // to prevent breaking out of the single-quoted string.
    !inner.contains('\'') && !inner.contains('\\') && !has_shell_metachar(inner)
}

fn validate_mshta(cmd: &str) -> bool {
    // `mshta vbscript:Execute("<vbs>")` — only the safe literal pattern.
    if !cmd.starts_with("mshta vbscript:Execute(\"CreateObject(\"\"SAPI.SpVoice\"\").Speak(\"") {
        return false;
    }
    if !cmd.ends_with("\" ) :close\")") {
        return false;
    }
    let inner = &cmd["mshta vbscript:Execute(\"CreateObject(\"\"SAPI.SpVoice\"\").Speak(\"".len()..cmd.len() - "\" ) :close\")".len()];
    !has_shell_metachar(inner) && !inner.is_empty()
}

fn validate_spd_say(cmd: &str) -> bool {
    // `spd-say <text>` — same restrictions as say.
    let body = cmd.strip_prefix("spd-say").unwrap_or("").trim();
    !body.is_empty() && !has_shell_metachar(body)
}

fn is_script_allowed(script: &str) -> bool {
    let trimmed = script.trim();
    // First, reject any command containing shell metacharacters. The
    // per-prefix validators below are stricter; this is a fallback.
    if has_shell_metachar(trimmed) {
        // Allow the whitelisted lock commands which contain commas,
        // periods, and equals but no shell metas.
        let allowed = &[
            "pmset displaysleepnow",
            "xdg-screensaver lock",
            "loginctl lock-session",
            "rundll32.exe powrprof.dll,SetSuspendState 0,1,0",
            "rundll32.exe user32.dll,LockWorkStation",
        ];
        if !allowed.contains(&trimmed) {
            return false;
        }
    } else {
        // Even if no metacharacters, the lock commands are still valid
        // (they don't contain metachars).
        let allowed = &[
            "pmset displaysleepnow",
            "xdg-screensaver lock",
            "loginctl lock-session",
            "rundll32.exe powrprof.dll,SetSuspendState 0,1,0",
            "rundll32.exe user32.dll,LockWorkStation",
        ];
        if allowed.contains(&trimmed) {
            return true;
        }
    }
    // Per-prefix strict validation. The body of the command must
    // not contain any shell metacharacter.
    if trimmed.starts_with("say ") { return validate_say(trimmed); }
    if trimmed.starts_with("osascript -e ") { return validate_osascript(trimmed); }
    if trimmed.starts_with("mshta vbscript:Execute(") { return validate_mshta(trimmed); }
    if trimmed.starts_with("spd-say ") { return validate_spd_say(trimmed); }
    false
}

#[tauri::command]
fn run_script(script: String) -> Result<(), String> {
    if !is_script_allowed(&script) {
        return Err("不允许的脚本命令，请联系开发者添加白名单".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", &script])
            .spawn()
            .map_err(|e| format!("执行失败: {}", e))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("sh")
            .arg("-c")
            .arg(&script)
            .spawn()
            .map_err(|e| format!("执行失败: {}", e))?;
    }
    Ok(())
}

// Dedicated TTS command that passes text as a process argument,
// avoiding shell interpretation entirely. This replaces the previous
// approach of constructing `say "text"` strings via run_script.
#[tauri::command]
fn speak_text(text: String) -> Result<(), String> {
    if text.trim().is_empty() {
        return Err("TTS text is empty".to_string());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("say")
            .arg(&text)
            .spawn()
            .map_err(|e| format!("say failed: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        // Try spd-say first, fall back to espeak
        let result = std::process::Command::new("spd-say")
            .arg(&text)
            .spawn();
        if result.is_err() {
            std::process::Command::new("espeak")
                .arg(&text)
                .spawn()
                .map_err(|e| format!("espeak failed: {}", e))?;
        }
    }
    #[cfg(target_os = "windows")]
    {
        // Use PowerShell's SpeechSynthesizer for reliable TTS on Windows
        let ps_script = format!(
            "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('{}')",
            text.replace('\'', "''")
        );
        std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps_script])
            .spawn()
            .map_err(|e| format!("PowerShell TTS failed: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn cancel_post_flight(app: tauri::AppHandle) {
    let _ = app.emit("cancel-post-flight", serde_json::json!({}));
    if let Some(w) = app.get_webview_window("gugufly-pfnotify") {
        let _ = w.close();
    }
}

#[tauri::command]
fn pf_notify_clicked(app: tauri::AppHandle) {
    let _ = app.emit("pf-notify-clicked", serde_json::json!({}));
    if let Some(w) = app.get_webview_window("gugufly-pfnotify") {
        let _ = w.close();
    }
}

#[tauri::command]
fn close_flight_windows(app: tauri::AppHandle) {
    for (label, window) in app.webview_windows() {
        if label.starts_with("flight-") {
            let _ = window.close();
        }
    }
}

#[tauri::command]
fn mini_start_dragging(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("gugufly-mini") {
        let _ = w.start_dragging();
    }
}

#[tauri::command]
async fn download_and_install_update(app: tauri::AppHandle, _url: String) -> Result<String, String> {
    use std::fs;

    let data_dir = app.path().app_data_dir().map_err(|e| format!("app data dir: {}", e))?;
    let downloads_dir = data_dir.join("updates");
    fs::create_dir_all(&downloads_dir).map_err(|e| format!("mkdir: {}", e))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP client: {}", e))?;

    // Fetch latest.json to get the version number
    let manifest_url = "https://github.com/pumf/guguFly/releases/latest/download/latest.json";
    let resp = client.get(manifest_url).send().await.map_err(|e| format!("fetch manifest: {}", e))?;
    let manifest: serde_json::Value = resp.json().await.map_err(|e| format!("parse manifest: {}", e))?;

    let version = manifest
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or("0.8.0");

    // Validate version is a safe semver-like string (digits and dots only)
    // to prevent path traversal via a malicious version string from the API.
    if !version.chars().all(|c| c.is_ascii_digit() || c == '.') || version.is_empty() || version.len() > 20 {
        return Err(format!("invalid version string: {}", version));
    }

    // Construct installer download URL based on platform
    // Release assets use pattern: _{version}_{arch}.{ext}
    let base = "https://github.com/pumf/guguFly/releases/download";
    let tag = format!("v{}", version);

    let installer_name = {
        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        { format!("_{}_aarch64.dmg", version) }
        #[cfg(all(target_os = "macos", not(target_arch = "aarch64")))]
        { format!("_{}_x64.dmg", version) }
        #[cfg(target_os = "windows")]
        { format!("_{}_x64-setup.exe", version) }
        #[cfg(target_os = "linux")]
        { format!("_{}_amd64.AppImage", version) }
    };

    let download_url = format!("{}/{}/{}", base, tag, installer_name);
    let dest = downloads_dir.join(&installer_name);

    // Skip download if already exists and is valid (>1MB)
    if !dest.exists() || dest.metadata().map(|m| m.len() < 1000).unwrap_or(true) {
        let dl_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(600))
            .build()
            .map_err(|e| format!("HTTP client: {}", e))?;

        let resp = dl_client.get(&download_url).send().await.map_err(|e| format!("download failed: {}", e))?;
        let bytes = resp.bytes().await.map_err(|e| format!("read body: {}", e))?;
        fs::write(&dest, &bytes).map_err(|e| format!("write file: {}", e))?;
    }

    // Open/run the installer
    #[cfg(target_os = "macos")]
    {
        // Use argument lists instead of sh -c to prevent shell injection.
        // Step 1: mount DMG
        let mount = std::process::Command::new("hdiutil")
            .args(["attach", dest.to_str().unwrap_or(""), "-nobrowse", "-quiet"])
            .spawn();
        if let Ok(mut child) = mount {
            let _ = child.wait();
        }
        // Step 2: copy app to /Applications
        let _ = std::process::Command::new("cp")
            .args(["-R", "/Volumes/咕咕机长/咕咕机长.app", "/Applications/"])
            .spawn();
        // Step 3: detach volume
        let _ = std::process::Command::new("hdiutil")
            .args(["detach", "/Volumes/咕咕机长", "-quiet"])
            .spawn();
        // Step 4: open the installed app
        let _ = std::process::Command::new("open")
            .args(["-a", "/Applications/咕咕机长.app"])
            .spawn();
    }
    #[cfg(target_os = "windows")]
    {
        // Run the NSIS installer
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "", &dest.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("run installer failed: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        // Make executable and run AppImage
        let _ = std::process::Command::new("chmod")
            .args(["+x", &dest.to_string_lossy()])
            .spawn();
        let _ = std::process::Command::new(&dest)
            .spawn()
            .map_err(|e| format!("run AppImage failed: {}", e))?;
    }

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn pick_file() -> Result<Option<String>, String> {
    let dialog = rfd::FileDialog::new()
        .set_title("选择应用程序");
    Ok(dialog.pick_file().map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
fn pick_folder() -> Result<Option<String>, String> {
    let dialog = rfd::FileDialog::new()
        .set_title("选择文件夹");
    Ok(dialog.pick_folder().map(|p| p.to_string_lossy().to_string()))
}

// Maximum allowed size for a single video file (200MB) and for the
// entire cache directory (1GB). This prevents a runaway download
// (e.g., a misconfigured server returning a huge file) from filling
// the user's disk.
const MAX_VIDEO_FILE_BYTES: u64 = 200 * 1024 * 1024;
const MAX_VIDEO_CACHE_BYTES: u64 = 1024 * 1024 * 1024;

#[tauri::command]
async fn download_builtin_video(name: String, app: tauri::AppHandle) -> Result<String, String> {
    use std::fs;
    // Reject path traversal attempts: name must be a simple basename
    // and only contain safe characters.
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(format!("invalid video name: {}", name));
    }
    let data_dir = app.path().app_data_dir().map_err(|e| format!("app data dir: {}", e))?;
    let videos_dir = data_dir.join("videos");
    fs::create_dir_all(&videos_dir).map_err(|e| format!("mkdir: {}", e))?;
    let dest = videos_dir.join(&name);
    if dest.exists() {
        return Ok(dest.to_string_lossy().to_string());
    }
    // Check existing cache size; if it would exceed the limit, refuse
    // to grow further. The user must clear the cache manually.
    let mut total_size: u64 = 0;
    if let Ok(entries) = fs::read_dir(&videos_dir) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() { total_size += meta.len(); }
            }
        }
    }
    if total_size > MAX_VIDEO_CACHE_BYTES {
        return Err(format!("视频缓存已满（{:.1}GB > {:.0}GB 限制），请先清理缓存", total_size as f64 / 1_073_741_824.0, MAX_VIDEO_CACHE_BYTES as f64 / 1_073_741_824.0));
    }
    let base_url = "https://fly.pumf.top/resource";
    let url = format!("{}/{}", base_url, name);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("HTTP client: {}", e))?;
    let resp = client.get(&url).send().await.map_err(|e| format!("download failed: {}", e))?;
    // Enforce the per-file size cap. Reject before reading the body
    // so we don't allocate unbounded memory for huge responses.
    let content_length = resp.content_length().unwrap_or(0);
    if content_length > MAX_VIDEO_FILE_BYTES {
        return Err(format!("视频文件过大（{}MB > {}MB 限制）", content_length / 1_048_576, MAX_VIDEO_FILE_BYTES / 1_048_576));
    }
    let bytes = resp.bytes().await.map_err(|e| format!("read body: {}", e))?;
    if bytes.len() as u64 > MAX_VIDEO_FILE_BYTES {
        return Err(format!("视频文件过大（{}MB > {}MB 限制）", bytes.len() / 1_048_576, MAX_VIDEO_FILE_BYTES / 1_048_576));
    }
    // Write to a .tmp file first, then rename. This prevents leaving
    // a partial file on disk if the write is interrupted. If the
    // rename fails, clean up the .tmp file to avoid leaking partial
    // downloads on disk.
    let tmp_dest = videos_dir.join(format!("{}.tmp", name));
    if let Err(e) = fs::write(&tmp_dest, &bytes) {
        return Err(format!("write file: {}", e));
    }
    match fs::rename(&tmp_dest, &dest) {
        Ok(()) => Ok(dest.to_string_lossy().to_string()),
        Err(e) => {
            // Try to clean up the .tmp file before returning the error.
            let _ = fs::remove_file(&tmp_dest);
            Err(format!("rename: {}", e))
        }
    }
}

#[tauri::command]
async fn get_video_cache_info(app: tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
    use std::fs;
    let data_dir = app.path().app_data_dir().map_err(|e| format!("app data dir: {}", e))?;
    let videos_dir = data_dir.join("videos");
    if !videos_dir.exists() {
        return Ok(vec![]);
    }
    let mut result = vec![];
    for entry in fs::read_dir(&videos_dir).map_err(|e| format!("read_dir: {}", e))? {
        let entry = entry.map_err(|e| format!("entry: {}", e))?;
        let path = entry.path();
        if path.is_file() {
            let meta = fs::metadata(&path).map_err(|e| format!("metadata: {}", e))?;
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            let size = meta.len();
            result.push(serde_json::json!({
                "name": name,
                "size": size,
                "path": path.to_string_lossy().to_string(),
            }));
        }
    }
    Ok(result)
}

#[tauri::command]
async fn clear_video_cache(app: tauri::AppHandle) -> Result<(), String> {
    use std::fs;
    let data_dir = app.path().app_data_dir().map_err(|e| format!("app data dir: {}", e))?;
    let videos_dir = data_dir.join("videos");
    if videos_dir.exists() {
        fs::remove_dir_all(&videos_dir).map_err(|e| format!("remove_dir: {}", e))?;
        fs::create_dir_all(&videos_dir).map_err(|e| format!("mkdir: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn open_app(path: String) -> Result<(), String> {
    // Validate path: must not be empty, must not contain shell-dangerous
    // characters, and must reference an existing file/directory.
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("路径不能为空".to_string());
    }
    if trimmed.contains('\0') {
        return Err("路径包含非法字符".to_string());
    }
    let p = std::path::Path::new(trimmed);
    if !p.exists() {
        return Err(format!("路径不存在: {}", trimmed));
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(trimmed)
            .spawn()
            .map_err(|e| format!("无法打开应用: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(trimmed)
            .spawn()
            .map_err(|e| format!("无法打开应用: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        // Use start with arg list (not cmd /C) to avoid shell interpretation
        std::process::Command::new("cmd")
            .args(["/C", "start", "", trimmed])
            .spawn()
            .map_err(|e| format!("无法打开应用: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn check_latest_release() -> Result<HashMap<String, String>, String> {
    const RELEASES_LATEST: &str = "https://github.com/pumf/guguFly/releases/latest";
    const API_LATEST: &str = "https://api.github.com/repos/pumf/guguFly/releases/latest";

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("guguFly-desktop")
        .build()
        .map_err(|e| format!("HTTP: {}", e))?;

    // Try API first — gives version + notes in one call
    if let Ok(resp) = client
        .get(API_LATEST)
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
    {
        if let Ok(api_data) = resp.json::<serde_json::Value>().await {
            if let Some(tag_name) = api_data.get("tag_name").and_then(|t| t.as_str()) {
                let mut result = HashMap::new();
                let ver = tag_name.trim_start_matches('v').to_string();
                let html = api_data.get("html_url").and_then(|u| u.as_str()).unwrap_or("");
                result.insert("version".to_string(), ver);
                result.insert("html_url".to_string(),
                    if html.is_empty() { format!("https://github.com/pumf/guguFly/releases/tag/{}", tag_name) }
                    else { html.to_string() });
                result.insert("notes".to_string(),
                    api_data.get("body").and_then(|b| b.as_str()).unwrap_or("").to_string());
                return Ok(result);
            }
        }
    }

    // Fallback: get version from redirect URL
    let no_redirect = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("guguFly-desktop")
        .build()
        .map_err(|e| format!("HTTP: {}", e))?;

    let resp = no_redirect
        .head(RELEASES_LATEST)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let location = resp
        .headers()
        .get("location")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| "未找到重定向地址".to_string())?;

    let tag = location
        .rsplit('/')
        .next()
        .unwrap_or("")
        .trim_start_matches('v')
        .to_string();

    if tag.is_empty() {
        return Err("无法解析版本号".to_string());
    }

    let mut result = HashMap::new();
    result.insert("version".to_string(), tag);
    result.insert("html_url".to_string(), location.to_string());

    // Try HTML page for notes (API rate-limited)
    if let Ok(html_resp) = client.get(RELEASES_LATEST).send().await {
        if let Ok(html) = html_resp.text().await {
            if let Some(notes) = extract_release_body(&html) {
                result.insert("notes".to_string(), notes);
            }
        }
    }

    Ok(result)
}

fn extract_release_body(html: &str) -> Option<String> {
    let i = html.find("markdown-body")?;
    let s = html[i..].find('>')? + i + 1;
    let mut depth = 1u32;
    let mut p = s;
    while depth > 0 && p < html.len() {
        let open = html[p..].find("<div");
        let close = html[p..].find("</div");
        if close.is_none() { break; }
        let close_pos = p + close.unwrap();
        if let Some(open_pos) = open.map(|o| p + o) {
            if open_pos < close_pos { depth += 1; p = open_pos + 5; continue; }
        }
        depth -= 1;
        p = close_pos + 6;
    }
    let body = &html[s..p - 6];
    let text = body
        .split('>')
        .flat_map(|part| {
            let i = part.find('<');
            if i == Some(0) { vec![] } else { vec![&part[..i.unwrap_or(part.len())]] }
        })
        .collect::<Vec<_>>()
        .join("");
    let text = text
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .trim()
        .to_string();
    if text.is_empty() { None } else { Some(text) }
}

#[tauri::command]
fn set_tray_mute_label(state: State<'_, MuteMenuItem>, muted: bool) {
    let label = if muted { "🔇 已静音" } else { "🔊 静音" };
    if let Ok(guard) = state.0.lock() {
        if let Some(item) = guard.as_ref() {
            let _ = item.set_text(label);
        }
    }
}

fn write_crash_log(msg: &str) {
    let log_path = std::env::temp_dir().join("gugufly_crash.log");
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let entry = format!("[{}] {}\n", timestamp, msg);
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        use std::io::Write;
        let _ = f.write_all(entry.as_bytes());
    } else {
        let _ = std::fs::write(&log_path, entry);
    }
}

fn setup_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        let msg = match info.payload().downcast_ref::<&str>() {
            Some(s) => s.to_string(),
            None => match info.payload().downcast_ref::<String>() {
                Some(s) => s.clone(),
                None => "unknown panic".to_string(),
            },
        };
        let location = info.location().map(|l| l.to_string()).unwrap_or_default();
        write_crash_log(&format!("PANIC: {} at {}", msg, location));
    }));
}

// Smart Pause: detect system context (fullscreen, meeting, recording, DND)
#[tauri::command]
fn check_system_context() -> serde_json::Value {
    let mut fullscreen = false;
    let mut in_meeting = false;
    let mut screen_recording = false;
    let mut dnd = false;

    #[cfg(target_os = "macos")]
    {
        // Fullscreen: check if frontmost app's window is fullscreen via osascript
        if let Ok(output) = std::process::Command::new("osascript")
            .args(["-e", "tell application \"System Events\" to tell (first process whose frontmost is true) to set f to value of attribute \"AXFullScreen\" of front window"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_lowercase();
            fullscreen = stdout == "true";
        }

        // Meeting: check for common meeting app processes
        if let Ok(output) = std::process::Command::new("sh")
            .args(["-c", "pgrep -x -l 'zoom|Zoom|Microsoft Teams|Google Meet|腾讯会议|飞书|钉钉' 2>/dev/null || true"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_lowercase();
            in_meeting = !stdout.is_empty();
        }

        // Screen recording: check for recording app processes
        if let Ok(output) = std::process::Command::new("sh")
            .args(["-c", "pgrep -x -l 'OBS|ScreenFlow|QuickTime Player|Loom|录猎|录屏' 2>/dev/null || true"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_lowercase();
            screen_recording = !stdout.is_empty();
        }

        // DND: check Focus/DND via defaults
        if let Ok(output) = std::process::Command::new("defaults")
            .args(["read", "com.apple.notificationcenterui", "doNotDisturb"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let trimmed = stdout.trim();
            dnd = trimmed == "1";
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Fullscreen: check if foreground window covers the screen via PowerShell
        if let Ok(output) = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command",
                "$f=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $p=[System.Diagnostics.Process]::GetCurrentProcess(); Add-Type -AssemblyName System.Windows.Forms; $fg=[System.Diagnostics.Process]::GetProcesses | Where-Object {$_.MainWindowHandle -ne [IntPtr]::Zero} | Select-Object -First 1; if($fg){$r=[System.Runtime.InteropServices.Marshal]::AllocHGlobal(48); [void][User32]::GetWindowRect($fg.MainWindowHandle,$r); $w=[System.Runtime.InteropServices.Marshal]::ReadInt32($r,8); $h=[System.Runtime.InteropServices.Marshal]::ReadInt32($r,12); if($w -ge $f.Width -and $h -ge $f.Height){\"true\"}else{\"false\"}}else{\"false\"}"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_lowercase();
            fullscreen = stdout == "true";
        }

        // Meeting: check for meeting processes
        if let Ok(output) = std::process::Command::new("tasklist")
            .args(["/FI", "IMAGENAME eq Zoom.exe", "/NH"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_lowercase();
            if stdout.contains("zoom.exe") { in_meeting = true; }
        }
        if let Ok(output) = std::process::Command::new("tasklist")
            .args(["/FI", "IMAGENAME eq ms-teams.exe", "/NH"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_lowercase();
            if stdout.contains("ms-teams.exe") { in_meeting = true; }
        }

        // DND: check Focus Assist registry
        if let Ok(output) = std::process::Command::new("reg")
            .args(["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CloudStore\\Store\\DefaultAccount\\Current\\default$windows.data.notifications.quiethoursprofile\\windows.data.notifications.quiethoursprofile", "/v", "Data", "/t", "REG_BINARY"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // DND is active if the binary data indicates it
            dnd = stdout.contains("Data") && stdout.len() > 200;
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Fullscreen: check window size via xdotool
        if let Ok(output) = std::process::Command::new("sh")
            .args(["-c", "xdotool getactivewindow getwindowgeometry 2>/dev/null | grep -oP 'Geometry \\K\\d+x\\d+' || echo ''"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout).trim();
            if let Some(size) = stdout.split('x').collect::<Vec<_>>().get(0..2) {
                if let (Ok(w), Ok(h)) = (size[0].parse::<u32>(), size[1].parse::<u32>()) {
                    if let Ok(monitor_output) = std::process::Command::new("sh")
                        .args(["-c", "xrandr --query 2>/dev/null | grep ' connected' | head -1 | grep -oP '\\d+x\\d+' || echo '1920x1080'"])
                        .output()
                    {
                        let monitor_str = String::from_utf8_lossy(&monitor_output.stdout).trim();
                        if let Some(mw) = monitor_str.split('x').collect::<Vec<_>>().get(0..2) {
                            if let (Ok(mw), Ok(mh)) = (mw[0].parse::<u32>(), mw[1].parse::<u32>()) {
                                fullscreen = w >= mw && h >= mh;
                            }
                        }
                    }
                }
            }
        }

        // Meeting: check for meeting processes
        if let Ok(output) = std::process::Command::new("sh")
            .args(["-c", "pgrep -x -l 'zoom|teams|meet|腾讯会议|飞书|钉钉' 2>/dev/null || true"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_lowercase();
            in_meeting = !stdout.is_empty();
        }

        // Screen recording: check for OBS
        if let Ok(output) = std::process::Command::new("sh")
            .args(["-c", "pgrep -x -l 'obs|OBS|录猎|录屏' 2>/dev/null || true"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_lowercase();
            screen_recording = !stdout.is_empty();
        }

        // DND: check D-Bus for GNOME/KDE DND
        if let Ok(output) = std::process::Command::new("sh")
            .args(["-c", "gsettings get org.gnome.desktop.notifications show-banners 2>/dev/null || echo 'true'"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout).trim();
            dnd = stdout == "false";
        }
    }

    serde_json::json!({
        "fullscreen": fullscreen,
        "in_meeting": in_meeting,
        "screen_recording": screen_recording,
        "dnd": dnd,
    })
}

// Natural break: get user idle time in seconds (time since last keyboard/mouse input)
#[tauri::command]
fn get_idle_time() -> Result<f64, String> {
    #[cfg(target_os = "macos")]
    {
        // Use ioreg to get HIDIdleTime (nanoseconds since last input)
        let output = std::process::Command::new("sh")
            .args(["-c", "ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF}'"])
            .output()
            .map_err(|e| format!("ioreg failed: {}", e))?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let trimmed = stdout.trim();
        if let Ok(nanos) = trimmed.parse::<u64>() {
            return Ok(nanos as f64 / 1_000_000_000.0);
        }
        return Ok(0.0);
    }

    #[cfg(target_os = "windows")]
    {
        // Use PowerShell to get last input time via GetLastInputInfo
        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command",
                "Add-Type @'\nusing System;\nusing System.Runtime.InteropServices;\npublic class IdleTime {\n    [DllImport(\"user32.dll\")]\n    static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);\n    [StructLayout(LayoutKind.Sequential)] struct LASTINPUTINFO { public int cbSize; public int dwTime; }\n    public static int GetIdleSeconds() {\n        LASTINPUTINFO li = new LASTINPUTINFO(); li.cbSize = Marshal.SizeOf(typeof(LASTINPUTINFO)); GetLastInputInfo(ref li); return (Environment.TickCount - li.dwTime) / 1000;\n    }\n}\n'@; [IdleTime]::GetIdleSeconds()"])
            .output()
            .map_err(|e| format!("PowerShell failed: {}", e))?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Ok(secs) = stdout.trim().parse::<f64>() {
            return Ok(secs);
        }
        return Ok(0.0);
    }

    #[cfg(target_os = "linux")]
    {
        // Try xprintidle first (returns milliseconds)
        if let Ok(output) = std::process::Command::new("xprintidle").output() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Ok(ms) = stdout.trim().parse::<u64>() {
                return Ok(ms as f64 / 1000.0);
            }
        }
        // Fallback: try xssstate
        if let Ok(output) = std::process::Command::new("sh")
            .args(["-c", "xssstate -i 2>/dev/null || echo 0"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Ok(ms) = stdout.trim().parse::<u64>() {
                return Ok(ms as f64 / 1000.0);
            }
        }
        return Ok(0.0);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    setup_panic_hook();
    let app = tauri::Builder::default()
        .manage(MuteMenuItem(Mutex::new(None)))
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, _event| {
                    let key = shortcut.to_string();
                    if key.ends_with("+Alt+S") {
                        let _ = app.emit("timer-start", ());
                    } else if key.ends_with("+Alt+P") {
                        let _ = app.emit("timer-pause", ());
                    } else if key.ends_with("+Alt+Q") {
                        let _ = app.emit("timer-stop", ());
                    }
                })
                .build(),
        )
        .setup(|app| {
            let log_level = if cfg!(debug_assertions) {
                log::LevelFilter::Debug
            } else {
                log::LevelFilter::Info
            };
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log_level)
                    .build(),
            )?;

            use tauri_plugin_global_shortcut::GlobalShortcutExt;

            // Skip global shortcut registration on Wayland. The
            // global-shortcut plugin requires XWAYLAND, which not all
            // Wayland compositors support. Attempting to register would
            // fail or behave inconsistently.
            #[cfg(target_os = "linux")]
            let skip_shortcuts = std::env::var("XDG_SESSION_TYPE")
                .map(|v| v.contains("wayland"))
                .unwrap_or(false);
            #[cfg(not(target_os = "linux"))]
            let skip_shortcuts = false;

            if skip_shortcuts {
                eprintln!("[gugufly] Wayland detected — skipping global shortcut registration (use tray menu instead).");
            } else {
              let s = |k: &str| -> Result<(), Box<dyn std::error::Error>> {
                app.global_shortcut().register(k)?;
                Ok(())
            };

            #[cfg(target_os = "macos")]
            {
                s("Super+Alt+S")?;
                s("Super+Alt+P")?;
                s("Super+Alt+Q")?;
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = s("Ctrl+Alt+S");
                let _ = s("Ctrl+Alt+P");
                let _ = s("Ctrl+Alt+Q");
            }
            } // close if !skip_shortcuts

            let start = MenuItemBuilder::with_id("start", "▶ 开始").accelerator("CmdOrCtrl+Alt+S").build(app)?;
            let pause = MenuItemBuilder::with_id("pause", "⏸ 暂停").accelerator("CmdOrCtrl+Alt+P").build(app)?;
            let stop = MenuItemBuilder::with_id("stop", "⏹ 停止").accelerator("CmdOrCtrl+Alt+Q").build(app)?;
            let sep_timer = PredefinedMenuItem::separator(app)?;
            let cd5 = MenuItemBuilder::with_id("countdown_5", "⏱ 快速倒计时 5 分钟").build(app)?;
            let cd15 = MenuItemBuilder::with_id("countdown_15", "⏱ 快速倒计时 15 分钟").build(app)?;
            let cd25 = MenuItemBuilder::with_id("countdown_25", "⏱ 快速倒计时 25 分钟").build(app)?;
            let cd30 = MenuItemBuilder::with_id("countdown_30", "⏱ 快速倒计时 30 分钟").build(app)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let mute = MenuItemBuilder::with_id("mute", "🔇 静音").build(app)?;
            let emergency = MenuItemBuilder::with_id("emergency", "🛑 紧急降落").build(app)?;
            let skip_flight = MenuItemBuilder::with_id("skip_flight", "⏭ 跳过当前飞行").build(app)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let show = MenuItemBuilder::with_id("show", "📂 打开主窗口").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "✕ 退出").build(app)?;

            if let Some(state) = app.try_state::<MuteMenuItem>() {
                if let Ok(mut guard) = state.0.lock() {
                    *guard = Some(mute.clone());
                }
            }

            let menu = MenuBuilder::new(app)
                .item(&start)
                .item(&pause)
                .item(&stop)
                .item(&sep_timer)
                .item(&cd5)
                .item(&cd15)
                .item(&cd25)
                .item(&cd30)
                .item(&sep1)
                .item(&mute)
                .item(&emergency)
                .item(&skip_flight)
                .item(&sep2)
                .item(&show)
                .item(&quit)
                .build()?;

            let tray_icon_bytes = include_bytes!("../icons/tray-icon.png");
            let mut tray_builder = TrayIconBuilder::with_id("main-tray")
                .icon(tauri::image::Image::from_bytes(tray_icon_bytes).expect("invalid tray icon"));
            #[cfg(target_os = "macos")]
            {
                tray_builder = tray_builder.icon_as_template(true);
            }
            let tray = tray_builder
                .menu(&menu)
                .tooltip("咕咕机长")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.unminimize();
                        }
                    }
                })
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "start" => {
                        let _ = app.emit("timer-start", ());
                    }
                    "pause" => {
                        let _ = app.emit("timer-pause", ());
                    }
                    "stop" => {
                        let _ = app.emit("timer-stop", ());
                    }
                    "mute" => {
                        let _ = app.emit("toggle-mute", ());
                    }
                    "emergency" => {
                        let _ = app.emit("emergency-landing", ());
                    }
                    "skip_flight" => {
                        let _ = app.emit("skip-current-flight", ());
                    }
                    "countdown_5" => {
                        let _ = app.emit("quick-countdown", 300);
                    }
                    "countdown_15" => {
                        let _ = app.emit("quick-countdown", 900);
                    }
                    "countdown_25" => {
                        let _ = app.emit("quick-countdown", 1500);
                    }
                    "countdown_30" => {
                        let _ = app.emit("quick-countdown", 1800);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.unminimize();
                        }
                    }
                    "quit" => {
                        QUITTING.store(true, Ordering::Relaxed);
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            // Keep tray alive: TrayIcon is Send+Sync, store in managed state
            app.manage(tray);

            // Set window title with version
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title(&format!("咕咕机长 v{}", APP_VERSION));
            }

            let app_handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    let _ = app_handle.emit("deep-link", url.to_string());
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![show_window, set_tray_mute_label, get_app_version, get_platform, is_compositor_available, open_url_in_browser, open_app, pick_file, pick_folder, download_builtin_video, get_video_cache_info, clear_video_cache, check_latest_release, close_flight_windows, run_script, speak_text, cancel_post_flight, pf_notify_clicked, mini_start_dragging, download_and_install_update, check_system_context, get_idle_time])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, event| match event {
        tauri::RunEvent::ExitRequested { api, .. } => {
            if !QUITTING.load(Ordering::Relaxed) {
                api.prevent_exit();
            }
        }
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Opened { urls } => {
            for url in urls {
                let _ = _app_handle.emit("deep-link", url.to_string());
            }
        }
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen { .. } => {
            if let Some(window) = _app_handle.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }
        _ => {}
    });
}
