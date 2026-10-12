<?php
$totalVerifiedIssues = (int)($stats['total'] ?? 0);
$electricalCount = (int)($stats['electrical'] ?? 0);
$roadsCount = (int)($stats['roads'] ?? 0);
$waterCount = (int)($stats['water'] ?? 0);
$landfillCount = (int)($stats['landfill'] ?? 0);
?>
<section style="display:grid;gap:1.25rem;color:#a0aec0;">
	<section style="background:linear-gradient(145deg,rgba(0,104,55,.16),rgba(19,25,38,.92));border:1px solid rgba(0,104,55,.45);border-radius:20px;padding:1.35rem 1.5rem;">
		<p style="margin:0;color:#fff;font-size:.95rem;text-transform:uppercase;letter-spacing:.08em;">Massive Impact Ticker</p>
		<p style="margin-top:.4rem;color:#ffcc00;font-size:clamp(1.9rem,6vw,3.8rem);font-weight:800;"><?= $totalVerifiedIssues ?> Verified Issues</p>
	</section>
	<section class="row g-3">
		<div class="col-md-3"><div style="background:rgba(20,26,39,.92);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:1rem;"><div>⚡</div><h3><?= $electricalCount ?></h3><p>Grid & Transformer Failures</p></div></div>
		<div class="col-md-3"><div style="background:rgba(20,26,39,.92);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:1rem;"><div>☁️</div><h3><?= $landfillCount ?></h3><p>Uitvalfontein Air Hazards</p></div></div>
		<div class="col-md-3"><div style="background:rgba(20,26,39,.92);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:1rem;"><div>🛣️</div><h3><?= $roadsCount ?></h3><p>Potholes & Drainage Hazards</p></div></div>
		<div class="col-md-3"><div style="background:rgba(20,26,39,.92);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:1rem;"><div>💧</div><h3><?= $waterCount ?></h3><p>Critical Pipe Bursts</p></div></div>
	</section>
</section>
