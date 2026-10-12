using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TheSolution.PAPortal.Data;

namespace TheSolution.PAPortal.Web.Controllers;

[Authorize(Roles = "Server Admin")]
public class SystemConfigurationController : Controller
{
    private readonly ApplicationDbContext _dbContext;

    public SystemConfigurationController(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<IActionResult> Index(CancellationToken cancellationToken)
    {
        SystemConfiguration? config = await _dbContext.SystemConfigurations
            .AsNoTracking()
            .OrderByDescending(c => c.UpdatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (config is null)
        {
            config = new SystemConfiguration
            {
                WebsiteName = string.Empty,
                DomainName = string.Empty,
                StorageRootPath = string.Empty,
                LocalDirectoryStructure = string.Empty,
                DatabaseConnectionString = string.Empty,
                BackupDriveLocation = string.Empty,
                WhatsAppChatLink = string.Empty,
                UpdatedAt = DateTime.UtcNow,
                UpdatedByUserID = 0
            };
        }

        return View("~/Views/Home/SystemConfiguration.cshtml", config);
    }

    [HttpGet("api/system-configuration")]
    public async Task<IActionResult> GetConfigurationAsync(CancellationToken cancellationToken)
    {
        SystemConfiguration? config = await _dbContext.SystemConfigurations
            .AsNoTracking()
            .OrderByDescending(c => c.UpdatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (config is null)
        {
            return NotFound(new { message = "Configuration record not found." });
        }

        return Ok(config);
    }

    [HttpPut("api/system-configuration")]
    public async Task<IActionResult> UpdateConfigurationAsync([FromBody] UpdateConfigurationRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        string? actorIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(actorIdClaim, out int actorUserId))
        {
            return Unauthorized(new { message = "Invalid authentication context." });
        }

        SystemConfiguration? config = await _dbContext.SystemConfigurations
            .OrderByDescending(c => c.UpdatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (config is null)
        {
            config = new SystemConfiguration
            {
                WebsiteName = request.WebsiteName,
                DomainName = request.DomainName,
                StorageRootPath = request.StorageRootPath,
                LocalDirectoryStructure = request.LocalDirectoryStructure,
                DatabaseConnectionString = request.DatabaseConnectionString,
                BackupDriveLocation = request.BackupDriveLocation,
                WhatsAppChatLink = request.WhatsAppChatLink,
                UpdatedAt = DateTime.UtcNow,
                UpdatedByUserID = actorUserId
            };
            _dbContext.SystemConfigurations.Add(config);
        }
        else
        {
            config.WebsiteName = request.WebsiteName;
            config.DomainName = request.DomainName;
            config.StorageRootPath = request.StorageRootPath;
            config.LocalDirectoryStructure = request.LocalDirectoryStructure;
            config.DatabaseConnectionString = request.DatabaseConnectionString;
            config.BackupDriveLocation = request.BackupDriveLocation;
            config.WhatsAppChatLink = request.WhatsAppChatLink;
            config.UpdatedAt = DateTime.UtcNow;
            config.UpdatedByUserID = actorUserId;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(config);
    }

    public sealed class UpdateConfigurationRequest
    {
        public string WebsiteName { get; set; } = string.Empty;
        public string DomainName { get; set; } = string.Empty;
        public string StorageRootPath { get; set; } = string.Empty;
        public string LocalDirectoryStructure { get; set; } = string.Empty;
        public string DatabaseConnectionString { get; set; } = string.Empty;
        public string BackupDriveLocation { get; set; } = string.Empty;

        public string WhatsAppChatLink { get; set; } = string.Empty;
    }
}
