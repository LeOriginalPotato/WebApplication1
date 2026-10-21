package org.paatwork.app

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface

/**
 * Page script calls this only to hand over a file the site already generated.
 * Calls from a page that is not https://pa-atwork.org (or an allowed subdomain) are ignored.
 */
class DownloadBridge(
    private val isTrustedPage: () -> Boolean,
    private val onSave: (fileName: String, mimeType: String, base64Data: String) -> Unit,
    private val onFailed: () -> Unit
) {
    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun saveBase64File(fileName: String?, mimeType: String?, base64Data: String?) {
        val safeName = fileName ?: "download"
        val safeType = mimeType ?: "application/octet-stream"
        val payload = base64Data ?: ""
        mainHandler.post {
            if (!isTrustedPage()) return@post
            onSave(safeName, safeType, payload)
        }
    }

    @JavascriptInterface
    fun reportDownloadFailed() {
        mainHandler.post {
            if (!isTrustedPage()) return@post
            onFailed()
        }
    }
}
