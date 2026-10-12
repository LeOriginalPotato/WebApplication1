<?php
$user = app_user();
$role = $user['UserRole'] ?? '';
$isResident = strcasecmp($role, 'Resident') === 0;
$isProfileComplete = (bool)($user['IsProfileComplete'] ?? false);
$firstName = 'Leader';
if (!empty($user['Name'])) {
	$parts = preg_split('/\s+/', trim((string)$user['Name']));
	$firstName = $parts[0] ?? 'Leader';
}
?>
<div class="resident-dashboard">
	<section style="background:linear-gradient(140deg,rgba(0,104,55,.25),rgba(16,22,34,.9));border:1px solid rgba(255,204,0,.3);border-radius:18px;padding:1.4rem;box-shadow:0 14px 30px rgba(0,0,0,.28);margin-bottom:1.4rem;">
		<h1 style="color:#fff;font-size:clamp(1.3rem,2.8vw,2rem);font-weight:700;margin-bottom:1rem;">Good Day, <?= htmlspecialchars($firstName) ?>. Let's fix Randfontein together.</h1>
	</section>

	<section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:1rem;margin-bottom:1.5rem;">
		<article style="background:rgba(22,27,39,.95);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:1.2rem;">
			<h2 style="color:#fff;font-size:1.1rem;font-weight:700;margin-bottom:.55rem;">🚨 Report Infrastructure Failure</h2>
			<p>Log urgent municipal infrastructure issues with geolocation.</p>
			<?php if ($isResident && !$isProfileComplete): ?>
				<div style="border:1px solid rgba(255,141,161,.5);background:rgba(255,141,161,.1);color:#ffd0da;border-radius:10px;padding:.75rem;">Complete your resident profile before submitting complaints. <a href="/account/edit-my-user" style="font-weight:700;">Update Profile</a></div>
			<?php else: ?>
				<button id="toggleReportForm" type="button" style="border:1px solid #ffcc00;background:#ffcc00;color:#1a1f2c;font-weight:800;border-radius:999px;padding:.6rem 1rem;">Open Report Form</button>
				<div id="reportFormPane" style="display:none;margin-top:1rem;border-top:1px solid rgba(255,255,255,.12);padding-top:1rem;">
					<form id="faultReportForm" method="post">
						<div class="mb-3"><label class="form-label">Category</label><select id="category" class="form-select" required><option value="1">Electrical &amp; Grid</option><option value="2">Roads &amp; Transport</option><option value="3">Water &amp; Sanitation</option><option value="4">Environmental &amp; Landfill</option></select></div>
						<div class="mb-3"><label class="form-label">Description</label><textarea id="description" class="form-control" rows="4" required></textarea></div>
						<div class="mb-3"><label class="form-label">Physical Street Address</label><input id="physicalAddress" class="form-control" required /></div>
						<div class="row g-2 mb-3"><div class="col-6"><label class="form-label">Latitude</label><input id="latitude" type="number" step="0.000001" class="form-control" required /></div><div class="col-6"><label class="form-label">Longitude</label><input id="longitude" type="number" step="0.000001" class="form-control" required /></div></div>
						<button id="faultSubmitButton" type="submit" style="border:1px solid #ffcc00;background:#ffcc00;color:#1a1f2c;font-weight:800;border-radius:999px;padding:.6rem 1rem;">Submit Fault Report</button>
						<div id="faultResult" class="mt-3"></div>
					</form>
				</div>
			<?php endif; ?>
		</article>

		<article style="background:rgba(22,27,39,.95);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:1.2rem;">
			<h2 style="color:#fff;font-size:1.1rem;font-weight:700;margin-bottom:.55rem;">Mass Rates Objection Portal</h2>
			<p>Submit a structural Section 78 dispute for incorrect municipal categorization and valuation impacts.</p>
			<a href="/section78-dispute" style="border:1px solid #ffcc00;background:#ffcc00;color:#1a1f2c;font-weight:800;border-radius:999px;padding:.6rem 1rem;display:inline-block;">File Section 78 Dispute</a>
		</article>
	</section>

	<section style="background:rgba(21,27,39,.9);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:1.2rem;">
		<h2 style="color:#fff;font-size:1.15rem;font-weight:700;margin-bottom:.9rem;">My Live Action Queue</h2>
		<ul id="myComplaintsList" style="list-style:none;margin:0;padding:0;display:grid;gap:.75rem;"><li style="border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:.85rem .9rem;background:rgba(255,255,255,.02);">Loading your complaints...</li></ul>
	</section>
</div>

<script>
(() => {
	const toggleButton = document.getElementById('toggleReportForm');
	const panel = document.getElementById('reportFormPane');
	const form = document.getElementById('faultReportForm');
	const submitButton = document.getElementById('faultSubmitButton');
	const faultResult = document.getElementById('faultResult');
	const complaintsList = document.getElementById('myComplaintsList');

	const getStatusCss = (status) => {
		if (!status) return 'status-logged';
		const value = status.toLowerCase();
		if (value.includes('resolved')) return 'status-resolved';
		if (value.includes('escalated') || value.includes('inspection') || value.includes('dispatched')) return 'status-escalated';
		return 'status-logged';
	};

	const loadMyComplaints = async () => {
		if (!complaintsList) return;
		try {
			const response = await fetch('/api/infrastructure/my-complaints');
			if (!response.ok) {
				complaintsList.innerHTML = "<li style='border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:.85rem .9rem;background:rgba(255,255,255,.02);'>Unable to load complaints right now.</li>";
				return;
			}
			const complaints = await response.json();
			complaintsList.innerHTML = '';
			if (!complaints.length) {
				complaintsList.innerHTML = "<li style='border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:.85rem .9rem;background:rgba(255,255,255,.02);'>No complaints logged yet.</li>";
				return;
			}
			complaints.forEach((item) => {
				const loggedDate = new Date(item.dateLogged).toLocaleString();
				const updatedDate = new Date(item.lastUpdatedAt).toLocaleString();
				const latestUpdate = item.latestUpdate || item.status;
				const entry = document.createElement('li');
				entry.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.8rem;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:.85rem .9rem;background:rgba(255,255,255,.02);';
				entry.innerHTML = `<div><div style="color:#fff;font-weight:700;">${item.ticketReference}</div><div style="font-size:.88rem;">Logged on ${loggedDate}</div><div style="font-size:.88rem;">Latest update (${updatedDate}): ${latestUpdate}</div></div><span>${item.status}</span>`;
				complaintsList.appendChild(entry);
			});
		} catch {
			complaintsList.innerHTML = "<li style='border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:.85rem .9rem;background:rgba(255,255,255,.02);'>Network error while loading complaints.</li>";
		}
	};

	loadMyComplaints();

	if (toggleButton && panel) {
		toggleButton.addEventListener('click', () => {
			panel.style.display = panel.style.display === 'none' || panel.style.display === '' ? 'block' : 'none';
			toggleButton.textContent = panel.style.display === 'block' ? 'Hide Report Form' : 'Open Report Form';
		});
	}

	if (form && submitButton && faultResult) {
		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			submitButton.disabled = true;
			submitButton.textContent = 'Submitting...';
			faultResult.textContent = '';
			const payload = {
				categoryID: Number(document.getElementById('category').value),
				description: document.getElementById('description').value,
				physicalAddress: document.getElementById('physicalAddress').value,
				latitude: Number(document.getElementById('latitude').value),
				longitude: Number(document.getElementById('longitude').value)
			};
			try {
				const response = await fetch('/api/infrastructure/log-fault', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
				const result = await response.json();
				if (!response.ok) {
					faultResult.innerHTML = `<span style='color:#ff8da1;'>${result.message || 'Unable to log fault.'}</span>`;
					return;
				}
				faultResult.innerHTML = `<span style='color:#8bf0bc;font-weight:700;'>Fault logged successfully. Ticket: ${result.ticketReference || result.TicketReference}</span>`;
				form.reset();
				await loadMyComplaints();
			} catch {
				faultResult.innerHTML = "<span style='color:#ff8da1;'>Network error while submitting fault report.</span>";
			} finally {
				submitButton.disabled = false;
				submitButton.textContent = 'Submit Fault Report';
			}
		});
	}
})();
</script>
