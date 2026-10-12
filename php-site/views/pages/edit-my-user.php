<?php $success = flash('ProfileUpdated'); $error = $error ?? null; ?>
<section style="max-width:760px;margin:1.2rem auto;background:rgba(20,27,39,.95);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:1.2rem;box-shadow:0 14px 30px rgba(0,0,0,.32);">
	<h1 style="color:#fff;font-size:1.35rem;font-weight:700;">Edit My User</h1>
	<?php if ($success): ?><div style="border:1px solid rgba(0,191,110,.5);background:rgba(0,191,110,.16);color:#a8f2ca;border-radius:10px;padding:.6rem .8rem;margin-bottom:.8rem;"><?= htmlspecialchars($success) ?></div><?php endif; ?>
	<?php if ($error): ?><div style="border:1px solid rgba(255,141,161,.5);background:rgba(255,141,161,.16);color:#ffd0da;border-radius:10px;padding:.6rem .8rem;margin-bottom:.8rem;"><?= htmlspecialchars($error) ?></div><?php endif; ?>

	<form method="post" action="/account/edit-my-user">
		<input type="hidden" name="_csrf" value="<?= htmlspecialchars(csrf_token()) ?>">
		<div class="row g-3">
			<div class="col-md-6"><label class="form-label text-white">Username</label><input name="username" class="form-control" value="<?= htmlspecialchars((string)$userRow['Username']) ?>" required></div>
			<div class="col-md-6"><label class="form-label text-white">Cell Number</label><input name="cellNumber" class="form-control" value="<?= htmlspecialchars((string)$userRow['CellNumber']) ?>" required></div>
			<div class="col-md-6"><label class="form-label text-white">First Name</label><input name="firstName" class="form-control" value="<?= htmlspecialchars((string)$userRow['FirstName']) ?>" required></div>
			<div class="col-md-6"><label class="form-label text-white">Last Name</label><input name="lastName" class="form-control" value="<?= htmlspecialchars((string)$userRow['LastName']) ?>" required></div>
			<div class="col-12"><label class="form-label text-white">Physical Address</label><input name="physicalAddress" class="form-control" value="<?= htmlspecialchars((string)$userRow['PhysicalAddress']) ?>" required></div>
			<div class="col-12"><label class="form-label text-white">Email Address</label><input name="emailAddress" type="email" class="form-control" value="<?= htmlspecialchars((string)$userRow['EmailAddress']) ?>" required></div>
			<div class="col-md-6"><label class="form-label text-white">New Password</label><input name="newPassword" type="password" class="form-control"></div>
			<div class="col-md-6"><label class="form-label text-white">Confirm New Password</label><input name="confirmNewPassword" type="password" class="form-control"></div>
			<div class="col-12 d-grid"><button type="submit" style="border:1px solid #ffcc00;background:#ffcc00;color:#1a1f2c;font-weight:800;border-radius:999px;padding:.6rem 1rem;">Save My Profile</button></div>
		</div>
	</form>
</section>
