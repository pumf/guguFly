use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{
    menu::{MenuBuilder, MenuItem, MenuItemBuilder, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State,
};
use tauri_plugin_deep_link::DeepLinkExt;

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
fn set_tray_mute_label(state: State<'_, MuteMenuItem>, muted: bool) {
    let label = if muted { "🔊 已静音" } else { "🔇 静音" };
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

            let start = MenuItemBuilder::with_id("start", "▶ 开始").build(app)?;
            let pause = MenuItemBuilder::with_id("pause", "⏸ 暂停").build(app)?;
            let stop = MenuItemBuilder::with_id("stop", "⏹ 停止").build(app)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let mute = MenuItemBuilder::with_id("mute", "🔇 静音").build(app)?;
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
                .item(&sep1)
                .item(&mute)
                .item(&sep2)
                .item(&show)
                .item(&quit)
                .build()?;

            TrayIconBuilder::with_id("main-tray")
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
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                        }
                    }
                    "quit" => {
                        QUITTING.store(true, Ordering::Relaxed);
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            let app_handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    let _ = app_handle.emit("deep-link", url.to_string());
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![show_window, set_tray_mute_label])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, event| match event {
        tauri::RunEvent::ExitRequested { api, .. } => {
            if !QUITTING.load(Ordering::Relaxed) {
                api.prevent_exit();
            }
        }
        tauri::RunEvent::Opened { urls } => {
            for url in urls {
                let _ = _app_handle.emit("deep-link", url.to_string());
            }
        }
        _ => {}
    });
}
