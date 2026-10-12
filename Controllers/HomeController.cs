using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;
using System.Security.Claims;
using TheSolution.PAPortal.Data;
using TheSolution.PAPortal.Web.Models.Section78;
using WebApplication1.Models;

namespace WebApplication1.Controllers
{
    [Authorize]
    public class HomeController : Controller
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IWebHostEnvironment _environment;

        public HomeController(ApplicationDbContext dbContext, IWebHostEnvironment environment)
        {
            _dbContext = dbContext;
            _environment = environment;
        }

        [Authorize(Roles = "Server Admin,Admin,PA Member,Resident")]
        public IActionResult Index()
        {
            return View();
        }

        [AllowAnonymous]
        public IActionResult Privacy()
        {
            return View();
        }

        [Authorize(Roles = "Server Admin,Admin,PA Member")]
        public IActionResult CommandView()
        {
            return View();
        }

        [Authorize(Roles = "Server Admin,Admin,PA Member")]
        public IActionResult StatsHub()
        {
            return View();
        }

        [Authorize(Roles = "Server Admin,Admin,PA Member")]
        public IActionResult Residents()
        {
            return View();
        }

        [HttpGet]
        [Authorize(Roles = "Resident")]
        public IActionResult Section78Dispute()
        {
            return View(new Section78DisputeViewModel());
        }

        [HttpPost]
        [Authorize(Roles = "Resident")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Section78Dispute(Section78DisputeViewModel model, CancellationToken cancellationToken)
        {
            string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized();
            }

            User? user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserID == userId, cancellationToken);
            if (user is null)
            {
                return Unauthorized();
            }

            if (!user.IsProfileComplete)
            {
                ModelState.AddModelError(string.Empty, "Complete your resident profile before filing a Section 78 dispute.");
            }

            if (!model.NoFormalNoticeReceived)
            {
                ModelState.AddModelError(nameof(model.NoFormalNoticeReceived), "You must confirm whether no formal notice was received.");
            }

            if (!model.NoSection78DocumentsReceived)
            {
                ModelState.AddModelError(nameof(model.NoSection78DocumentsReceived), "You must confirm whether no Section 78 engagement documents were delivered.");
            }

            if (!ModelState.IsValid)
            {
                return View(model);
            }

            string uploadsRoot = Path.Combine(_environment.WebRootPath, "uploads", "section78", userId.ToString(), DateTime.UtcNow.ToString("yyyyMMddHHmmss"));
            Directory.CreateDirectory(uploadsRoot);

            string supportingDocumentPath = await SaveFileAsync(model.SupportingDocument!, uploadsRoot, cancellationToken);
            string identityDocumentPath = await SaveFileAsync(model.IdentityDocument!, uploadsRoot, cancellationToken);
            string municipalAccountProofPath = await SaveFileAsync(model.MunicipalAccountProof!, uploadsRoot, cancellationToken);

            Section78Dispute dispute = new()
            {
                UserID = userId,
                PropertyAddress = model.PropertyAddress,
                MunicipalAccountNumber = model.MunicipalAccountNumber,
                ErfNumber = model.ErfNumber,
                PropertyCategoryDispute = model.PropertyCategoryDispute,
                OwnerStatement = model.OwnerStatement,
                NoFormalNoticeReceived = model.NoFormalNoticeReceived,
                NoSection78DocumentsReceived = model.NoSection78DocumentsReceived,
                SupportingDocumentPath = supportingDocumentPath,
                IdentityDocumentPath = identityDocumentPath,
                MunicipalAccountProofPath = municipalAccountProofPath,
                AdditionalNotes = model.AdditionalNotes,
                SubmittedAt = DateTime.UtcNow
            };

            _dbContext.Section78Disputes.Add(dispute);
            await _dbContext.SaveChangesAsync(cancellationToken);

            TempData["Section78Success"] = "Your Section 78 dispute has been submitted successfully.";
            return RedirectToAction(nameof(Section78Dispute));
        }

        private static async Task<string> SaveFileAsync(IFormFile file, string uploadsRoot, CancellationToken cancellationToken)
        {
            string extension = Path.GetExtension(file.FileName);
            string fileName = $"{Guid.NewGuid():N}{extension}";
            string fullPath = Path.Combine(uploadsRoot, fileName);

            await using FileStream stream = new(fullPath, FileMode.Create);
            await file.CopyToAsync(stream, cancellationToken);

            return fullPath;
        }

        [AllowAnonymous]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}
