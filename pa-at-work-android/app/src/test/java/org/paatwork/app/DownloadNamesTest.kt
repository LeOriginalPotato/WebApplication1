package org.paatwork.app

import org.junit.Assert.assertEquals
import org.junit.Test

class DownloadNamesTest {
    @Test
    fun usesContentDispositionFileName() {
        val header = "attachment; filename=\"residents_selected_2026-10-21.csv\""
        assertEquals(
            "residents_selected_2026-10-21.csv",
            DownloadNames.fileName("https://pa-atwork.org/resident-management/export", header, "text/csv")
        )
    }

    @Test
    fun decodesExtendedFileName() {
        val header = "attachment; filename*=UTF-8''resident%20list.csv"
        assertEquals("resident list.csv", DownloadNames.filenameFromContentDisposition(header))
    }

    @Test
    fun stripsPathTricks() {
        assertEquals("residents.csv", DownloadNames.sanitize("../../residents.csv"))
        assertEquals("residents.csv", DownloadNames.sanitize("C:\\Users\\a\\residents.csv"))
        assertEquals("download", DownloadNames.sanitize(".."))
        assertEquals("download", DownloadNames.sanitize("   "))
    }

    @Test
    fun addsCsvExtensionWhenTheNameHasNone() {
        assertEquals("export.csv", DownloadNames.ensureExtension("export", "text/csv; charset=utf-8"))
        assertEquals("export.csv", DownloadNames.ensureExtension("export.csv", "text/csv"))
    }

    @Test
    fun fallsBackToTheUrlPath() {
        assertEquals(
            "residents.csv",
            DownloadNames.fileName(
                "https://pa-atwork.org/api/residents/export/residents.csv",
                null,
                "text/csv"
            )
        )
    }
}
