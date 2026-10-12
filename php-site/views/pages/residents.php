<section style="display:grid;gap:1rem;">
	<div style="background:rgba(20,27,39,.94);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:1rem;">
		<h1 style="color:#fff;font-size:1.25rem;font-weight:700;">Residents List</h1>
		<p style="color:#a0aec0;">PA Members can review all registered residents and export the directory.</p>
		<a href="/api/residents/export" style="display:inline-block;border:1px solid #ffcc00;background:#ffcc00;color:#1a1f2c;font-weight:800;border-radius:999px;padding:.55rem .9rem;">Export Residents CSV</a>
	</div>
	<div style="background:rgba(20,27,39,.94);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:1rem;overflow:auto;">
		<table style="width:100%;border-collapse:collapse;color:#d2dbe8;min-width:860px;"><thead><tr><th>Username</th><th>Name</th><th>Address</th><th>Email</th><th>Phone</th><th>Registered</th></tr></thead><tbody id="residentRows"></tbody></table>
	</div>
</section>
<script>
(async () => {
 const tbody = document.getElementById('residentRows');
 const response = await fetch('/api/residents');
 if (!response.ok) { tbody.innerHTML = "<tr><td colspan='6'>Unable to load residents list.</td></tr>"; return; }
 const residents = await response.json();
 tbody.innerHTML = residents.length ? '' : "<tr><td colspan='6'>No residents found.</td></tr>";
 residents.forEach((r) => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${r.username}</td><td>${r.firstName} ${r.lastName}</td><td>${r.physicalAddress}</td><td>${r.emailAddress ?? ''}</td><td>${r.cellNumber}</td><td>${new Date(r.createdAt).toLocaleString()}</td>`; tbody.appendChild(tr); });
})();
</script>
