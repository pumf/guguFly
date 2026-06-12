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
fn open_url_in_browser(app: tauri::AppHandle, url: String) -> Result<(), String> {
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn run_script(script: String) -> Result<(), String> {
    std::process::Command::new("sh")
        .arg("-c")
        .arg(&script)
        .spawn()
        .map_err(|e| format!("执行失败: {}", e))?;
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
        .plugin(tauri_plugin_dialog::init())
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
        .invoke_handler(tauri::generate_handler![show_window, set_tray_mute_label, get_app_version, open_url_in_browser, open_app, check_latest_release, close_flight_windows, run_script, cancel_post_flight, pf_notify_clicked])
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
        _ => {}
    });
}
