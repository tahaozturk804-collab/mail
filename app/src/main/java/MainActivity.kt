package com.nexuscore.ai

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.os.BatteryManager
import android.os.Bundle
import android.os.Debug
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.Process
import android.os.SystemClock
import android.provider.Settings
import android.speech.RecognizerIntent
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import com.nexuscore.ai.bridge.NexusBridge
import com.nexuscore.ai.core.ResourceGovernor
import org.json.JSONObject
import java.util.Locale
import kotlin.math.max

@Suppress("DEPRECATION")
class MainActivity : Activity() {
    private lateinit var webView: WebView
    private val mainHandler = Handler(Looper.getMainLooper())
    private val resourceGovernor by lazy { ResourceGovernor() }

    private var previousCpuTimeMs = Process.getElapsedCpuTime()
    private var previousWallTimeMs = SystemClock.elapsedRealtime()
    @Volatile private var appCpuPercent = 0.0

    private val voiceRequestCode = 9101
    private val microphonePermissionCode = 9102

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = android.graphics.Color.rgb(7, 11, 19)
        window.navigationBarColor = android.graphics.Color.rgb(7, 11, 19)
        window.decorView.systemUiVisibility = 0

        webView = WebView(this).apply {
            setBackgroundColor(android.graphics.Color.rgb(7, 11, 19))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.allowFileAccessFromFileURLs = false
            settings.allowUniversalAccessFromFileURLs = false
            addJavascriptInterface(NexusBridge(this@MainActivity), "Nexus")
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    val url = request?.url?.toString().orEmpty()
                    // The bridge is exposed only to our bundled, local UI.
                    return !url.startsWith("file:///android_asset/www/")
                }
            }
            loadUrl("file:///android_asset/www/index.html")
        }
        setContentView(webView)

    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) webView.onResume()
        mainHandler.removeCallbacks(monitorRunnable)
        mainHandler.post(monitorRunnable)
    }

    override fun onPause() {
        mainHandler.removeCallbacks(monitorRunnable)
        if (::webView.isInitialized) webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        mainHandler.removeCallbacks(monitorRunnable)
        if (::webView.isInitialized) {
            webView.removeJavascriptInterface("Nexus")
            webView.stopLoading()
            webView.loadUrl("about:blank")
            webView.destroy()
        }
        resourceGovernor.close()
        super.onDestroy()
    }

    private val monitorRunnable = object : Runnable {
        override fun run() {
            updateCpuEstimate()
            resourceGovernor.updateMeasuredCpu(appCpuPercent)
            mainHandler.postDelayed(this, 1500L)
        }
    }

    @Synchronized
    private fun updateCpuEstimate() {
        val wallNow = SystemClock.elapsedRealtime()
        val cpuNow = Process.getElapsedCpuTime()
        val wallDelta = max(1L, wallNow - previousWallTimeMs)
        val cpuDelta = max(0L, cpuNow - previousCpuTimeMs)
        val cores = max(1, Runtime.getRuntime().availableProcessors())
        appCpuPercent = ((cpuDelta.toDouble() / wallDelta.toDouble()) * 100.0 / cores)
            .coerceIn(0.0, 100.0)
        previousWallTimeMs = wallNow
        previousCpuTimeMs = cpuNow
    }

    fun systemSnapshotJson(): String {
        updateCpuEstimate()
        val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
        val memoryInfo = android.app.ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memoryInfo)

        val runtime = Runtime.getRuntime()
        val appHeapUsedMb = (runtime.totalMemory() - runtime.freeMemory()) / (1024.0 * 1024.0)
        val totalRamMb = memoryInfo.totalMem / (1024.0 * 1024.0)
        val usedRamMb = (memoryInfo.totalMem - memoryInfo.availMem) / (1024.0 * 1024.0)

        val batteryIntent = registerReceiver(null, android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val batteryTempRaw = batteryIntent?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1) ?: -1
        val batteryLevel = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val batteryScale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        val batteryPercent = if (batteryLevel >= 0 && batteryScale > 0) {
            (batteryLevel * 100.0 / batteryScale).toInt()
        } else -1

        val thermalStatus = if (android.os.Build.VERSION.SDK_INT >= 29) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            powerManager.currentThermalStatus
        } else -1

        return JSONObject()
            .put("cpuPercent", appCpuPercent)
            .put("cpuBudgetPercent", ResourceGovernor.CPU_BUDGET_PERCENT)
            .put("ramUsedMb", usedRamMb)
            .put("ramTotalMb", totalRamMb)
            .put("appHeapUsedMb", appHeapUsedMb)
            .put("batteryTempC", if (batteryTempRaw >= 0) batteryTempRaw / 10.0 else JSONObject.NULL)
            .put("batteryPercent", batteryPercent)
            .put("thermalStatus", thermalStatus)
            .put("thermalLabel", thermalLabel(thermalStatus))
            .put("processCpuTimeMs", Process.getElapsedCpuTime())
            .put("nativeHeapMb", Debug.getNativeHeapAllocatedSize() / (1024.0 * 1024.0))
            .toString()
    }

    private fun thermalLabel(status: Int): String = when (status) {
        0 -> "NORMAL"
        1 -> "LIGHT"
        2 -> "MODERATE"
        3 -> "SEVERE"
        4 -> "CRITICAL"
        5 -> "EMERGENCY"
        6 -> "SHUTDOWN"
        else -> "UNAVAILABLE"
    }

    fun permissionSnapshotJson(): String {
        val hasMic = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        return JSONObject()
            .put("microphoneGranted", hasMic)
            .put("accessibilityService", false)
            .put("automationAvailable", false)
            .toString()
    }

    fun runSafeCommand(rawCommand: String): String {
        val command = rawCommand.trim().lowercase(Locale.ROOT)
        if (command.isBlank()) return response(false, "Bir komut yazmalısın.")

        // The first MVP intentionally supports a small, explicit allowlist only.
        if (listOf("sil", "silinsin", "gönder", "aktar", "öde", "şifre", "parola", "banka").any { command.contains(it) }) {
            return response(false, "Güvenlik kilidi: Hassas veri, ödeme veya kalıcı değişiklik komutları bu sürümde yürütülmez.")
        }

        return when (command) {
            "yardım", "help", "komutlar" -> response(
                true,
                "Desteklenenler: cihaz bilgisi, ayarları aç, wifi ayarları, bluetooth ayarları, ekran ayarları, pil ayarları, ses artır, ses azalt."
            )
            "cihaz bilgisi", "sistem durumu", "durum" -> {
                val snapshot = JSONObject(systemSnapshotJson())
                response(true, "NEXUSCORE CPU: ${snapshot.optDouble("cpuPercent", 0.0).format1()}% · RAM: ${snapshot.optDouble("ramUsedMb", 0.0).toInt()} / ${snapshot.optDouble("ramTotalMb", 0.0).toInt()} MB · Isı: ${snapshot.optString("thermalLabel")}")
            }
            "ayarlar", "ayarları aç", "sistem ayarları" -> openSettings(Settings.ACTION_SETTINGS, "Sistem ayarları açılıyor.")
            "wifi", "wifi ayarları", "wifi ayarlarını aç", "wi-fi ayarları" -> openSettings(Settings.ACTION_WIFI_SETTINGS, "Wi-Fi ayarları açılıyor. Wi-Fi durumunu Android'in sistem panelinden değiştirebilirsin.")
            "bluetooth", "bluetooth ayarları", "bluetooth ayarlarını aç" -> openSettings(Settings.ACTION_BLUETOOTH_SETTINGS, "Bluetooth ayarları açılıyor. Değişiklik Android sistem panelinden yapılır.")
            "ekran", "ekran ayarları", "parlaklık ayarları" -> openSettings(Settings.ACTION_DISPLAY_SETTINGS, "Ekran ayarları açılıyor.")
            "pil", "pil ayarları", "batarya ayarları" -> openSettings(Settings.ACTION_BATTERY_SAVER_SETTINGS, "Pil ayarları açılıyor.")
            "ses artır", "sesi artır", "ses yükselt" -> adjustVolume(AudioManager.ADJUST_RAISE)
            "ses azalt", "sesi azalt", "sesi kıs" -> adjustVolume(AudioManager.ADJUST_LOWER)

            else -> response(false, "Bu komut ilk sürümde tanımlı değil. 'yardım' yazarak desteklenen komutları görebilirsin.")
        }
    }

    private fun openSettings(action: String, message: String): String {
        return try {
            runOnUiThread {
                try {
                    startActivity(Intent(action))
                } catch (_: Exception) {
                    Toast.makeText(this, "Bu ayar ekranı cihazında bulunamadı.", Toast.LENGTH_SHORT).show()
                }
            }
            response(true, message)
        } catch (_: Exception) {
            response(false, "Ayarlar açılamadı.")
        }
    }

    private fun adjustVolume(direction: Int): String {
        return try {
            runOnUiThread {
                val audio = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                audio.adjustStreamVolume(AudioManager.STREAM_MUSIC, direction, AudioManager.FLAG_SHOW_UI)
            }
            response(true, if (direction == AudioManager.ADJUST_RAISE) "Medya sesi bir kademe artırıldı." else "Medya sesi bir kademe azaltıldı.")
        } catch (_: Exception) {
            response(false, "Ses seviyesi değiştirilemedi.")
        }
    }

    fun beginVoiceInput() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), microphonePermissionCode)
            return
        }
        launchSpeechRecognizer()
    }

    private fun launchSpeechRecognizer() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "tr-TR")
            putExtra(RecognizerIntent.EXTRA_PROMPT, "NEXUSCORE komutunu dinliyor")
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        }
        try {
            startActivityForResult(intent, voiceRequestCode)
        } catch (_: ActivityNotFoundException) {
            notifyVoiceError("Bu cihazda kullanılabilir bir konuşma tanıma uygulaması bulunamadı.")
        } catch (_: SecurityException) {
            notifyVoiceError("Mikrofon izni verilmedi.")
        }
    }

    @Deprecated("Speech recognizer result callback")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == voiceRequestCode) {
            if (resultCode == RESULT_OK) {
                val result = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
                if (!result.isNullOrBlank()) {
                    val quoted = JSONObject.quote(result)
                    webView.post { webView.evaluateJavascript("window.NexusUI && window.NexusUI.onVoiceResult($quoted);", null) }
                } else notifyVoiceError("Konuşma anlaşılamadı. Tekrar deneyebilirsin.")
            } else notifyVoiceError("Sesli giriş iptal edildi.")
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == microphonePermissionCode) {
            if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
                launchSpeechRecognizer()
            } else {
                notifyVoiceError("Sesli komut için mikrofon izni gerekli. Yazılı komutları kullanmaya devam edebilirsin.")
            }
            refreshPermissionsInUi()
        }
    }

    private fun notifyVoiceError(message: String) {
        val quoted = JSONObject.quote(message)
        if (::webView.isInitialized) {
            webView.post { webView.evaluateJavascript("window.NexusUI && window.NexusUI.onVoiceError($quoted);", null) }
        }
    }

    private fun refreshPermissionsInUi() {
        if (::webView.isInitialized) {
            val permissions = permissionSnapshotJson()
            webView.post { webView.evaluateJavascript("window.NexusUI && window.NexusUI.onPermissions($permissions);", null) }
        }
    }

    private fun response(ok: Boolean, message: String): String = JSONObject()
        .put("ok", ok)
        .put("message", message)
        .toString()

    private fun Double.format1(): String = String.format(Locale.US, "%.1f", this)
}
