package org.paatwork.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SitePolicyTest {
    @Test
    fun startUrlStaysInTheApp() {
        val decision = SitePolicy.decide(SitePolicy.START_URL)
        assertEquals(SitePolicy.Kind.IN_APP, decision.kind)
        assertFalse(decision.rewrite)
        assertTrue(SitePolicy.isInAppUrl(SitePolicy.START_URL))
    }

    @Test
    fun subdomainsStayInTheApp() {
        assertTrue(SitePolicy.isInAppUrl("https://www.pa-atwork.org/dashboard"))
        assertTrue(SitePolicy.isInAppUrl("https://stats.pa-atwork.org/path?q=1"))
        assertTrue(SitePolicy.isInAppUrl("https://PA-ATWORK.org/Login"))
        assertTrue(SitePolicy.isInAppUrl("https://pa-atwork.org:443/login"))
    }

    @Test
    fun votersPortalIsNeverLoaded() {
        listOf(
            "https://lge2026.pa-atwork.org/",
            "https://lge2026.pa-atwork.org/login",
            "https://LGE2026.pa-atwork.org/voters",
            "https://foo.lge2026.pa-atwork.org/x",
            "http://lge2026.pa-atwork.org/login",
            "https://user:pass@lge2026.pa-atwork.org/"
        ).forEach { url ->
            assertEquals(url, SitePolicy.Kind.BLOCKED, SitePolicy.decide(url).kind)
            assertFalse(SitePolicy.isInAppUrl(url))
            assertTrue(SitePolicy.mustBlockSubresource(url))
        }
    }

    @Test
    fun lookalikeHostsAreNotThePortal() {
        assertEquals(
            SitePolicy.Kind.EXTERNAL_BROWSER,
            SitePolicy.decide("https://pa-atwork.org.evil.com/login").kind
        )
        assertEquals(
            SitePolicy.Kind.EXTERNAL_BROWSER,
            SitePolicy.decide("https://notpa-atwork.org/").kind
        )
        assertEquals(
            SitePolicy.Kind.EXTERNAL_BROWSER,
            SitePolicy.decide("https://evil.com/?next=https://pa-atwork.org").kind
        )
        assertFalse(SitePolicy.isInAppUrl("https://pa-atwork.org.evil.com/"))
    }

    @Test
    fun httpOnOurHostIsUpgraded() {
        val decision = SitePolicy.decide("http://pa-atwork.org/login?returnUrl=%2Fdashboard")
        assertEquals(SitePolicy.Kind.IN_APP, decision.kind)
        assertTrue(decision.rewrite)
        assertEquals("https://pa-atwork.org/login?returnUrl=%2Fdashboard", decision.url)
        assertFalse(SitePolicy.isInAppUrl("http://pa-atwork.org/login"))
    }

    @Test
    fun cleartextSubresourcesAreBlocked() {
        assertTrue(SitePolicy.mustBlockSubresource("http://pa-atwork.org/styles/site.css"))
        assertTrue(SitePolicy.mustBlockSubresource("http://cdn.example.com/app.js"))
        assertFalse(SitePolicy.mustBlockSubresource("https://pa-atwork.org/styles/site.css"))
        assertFalse(SitePolicy.mustBlockSubresource("https://fonts.example.com/font.woff2"))
        assertFalse(SitePolicy.mustBlockSubresource("data:image/jpeg;base64,aaaa"))
        assertTrue(SitePolicy.mustBlockSubresource("data:text/html,<script></script>"))
    }

    @Test
    fun unsafeSchemesAreBlocked() {
        listOf(
            "javascript:alert(1)",
            "file:///data/data/org.paatwork.app/databases/webview.db",
            "content://com.android.contacts/contacts",
            "blob:https://pa-atwork.org/uuid",
            "intent://scan/#Intent;scheme=zxing;end",
            "data:text/html,<script>alert(1)</script>",
            "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>"
        ).forEach { url ->
            assertEquals(url, SitePolicy.Kind.BLOCKED, SitePolicy.decide(url).kind)
        }
    }

    @Test
    fun rasterDataImagesCanBeViewed() {
        val jpeg = "data:image/jpeg;base64,aaaa"
        assertEquals(SitePolicy.Kind.DATA_IMAGE, SitePolicy.decide(jpeg).kind)
        assertTrue(SitePolicy.isDataImage(jpeg))
        assertTrue(SitePolicy.isDataImage("data:image/png,xx"))
        assertFalse(SitePolicy.isDataImage("data:image/svg+xml;base64,xx"))
    }

    @Test
    fun externalLinksLeaveTheApp() {
        assertEquals(
            SitePolicy.Kind.EXTERNAL_BROWSER,
            SitePolicy.decide("https://wa.me/27123456789").kind
        )
        assertEquals(
            SitePolicy.Kind.EXTERNAL_BROWSER,
            SitePolicy.decide("https://maps.google.com/?q=-26.17,27.70").kind
        )
        assertEquals(SitePolicy.Kind.EXTERNAL_APP, SitePolicy.decide("mailto:desk@example.com").kind)
        assertEquals(SitePolicy.Kind.EXTERNAL_APP, SitePolicy.decide("tel:+27115550000").kind)
    }

    @Test
    fun credentialsAndOddPortsOnOurHostAreBlocked() {
        assertEquals(
            SitePolicy.Kind.BLOCKED,
            SitePolicy.decide("https://user:secret@pa-atwork.org/login").kind
        )
        assertEquals(
            SitePolicy.Kind.BLOCKED,
            SitePolicy.decide("https://pa-atwork.org:8443/login").kind
        )
    }

    @Test
    fun aSiblingHostIsNotTheVotersPortal() {
        assertTrue(SitePolicy.isInAppUrl("https://notlge2026.pa-atwork.org/login"))
    }

    @Test
    fun downloadPathsMatchExportAndDownloadSegments() {
        assertTrue(SitePolicy.isSiteDownloadPath("/resident-management/export"))
        assertTrue(SitePolicy.isSiteDownloadPath("https://pa-atwork.org/api/residents/export"))
        assertTrue(SitePolicy.isSiteDownloadPath("/files/download"))
        assertFalse(SitePolicy.isSiteDownloadPath("/login"))
        assertFalse(SitePolicy.isSiteDownloadPath("/resident-management"))
        assertFalse(SitePolicy.isSiteDownloadPath("/export-notes"))
    }
}
