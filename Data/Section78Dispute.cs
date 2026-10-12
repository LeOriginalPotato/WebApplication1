using System;
using System.ComponentModel.DataAnnotations;

namespace TheSolution.PAPortal.Data;

public class Section78Dispute
{
    [Key]
    public int Section78DisputeID { get; set; }

    public int UserID { get; set; }

    public string PropertyAddress { get; set; } = string.Empty;

    public string MunicipalAccountNumber { get; set; } = string.Empty;

    public string ErfNumber { get; set; } = string.Empty;

    public string TitleDeedNumber { get; set; } = string.Empty;

    public string ActualDominantUse { get; set; } = string.Empty;

    public string PropertyCategoryDispute { get; set; } = string.Empty;

    public string OwnerStatement { get; set; } = string.Empty;

    public bool NoFormalNoticeReceived { get; set; }

    public bool NoSection78DocumentsReceived { get; set; }

    public string SupportingDocumentPath { get; set; } = string.Empty;

    public string IdentityDocumentPath { get; set; } = string.Empty;

    public string MunicipalAccountProofPath { get; set; } = string.Empty;

    public string AdditionalNotes { get; set; } = string.Empty;

    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

    public virtual User User { get; set; } = null!;
}
