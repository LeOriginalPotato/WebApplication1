<?php
/** @var string $viewFile */
$user = app_user();
$role = $user['UserRole'] ?? null;
$cfg = db_one(db(), 'SELECT * FROM SystemConfigurations ORDER BY UpdatedAt DESC LIMIT 1');
$whatsAppLink = trim((string)($cfg['WhatsAppChatLink'] ?? '')) ?: 'https://wa.me/0000000000';
$title = $title ?? 'PA Infrastructure Portal';
?>
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title><?= htmlspecialchars($title) ?> - PA Infrastructure Portal</title>
	<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
	<style>
		:root { --pa-bg:#1a1f2c; --pa-emerald:#006837; --pa-gold:#ffcc00; --pa-heading:#fff; --pa-muted:#a0aec0; --pa-glass:rgba(26,31,44,.72);} 
		html,body{margin:0;padding:0;min-height:100%;background:radial-gradient(circle at 0% 0%,rgba(0,104,55,.14),transparent 45%),radial-gradient(circle at 100% 100%,rgba(255,204,0,.08),transparent 40%),var(--pa-bg);color:var(--pa-muted);font-family:Inter,"Segoe UI",Arial,sans-serif;line-height:1.65}
		h1,h2,h3,h4,h5,h6{color:var(--pa-heading);font-weight:600} a{color:var(--pa-gold);text-decoration:none} a:hover{color:#ffe066}
		.pa-navbar{position:fixed;top:0;left:0;right:0;z-index:1050;background:var(--pa-glass);border-bottom:1px solid rgba(255,255,255,.12);backdrop-filter:blur(14px);box-shadow:0 12px 28px rgba(0,0,0,.22)}
		.pa-brand{color:var(--pa-heading);font-weight:700;letter-spacing:.11em;font-size:.95rem;text-transform:uppercase}
		.pa-clock{font-weight:600;color:var(--pa-heading);font-size:.95rem;min-width:210px;text-align:center;background:rgba(0,104,55,.18);border:1px solid rgba(0,104,55,.45);border-radius:999px;padding:.42rem .9rem}
		.pa-profile-badge{border:1px solid rgba(255,204,0,.45);border-radius:999px;background:rgba(255,204,0,.1);color:var(--pa-gold);font-weight:600;padding:.42rem .88rem}
		.pa-main{padding-top:6.2rem;padding-bottom:2.5rem}.pa-content-shell{max-width:1200px;margin:0 auto;padding:1.25rem 1rem}
		.pa-footer{margin-top:auto;border-top:1px solid rgba(255,255,255,.1);background:rgba(10,14,21,.66)}
		.pa-footer-content{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.1rem 1rem;max-width:1200px;margin:0 auto;color:var(--pa-muted);font-size:.92rem}
		.pa-popia{border-radius:999px;border:1px solid rgba(0,104,55,.45);background:rgba(0,104,55,.18);color:#90e7b8;font-weight:600;padding:.36rem .8rem}
	</style>
</head>
<body>
<header>
	<nav class="navbar navbar-expand-lg pa-navbar">
		<div class="container-fluid px-3 px-lg-4">
			<a class="navbar-brand pa-brand" href="/">PA INFRASTRUCTURE PORTAL</a>
			<button class="navbar-toggler border-0 shadow-none" type="button" data-bs-toggle="collapse" data-bs-target="#paTopNav"><span class="navbar-toggler-icon"></span></button>
			<div class="collapse navbar-collapse" id="paTopNav">
				<div class="ms-lg-auto d-flex flex-column flex-lg-row align-items-lg-center gap-2 gap-lg-3 w-100 w-lg-auto pt-2 pt-lg-0">
					<div id="paClock" class="pa-clock"></div>
					<a class="pa-profile-badge" href="<?= htmlspecialchars($whatsAppLink) ?>" target="_blank" rel="noopener noreferrer">WhatsApp</a>
					<?php if ($user): ?>
						<div class="dropdown">
							<button class="btn pa-profile-badge dropdown-toggle" type="button" data-bs-toggle="dropdown"><?= htmlspecialchars($user['Name']) ?> (<?= htmlspecialchars((string)$role) ?>)</button>
							<ul class="dropdown-menu dropdown-menu-end">
								<li><a class="dropdown-item" href="/">Dashboard</a></li>
								<li><a class="dropdown-item" href="/stats-hub">Stats Hub</a></li>
								<?php if (has_role('Server Admin', 'Admin', 'PA Member')): ?><li><a class="dropdown-item" href="/command-view">PA Oversight Tab</a></li><?php endif; ?>
								<?php if (has_role('Server Admin', 'Admin')): ?>
									<li><a class="dropdown-item" href="/account/create-managed-user">Create Admin/PA User</a></li>
									<li><a class="dropdown-item" href="/account/manage-users">Staff Management</a></li>
									<li><a class="dropdown-item" href="/account/manage-residents">Resident Management</a></li>
								<?php endif; ?>
								<?php if (has_role('Server Admin')): ?><li><a class="dropdown-item" href="/system-configuration">System Configuration</a></li><?php endif; ?>
								<?php if (has_role('Server Admin', 'Admin', 'PA Member')): ?><li><a class="dropdown-item" href="/residents">Residents List Export</a></li><?php endif; ?>
								<li><a class="dropdown-item" href="/account/edit-my-user">Edit My User</a></li>
								<li><a class="dropdown-item" href="/privacy">Compliance</a></li>
								<li>
									<form method="post" action="/logout" class="px-2 py-1">
										<input type="hidden" name="_csrf" value="<?= htmlspecialchars(csrf_token()) ?>">
										<button class="dropdown-item" type="submit">Sign Out</button>
									</form>
								</li>
							</ul>
						</div>
					<?php else: ?>
						<a class="btn pa-profile-badge" href="/login">Sign In</a>
						<a class="btn pa-profile-badge" href="/register">Register</a>
					<?php endif; ?>
				</div>
			</div>
		</div>
	</nav>
</header>

<main class="pa-main"><div class="pa-content-shell"><?php require $viewFile; ?></div></main>
<footer class="pa-footer"><div class="pa-footer-content"><span>&copy; <?= gmdate('Y') ?> Patriotic Alliance Executive Infrastructure Portal. All rights reserved.</span><span class="pa-popia">POPIA Compliant Data System</span></div></footer>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script>
(() => {
	const clock = document.getElementById('paClock');
	if (!clock) return;
	const tick = () => { clock.textContent = new Date().toLocaleString('en-ZA', { weekday:'short', year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }); };
	tick();
	setInterval(tick, 1000);
})();
</script>
</body>
</html>
