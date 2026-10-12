using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TheSolution.PAPortal.Data;

namespace TheSolution.PAPortal.Web.Controllers;

[ApiController]
[Route("api/residents")]
[Authorize(Roles = "Server Admin,Admin,PA Member")]
public class ResidentsController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;

    public ResidentsController(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetResidentsAsync(CancellationToken cancellationToken)
    {
        var residents = await _dbContext.Users
            .AsNoTracking()
            .Where(u => u.UserRole == "Resident")
            .OrderBy(u => u.CreatedAt)
            .Select(u => new
            {
                u.UserID,
                u.Username,
                u.FirstName,
                u.LastName,
                u.PhysicalAddress,
                u.EmailAddress,
                u.CellNumber,
                u.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(residents);
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportResidentsCsvAsync(CancellationToken cancellationToken)
    {
        var residents = await _dbContext.Users
            .AsNoTracking()
            .Where(u => u.UserRole == "Resident")
            .OrderBy(u => u.CreatedAt)
            .ToListAsync(cancellationToken);

        StringBuilder csvBuilder = new();
        csvBuilder.AppendLine("UserID,Username,FirstName,LastName,PhysicalAddress,EmailAddress,CellNumber,CreatedAt");

        foreach (var resident in residents)
        {
            csvBuilder.AppendLine(string.Join(",",
                resident.UserID,
                Escape(resident.Username),
                Escape(resident.FirstName),
                Escape(resident.LastName),
                Escape(resident.PhysicalAddress),
                Escape(resident.EmailAddress ?? string.Empty),
                Escape(resident.CellNumber),
                resident.CreatedAt.ToString("O")));
        }

        byte[] fileBytes = Encoding.UTF8.GetBytes(csvBuilder.ToString());
        return File(fileBytes, "text/csv", $"residents_{DateTime.UtcNow:yyyyMMddHHmmss}.csv");
    }

    private static string Escape(string value)
    {
        string escaped = value.Replace("\"", "\"\"");
        return $"\"{escaped}\"";
    }
}
