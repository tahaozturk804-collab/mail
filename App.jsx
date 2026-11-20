import React, { useCallback, useEffect, useMemo, useState } from 'react';

const demo = { cpuPercent: 0, cpuBudgetPercent: 35, ramUsedMb: 0, ramTotalMb: 0, appHeapUsedMb: 0, batteryTempC: null, batteryPercent: -1, thermalLabel: 'BROWSER' };

export default function App() {
  const native = useMemo(() => Boolean(window.Nexus?.getSystemSnapshot), []);
  const [snapshot, setSnapshot] = useState(demo);
  const [permissions, setPermissions] = useState({ microphoneGranted: false });
  const [command, setCommand] = useState('');
  const [logs, setLogs] = useState([
    { type: 'system', label: 'CORE', message: 'NEXUSCORE yerel çekirdeği başlatıldı.' },
    { type: 'system', label: 'SAFE', message: "Komut güvenlik duvarı aktif. 'yardım' yaz." },
  ]);
  const [events, setEvents] = useState([{ label: 'BOOT', message: 'Yerel arayüz hazır', status: 'OK' }]);
  const [clock, setClock] = useState(new Date());
  const [toast, setToast] = useState('');

  const addLog = useCallback((type, label, message) => setLogs((old) => [...old, { type, label, message }].slice(-45)), []);
  const addEvent = useCallback((label, message, status) => setEvents((old) => [{ label, message, status }, ...old].slice(0, 5)), []);
  const refresh = useCallback(() => {
    if (!native) return;
    try { setSnapshot(JSON.parse(window.Nexus.getSystemSnapshot())); } catch { /* keep last good sample */ }
    try { setPermissions(JSON.parse(window.Nexus.getPermissionStatus())); } catch { /* keep last good sample */ }
  }, [native]);

  useEffect(() => {
    refresh();
    const metrics = setInterval(refresh, 1800);
    const time = setInterval(() => setClock(new Date()), 1000);
    return () => { clearInterval(metrics); clearInterval(time); };
  }, [refresh]);

  useEffect(() => {
    window.NexusUI = {
      onVoiceResult: (text) => { setCommand(text); execute(text); setCommand(''); },
      onVoiceError: (message) => { addLog('error', 'VOICE', message); setToast(message); },
      onPermissions: setPermissions,
    };
    return () => { delete window.NexusUI; };
  });

  function execute(raw) {
    const text = String(raw || '').trim();
    if (!text) return;
    addLog('user', 'YOU', text);
    addEvent('CMD', 'Komut alındı', 'QUEUED');
    let result;
    try { result = native ? JSON.parse(window.Nexus.runCommand(text)) : { ok: false, message: 'Android köprüsü bulunamadı. Bu web önizlemesidir.' }; }
    catch { result = { ok: false, message: 'Yerel köprü yanıt vermedi.' }; }
    addLog(result.ok ? 'success' : 'error', result.ok ? 'CORE' : 'SAFE', result.message);
    addEvent('EXEC', result.ok ? 'Komut işlendi' : 'Komut reddedildi', result.ok ? 'OK' : 'BLOCK');
    if (!result.ok) { setToast(result.message); window.setTimeout(() => setToast(''), 2600); }
    refresh();
  }

  const cpu = Number(snapshot.cpuPercent || 0);
  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-wrap"><div className="brand-mark"><span>N</span></div><div><div className="brand-name">NEXUSCORE <b>AI</b></div><div className="brand-sub">PERSONAL ANDROID SYSTEM</div></div></div>
      <div className="connection"><i />{native ? 'DEVICE CONNECTED' : 'BROWSER PREVIEW'}</div>
    </header>
    <section className="hero">
      <div><div className="eyebrow"><span className="pulse" /> SYSTEM ONLINE · BUILD 0.1.0</div><h1>Kontrol sende.<br /><em>Komutunu bekliyorum.</em></h1><p>Yerel komut motoru · Şeffaf izinler · Kaynak farkındalıklı çalışma</p></div>
      <div className="core-visual"><div className="core-ring ring-outer" /><div className="core-ring ring-mid" /><div className="core-ring ring-inner" /><div className="core-center">N<span>CORE</span></div><div className="orbit-dot" /></div>
    </section>
    <section className="metrics-grid">
      <Metric title="UYGULAMA CPU" icon="⌁" value={cpu.toFixed(1)} unit="%" foot="Yumuşak hedef bütçe" meta={`${snapshot.cpuBudgetPercent || 35}%`} progress={Math.min(100, cpu / 35 * 100)} />
      <Metric title="SİSTEM RAM" icon="▤" value={Math.round(snapshot.ramUsedMb || 0).toLocaleString('tr-TR')} unit="MB" foot={`${Math.round(snapshot.ramTotalMb || 0).toLocaleString('tr-TR')} MB toplam`} meta="USED" note={`Uygulama heap: ${Number(snapshot.appHeapUsedMb || 0).toFixed(1)} MB`} />
      <Metric title="BATARYA SICAKLIĞI" icon="♨" value={snapshot.batteryTempC == null ? '—' : Number(snapshot.batteryTempC).toFixed(1)} unit="°C" foot="Termal durum" meta={snapshot.thermalLabel || 'UNKNOWN'} note={`Pil: ${snapshot.batteryPercent >= 0 ? `${snapshot.batteryPercent}%` : '—'}`} />
    </section>
    <section className="workspace">
      <div className="panel terminal-panel">
        <div className="panel-heading"><div><div className="panel-kicker">01 / COMMAND INTERFACE</div><h2>Komut terminali</h2></div><span className="live-tag"><i /> LIVE</span></div>
        <div className="terminal-window"><div className="terminal-bar"><div className="traffic"><i /><i /><i /></div><span>nexuscore://local-terminal</span><span className="terminal-lock">LOCAL</span></div>
          <div className="terminal-output">{logs.map((line, i) => <div className={`log-line ${line.type}`} key={`${i}-${line.label}`}><time>{line.label}</time><span>{line.message}</span></div>)}</div>
          <form className="command-form" onSubmit={(e) => { e.preventDefault(); execute(command); setCommand(''); }}><span className="prompt">›</span><input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="Bir komut gir..." aria-label="Komut" /><button className="mic-btn" type="button" title="Sesli komut" onClick={() => native ? window.Nexus.startVoiceInput() : setToast('Sesli komut Android uygulamasında kullanılabilir.')}>◖</button><button className="send-btn">GÖNDER <span>↗</span></button></form>
        </div>
        <div className="quick-commands"><span>HIZLI KOMUTLAR</span>{['cihaz bilgisi', 'wifi ayarları', 'ses artır', 'yardım'].map((item) => <button key={item} onClick={() => execute(item)}>{item}</button>)}</div>
      </div>
      <aside className="side-column">
        <div className="panel status-panel"><div className="panel-heading compact"><div><div className="panel-kicker">02 / SECURITY</div><h2>Yetki durumu</h2></div><span className="shield">⬡</span></div>
          <Permission name="Mikrofon" description="Yalnızca sesli komut sırasında" active={permissions.microphoneGranted} />
          <div className="permission-row"><div><b>Yüzen pencere</b><small>Sonraki sürümde planlandı</small></div><span className="status-pill locked">PLANLANDI</span></div>
          <div className="permission-row"><div><b>Ekran otomasyonu</b><small>Etkinleştirilmedi</small></div><span className="status-pill locked">DEVRE DIŞI</span></div>
          <div className="security-note"><span>◆</span><p>Bu sürüm ekran içeriğini okumaz, başka uygulamalara tıklamaz ve arka planda kayıt yapmaz.</p></div>
        </div>
        <div className="panel log-panel"><div className="panel-heading compact"><div><div className="panel-kicker">03 / EVENT STREAM</div><h2>Sistem kayıtları</h2></div><span className="log-count">{String(events.length).padStart(2, '0')}</span></div>
          <div className="event-list">{events.map((event, i) => <div className="event" key={`${i}-${event.label}`}><time>{event.label}</time><span>{event.message}</span><b>{event.status}</b></div>)}</div>
        </div>
      </aside>
    </section>
    <footer><span>NEXUSCORE AI <b>0.1.0</b></span><span>LOCAL-FIRST · NO CLOUD CONNECTION</span><span>{clock.toLocaleTimeString('tr-TR', { hour12: false })}</span></footer>
    {toast && <div className="toast">{toast}</div>}
  </main>;
}

function Metric({ title, icon, value, unit, foot, meta, progress, note }) {
  return <article className="metric-card"><div className="metric-top"><span>{title}</span><span className="metric-icon">{icon}</span></div><div className="metric-value"><strong>{value}</strong><small>{unit}</small></div>{progress != null && <div className="meter"><span style={{ width: `${progress}%` }} /></div>}<div className="metric-foot"><span>{foot}</span><b>{meta}</b></div>{note && <div className="mini-note">{note}</div>}</article>;
}
function Permission({ name, description, active }) {
  return <div className="permission-row"><div><b>{name}</b><small>{description}</small></div><span className={`status-pill ${active ? 'on' : 'off'}`}>{active ? 'İZİNLİ' : 'KAPALI'}</span></div>;
}
