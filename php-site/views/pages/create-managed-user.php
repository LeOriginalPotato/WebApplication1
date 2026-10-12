<?php $success = flash('ManagedUserCreated'); $error = $error ?? null; ?>
<section style="max-width:700px;margin:1.2rem auto;background:rgba(20,27,39,.95);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:1.2rem;">
	<h1 style="color:#fff;font-size:1.35rem;font-weight:700;">Administrative User Provisioning</h1>
	<?php if ($success): ?><div style="border:1px solid rgba(0,191,110,.5);background:rgba(0,191,110,.16);color:#a8f2ca;border-radius:10px;padding:.6rem .8rem;margin-bottom:.8rem;"><?= htmlspecialchars($success) ?></div><?php endif; ?>
	<?php if ($error): ?><div style="border:1px solid rgba(255,141,161,.5);background:rgba(255,141,161,.16);color:#ffd0da;border-radius:10px;padding:.6rem .8rem;margin-bottom:.8rem;"><?= htmlspecialchars($error) ?></div><?php endif; ?>
	<form method="post" action="/account/create-managed-user">
		<input type="hidden" name="_csrf" value="<?= htmlspecialchars(csrf_token()) ?>">
		<div class="row g-3">
			<div class="col-md-6"><label class="form-label text-white">Username</label><input name="username" class="form-control" required></div>
			<div class="col-md-6"><label class="form-label text-white">User Role</label><select name="userRole" class="form-select"><option value="PA Member">PA Member</option><option value="Admin">Admin</option><?php if (has_role('Server Admin')): ?><option value="Server Admin">Server Admin</option><?php endif; ?></select></div>
			<div class="col-md-6"><label class="form-label text-white">First Name</label><input name="firstName" class="form-control" required></div>
			<div class="col-md-6"><label class="form-label text-white">Last Name</label><input name="lastName" class="form-control" required></div>
			<div class="col-12"><label class="form-label text-white">Physical Address</label><input name="physicalAddress" class="form-control" required></div>
			<div class="col-md-6"><label class="form-label text-white">Email Address</label><input name="emailAddress" type="email" class="form-control" required></div>
			<div class="col-md-6"><label class="form-label text-white">Cell Number</label><input name="cellNumber" class="form-control" required></div>
			<div class="col-12"><label class="form-label text-white">Password</label><input name="password" type="password" class="form-control" required></div>
			<div class="col-12 d-grid"><button type="submit" style="border:1px solid #ffcc00;background:#ffcc00;color:#1a1f2c;font-weight:800;border-radius:999px;padding:.6rem 1rem;">Create Managed User</button></div>
		</div>
	</form>
</section>
