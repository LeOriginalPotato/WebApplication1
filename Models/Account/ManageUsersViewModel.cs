using System.Collections.Generic;

namespace TheSolution.PAPortal.Web.Models.Account;

public class ManageUsersViewModel
{
    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public bool CanEditServerAdmins { get; set; }

    public bool IsResidentTab { get; set; }

    public List<UserManagementEditViewModel> Users { get; set; } = new();
}
