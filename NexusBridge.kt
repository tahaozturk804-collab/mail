package com.nexuscore.ai.bridge

import android.webkit.JavascriptInterface
import com.nexuscore.ai.MainActivity

/**
 * Narrow bridge exposed only to the app's bundled local WebView assets.
 * Never load remote or user-supplied web pages in this WebView.
 */
class NexusBridge(private val activity: MainActivity) {
    @JavascriptInterface
    fun getSystemSnapshot(): String = activity.systemSnapshotJson()

    @JavascriptInterface
    fun getPermissionStatus(): String = activity.permissionSnapshotJson()

    @JavascriptInterface
    fun runCommand(command: String): String = activity.runSafeCommand(command)

    @JavascriptInterface
    fun startVoiceInput() {
        activity.runOnUiThread { activity.beginVoiceInput() }
    }

}
