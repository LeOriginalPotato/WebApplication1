using System;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using OpenAI.Chat;
using TheSolution.PAPortal.Data;
using TheSolution.PAPortal.Web.Hubs;

namespace TheSolution.PAPortal.Web.Controllers;

[ApiController]
[Route("api")]
[Authorize(Roles = "Server Admin,Admin,PA Member,Resident")]
public class FaultReportingController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IHubContext<NotificationHub> _hubContext;

    public FaultReportingController(ApplicationDbContext dbContext, IHubContext<NotificationHub> hubContext)
    {
        _dbContext = dbContext;
        _hubContext = hubContext;
    }

    [HttpPost("infrastructure/log-fault")]
    public async Task<IActionResult> LogFaultAsync([FromBody] LogFaultRequest request, CancellationToken cancellationToken)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out int authenticatedUserId))
            {
                return Unauthorized(new { message = "Invalid authentication context." });
            }

            User? user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserID == authenticatedUserId, cancellationToken);
            if (user is null)
            {
                return BadRequest(new { message = "Authenticated user was not found." });
            }

            if (user.UserRole == "Resident" && !user.IsProfileComplete)
            {
                return BadRequest(new { message = "Resident profile is incomplete. Complete all required profile fields before logging a complaint." });
            }

            bool categoryExists = await _dbContext.Categories.AnyAsync(c => c.CategoryID == request.CategoryID, cancellationToken);
            if (!categoryExists)
            {
                return BadRequest(new { message = "Invalid CategoryID." });
            }

            string ticketReference = await GenerateUniqueTicketReferenceAsync(cancellationToken);

            Fault fault = new()
            {
                TicketReference = ticketReference,
                UserID = authenticatedUserId,
                CategoryID = request.CategoryID,
                Description = request.Description,
                PhysicalAddress = request.PhysicalAddress,
                Latitude = request.Latitude,
                Longitude = request.Longitude,
                Status = "Logged",
                DateLogged = DateTime.UtcNow,
                LastUpdated = DateTime.UtcNow
            };

            _dbContext.Faults.Add(fault);
            _dbContext.Notifications.Add(new Notification
            {
                TargetRole = "PA Member",
                Message = $"New community complaint logged: {fault.TicketReference}",
                RelatedTicketReference = fault.TicketReference,
                CreatedAt = DateTime.UtcNow
            });
            await _dbContext.SaveChangesAsync(cancellationToken);

            await _hubContext.Clients.Group("role:PA Member").SendAsync(
                "ReceiveNotification",
                new
                {
                    Type = "NewComplaint",
                    TicketReference = fault.TicketReference,
                    Message = $"New complaint {fault.TicketReference} has been filed."
                },
                cancellationToken);

            return Ok(new { TicketReference = fault.TicketReference });
        }
        catch (DbUpdateException)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "A database error occurred while logging the fault." });
        }
        catch (Exception)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An unexpected error occurred while logging the fault." });
        }
    }

    [HttpGet("infrastructure/my-complaints")]
    public async Task<IActionResult> GetMyComplaintsAsync(CancellationToken cancellationToken)
    {
        try
        {
            string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out int authenticatedUserId))
            {
                return Unauthorized(new { message = "Invalid authentication context." });
            }

            List<MyComplaintResult> complaints = await _dbContext.Faults
                .AsNoTracking()
                .Where(f => f.UserID == authenticatedUserId)
                .OrderByDescending(f => f.DateLogged)
                .Select(f => new MyComplaintResult
                {
                    TicketReference = f.TicketReference,
                    DateLogged = f.DateLogged,
                    Status = f.Status,
                    LatestUpdate = f.EscalationHistory
                        .OrderByDescending(e => e.DateActioned)
                        .Select(e => e.Notes)
                        .FirstOrDefault() ?? f.Status,
                    LastUpdatedAt = f.EscalationHistory
                        .OrderByDescending(e => e.DateActioned)
                        .Select(e => (DateTime?)e.DateActioned)
                        .FirstOrDefault() ?? f.LastUpdated
                })
                .ToListAsync(cancellationToken);

            return Ok(complaints);
        }
        catch (Exception)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An unexpected error occurred while loading your complaints." });
        }
    }

    [HttpPost("ai-analytics/analyze-whatsapp-dump")]
    [Consumes("text/plain")]
    public async Task<IActionResult> AnalyzeWhatsAppDumpAsync([FromBody] string rawChatDump, CancellationToken cancellationToken)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(rawChatDump))
            {
                return BadRequest(new { message = "The chat payload cannot be empty." });
            }

            string? apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "OPENAI_API_KEY is not configured." });
            }

            ChatClient chatClient = new(model: "gpt-4o", apiKey: apiKey);

            string systemPrompt = "You are a municipal infrastructure analytics engine. Analyze only the provided WhatsApp group chat dump text. Count distinct community infrastructure complaints that occurred over the weekend only. Classify complaints into these categories only: Electrical, Roads, Water, Environmental. For privacy and POPIA compliance, remove and ignore all personal names, phone numbers, and exact ERF numbers. Return output as valid raw JSON only with exactly these keys: TotalComplaints, ElectricalCount, RoadsCount, WaterCount, LandfillCount, SummaryNote. LandfillCount must represent Environmental complaints. Do not include markdown, code fences, additional text, or extra properties.";

            ChatCompletion completion = await chatClient.CompleteChatAsync(
                [
                    new SystemChatMessage(systemPrompt),
                    new UserChatMessage(rawChatDump)
                ],
                cancellationToken: cancellationToken);

            string responseText = string.Concat(completion.Content.Select(part => part.Text));
            string jsonText = ExtractJsonObject(responseText);

            WhatsAppAnalyticsResult? analytics = JsonSerializer.Deserialize<WhatsAppAnalyticsResult>(jsonText, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (analytics is null)
            {
                return StatusCode(StatusCodes.Status502BadGateway, new { message = "AI service returned an unreadable response." });
            }

            return Ok(analytics);
        }
        catch (JsonException)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "AI service returned invalid JSON." });
        }
        catch (Exception)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An unexpected error occurred while analyzing the WhatsApp dump." });
        }
    }

    private async Task<string> GenerateUniqueTicketReferenceAsync(CancellationToken cancellationToken)
    {
        for (int attempt = 0; attempt < 20; attempt++)
        {
            int randomDigits = RandomNumberGenerator.GetInt32(10000, 100000);
            string candidate = $"PA-RF-{DateTime.UtcNow.Year}-{randomDigits}";
            bool exists = await _dbContext.Faults.AnyAsync(f => f.TicketReference == candidate, cancellationToken);
            if (!exists)
            {
                return candidate;
            }
        }

        throw new InvalidOperationException("Unable to generate a unique ticket reference.");
    }

    public sealed class LogFaultRequest
    {
        public int CategoryID { get; set; }
        public string Description { get; set; } = string.Empty;
        public string PhysicalAddress { get; set; } = string.Empty;
        public decimal Latitude { get; set; }
        public decimal Longitude { get; set; }
    }

    public sealed class MyComplaintResult
    {
        public string TicketReference { get; set; } = string.Empty;
        public DateTime DateLogged { get; set; }
        public string Status { get; set; } = string.Empty;
        public string LatestUpdate { get; set; } = string.Empty;
        public DateTime LastUpdatedAt { get; set; }
    }

    public sealed class WhatsAppAnalyticsResult
    {
        public int TotalComplaints { get; set; }
        public int ElectricalCount { get; set; }
        public int RoadsCount { get; set; }
        public int WaterCount { get; set; }
        public int LandfillCount { get; set; }
        public string SummaryNote { get; set; } = string.Empty;
    }

    private static string ExtractJsonObject(string input)
    {
        int start = input.IndexOf('{');
        int end = input.LastIndexOf('}');

        if (start < 0 || end < start)
        {
            throw new JsonException("No JSON object was found in the AI response.");
        }

        return input[start..(end + 1)];
    }
}
