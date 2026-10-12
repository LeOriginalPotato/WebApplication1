using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace TheSolution.PAPortal.Data;

public class Fault
{
    [Key]
    public int FaultID { get; set; }

    public string TicketReference { get; set; } = string.Empty;

    public int UserID { get; set; }

    public int CategoryID { get; set; }

    public string Description { get; set; } = string.Empty;

    public string PhysicalAddress { get; set; } = string.Empty;

    public decimal Latitude { get; set; }

    public decimal Longitude { get; set; }

    public string Status { get; set; } = "Logged";

    public string? MunicipalityRefCode { get; set; }

    public DateTime DateLogged { get; set; } = DateTime.UtcNow;

    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

    public bool TeamDispatched { get; set; }

    public string InspectionFindings { get; set; } = string.Empty;

    public bool IsResolved { get; set; }

    public DateTime? ResolvedAt { get; set; }

    public string? ProofImagePath { get; set; }

    public virtual User User { get; set; } = null!;

    public virtual Category Category { get; set; } = null!;

    public virtual ICollection<EscalationHistory> EscalationHistory { get; set; } = new HashSet<EscalationHistory>();
}
