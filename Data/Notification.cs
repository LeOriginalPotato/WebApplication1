using System;
using System.ComponentModel.DataAnnotations;

namespace TheSolution.PAPortal.Data;

public class Notification
{
    [Key]
    public int NotificationID { get; set; }

    public int? UserID { get; set; }

    public string TargetRole { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public string RelatedTicketReference { get; set; } = string.Empty;

    public bool IsRead { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public virtual User? User { get; set; }
}
