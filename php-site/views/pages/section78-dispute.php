<?php $success = flash('Section78Success'); $error = $error ?? null; ?>
<section style="max-width:920px;margin:1.2rem auto;background:rgba(20,27,39,.95);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:1.2rem;box-shadow:0 14px 30px rgba(0,0,0,.32);">
	<h1 style="color:#fff;font-size:1.35rem;font-weight:700;">Section 78 Dispute Submission</h1>
	<p style="color:#a0aec0;">Upload the documents and details needed to challenge a municipal property categorization or valuation issue.</p>
	<?php if ($success): ?><div style="margin-bottom:1rem;border-radius:10px;padding:.75rem;background:rgba(0,191,110,.16);border:1px solid rgba(0,191,110,.45);color:#a8f2ca;"><?= htmlspecialchars($success) ?></div><?php endif; ?>
	<?php if ($error): ?><div style="margin-bottom:1rem;border-radius:10px;padding:.75rem;background:rgba(255,141,161,.12);border:1px solid rgba(255,141,161,.45);color:#ffd0da;"><?= htmlspecialchars($error) ?></div><?php endif; ?>

	<form method="post" action="/section78-dispute" enctype="multipart/form-data">
		<input type="hidden" name="_csrf" value="<?= htmlspecialchars(csrf_token()) ?>">
		<div class="row g-3">
			<div class="col-md-6"><label class="form-label text-white">Property Address</label><input name="propertyAddress" class="form-control" required></div>
			<div class="col-md-6"><label class="form-label text-white">Municipal Account Number</label><input name="municipalAccountNumber" class="form-control" required></div>
			<div class="col-md-6"><label class="form-label text-white">Erf Number</label><input name="erfNumber" class="form-control" required></div>
			<div class="col-md-6"><label class="form-label text-white">Property Category Dispute</label><input name="propertyCategoryDispute" class="form-control" required></div>
			<div class="col-12"><label class="form-label text-white">Owner Statement</label><textarea name="ownerStatement" class="form-control" rows="5" required></textarea></div>
			<div class="col-12">
				<div style="border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:.85rem;background:rgba(255,255,255,.03);">
					<div class="form-check mb-2"><input name="noFormalNoticeReceived" value="1" class="form-check-input" type="checkbox" id="noFormal"><label for="noFormal" class="form-check-label text-light">I confirm no formal municipal reclassification notice was received.</label></div>
					<div class="form-check"><input name="noSection78DocumentsReceived" value="1" class="form-check-input" type="checkbox" id="noDocs"><label for="noDocs" class="form-check-label text-light">I confirm no Section 78 prior engagement documents were delivered.</label></div>
				</div>
			</div>
			<div class="col-md-4"><label class="form-label text-white">Supporting Document</label><input name="supportingDocument" class="form-control" type="file" required></div>
			<div class="col-md-4"><label class="form-label text-white">Identity Document</label><input name="identityDocument" class="form-control" type="file" required></div>
			<div class="col-md-4"><label class="form-label text-white">Municipal Account Proof</label><input name="municipalAccountProof" class="form-control" type="file" required></div>
			<div class="col-12"><label class="form-label text-white">Additional Notes</label><textarea name="additionalNotes" class="form-control" rows="3"></textarea></div>
			<div class="col-12 d-grid"><button type="submit" style="border:1px solid #ffcc00;background:#ffcc00;color:#1a1f2c;font-weight:800;border-radius:999px;padding:.6rem 1rem;">Submit Section 78 Dispute</button></div>
		</div>
	</form>
</section>
