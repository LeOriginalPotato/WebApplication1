using System;
using System.ComponentModel.DataAnnotations;

namespace TheSolution.PAPortal.Data;

public class EscalationHistory
{
    [Key]
    public int EscalationID { get; set; }

    public int FaultID { get; set; }

    public int ActionTakenBy { get; set; }

    public string Notes { get; set; } = string.Empty;

    public DateTime DateActioned { get; set; } = DateTime.UtcNow;

    public virtual Fault Fault { get; set; } = null!;

    public virtual User ActionTakenByUser { get; set; } = null!;
}
