package org.paatwork.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Message
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.content.ContextCompat
import androidx.core.net.toUri
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.appbar.MaterialToolbar
import org.json.JSONObject
import java.io.ByteArrayInputStream

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var errorView: View
    private lateinit var errorTitle: TextView
    private lateinit var errorBody: TextView

    private var mainFrameFailed = false
    private var errorVisible = false
    private var pendingError = ConnectionError.OFFLINE
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingRemote: PendingRemote? = null
    private var pendingBytes: PendingBytes? = null

    private val downloadHookJs: String by lazy {
        assets.open("download_hook.js").bufferedReader().use { it.readText() }
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = filePathCallback
        filePathCallback = null
        val uris = if (result.resultCode == Activity.RESULT_OK) {
            WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        } else {
            null
        }
        callback?.onReceiveValue(uris)
    }

    private val storagePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        val remote = pendingRemote
        val bytes = pendingBytes
        pendingRemote = null
        pendingBytes = null
        if (!granted) {
            toast(R.string.storage_permission_needed)
            return@registerForActivityResult
        }
        if (remote != null) {
            deliverRemote(remote)
        }
        if (bytes != null) {
            deliverBytes(bytes)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.root)) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime()
            )
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }

        swipeRefresh = findViewById(R.id.swipeRefresh)
        webView = findViewById(R.id.webView)
        errorView = findViewById(R.id.errorView)
        errorTitle = findViewById(R.id.errorTitle)
        errorBody = findViewById(R.id.errorBody)

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        toolbar.inflateMenu(R.menu.toolbar)
        toolbar.setOnMenuItemClickListener { item ->
            if (item.itemId == R.id.action_share) {
                shareCurrentPage()
                true
            } else {
                false
            }
        }
        findViewById<View>(R.id.retryButton).setOnClickListener { retry() }
        swipeRefresh.setColorSchemeColors(ContextCompat.getColor(this, R.color.pa_emerald))
        swipeRefresh.setOnRefreshListener {
            if (!isOnline()) {
                swipeRefresh.isRefreshing = false
                showConnectionError(ConnectionError.OFFLINE)
            } else {
                webView.reload()
            }
        }

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        configureWebView(webView)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    showWeb()
                    webView.goBack()
                    return
                }
                isEnabled = false
                onBackPressedDispatcher.onBackPressed()
            }
        })

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        }
        if (!isOnline()) {
            showConnectionError(ConnectionError.OFFLINE)
        } else if (savedInstanceState == null) {
            webView.loadUrl(SitePolicy.START_URL)
        } else {
            val restored = webView.url
            if (!restored.isNullOrBlank() &&
                !SitePolicy.isInAppUrl(restored) &&
                !SitePolicy.isDataImage(restored)
            ) {
                webView.loadUrl(SitePolicy.START_URL)
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::webView.isInitialized) {
            webView.saveState(outState)
        }
    }

    override fun onPause() {
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onDestroy() {
        filePathCallback?.onReceiveValue(null)
        filePathCallback = null
        if (::webView.isInitialized) {
            webView.removeJavascriptInterface(BRIDGE_NAME)
            (webView.parent as? ViewGroup)?.removeView(webView)
            webView.destroy()
        }
        super.onDestroy()
    }

    @SuppressLint("SetJavaScriptEnabled", "AddJavascriptInterface")
    private fun configureWebView(view: WebView) {
        val cookies = CookieManager.getInstance()
        cookies.setAcceptCookie(true)
        cookies.setAcceptThirdPartyCookies(view, false)

        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = false
            loadsImagesAutomatically = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_NO_CACHE
            allowFileAccess = false
            allowContentAccess = false
            @Suppress("DEPRECATION")
            allowFileAccessFromFileURLs = false
            @Suppress("DEPRECATION")
            allowUniversalAccessFromFileURLs = false
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(true)
            mediaPlaybackRequiresUserGesture = true
            setGeolocationEnabled(false)
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            userAgentString = userAgentString + " PAAtWorkApp/" + BuildConfig.VERSION_NAME
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                @Suppress("DEPRECATION")
                safeBrowsingEnabled = true
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                isAlgorithmicDarkeningAllowed = false
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                @Suppress("DEPRECATION")
                forceDark = WebSettings.FORCE_DARK_OFF
            }
        }
        view.setBackgroundColor(ContextCompat.getColor(this, R.color.pa_surface))
        view.clearCache(true)
        view.addJavascriptInterface(
            DownloadBridge(
                isTrustedPage = { SitePolicy.isInAppUrl(view.url) },
                onSave = { name, mime, data -> saveBase64(name, mime, data) },
                onFailed = { toast(R.string.download_failed) }
            ),
            BRIDGE_NAME
        )
        view.webViewClient = createWebClient()
        view.webChromeClient = createChromeClient()
        view.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            handleDownload(url, userAgent, contentDisposition, mimeType)
        }
    }

    private fun createWebClient(): WebViewClient {
        return object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return routeNavigation(request, fromPopup = false)
            }

            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                if (request.isForMainFrame) return null
                val url = request.url?.toString()
                if (!SitePolicy.mustBlockSubresource(url)) return null
                return WebResourceResponse("text/plain", "utf-8", ByteArrayInputStream(ByteArray(0)))
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                mainFrameFailed = false
                swipeRefresh.isRefreshing = true
                showWeb()
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                swipeRefresh.isRefreshing = false
                CookieManager.getInstance().flush()
                if (mainFrameFailed) {
                    showConnectionError(pendingError)
                } else {
                    showWeb()
                    if (view != null && SitePolicy.isInAppUrl(url)) {
                        view.evaluateJavascript(downloadHookJs, null)
                    }
                }
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                if (!request.isForMainFrame) return
                mainFrameFailed = true
                pendingError = classifyError(error)
                swipeRefresh.isRefreshing = false
                showConnectionError(pendingError)
            }

            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: android.net.http.SslError) {
                // Never continue past a certificate error.
                handler.cancel()
                val page = view.url
                val failed = error.url
                if (page.isNullOrBlank() || failed.isNullOrBlank() || failed == page) {
                    mainFrameFailed = true
                    pendingError = ConnectionError.INSECURE
                    swipeRefresh.isRefreshing = false
                    showConnectionError(ConnectionError.INSECURE)
                }
            }

            override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean {
                if (view == webView) {
                    replaceWebView()
                    showConnectionError(ConnectionError.FAILED)
                }
                return true
            }
        }
    }

    private fun createChromeClient(): WebChromeClient {
        return object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                val intent = try {
                    params?.createIntent()
                } catch (_: Exception) {
                    null
                } ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                }
                return try {
                    fileChooserLauncher.launch(intent)
                    true
                } catch (_: ActivityNotFoundException) {
                    filePathCallback = null
                    callback?.onReceiveValue(null)
                    toast(R.string.file_chooser_failed)
                    false
                }
            }

            override fun onCreateWindow(
                view: WebView,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message
            ): Boolean {
                val popup = WebView(view.context)
                popup.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(popupView: WebView, request: WebResourceRequest): Boolean {
                        val url = request.url?.toString().orEmpty()
                        if (url.isBlank() || url == "about:blank") return false
                        routeNavigation(request, fromPopup = true)
                        popupView.post { popupView.destroy() }
                        return true
                    }
                }
                val transport = resultMsg.obj as WebView.WebViewTransport
                transport.webView = popup
                resultMsg.sendToTarget()
                return true
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                request.deny()
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                callback?.invoke(origin, false, false)
            }
        }
    }

    private fun routeNavigation(request: WebResourceRequest, fromPopup: Boolean): Boolean {
        val raw = request.url?.toString() ?: return true
        if (raw == "about:blank") return false
        val decision = SitePolicy.decide(raw)
        val mainFrame = request.isForMainFrame || fromPopup
        return when (decision.kind) {
            SitePolicy.Kind.IN_APP -> {
                if (decision.rewrite || fromPopup) {
                    webView.loadUrl(decision.url)
                    true
                } else {
                    false
                }
            }
            SitePolicy.Kind.DATA_IMAGE -> {
                if (fromPopup) {
                    webView.loadUrl(decision.url)
                    true
                } else {
                    false
                }
            }
            SitePolicy.Kind.EXTERNAL_BROWSER -> {
                if (mainFrame) openExternal(decision.url)
                true
            }
            SitePolicy.Kind.EXTERNAL_APP -> {
                if (mainFrame && (request.hasGesture() || fromPopup)) openExternalApp(decision.url)
                true
            }
            SitePolicy.Kind.BLOCKED -> {
                if (mainFrame) toast(R.string.link_blocked)
                true
            }
        }
    }

    private fun handleDownload(url: String, userAgent: String, contentDisposition: String?, mimeType: String?) {
        when {
            url.startsWith("blob:", ignoreCase = true) -> saveBlobUrl(url)
            url.startsWith("data:", ignoreCase = true) -> saveDataUrl(url, mimeType)
            else -> {
                val decision = SitePolicy.decide(url)
                if (decision.kind != SitePolicy.Kind.IN_APP) {
                    toast(R.string.download_failed)
                    return
                }
                saveRemoteWithPermission(
                    PendingRemote(decision.url, userAgent, contentDisposition, mimeType)
                )
            }
        }
    }

    private fun saveBlobUrl(url: String) {
        if (!SitePolicy.isInAppUrl(webView.url)) {
            toast(R.string.download_failed)
            return
        }
        val quoted = JSONObject.quote(url)
        webView.evaluateJavascript(
            """
            (function(){
              try {
                fetch($quoted).then(function(response){ return response.blob(); }).then(function(blob){
                  var reader = new FileReader();
                  reader.onloadend = function(){
                    var result = String(reader.result || "");
                    var comma = result.indexOf(",");
                    var data = comma >= 0 ? result.substring(comma + 1) : result;
                    if (window.$BRIDGE_NAME) {
                      window.$BRIDGE_NAME.saveBase64File("download", blob.type || "application/octet-stream", data);
                    }
                  };
                  reader.readAsDataURL(blob);
                }).catch(function(){
                  if (window.$BRIDGE_NAME) window.$BRIDGE_NAME.reportDownloadFailed();
                });
              } catch (e) {
                if (window.$BRIDGE_NAME) window.$BRIDGE_NAME.reportDownloadFailed();
              }
            })();
            """.trimIndent(),
            null
        )
    }

    private fun saveDataUrl(url: String, mimeType: String?) {
        val comma = url.indexOf(',')
        if (comma < 5) {
            toast(R.string.download_failed)
            return
        }
        val meta = url.substring(5, comma)
        if (!meta.split(';').any { it.equals("base64", ignoreCase = true) }) {
            toast(R.string.download_failed)
            return
        }
        val mime = mimeType?.substringBefore(';')?.trim().orEmpty()
            .ifBlank { meta.substringBefore(';').ifBlank { "application/octet-stream" } }
        saveBase64(DownloadNames.ensureExtension("download", mime), mime, url.substring(comma + 1))
    }

    private fun saveBase64(fileName: String, mimeType: String, base64Data: String) {
        if (isDestroyed) return
        val cleaned = base64Data.trim()
        val maxChars = (FileSaver.MAX_BYTES / 3) * 4 + 64
        if (cleaned.length > maxChars) {
            toast(R.string.download_too_large)
            return
        }
        val bytes = try {
            android.util.Base64.decode(cleaned, android.util.Base64.DEFAULT)
        } catch (_: IllegalArgumentException) {
            toast(R.string.download_failed)
            return
        }
        if (bytes.size > FileSaver.MAX_BYTES) {
            toast(R.string.download_too_large)
            return
        }
        saveBytesWithPermission(PendingBytes(fileName, mimeType, bytes))
    }

    private fun saveRemoteWithPermission(remote: PendingRemote) {
        if (needsStoragePermission()) {
            pendingRemote = remote
            storagePermissionLauncher.launch(android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
            return
        }
        deliverRemote(remote)
    }

    private fun saveBytesWithPermission(pending: PendingBytes) {
        if (needsStoragePermission()) {
            pendingBytes = pending
            storagePermissionLauncher.launch(android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
            return
        }
        deliverBytes(pending)
    }

    private fun needsStoragePermission(): Boolean {
        return Build.VERSION.SDK_INT <= Build.VERSION_CODES.P &&
            ContextCompat.checkSelfPermission(
                this,
                android.Manifest.permission.WRITE_EXTERNAL_STORAGE
            ) != PackageManager.PERMISSION_GRANTED
    }

    private fun deliverRemote(remote: PendingRemote) {
        val saved = FileSaver.enqueue(
            this,
            remote.url,
            remote.userAgent,
            remote.contentDisposition,
            remote.mimeType
        )
        toast(if (saved) R.string.download_started else R.string.download_failed)
    }

    private fun deliverBytes(pending: PendingBytes) {
        val saved = FileSaver.saveBytes(this, pending.name, pending.mime, pending.bytes)
        toast(if (saved) R.string.download_started else R.string.download_failed)
    }

    private fun shareCurrentPage() {
        val url = webView.url
        if (!SitePolicy.isInAppUrl(url)) {
            toast(R.string.share_unavailable)
            return
        }
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, url)
            putExtra(Intent.EXTRA_SUBJECT, getString(R.string.app_name))
        }
        startActivity(Intent.createChooser(send, getString(R.string.share_chooser)))
    }

    private fun retry() {
        if (!isOnline()) {
            showConnectionError(ConnectionError.OFFLINE)
            return
        }
        val current = webView.url
        val target = if (SitePolicy.isInAppUrl(current) || SitePolicy.isDataImage(current)) {
            current
        } else {
            SitePolicy.START_URL
        }
        mainFrameFailed = false
        showWeb()
        webView.loadUrl(target ?: SitePolicy.START_URL)
    }

    private fun openExternal(url: String) {
        val uri = url.toUri()
        try {
            CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(this, uri)
        } catch (_: ActivityNotFoundException) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, uri))
            } catch (_: ActivityNotFoundException) {
                toast(R.string.external_link_failed)
            }
        }
    }

    private fun openExternalApp(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, url.toUri()))
        } catch (_: ActivityNotFoundException) {
            toast(R.string.external_link_failed)
        }
    }

    private fun replaceWebView() {
        val parent = webView.parent as? ViewGroup ?: return
        val index = parent.indexOfChild(webView)
        val params = webView.layoutParams
        webView.removeJavascriptInterface(BRIDGE_NAME)
        parent.removeView(webView)
        webView.destroy()
        val fresh = WebView(this)
        fresh.id = R.id.webView
        parent.addView(fresh, index, params)
        webView = fresh
        configureWebView(webView)
    }

    private fun showWeb() {
        errorVisible = false
        errorView.visibility = View.GONE
        swipeRefresh.visibility = View.VISIBLE
    }

    private fun showConnectionError(error: ConnectionError) {
        errorVisible = true
        swipeRefresh.isRefreshing = false
        val title: Int
        val body: Int
        when (error) {
            ConnectionError.OFFLINE -> {
                title = R.string.offline_title
                body = R.string.offline_body
            }
            ConnectionError.INSECURE -> {
                title = R.string.insecure_title
                body = R.string.insecure_body
            }
            ConnectionError.FAILED -> {
                title = R.string.load_failed_title
                body = R.string.load_failed_body
            }
        }
        errorTitle.setText(title)
        errorBody.setText(body)
        swipeRefresh.visibility = View.GONE
        errorView.visibility = View.VISIBLE
    }

    private fun classifyError(error: WebResourceError?): ConnectionError {
        val code = error?.errorCode
        if (code == WebViewClient.ERROR_FAILED_SSL_HANDSHAKE) return ConnectionError.INSECURE
        if (!isOnline()) return ConnectionError.OFFLINE
        return when (code) {
            WebViewClient.ERROR_HOST_LOOKUP,
            WebViewClient.ERROR_CONNECT,
            WebViewClient.ERROR_TIMEOUT,
            WebViewClient.ERROR_IO -> ConnectionError.OFFLINE
            else -> ConnectionError.FAILED
        }
    }

    private fun isOnline(): Boolean {
        val manager = getSystemService(ConnectivityManager::class.java) ?: return false
        val network = manager.activeNetwork ?: return false
        val capabilities = manager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun toast(message: Int) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    private enum class ConnectionError {
        OFFLINE,
        INSECURE,
        FAILED
    }

    private data class PendingRemote(
        val url: String,
        val userAgent: String,
        val contentDisposition: String?,
        val mimeType: String?
    )

    private data class PendingBytes(
        val name: String,
        val mime: String,
        val bytes: ByteArray
    )

    companion object {
        private const val BRIDGE_NAME = "PAAtWorkAndroid"
    }
}
