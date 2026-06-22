(async function(){
  function setLabel(text) {
    try { document.getElementById('x').textContent = String(text || '飞行后操作'); } catch(e) {}
  }
  function notifyClicked() {
    try {
      if (window.__TAURI__ && window.__TAURI__.event && window.__TAURI__.event.emit) {
        window.__TAURI__.event.emit('pf-notify-clicked');
      } else if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
        window.__TAURI__.core.invoke('pf_notify_clicked');
      } else {
        try { window.close(); } catch(e) {}
      }
    } catch(err) {
      try { window.close(); } catch(e) {}
    }
  }
  try {
    var n = document.getElementById('n');
    n.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      notifyClicked();
    });
  } catch(e) {
    try { var n2 = document.getElementById('n'); n2.onclick = function(){ notifyClicked(); }; } catch(_){}
  }
  try {
    if (window.__TAURI__ && window.__TAURI__.event && window.__TAURI__.event.listen) {
      await window.__TAURI__.event.listen('pf-notify-set-label', function(event){
        setLabel(event && event.payload && event.payload.label);
      });
    }
  } catch(e) {}
})();
