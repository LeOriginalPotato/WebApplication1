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
    public async Task<IActionResult> GetComplaintsAsync(CancellationToken cancellationToken)
    {
        var complaints = await _dbContext.Faults
            .AsNoTracking()
            .Include(f => f.User)
            .Include(f => f.Category)
            .OrderByDescending(f => f.DateLogged)
            .Select(f => new
            {
                f.FaultID,
                f.TicketReference,
                f.DateLogged,
                Category = f.Category.CategoryName,
                f.Description,
                f.PhysicalAddress,
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

    public sealed class UpdateWorkflowRequest
    {
        public bool? TeamDispatched { get; set; }
        public string InspectionFindings { get; set; } = string.Empty;
        public bool MarkResolved { get; set; }
    }
}
