using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TheSolution.PAPortal.Data;
using TheSolution.PAPortal.Web.Models.Account;

namespace TheSolution.PAPortal.Web.Controllers;

public class AccountController : Controller
{
    private readonly ApplicationDbContext _dbContext;

    public AccountController(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [AllowAnonymous]
    public IActionResult Login(string? returnUrl = null)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToAction("Index", "Home");
        }

        return View(new LoginViewModel { ReturnUrl = returnUrl });
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(LoginViewModel model, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        User? user;
        try
        {
            user = await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.EmailAddress == model.EmailAddress, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            // Request was cancelled (client disconnected or request aborted). Stop processing.
            // Return a 499-like status code to indicate client closed request; the response may not be delivered.
            return StatusCode(499);
        }

        if (user is null || string.IsNullOrWhiteSpace(user.EmailAddress) || !PasswordUtility.Verify(model.Password, user.EmailAddress, user.PasswordHash))
        {
            ModelState.AddModelError(string.Empty, "Invalid login attempt.");
            return View(model);
        }

        List<Claim> claims =
        [
            new Claim(ClaimTypes.NameIdentifier, user.UserID.ToString()),
            new Claim(ClaimTypes.Name, $"{user.FirstName} {user.LastName}".Trim()),
            new Claim(ClaimTypes.Role, user.UserRole),
            new Claim("UserRole", user.UserRole),
            new Claim("IsProfileComplete", user.IsProfileComplete.ToString())
        ];

        ClaimsIdentity claimsIdentity = new(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        ClaimsPrincipal principal = new(claimsIdentity);

        AuthenticationProperties properties = new()
        {
            IsPersistent = model.RememberMe,
            AllowRefresh = true,
            ExpiresUtc = model.RememberMe ? DateTimeOffset.UtcNow.AddDays(7) : DateTimeOffset.UtcNow.AddHours(8)
        };

        try
        {
            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal, properties);
        }
        catch (OperationCanceledException)
        {
            // Request was cancelled while writing the auth cookie.
            return StatusCode(499);
        }

        if (!string.IsNullOrWhiteSpace(model.ReturnUrl) && Url.IsLocalUrl(model.ReturnUrl))
        {
            return Redirect(model.ReturnUrl);
        }

        return RedirectToAction("Index", "Home");
    }

    [HttpGet]
    [AllowAnonymous]
    public IActionResult Register()
    {
        return View(new RegisterResidentViewModel());
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Register(RegisterResidentViewModel model, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        bool exists = await _dbContext.Users.AnyAsync(u =>
            u.Username == model.Username ||
            u.EmailAddress == model.EmailAddress ||
            u.CellNumber == model.CellNumber,
            cancellationToken);

        if (exists)
        {
            ModelState.AddModelError(string.Empty, "A user with the same username, email, or phone already exists.");
            return View(model);
        }

        User resident = new()
        {
            Username = model.Username,
            FirstName = model.FirstName,
            LastName = model.LastName,
            PhysicalAddress = model.PhysicalAddress,
            EmailAddress = model.EmailAddress,
            CellNumber = model.CellNumber,
            PasswordHash = PasswordUtility.CreateHash(model.Password, model.EmailAddress),
            UserRole = "Resident",
            CreatedAt = DateTime.UtcNow,
            IsProfileComplete = true
        };

        _dbContext.Users.Add(resident);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return RedirectToAction("Login", new { returnUrl = "/" });
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Server Admin")]
    public IActionResult CreateManagedUser()
    {
        return View(new CreateManagedUserViewModel());
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Server Admin")]
    public Task<IActionResult> ManageUsers(CancellationToken cancellationToken)
    {
        return BuildManageUsersViewAsync(includeResidents: false, cancellationToken);
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Server Admin")]
    public Task<IActionResult> ManageResidents(CancellationToken cancellationToken)
    {
        return BuildManageUsersViewAsync(includeResidents: true, cancellationToken);
    }

    private async Task<IActionResult> BuildManageUsersViewAsync(bool includeResidents, CancellationToken cancellationToken)
    {
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdClaim, out int currentUserId);
        bool isServerAdmin = User.IsInRole("Server Admin");

        IQueryable<User> query = _dbContext.Users.AsNoTracking();

        if (includeResidents)
        {
            query = query.Where(u => u.UserRole == "Resident");
        }
        else if (isServerAdmin)
        {
            query = query.Where(u => u.UserRole == "Server Admin" || u.UserRole == "Admin" || u.UserRole == "PA Member");
        }
        else
        {
            query = query.Where(u => u.UserRole == "Admin" || u.UserRole == "PA Member");
        }

        ManageUsersViewModel model = new()
        {
            Title = includeResidents ? "Resident Management" : "User Management",
            Description = includeResidents
                ? "Admins and Server Admins can edit resident accounts from this dedicated tab."
                : "Server Admins can edit staff and Server Admin accounts. Admins can edit Admin and PA Member accounts here.",
            CanEditServerAdmins = isServerAdmin,
            IsResidentTab = includeResidents,
            Users = await query
                .OrderBy(u => u.UserRole)
                .ThenBy(u => u.FirstName)
                .Select(u => new UserManagementEditViewModel
                {
                    UserID = u.UserID,
                    Username = u.Username,
                    FirstName = u.FirstName,
                    LastName = u.LastName,
                    PhysicalAddress = u.PhysicalAddress,
                    EmailAddress = u.EmailAddress ?? string.Empty,
                    CellNumber = u.CellNumber,
                    UserRole = u.UserRole,
                    IsCurrentUser = u.UserID == currentUserId
                })
                .ToListAsync(cancellationToken)
        };

        return View("ManageUsers", model);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Server Admin")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateManagedUser(CreateManagedUserViewModel model, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        if (model.UserRole == "Server Admin" && !User.IsInRole("Server Admin"))
        {
            ModelState.AddModelError(string.Empty, "Only Server Admin users can create Server Admin accounts.");
            return View(model);
        }

        bool exists = await _dbContext.Users.AnyAsync(u =>
            u.Username == model.Username ||
            u.EmailAddress == model.EmailAddress ||
            u.CellNumber == model.CellNumber,
            cancellationToken);

        if (exists)
        {
            ModelState.AddModelError(string.Empty, "A user with the same username, email, or phone already exists.");
            return View(model);
        }

        User managedUser = new()
        {
            Username = model.Username,
            FirstName = model.FirstName,
            LastName = model.LastName,
            PhysicalAddress = model.PhysicalAddress,
            EmailAddress = model.EmailAddress,
            CellNumber = model.CellNumber,
            PasswordHash = PasswordUtility.CreateHash(model.Password, model.EmailAddress),
            UserRole = model.UserRole,
            CreatedAt = DateTime.UtcNow,
            IsProfileComplete = true
        };

        _dbContext.Users.Add(managedUser);
        await _dbContext.SaveChangesAsync(cancellationToken);

        TempData["ManagedUserCreated"] = "User created successfully.";
        return RedirectToAction("CreateManagedUser");
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Server Admin")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateManagedUser(UserManagementEditViewModel model, CancellationToken cancellationToken)
    {
        bool redirectToResidents = string.Equals(Request.Form["ReturnTab"], "Residents", StringComparison.OrdinalIgnoreCase);
        string redirectAction = redirectToResidents ? nameof(ManageResidents) : nameof(ManageUsers);

        if (!ModelState.IsValid)
        {
            TempData["UserManagementError"] = "Please correct the validation errors and try again.";
            return RedirectToAction(redirectAction);
        }

        if (!string.IsNullOrWhiteSpace(model.NewPassword) || !string.IsNullOrWhiteSpace(model.ConfirmNewPassword))
        {
            if (!string.Equals(model.NewPassword, model.ConfirmNewPassword, StringComparison.Ordinal))
            {
                TempData["UserManagementError"] = "New password and confirmation must match.";
                return RedirectToAction(redirectAction);
            }
        }

        bool isServerAdmin = User.IsInRole("Server Admin");
        string? actorIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(actorIdClaim, out int actorUserId);

        User? user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserID == model.UserID, cancellationToken);
        if (user is null)
        {
            return NotFound();
        }

        bool canEditTarget = isServerAdmin || user.UserRole == "Admin" || user.UserRole == "PA Member" || user.UserRole == "Resident";
        if (!canEditTarget)
        {
            return Forbid();
        }

        bool targetIsSelf = user.UserID == actorUserId;
        bool allowedRole = isServerAdmin
            ? model.UserRole is "Server Admin" or "Admin" or "PA Member" or "Resident"
            : model.UserRole is "Admin" or "PA Member" or "Resident";

        if (!allowedRole)
        {
            TempData["UserManagementError"] = "You are not allowed to assign that role.";
            return RedirectToAction(redirectAction);
        }

        if (!isServerAdmin && user.UserRole == "Server Admin")
        {
            return Forbid();
        }

        if (!isServerAdmin && model.UserRole == "Server Admin")
        {
            return Forbid();
        }

        bool exists = await _dbContext.Users.AnyAsync(u =>
            u.UserID != model.UserID &&
            (u.Username == model.Username || u.EmailAddress == model.EmailAddress || u.CellNumber == model.CellNumber),
            cancellationToken);

        if (exists)
        {
            TempData["UserManagementError"] = "Another account already uses this username, email, or phone number.";
            return RedirectToAction(redirectAction);
        }

        user.Username = model.Username;
        user.FirstName = model.FirstName;
        user.LastName = model.LastName;
        user.PhysicalAddress = model.PhysicalAddress;
        user.EmailAddress = model.EmailAddress;
        user.CellNumber = model.CellNumber;
        user.UserRole = model.UserRole;
        user.IsProfileComplete = true;

        if (!string.IsNullOrWhiteSpace(model.NewPassword))
        {
            user.PasswordHash = PasswordUtility.CreateHash(model.NewPassword, model.EmailAddress);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        TempData["UserManagementSuccess"] = targetIsSelf ? "Your account was updated successfully." : "User account updated successfully.";
        return RedirectToAction(redirectAction);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Server Admin")]
    [ValidateAntiForgeryToken]
    public Task<IActionResult> UpdateStaffUser(StaffUserEditViewModel model, CancellationToken cancellationToken)
    {
        UserManagementEditViewModel unifiedModel = new()
        {
            UserID = model.UserID,
            Username = model.Username,
            FirstName = model.FirstName,
            LastName = model.LastName,
            PhysicalAddress = model.PhysicalAddress,
            EmailAddress = model.EmailAddress,
            CellNumber = model.CellNumber,
            UserRole = model.UserRole,
            NewPassword = model.NewPassword
        };

        return UpdateManagedUser(unifiedModel, cancellationToken);
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Server Admin")]
    public Task<IActionResult> ManageStaff(CancellationToken cancellationToken)
    {
        return ManageUsers(cancellationToken);
    }

    [HttpGet]
    [Authorize(Roles = "Server Admin")]
    public Task<IActionResult> ManageServerAdmins(CancellationToken cancellationToken)
    {
        return ManageUsers(cancellationToken);
    }

    [HttpPost]
    [Authorize(Roles = "Server Admin")]
    [ValidateAntiForgeryToken]
    public Task<IActionResult> UpdateServerAdminUser(ServerAdminUserEditViewModel model, CancellationToken cancellationToken)
    {
        UserManagementEditViewModel unifiedModel = new()
        {
            UserID = model.UserID,
            Username = model.Username,
            FirstName = model.FirstName,
            LastName = model.LastName,
            PhysicalAddress = model.PhysicalAddress,
            EmailAddress = model.EmailAddress,
            CellNumber = model.CellNumber,
            UserRole = "Server Admin",
            NewPassword = model.NewPassword,
            ConfirmNewPassword = model.ConfirmNewPassword
        };

        return UpdateManagedUser(unifiedModel, cancellationToken);
    }

    [HttpPost("api/admin/users")]
    [Authorize(Roles = "Admin,Server Admin")]
    public async Task<IActionResult> CreateManagedUserApi([FromBody] CreateManagedUserViewModel model, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        if (model.UserRole == "Server Admin" && !User.IsInRole("Server Admin"))
        {
            return Forbid();
        }

        bool exists = await _dbContext.Users.AnyAsync(u =>
            u.Username == model.Username ||
            u.EmailAddress == model.EmailAddress ||
            u.CellNumber == model.CellNumber,
            cancellationToken);

        if (exists)
        {
            return Conflict(new { message = "A user with the same username, email, or phone already exists." });
        }

        User managedUser = new()
        {
            Username = model.Username,
            FirstName = model.FirstName,
            LastName = model.LastName,
            PhysicalAddress = model.PhysicalAddress,
            EmailAddress = model.EmailAddress,
            CellNumber = model.CellNumber,
            PasswordHash = PasswordUtility.CreateHash(model.Password, model.EmailAddress),
            UserRole = model.UserRole,
            CreatedAt = DateTime.UtcNow,
            IsProfileComplete = true
        };

        _dbContext.Users.Add(managedUser);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { managedUser.UserID, managedUser.Username, managedUser.UserRole });
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> EditMyUser(CancellationToken cancellationToken)
    {
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized();
        }

        User? user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserID == userId, cancellationToken);
        if (user is null)
        {
            return NotFound();
        }

        EditMyUserViewModel model = new()
        {
            Username = user.Username,
            FirstName = user.FirstName,
            LastName = user.LastName,
            PhysicalAddress = user.PhysicalAddress,
            EmailAddress = user.EmailAddress ?? string.Empty,
            CellNumber = user.CellNumber
        };

        return View(model);
    }

    [HttpPost]
    [Authorize]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EditMyUser(EditMyUserViewModel model, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized();
        }

        User? user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserID == userId, cancellationToken);
        if (user is null)
        {
            return NotFound();
        }

        bool exists = await _dbContext.Users.AnyAsync(u =>
            u.UserID != userId &&
            (u.Username == model.Username || u.EmailAddress == model.EmailAddress || u.CellNumber == model.CellNumber),
            cancellationToken);

        if (exists)
        {
            ModelState.AddModelError(string.Empty, "Another account already uses this username, email, or phone number.");
            return View(model);
        }

        user.Username = model.Username;
        user.FirstName = model.FirstName;
        user.LastName = model.LastName;
        user.PhysicalAddress = model.PhysicalAddress;
        user.EmailAddress = model.EmailAddress;
        user.CellNumber = model.CellNumber;
        user.IsProfileComplete = true;

        if (!string.IsNullOrWhiteSpace(model.NewPassword))
        {
            user.PasswordHash = PasswordUtility.CreateHash(model.NewPassword, model.EmailAddress);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        TempData["ProfileUpdated"] = "Your account details were updated successfully.";
        return RedirectToAction("EditMyUser");
    }

    [HttpPost]
    [Authorize]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return RedirectToAction("Login", "Account");
    }

    [HttpGet]
    [AllowAnonymous]
    public IActionResult AccessDenied()
    {
        return View();
    }
}
