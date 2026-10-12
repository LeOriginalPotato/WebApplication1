using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TheSolution.PAPortal.Data;
using TheSolution.PAPortal.Web.Hubs;

namespace TheSolution.PAPortal.Web.Controllers;

[ApiController]
[Route("api/oversight")]
[Authorize(Roles = "Server Admin,Admin,PA Member")]
public class OversightController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IHubContext<NotificationHub> _hubContext;

    public OversightController(ApplicationDbContext dbContext, IHubContext<NotificationHub> hubContext)
    {
        _dbContext = dbContext;
        _hubContext = hubContext;
    }

    [HttpGet("complaints")]
    public async Task<IActionResult> GetComplaintsAsync([FromQuery] string? ward = null, [FromQuery] string? category = null, [FromQuery] string? urgency = null, CancellationToken cancellationToken = default)
    {
        IQueryable<Fault> query = _dbContext.Faults
            .AsNoTracking()
            .Include(f => f.User)
            .Include(f => f.Category);

        if (!string.IsNullOrWhiteSpace(ward) && !string.Equals(ward, "all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(f => f.WardName == ward);
        }

        if (!string.IsNullOrWhiteSpace(category) && !string.Equals(category, "all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(f => f.Category.CategoryName == category);
        }

        if (!string.IsNullOrWhiteSpace(urgency) && !string.Equals(urgency, "all", StringComparison.OrdinalIgnoreCase))
        {
            query = urgency.ToLowerInvariant() switch
            {
                "critical" => query.Where(f => f.Category.CategoryName.Contains("Electrical") || f.Category.CategoryName.Contains("Water")),
                "high" => query.Where(f => f.Category.CategoryName.Contains("Roads") || f.Category.CategoryName.Contains("Electrical")),
                "medium" => query.Where(f => f.Category.CategoryName.Contains("Environmental")),
                _ => query
            };
        }

        var complaints = await query
            .OrderByDescending(f => f.DateLogged)
            .Select(f => new
            {
                f.FaultID,
                f.TicketReference,
                f.DateLogged,
                Category = f.Category.CategoryName,
                f.Description,
                f.PhysicalAddress,
                f.WardName,
                f.Latitude,
                f.Longitude,
                f.Status,
                f.TeamDispatched,
                f.InspectionFindings,
                f.IsResolved,
                f.ResolvedAt,
                Resident = $"{f.User.FirstName} {f.User.LastName}".Trim(),
                f.UserID
            })
            .ToListAsync(cancellationToken);

        return Ok(complaints);
    }

    [HttpPut("complaints/{faultId:int}/workflow")]
    public async Task<IActionResult> UpdateWorkflowAsync(int faultId, [FromBody] UpdateWorkflowRequest request, CancellationToken cancellationToken)
    {
        string? actorIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(actorIdClaim, out int actorUserId))
        {
            return Unauthorized(new { message = "Invalid authentication context." });
        }

        Fault? fault = await _dbContext.Faults.FirstOrDefaultAsync(f => f.FaultID == faultId, cancellationToken);
        if (fault is null)
        {
            return NotFound(new { message = "Complaint not found." });
        }

        if (fault.IsResolved)
        {
            return BadRequest(new { message = "Complaint is already resolved and locked." });
        }

        if (request.TeamDispatched.HasValue)
        {
            fault.TeamDispatched = request.TeamDispatched.Value;
            if (fault.TeamDispatched)
            {
                fault.Status = "Team Dispatched";
            }
        }

        if (!string.IsNullOrWhiteSpace(request.InspectionFindings))
        {
            fault.InspectionFindings = request.InspectionFindings.Trim();
            fault.Status = "Inspection Updated";
        }

        if (request.MarkResolved)
        {
            fault.IsResolved = true;
            fault.ResolvedAt = DateTime.UtcNow;
            fault.Status = "Resolved";

            _dbContext.Notifications.Add(new Notification
            {
                UserID = fault.UserID,
                TargetRole = "Resident",
                Message = $"Your complaint {fault.TicketReference} has been resolved.",
                RelatedTicketReference = fault.TicketReference,
                CreatedAt = DateTime.UtcNow
            });

            await _hubContext.Clients.Group($"user:{fault.UserID}").SendAsync(
                "ReceiveNotification",
                new
                {
                    Type = "ComplaintResolved",
                    TicketReference = fault.TicketReference,
                    Message = $"Your complaint {fault.TicketReference} has been resolved."
                },
                cancellationToken);
        }

        fault.LastUpdated = DateTime.UtcNow;

        string historyNote = request.MarkResolved
            ? "Complaint marked as resolved."
            : !string.IsNullOrWhiteSpace(request.InspectionFindings)
                ? $"Inspection findings updated: {request.InspectionFindings.Trim()}"
                : request.TeamDispatched.HasValue
                    ? $"Team dispatched set to {request.TeamDispatched.Value}."
                    : "Workflow updated.";

        _dbContext.EscalationHistories.Add(new EscalationHistory
        {
            FaultID = fault.FaultID,
            ActionTakenBy = actorUserId,
            Notes = historyNote,
            DateActioned = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            fault.FaultID,
            fault.TicketReference,
            fault.Status,
            fault.TeamDispatched,
            fault.InspectionFindings,
            fault.IsResolved,
            fault.ResolvedAt,
            fault.LastUpdated
        });
    }

    [HttpPost("complaints/{faultId:int}/push")]
    public async Task<IActionResult> PushToMunicipalityAsync(int faultId, [FromBody] PushToMunicipalityRequest request, CancellationToken cancellationToken)
    {
        string? actorIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(actorIdClaim, out int actorUserId))
        {
            return Unauthorized(new { message = "Invalid authentication context." });
        }

        Fault? fault = await _dbContext.Faults
            .Include(f => f.User)
            .Include(f => f.Category)
            .FirstOrDefaultAsync(f => f.FaultID == faultId, cancellationToken);

        if (fault is null)
        {
            return NotFound(new { message = "Complaint not found." });
        }

        string technicalPayload = string.IsNullOrWhiteSpace(request.TechnicalPayload)
            ? $"Ticket {fault.TicketReference} | Ward {fault.WardName} | {fault.Category.CategoryName} | {fault.PhysicalAddress} | {fault.Latitude},{fault.Longitude} | Resident {fault.User.FirstName} {fault.User.LastName}"
            : request.TechnicalPayload.Trim();

        fault.Status = "Pushed to Municipality";
        fault.TeamDispatched = true;
        fault.LastUpdated = DateTime.UtcNow;

        _dbContext.EscalationHistories.Add(new EscalationHistory
        {
            FaultID = fault.FaultID,
            ActionTakenBy = actorUserId,
            Notes = $"Pushed to municipality with payload: {technicalPayload}",
            DateActioned = DateTime.UtcNow
        });

        _dbContext.Notifications.Add(new Notification
        {
            UserID = fault.UserID,
            TargetRole = "Resident",
            Message = $"Your complaint {fault.TicketReference} was pushed to municipality engineering.",
            RelatedTicketReference = fault.TicketReference,
            CreatedAt = DateTime.UtcNow
        });

        _dbContext.Notifications.Add(new Notification
        {
            TargetRole = "Municipal Engineer",
            Message = technicalPayload,
            RelatedTicketReference = fault.TicketReference,
            CreatedAt = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        await _hubContext.Clients.Group("role:Municipal Engineer").SendAsync(
            "ReceiveNotification",
            new
            {
                Type = "MunicipalPush",
                TicketReference = fault.TicketReference,
                Payload = technicalPayload
            },
            cancellationToken);

        return Ok(new
        {
            fault.FaultID,
            fault.TicketReference,
            fault.Status,
            TechnicalPayload = technicalPayload
        });
    }

    public sealed class UpdateWorkflowRequest
    {
        public bool? TeamDispatched { get; set; }
        public string InspectionFindings { get; set; } = string.Empty;
        public bool MarkResolved { get; set; }
    }

    public sealed class PushToMunicipalityRequest
    {
        public string TechnicalPayload { get; set; } = string.Empty;
    }
}
