<section style="max-width:920px;margin:1.2rem auto;background:rgba(20,27,39,.95);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:1.2rem;box-shadow:0 14px 30px rgba(0,0,0,.32);">
	<h1 style="color:#fff;font-size:1.35rem;font-weight:700;">WHM Hosting Configuration</h1>
	<p style="color:#a0aec0;">Use this page to update the live site settings and WhatsApp contact link.</p>
	<form id="configForm">
		<div class="row g-3">
			<div class="col-md-6"><label class="form-label text-white">Website Name</label><input id="websiteName" class="form-control" value="<?= htmlspecialchars((string)($config['WebsiteName'] ?? '')) ?>" required /></div>
			<div class="col-md-6"><label class="form-label text-white">Domain Name</label><input id="domainName" class="form-control" value="<?= htmlspecialchars((string)($config['DomainName'] ?? '')) ?>" required /></div>
			<div class="col-12"><label class="form-label text-white">Storage Root Path</label><input id="storageRootPath" class="form-control" value="<?= htmlspecialchars((string)($config['StorageRootPath'] ?? '')) ?>" required /></div>
			<div class="col-12"><label class="form-label text-white">Local Directory Structure</label><input id="localDirectoryStructure" class="form-control" value="<?= htmlspecialchars((string)($config['LocalDirectoryStructure'] ?? '')) ?>" required /></div>
			<div class="col-12"><label class="form-label text-white">Database Connection String</label><textarea id="databaseConnectionString" class="form-control" rows="3" required><?= htmlspecialchars((string)($config['DatabaseConnectionString'] ?? '')) ?></textarea></div>
			<div class="col-12"><label class="form-label text-white">Backup Drive Location</label><input id="backupDriveLocation" class="form-control" value="<?= htmlspecialchars((string)($config['BackupDriveLocation'] ?? '')) ?>" required /></div>
			<div class="col-12"><label class="form-label text-white">WhatsApp Chat Link</label><input id="whatsAppChatLink" class="form-control" value="<?= htmlspecialchars((string)($config['WhatsAppChatLink'] ?? '')) ?>" required /></div>
			<div class="col-12 d-grid"><button type="submit" style="border:1px solid #ffcc00;background:#ffcc00;color:#1a1f2c;font-weight:800;border-radius:999px;padding:.6rem 1rem;">Save Configuration</button></div>
		</div>
	</form>
	<div id="configMessage" style="margin-top:.9rem;color:#a0aec0;"></div>
</section>
<script>
(() => {
const form = document.getElementById('configForm'); const message = document.getElementById('configMessage');
form.addEventListener('submit', async (event) => {
 event.preventDefault(); message.textContent='Saving...';
 const payload = { websiteName: websiteName.value, domainName: domainName.value, storageRootPath: storageRootPath.value, localDirectoryStructure: localDirectoryStructure.value, databaseConnectionString: databaseConnectionString.value, backupDriveLocation: backupDriveLocation.value, whatsAppChatLink: whatsAppChatLink.value };
 const response = await fetch('/api/system-configuration', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
 message.innerHTML = response.ok ? "<span style='color:#8bf0bc;font-weight:700;'>Configuration saved successfully.</span>" : "<span style='color:#ff8da1;'>Failed to save configuration.</span>";
});
})();
</script>
