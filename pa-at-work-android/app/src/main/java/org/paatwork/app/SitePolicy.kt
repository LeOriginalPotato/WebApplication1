package org.paatwork.app

import java.net.IDN
import java.net.URI
import java.util.Locale

/**
 * Decides where a URL may go.
 *
 * Pages on pa-atwork.org and its subdomains stay inside the app.
 * lge2026.pa-atwork.org is refused entirely, including as a subdomain of itself.
 * Every other http(s) link is handed to the browser. Cleartext is never loaded in the WebView:
 * an http link on our own host is rewritten to https.
 */
object SitePolicy {
    const val START_URL = "https://pa-atwork.org/login"
    const val ROOT_HOST = "pa-atwork.org"
    const val BLOCKED_HOST = "lge2026.pa-atwork.org"

    private val RASTER_DATA_IMAGE = Regex(
        "^data:image/(png|jpe?g|gif|webp|bmp)([;,]|$)",
        RegexOption.IGNORE_CASE
    )

    enum class Kind {
        IN_APP,
        EXTERNAL_BROWSER,
        EXTERNAL_APP,
        BLOCKED,
        DATA_IMAGE
    }

    data class Decision(
        val kind: Kind,
        val url: String,
        val rewrite: Boolean = false
    )

    fun decide(raw: String?): Decision {
        if (raw.isNullOrBlank()) return Decision(Kind.BLOCKED, "")
        val trimmed = raw.trim()
        if (isDataImage(trimmed)) return Decision(Kind.DATA_IMAGE, trimmed)

        val lower = trimmed.lowercase(Locale.ROOT)
        if (lower.startsWith("javascript:") ||
            lower.startsWith("file:") ||
            lower.startsWith("content:") ||
            lower.startsWith("blob:") ||
            lower.startsWith("intent:") ||
            lower.startsWith("data:")
        ) {
            return Decision(Kind.BLOCKED, trimmed)
        }

        val uri = try {
            URI(trimmed)
        } catch (_: Exception) {
            return Decision(Kind.BLOCKED, trimmed)
        }
        if (!uri.userInfo.isNullOrEmpty()) return Decision(Kind.BLOCKED, trimmed)

        val scheme = uri.scheme?.lowercase(Locale.ROOT) ?: return Decision(Kind.BLOCKED, trimmed)
        when (scheme) {
            "mailto", "tel", "sms", "smsto", "geo" -> return Decision(Kind.EXTERNAL_APP, trimmed)
            "http", "https" -> Unit
            else -> return Decision(Kind.BLOCKED, trimmed)
        }

        val host = normalizeHost(uri.host ?: return Decision(Kind.BLOCKED, trimmed))
        if (host.isEmpty()) return Decision(Kind.BLOCKED, trimmed)
        if (isBlockedHost(host)) return Decision(Kind.BLOCKED, trimmed)

        val port = uri.port
        val standardPort = (scheme == "https" && (port == -1 || port == 443)) ||
            (scheme == "http" && (port == -1 || port == 80))
        if (!standardPort) {
            return if (isOurHost(host)) {
                Decision(Kind.BLOCKED, trimmed)
            } else {
                Decision(Kind.EXTERNAL_BROWSER, trimmed)
            }
        }

        if (isOurHost(host)) {
            if (scheme == "http") {
                return Decision(Kind.IN_APP, rewriteHttpToHttps(trimmed), rewrite = true)
            }
            return Decision(Kind.IN_APP, trimmed)
        }
        return Decision(Kind.EXTERNAL_BROWSER, trimmed)
    }

    fun isInAppUrl(raw: String?): Boolean {
        val decision = decide(raw)
        return decision.kind == Kind.IN_APP && !decision.rewrite
    }

    fun isDataImage(raw: String?): Boolean {
        return raw != null && RASTER_DATA_IMAGE.containsMatchIn(raw.trim())
    }

    /**
     * Subresources (images, scripts, XHR) are not navigations.
     * Cleartext, file URLs, and the blocked voters host are still refused.
     * Other https hosts are allowed so a future same-page asset does not break the portal.
     */
    fun mustBlockSubresource(raw: String?): Boolean {
        if (raw.isNullOrBlank()) return true
        val trimmed = raw.trim()
        val lower = trimmed.lowercase(Locale.ROOT)
        if (lower.startsWith("blob:") || lower == "about:blank") return false
        // Raster images only. data:text/html and SVG can carry script.
        if (lower.startsWith("data:")) return !isDataImage(trimmed)
        if (lower.startsWith("http://")) return true
        if (lower.startsWith("file:") || lower.startsWith("content:") || lower.startsWith("javascript:") || lower.startsWith("intent:")) {
            return true
        }
        val host = hostOf(trimmed) ?: return !lower.startsWith("https://")
        return isBlockedHost(host)
    }

    /** Path segments named export or download. Mirrors assets/download_hook.js. */
    fun isSiteDownloadPath(pathOrUrl: String?): Boolean {
        if (pathOrUrl.isNullOrBlank()) return false
        val path = if (pathOrUrl.startsWith("/")) {
            pathOrUrl
        } else {
            try {
                URI(pathOrUrl).path ?: return false
            } catch (_: Exception) {
                return false
            }
        }
        val segments = path.substringBefore('?').substringBefore('#').lowercase(Locale.ROOT)
            .split('/')
            .filter { it.isNotBlank() }
        return segments.any { it == "export" || it == "download" }
    }

    internal fun normalizeHost(host: String): String {
        val trimmed = host.trim().trimEnd('.').lowercase(Locale.ROOT)
        if (trimmed.isEmpty()) return ""
        return try {
            IDN.toASCII(trimmed, IDN.USE_STD3_ASCII_RULES).lowercase(Locale.ROOT)
        } catch (_: IllegalArgumentException) {
            trimmed
        }
    }

    private fun isOurHost(host: String): Boolean {
        return host == ROOT_HOST || host.endsWith(".$ROOT_HOST")
    }

    private fun isBlockedHost(host: String): Boolean {
        val normalized = normalizeHost(host)
        return normalized == BLOCKED_HOST || normalized.endsWith(".$BLOCKED_HOST")
    }

    private fun hostOf(raw: String): String? {
        val uri = try {
            URI(raw)
        } catch (_: Exception) {
            return null
        }
        val host = uri.host ?: return null
        return normalizeHost(host)
    }

    private fun rewriteHttpToHttps(raw: String): String {
        val rest = if (raw.length >= 7 && raw.regionMatches(0, "http://", 0, 7, ignoreCase = true)) {
            raw.substring(7)
        } else {
            raw
        }
        val cut = rest.indexOfAny(charArrayOf('/', '?', '#'))
        val authority = if (cut == -1) rest else rest.substring(0, cut)
        val tail = if (cut == -1) "" else rest.substring(cut)
        val at = authority.lastIndexOf('@')
        val hostPort = if (at >= 0) authority.substring(at + 1) else authority
        val host = hostPort.substringBefore(':')
        return "https://$host$tail"
    }
}
