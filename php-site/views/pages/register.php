<?php $error = $error ?? null; ?>
<section style="max-width:680px;margin:1.2rem auto;background:rgba(20,27,39,.95);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:1.2rem;box-shadow:0 14px 30px rgba(0,0,0,.32);">
	<h1 style="color:#fff;font-size:1.4rem;font-weight:700;">Create Resident Account</h1>
	<p style="color:#a0aec0;">Complete all required profile fields to unlock complaint submission.</p>
	<?php if ($error): ?><div style="color:#ffd0da;background:rgba(255,141,161,.12);border:1px solid rgba(255,141,161,.45);border-radius:10px;padding:.65rem;margin-bottom:.9rem;"><?= htmlspecialchars($error) ?></div><?php endif; ?>

	<form method="post" action="/register">
		<input type="hidden" name="_csrf" value="<?= htmlspecialchars(csrf_token()) ?>">
		<div class="row g-3">
			<div class="col-md-6"><label class="form-label text-white">Username</label><input name="username" class="form-control" required></div>
			<div class="col-md-6"><label class="form-label text-white">Cell Number</label><input name="cellNumber" class="form-control" required></div>
			<div class="col-md-6"><label class="form-label text-white">First Name</label><input name="firstName" class="form-control" required></div>
			<div class="col-md-6"><label class="form-label text-white">Last Name</label><input name="lastName" class="form-control" required></div>
			<div class="col-12"><label class="form-label text-white">Physical Address</label><input name="physicalAddress" class="form-control" required></div>
			<div class="col-12"><label class="form-label text-white">Email Address</label><input name="emailAddress" type="email" class="form-control" required></div>
			<div class="col-md-6"><label class="form-label text-white">Password</label><input name="password" type="password" class="form-control" required></div>
			<div class="col-md-6"><label class="form-label text-white">Confirm Password</label><input name="confirmPassword" type="password" class="form-control" required></div>
			<div class="col-12 d-grid"><button type="submit" style="border:1px solid #ffcc00;background:#ffcc00;color:#1a1f2c;font-weight:800;border-radius:999px;padding:.6rem 1rem;">Register Resident Account</button></div>
		</div>
	</form>
	<div style="margin-top:1rem;color:#a0aec0;">Already registered? <a href="/login">Sign in</a></div>
</section>
