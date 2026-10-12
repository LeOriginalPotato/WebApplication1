<?php $error = $error ?? null; $returnUrl = $returnUrl ?? '/'; ?>
<section style="max-width:460px;margin:1.2rem auto;background:rgba(20,27,39,.95);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:1.3rem;box-shadow:0 14px 28px rgba(0,0,0,.3);">
	<h1 style="color:#fff;font-size:1.35rem;font-weight:700;margin-bottom:.25rem;">Portal Sign In</h1>
	<p style="color:#a0aec0;margin-bottom:1rem;">Use your assigned profile to access resident reporting tools.</p>

	<?php if ($error): ?><div style="color:#ffd0da;background:rgba(255,141,161,.12);border:1px solid rgba(255,141,161,.45);border-radius:10px;padding:.65rem;margin-bottom:.9rem;"><?= htmlspecialchars($error) ?></div><?php endif; ?>

	<form method="post" action="/login">
		<input type="hidden" name="_csrf" value="<?= htmlspecialchars(csrf_token()) ?>">
		<input type="hidden" name="returnUrl" value="<?= htmlspecialchars($returnUrl) ?>">
		<div class="mb-3"><label class="form-label" style="color:#d8e1ef;font-weight:600;">Email Address</label><input name="emailAddress" class="form-control" required /></div>
		<div class="mb-3"><label class="form-label" style="color:#d8e1ef;font-weight:600;">Password</label><input name="password" type="password" class="form-control" required /></div>
		<div class="form-check mb-3"><input class="form-check-input" type="checkbox" name="rememberMe" id="rememberMe"><label class="form-check-label" for="rememberMe">Remember me</label></div>
		<button type="submit" style="width:100%;border:1px solid #ffcc00;background:#ffcc00;color:#1a1f2c;font-weight:800;border-radius:999px;padding:.6rem 1rem;">Sign In Securely</button>
	</form>
</section>
