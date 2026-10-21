/*
 * Saves POST downloads that DownloadManager cannot replay.
 * Path rule matches SitePolicy.isSiteDownloadPath: a path segment named export or download.
 * Login and other form posts are left alone.
 */
(function () {
  if (window.__paAtWorkDownloadHook) return;
  if (!window.fetch || !window.FormData || !window.URLSearchParams || !window.URL || !window.FileReader) return;
  window.__paAtWorkDownloadHook = true;

  function isDownloadAction(action) {
    try {
      var url = new URL(action, window.location.href);
      var parts = url.pathname.toLowerCase().split("/");
      for (var i = 0; i < parts.length; i++) {
        if (parts[i] === "export" || parts[i] === "download") return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function fileNameFromDisposition(disposition) {
    var header = disposition || "";
    var star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
    if (star && star[1]) {
      try { return decodeURIComponent(star[1].trim()); } catch (e) { return star[1].trim(); }
    }
    var quoted = /filename\s*=\s*"([^"]+)"/i.exec(header);
    if (quoted && quoted[1]) return quoted[1].trim();
    var plain = /filename\s*=\s*([^;]+)/i.exec(header);
    if (plain && plain[1]) return plain[1].trim().replace(/^"|"$/g, "");
    return "download";
  }

  function looksLikeFile(contentType, disposition) {
    var type = (contentType || "").toLowerCase();
    var header = (disposition || "").toLowerCase();
    return header.indexOf("attachment") !== -1 ||
      type.indexOf("text/csv") !== -1 ||
      type.indexOf("application/csv") !== -1 ||
      type.indexOf("application/pdf") !== -1 ||
      type.indexOf("application/zip") !== -1 ||
      type.indexOf("application/octet-stream") !== -1 ||
      type.indexOf("spreadsheet") !== -1 ||
      type.indexOf("application/vnd") !== -1;
  }

  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form || String(form.tagName).toUpperCase() !== "FORM") return;
    var method = (form.getAttribute("method") || "get").toLowerCase();
    if (method !== "post") return;
    var action = form.getAttribute("action") || window.location.href;
    if (!isDownloadAction(action) && !form.hasAttribute("data-download")) return;
    if (!window.PAAtWorkAndroid) return;

    event.preventDefault();
    event.stopPropagation();

    var enctype = (form.getAttribute("enctype") || "").toLowerCase();
    var body = enctype === "multipart/form-data"
      ? new FormData(form)
      : new URLSearchParams(new FormData(form));

    fetch(action, {
      method: "POST",
      body: body,
      credentials: "include",
      redirect: "follow"
    }).then(function (response) {
      var type = response.headers.get("content-type") || "";
      var disposition = response.headers.get("content-disposition") || "";
      if (!looksLikeFile(type, disposition)) {
        if (response.redirected && response.url) {
          window.location.assign(response.url);
          return null;
        }
        return response.text().then(function (html) {
          document.open();
          document.write(html);
          document.close();
        });
      }
      var name = fileNameFromDisposition(disposition);
      return response.blob().then(function (blob) {
        return new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onloadend = function () {
            var result = String(reader.result || "");
            var comma = result.indexOf(",");
            var data = comma >= 0 ? result.substring(comma + 1) : result;
            window.PAAtWorkAndroid.saveBase64File(name, blob.type || type, data);
            resolve();
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      });
    }).catch(function () {
      if (window.PAAtWorkAndroid && window.PAAtWorkAndroid.reportDownloadFailed) {
        window.PAAtWorkAndroid.reportDownloadFailed();
      }
    });
  }, true);
})();
