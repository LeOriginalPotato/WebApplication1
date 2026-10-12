using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace TheSolution.PAPortal.Web.Hubs;

[Authorize(Roles = "Server Admin,Admin,PA Member,Resident")]
public class NotificationHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        string? role = Context.User?.FindFirstValue(ClaimTypes.Role);
        string? userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!string.IsNullOrWhiteSpace(role))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"role:{role}");
        }

        if (!string.IsNullOrWhiteSpace(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");
        }

        await base.OnConnectedAsync();
    }
}
