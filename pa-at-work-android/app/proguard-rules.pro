# The download bridge is called by name from page JavaScript.
-keepattributes JavascriptInterface
-keepclassmembers class org.paatwork.app.DownloadBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
