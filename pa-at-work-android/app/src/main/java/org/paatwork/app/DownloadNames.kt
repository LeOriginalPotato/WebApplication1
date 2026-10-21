package org.paatwork.app

import java.net.URI
import java.net.URLDecoder
import java.util.Locale

/** Turns a site download into a safe file name for the public Downloads folder. */
object DownloadNames {
    fun fileName(url: String, contentDisposition: String?, mimeType: String?): String {
        val fromHeader = filenameFromContentDisposition(contentDisposition)
        val fromUrl = filenameFromUrl(url)
        val raw = fromHeader ?: fromUrl ?: "download"
        return ensureExtension(sanitize(raw), mimeType)
    }

    fun filenameFromContentDisposition(header: String?): String? {
        if (header.isNullOrBlank()) return null
        val extended = Regex("""filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)""", RegexOption.IGNORE_CASE)
            .find(header)
        if (extended != null) {
            val value = extended.groupValues[1].trim().trim('"')
            return try {
                URLDecoder.decode(value, "UTF-8")
            } catch (_: Exception) {
                value
            }
        }
        val quoted = Regex("""filename\s*=\s*"([^"]+)"""", RegexOption.IGNORE_CASE).find(header)
        if (quoted != null) return quoted.groupValues[1].trim()
        val plain = Regex("""filename\s*=\s*([^;]+)""", RegexOption.IGNORE_CASE).find(header)
        return plain?.groupValues?.get(1)?.trim()?.trim('"')?.takeIf { it.isNotEmpty() }
    }

    fun sanitize(raw: String): String {
        val base = raw.substringAfterLast('/').substringAfterLast('\\').trim()
        val cleaned = base.replace(Regex("""[^\p{L}\p{N}._ -]"""), "_")
            .trim(' ', '.', '_')
            .take(80)
        return cleaned.ifBlank { "download" }
    }

    fun ensureExtension(name: String, mimeType: String?): String {
        if ('.' in name) return name
        val ext = when (mimeType?.substringBefore(';')?.trim()?.lowercase(Locale.ROOT)) {
            "text/csv", "application/csv" -> ".csv"
            "application/pdf" -> ".pdf"
            "application/zip" -> ".zip"
            "text/plain" -> ".txt"
            "image/jpeg", "image/jpg" -> ".jpg"
            "image/png" -> ".png"
            "image/webp" -> ".webp"
            "image/gif" -> ".gif"
            else -> ""
        }
        return name + ext
    }

    private fun filenameFromUrl(url: String): String? {
        if (url.startsWith("data:", ignoreCase = true) || url.startsWith("blob:", ignoreCase = true)) {
            return null
        }
        val path = try {
            URI(url).path
        } catch (_: Exception) {
            return null
        } ?: return null
        return path.substringAfterLast('/').takeIf { it.isNotBlank() }
    }
}
