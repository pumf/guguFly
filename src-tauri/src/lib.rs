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
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开应用: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开应用: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(MuteMenuItem(Mutex::new(None)))
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
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
                s("Ctrl+Alt+S")?;
                s("Ctrl+Alt+P")?;
                s("Ctrl+Alt+Q")?;
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
            let tray = TrayIconBuilder::with_id("main-tray")
                .icon(tauri::image::Image::from_bytes(tray_icon_bytes).expect("invalid tray icon"))
                .icon_as_template(true)
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

            let app_handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    let _ = app_handle.emit("deep-link", url.to_string());
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![show_window, set_tray_mute_label, get_app_version, is_compositor_available, open_url_in_browser, open_app, pick_file, pick_folder, download_builtin_video, get_video_cache_info, clear_video_cache, check_latest_release, close_flight_windows, run_script, cancel_post_flight, pf_notify_clicked, mini_start_dragging])
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
