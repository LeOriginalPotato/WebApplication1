<?php
$success = flash('UserManagementSuccess');
$errorFlash = flash('UserManagementError');
$isResidentTab = (bool)($isResidentTab ?? false);
$canEditServerAdmins = (bool)($canEditServerAdmins ?? false);
?>
<section style="display:grid;gap:1rem;">
	<div style="background:rgba(20,27,39,.95);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:1.2rem;">
		<h1 style="color:#fff;margin:0 0 .35rem;font-size:1.35rem;font-weight:700;"><?= htmlspecialchars((string)$title) ?></h1>
		<p style="color:#a0aec0;margin:0;"><?= htmlspecialchars((string)$description) ?></p>
	</div>

	<?php if ($success): ?><div style="background:rgba(0,191,110,.16);color:#a8f2ca;border:1px solid rgba(0,191,110,.45);border-radius:10px;padding:.7rem .85rem;"><?= htmlspecialchars($success) ?></div><?php endif; ?>
	<?php if ($errorFlash): ?><div style="background:rgba(255,141,161,.12);color:#ffd0da;border:1px solid rgba(255,141,161,.45);border-radius:10px;padding:.7rem .85rem;"><?= htmlspecialchars($errorFlash) ?></div><?php endif; ?>

	<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1rem;">
		<?php foreach ($users as $u): ?>
			<form method="post" action="/account/update-managed-user" style="background:rgba(22,27,39,.95);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:1rem;">
				<input type="hidden" name="_csrf" value="<?= htmlspecialchars(csrf_token()) ?>">
				<input type="hidden" name="userID" value="<?= (int)$u['UserID'] ?>">
				<input type="hidden" name="returnTab" value="<?= $isResidentTab ? 'Residents' : 'Users' ?>">
				<h2 style="color:#fff;font-size:1.05rem;"><?= htmlspecialchars($u['FirstName'] . ' ' . $u['LastName']) ?></h2>
				<div class="row g-2">
					<div class="col-12"><label class="form-label">Username</label><input name="username" class="form-control" value="<?= htmlspecialchars((string)$u['Username']) ?>" required></div>
					<div class="col-md-6"><label class="form-label">First Name</label><input name="firstName" class="form-control" value="<?= htmlspecialchars((string)$u['FirstName']) ?>" required></div>
					<div class="col-md-6"><label class="form-label">Surname</label><input name="lastName" class="form-control" value="<?= htmlspecialchars((string)$u['LastName']) ?>" required></div>
					<div class="col-12"><label class="form-label">Physical Address</label><input name="physicalAddress" class="form-control" value="<?= htmlspecialchars((string)$u['PhysicalAddress']) ?>" required></div>
					<div class="col-md-6"><label class="form-label">Email Address</label><input name="emailAddress" class="form-control" value="<?= htmlspecialchars((string)$u['EmailAddress']) ?>" required></div>
					<div class="col-md-6"><label class="form-label">Phone Number</label><input name="cellNumber" class="form-control" value="<?= htmlspecialchars((string)$u['CellNumber']) ?>" required></div>
					<div class="col-md-6"><label class="form-label">Role</label>
						<select name="userRole" class="form-select" required>
							<?php if ($isResidentTab): ?>
								<option value="Resident" selected>Resident</option>
							<?php else: ?>
								<?php if ($canEditServerAdmins): ?><option value="Server Admin" <?= $u['UserRole'] === 'Server Admin' ? 'selected' : '' ?>>Server Admin</option><?php endif; ?>
								<option value="Admin" <?= $u['UserRole'] === 'Admin' ? 'selected' : '' ?>>Admin</option>
								<option value="PA Member" <?= $u['UserRole'] === 'PA Member' ? 'selected' : '' ?>>PA Member</option>
								<option value="Resident" <?= $u['UserRole'] === 'Resident' ? 'selected' : '' ?>>Resident</option>
							<?php endif; ?>
						</select>
					</div>
					<div class="col-md-6"><label class="form-label">New Password</label><input name="newPassword" type="password" class="form-control"></div>
					<div class="col-12"><label class="form-label">Confirm New Password</label><input name="confirmNewPassword" type="password" class="form-control"></div>
					<div class="col-12"><button type="submit" class="btn btn-warning w-100">Save Changes</button></div>
				</div>
			</form>
		<?php endforeach; ?>
	</div>
</section>
