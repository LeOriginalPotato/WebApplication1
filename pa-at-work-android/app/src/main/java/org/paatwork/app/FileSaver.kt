package org.paatwork.app

import android.app.DownloadManager
import android.content.ContentValues
import android.content.Context
import android.media.MediaScannerConnection
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.webkit.CookieManager
import androidx.annotation.RequiresApi
import androidx.core.net.toUri
import java.io.File
import java.io.IOException

/**
 * Saves a file the website produced into the public Downloads folder.
 * Nothing here talks to a database. The bytes come from an https response or from the page.
 */
object FileSaver {
    const val MAX_BYTES = 8 * 1024 * 1024

    fun enqueue(
        context: Context,
        url: String,
        userAgent: String,
        contentDisposition: String?,
        mimeType: String?
    ): Boolean {
        if (!SitePolicy.isInAppUrl(url)) return false
        val fileName = DownloadNames.fileName(url, contentDisposition, mimeType)
        val request = DownloadManager.Request(url.toUri()).apply {
            val cookie = CookieManager.getInstance().getCookie(url)
            if (!cookie.isNullOrBlank()) {
                addRequestHeader("Cookie", cookie)
            }
            if (userAgent.isNotBlank()) {
                addRequestHeader("User-Agent", userAgent)
            }
            setTitle(fileName)
            setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            val mime = mimeType?.substringBefore(';')?.trim().orEmpty()
            if (mime.isNotEmpty()) setMimeType(mime)
            setAllowedOverMetered(true)
            setAllowedOverRoaming(true)
        }
        val manager = context.getSystemService(DownloadManager::class.java) ?: return false
        return try {
            manager.enqueue(request)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun saveBytes(context: Context, displayName: String, mimeType: String?, bytes: ByteArray): Boolean {
        if (bytes.isEmpty() || bytes.size > MAX_BYTES) return false
        val mime = mimeType?.substringBefore(';')?.trim().orEmpty().ifBlank { "application/octet-stream" }
        val name = DownloadNames.ensureExtension(DownloadNames.sanitize(displayName), mime)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveWithMediaStore(context, name, mime, bytes)
        } else {
            saveLegacy(context, name, mime, bytes)
        }
    }

    @RequiresApi(Build.VERSION_CODES.Q)
    private fun saveWithMediaStore(context: Context, name: String, mime: String, bytes: ByteArray): Boolean {
        val collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, name)
            put(MediaStore.Downloads.MIME_TYPE, mime)
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = context.contentResolver.insert(collection, values) ?: return false
        return try {
            context.contentResolver.openOutputStream(uri)?.use { stream ->
                stream.write(bytes)
            } ?: return false
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            context.contentResolver.update(uri, values, null, null)
            true
        } catch (_: IOException) {
            context.contentResolver.delete(uri, null, null)
            false
        }
    }

    @Suppress("DEPRECATION")
    private fun saveLegacy(context: Context, name: String, mime: String, bytes: ByteArray): Boolean {
        val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        if (!dir.exists() && !dir.mkdirs()) return false
        val file = uniqueFile(dir, name)
        return try {
            file.writeBytes(bytes)
            MediaScannerConnection.scanFile(context, arrayOf(file.absolutePath), arrayOf(mime), null)
            true
        } catch (_: IOException) {
            false
        }
    }

    private fun uniqueFile(dir: File, name: String): File {
        val candidate = File(dir, name)
        if (!candidate.exists()) return candidate
        val dot = name.lastIndexOf('.')
        val stem = if (dot > 0) name.substring(0, dot) else name
        val ext = if (dot > 0) name.substring(dot) else ""
        return File(dir, stem.take(40) + "-" + System.currentTimeMillis() + ext)
    }
}
