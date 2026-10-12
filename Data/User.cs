using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace TheSolution.PAPortal.Data;

public class User
{
    [Key]
    public int UserID { get; set; }

    public string Username { get; set; } = string.Empty;

    public string FirstName { get; set; } = string.Empty;

    public string LastName { get; set; } = string.Empty;

    public string PhysicalAddress { get; set; } = string.Empty;

    public string CellNumber { get; set; } = string.Empty;

    public string? EmailAddress { get; set; }

    public string PasswordHash { get; set; } = string.Empty;

    public string UserRole { get; set; } = "Resident";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsProfileComplete { get; set; } = false;

    public virtual ICollection<Fault> Faults { get; set; } = new HashSet<Fault>();

    public virtual ICollection<Section78Dispute> Section78Disputes { get; set; } = new HashSet<Section78Dispute>();

    public virtual ICollection<EscalationHistory> EscalationActions { get; set; } = new HashSet<EscalationHistory>();

    public virtual ICollection<Notification> Notifications { get; set; } = new HashSet<Notification>();
}
