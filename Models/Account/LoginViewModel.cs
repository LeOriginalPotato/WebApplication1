using System.ComponentModel.DataAnnotations;

namespace TheSolution.PAPortal.Web.Models.Account;

public class LoginViewModel
{
    [Required]
    [Display(Name = "Email Address")]
    [EmailAddress]
    public string EmailAddress { get; set; } = string.Empty;

    [Required]
    [DataType(DataType.Password)]
    public string Password { get; set; } = string.Empty;

    public bool RememberMe { get; set; }

    public string? ReturnUrl { get; set; }
}
