(function () {
  const $ = (id) => document.getElementById(id);
  const output = $('terminalOutput');
  const eventList = $('eventList');
  let logCount = 3;
  let toastTimer;
  const isNative = !!(window.Nexus && typeof window.Nexus.getSystemSnapshot === 'function');

  function toast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }
  function clock() { $('clock').textContent = new Date().toLocaleTimeString('tr-TR', {hour12:false}); }
  function addLine(kind, label, message) {
    const line = document.createElement('div'); line.className = 'log-line ' + kind;
    const time = document.createElement('time'); time.textContent = label;
    const span = document.createElement('span'); span.textContent = message;
    line.append(time, span); output.appendChild(line); output.scrollTop = output.scrollHeight;
    while (output.children.length > 45) output.removeChild(output.firstChild);
  }
  function addEvent(label, message, status) {
    const row = document.createElement('div'); row.className = 'event';
    [label, message, status].forEach((value, index) => { const el = document.createElement(index === 0 ? 'time' : index === 2 ? 'b' : 'span'); el.textContent = value; row.appendChild(el); });
    eventList.prepend(row); logCount += 1; $('logCount').textContent = String(logCount).padStart(2, '0');
    while (eventList.children.length > 5) eventList.removeChild(eventList.lastChild);
  }
  function renderSnapshot(s) {
    const cpu = Number(s.cpuPercent || 0); const budget = Number(s.cpuBudgetPercent || 35);
    $('cpuValue').textContent = cpu.toFixed(1);
    $('cpuBudget').textContent = budget.toFixed(0) + '%';
    $('cpuMeter').style.width = Math.min(100, (cpu / budget) * 100) + '%';
    $('ramValue').textContent = Math.round(Number(s.ramUsedMb || 0)).toLocaleString('tr-TR');
    $('ramTotal').textContent = Math.round(Number(s.ramTotalMb || 0)).toLocaleString('tr-TR') + ' MB toplam';
    $('heapValue').textContent = 'Uygulama heap: ' + Number(s.appHeapUsedMb || 0).toFixed(1) + ' MB';
    $('tempValue').textContent = s.batteryTempC == null ? '—' : Number(s.batteryTempC).toFixed(1);
    $('thermalValue').textContent = s.thermalLabel || 'UNKNOWN';
    $('batteryValue').textContent = Number(s.batteryPercent) >= 0 ? 'Pil: ' + s.batteryPercent + '%' : 'Pil: —';
    $('thermalValue').style.color = ['SEVERE','CRITICAL','EMERGENCY','SHUTDOWN'].includes(s.thermalLabel) ? 'var(--red)' : 'var(--cyan)';
  }
  function refresh() {
    if (!isNative) {
      renderSnapshot({cpuPercent:0, cpuBudgetPercent:35, ramUsedMb:0, ramTotalMb:0, appHeapUsedMb:0, batteryTempC:null, batteryPercent:-1, thermalLabel:'BROWSER'});
      return;
    }
    try { renderSnapshot(JSON.parse(window.Nexus.getSystemSnapshot())); } catch (_) { /* keep last known values */ }
    try { updatePermissions(JSON.parse(window.Nexus.getPermissionStatus())); } catch (_) { /* permissions not available */ }
  }
  function updatePermissions(p) {
    setPill('micStatus', p.microphoneGranted, 'İZİNLİ', 'KAPALI');
    const overlay = $('overlayStatus'); overlay.textContent = 'PLANLANDI'; overlay.className = 'status-pill locked';
  }
  function setPill(id, state, yes, no) { const el=$(id); el.textContent=state?yes:no; el.className='status-pill '+(state?'on':'off'); }
  function runCommand(command) {
    const text = String(command || '').trim(); if (!text) return;
    addLine('user', 'YOU', text);
    addEvent('CMD', 'Komut alındı', 'QUEUED');
    let result;
    if (isNative) {
      try { result = JSON.parse(window.Nexus.runCommand(text)); }
      catch (_) { result = {ok:false, message:'Yerel köprü yanıt vermedi.'}; }
    } else {
      result = {ok:false, message:'Tarayıcı önizlemesindesin. Android özellikleri için uygulamayı telefonda aç.'};
    }
    addLine(result.ok ? 'success' : 'error', result.ok ? 'CORE' : 'SAFE', result.message || 'İşlem tamamlandı.');
    addEvent('EXEC', result.ok ? 'Komut işlendi' : 'Komut reddedildi', result.ok ? 'OK' : 'BLOCK');
    if (!result.ok) toast(result.message || 'Komut çalıştırılamadı.');
    refresh();
  }
  $('commandForm').addEventListener('submit', (event) => { event.preventDefault(); runCommand($('commandInput').value); $('commandInput').value=''; });
  document.querySelectorAll('[data-command]').forEach((button) => button.addEventListener('click', () => runCommand(button.getAttribute('data-command'))));
  $('micButton').addEventListener('click', () => {
    if (isNative) { addLine('system','VOICE','Türkçe konuşma tanıma açılıyor.'); window.Nexus.startVoiceInput(); }
    else toast('Sesli komut Android uygulamasında kullanılabilir.');
  });
  window.NexusUI = {
    onVoiceResult: (text) => { $('commandInput').value = text; runCommand(text); $('commandInput').value=''; },
    onVoiceError: (message) => { addLine('error','VOICE',message); toast(message); },
    onPermissions: updatePermissions
  };
  if (!isNative) { $('connectionText').textContent='BROWSER PREVIEW'; addLine('system','DEMO','Web önizlemesi: Android köprüsü bağlı değil.'); }
  else { $('connectionText').textContent='DEVICE CONNECTED'; }
  refresh(); clock(); setInterval(refresh, 1800); setInterval(clock, 1000);
})();
