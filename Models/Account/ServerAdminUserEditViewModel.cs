using System.ComponentModel.DataAnnotations;

namespace TheSolution.PAPortal.Web.Models.Account;

public class ServerAdminUserEditViewModel
{
    [Required]
    public int UserID { get; set; }

    [Required]
    public string Username { get; set; } = string.Empty;

    [Required]
    [Display(Name = "First Name")]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [Display(Name = "Surname")]
    public string LastName { get; set; } = string.Empty;

    [Required]
    [Display(Name = "Physical Address")]
    public string PhysicalAddress { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [Display(Name = "Email Address")]
    public string EmailAddress { get; set; } = string.Empty;

    [Required]
    [Phone]
    [Display(Name = "Phone Number")]
    public string CellNumber { get; set; } = string.Empty;

    [DataType(DataType.Password)]
    [Display(Name = "New Password")]
    public string? NewPassword { get; set; }

    [DataType(DataType.Password)]
    [Display(Name = "Confirm New Password")]
    public string? ConfirmNewPassword { get; set; }
}
