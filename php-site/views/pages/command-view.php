<section style="display:grid;gap:1rem;color:#a0aec0;">
	<section style="background:rgba(20,27,39,.94);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:1rem;">
		<h2 style="color:#fff;font-size:1.05rem;font-weight:700;margin-bottom:.7rem;">Oversight Tab</h2>
	</section>
	<section style="background:rgba(20,27,39,.94);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:1rem;">
		<h2 style="color:#fff;font-size:1.05rem;font-weight:700;margin-bottom:.7rem;">All Logged Community Complaints</h2>
		<div id="oversightMessage"></div><div id="ticketList" style="display:grid;gap:.7rem;"></div>
	</section>
</section>
<script>
(() => {
const list = document.getElementById('ticketList'); const message = document.getElementById('oversightMessage');
const renderTicket = (ticket) => {
 const card = document.createElement('article'); card.style.cssText='border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.85rem;background:rgba(255,255,255,.02);';
 card.innerHTML = `<div style="display:flex;justify-content:space-between;gap:.6rem;flex-wrap:wrap;"><div><div style="color:#fff;font-weight:700;">${ticket.ticketReference}</div><div style="font-size:.88rem;">${new Date(ticket.dateLogged).toLocaleString()} · ${ticket.category}</div></div><span>${ticket.status}</span></div><div style="margin-top:.7rem;padding-top:.7rem;border-top:1px solid rgba(255,255,255,.1);display:grid;gap:.7rem;"><div>GPS: ${ticket.latitude}, ${ticket.longitude}</div><div><strong>Resident:</strong> ${ticket.resident}</div><div><strong>Address:</strong> ${ticket.physicalAddress}</div><div><label class="form-label text-white">Inspection Findings / Status Report</label><textarea class="findings form-control">${ticket.inspectionFindings ?? ''}</textarea></div><label><input type="checkbox" class="dispatch" ${ticket.teamDispatched ? 'checked' : ''}/> Team Dispatched</label><label><input type="checkbox" class="resolve" ${ticket.isResolved ? 'checked disabled' : ''}/> Mark as Resolved</label><button type="button" class="btn btn-warning save">Save Workflow Update</button><div class="result"></div></div>`;
 const saveButton = card.querySelector('.save'); const findingsEl = card.querySelector('.findings'); const dispatchEl = card.querySelector('.dispatch'); const resolveEl = card.querySelector('.resolve'); const resultEl = card.querySelector('.result');
 saveButton.addEventListener('click', async () => {
   const payload = { teamDispatched: dispatchEl.checked, inspectionFindings: findingsEl.value, markResolved: resolveEl.checked };
   const response = await fetch(`/api/oversight/complaints/${ticket.faultID}/workflow`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
   if (response.ok) { const updated = await response.json(); card.querySelector('span').textContent = updated.status; if (updated.isResolved){resolveEl.disabled=true;dispatchEl.disabled=true;findingsEl.disabled=true;saveButton.disabled=true;} resultEl.innerHTML='<span style="color:#8bf0bc;">Workflow updated.</span>'; }
   else { resultEl.innerHTML='<span style="color:#ff8da1;">Update failed.</span>'; }
 });
 list.appendChild(card);
};
const loadComplaints = async () => { message.textContent='Loading complaints...'; const response = await fetch('/api/oversight/complaints'); if(!response.ok){message.innerHTML='<span style="color:#ff8da1;">Unable to load complaints.</span>'; return;} const complaints = await response.json(); list.innerHTML=''; message.textContent=`${complaints.length} complaints loaded.`; complaints.forEach(renderTicket);} ;
loadComplaints();
})();
</script>
