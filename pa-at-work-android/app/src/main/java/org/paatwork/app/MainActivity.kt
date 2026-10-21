package org.paatwork.app

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.os.Bundle
import android.view.View
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {

	private lateinit var webView: WebView
	private lateinit var swipeRefresh: SwipeRefreshLayout

	private val startUrl = "https://pa-atwork.org/login"

	@SuppressLint("SetJavaScriptEnabled")
	override fun onCreate(savedInstanceState: Bundle?) {
		super.onCreate(savedInstanceState)
		setContentView(R.layout.activity_main)

		swipeRefresh = findViewById(R.id.swipeRefresh)
		webView = findViewById(R.id.webView)

		val settings: WebSettings = webView.settings
		settings.javaScriptEnabled = true
		settings.domStorageEnabled = true
		settings.loadsImagesAutomatically = true
		settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW

		webView.webViewClient = object : WebViewClient() {
			override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
				return false // Keep all navigation in-app (no external browser)
			}

			override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
				super.onPageStarted(view, url, favicon)
				swipeRefresh.isRefreshing = true
			}

			override fun onPageFinished(view: WebView?, url: String?) {
				super.onPageFinished(view, url)
				swipeRefresh.isRefreshing = false
				toggleError(false)
			}

			override fun onReceivedError(
				view: WebView?,
				request: WebResourceRequest?,
				error: WebResourceError?
			) {
				super.onReceivedError(view, request, error)
				if (request?.isForMainFrame == true) {
					swipeRefresh.isRefreshing = false
					toggleError(true)
				}
			}
		}

		swipeRefresh.setOnRefreshListener {
			webView.reload()
		}

		if (savedInstanceState != null) {
			webView.restoreState(savedInstanceState)
		} else {
			webView.loadUrl(startUrl)
		}
	}

	override fun onSaveInstanceState(outState: Bundle) {
		super.onSaveInstanceState(outState)
		webView.saveState(outState)
	}

	override fun onBackPressed() {
		if (webView.canGoBack()) {
			webView.goBack()
		} else {
			super.onBackPressed()
		}
	}

	private fun toggleError(showError: Boolean) {
		val errorView = findViewById<View>(R.id.errorView)
		val webContainer = findViewById<View>(R.id.webContainer)
		errorView.visibility = if (showError) View.VISIBLE else View.GONE
		webContainer.visibility = if (showError) View.GONE else View.VISIBLE
	}
}
