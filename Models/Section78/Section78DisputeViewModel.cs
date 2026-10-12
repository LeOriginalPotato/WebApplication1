using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace TheSolution.PAPortal.Web.Models.Section78;

public class Section78DisputeViewModel
{
    [Required]
    [Display(Name = "Property Address")]
    public string PropertyAddress { get; set; } = string.Empty;

    [Required]
    [Display(Name = "Municipal Account Number")]
    public string MunicipalAccountNumber { get; set; } = string.Empty;

    [Required]
    [Display(Name = "Erf / Stand Number")]
    public string ErfNumber { get; set; } = string.Empty;

    [Required]
    [Display(Name = "Disputed Property Category or Valuation Issue")]
    public string PropertyCategoryDispute { get; set; } = string.Empty;

    [Required]
    [Display(Name = "Resident Statement")]
    public string OwnerStatement { get; set; } = string.Empty;

    [Display(Name = "I did not receive a formal municipal reclassification notice")]
    public bool NoFormalNoticeReceived { get; set; }

    [Display(Name = "No lawful Section 78 engagement documents were delivered to my address")]
    public bool NoSection78DocumentsReceived { get; set; }

    [Required]
    [Display(Name = "Supporting Dispute Document")]
    public IFormFile? SupportingDocument { get; set; }

    [Required]
    [Display(Name = "Identity Document")]
    public IFormFile? IdentityDocument { get; set; }

    [Required]
    [Display(Name = "Municipal Account / Rates Bill")]
    public IFormFile? MunicipalAccountProof { get; set; }

    [Display(Name = "Additional Notes")]
    public string AdditionalNotes { get; set; } = string.Empty;
}
