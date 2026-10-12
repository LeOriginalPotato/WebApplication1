using System.ComponentModel.DataAnnotations;

namespace TheSolution.PAPortal.Web.Models.Account;

public class CreateManagedUserViewModel
{
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

    [Required]
    [DataType(DataType.Password)]
    public string Password { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(Admin|PA Member|Server Admin)$")]
    [Display(Name = "User Role")]
    public string UserRole { get; set; } = "PA Member";
}
