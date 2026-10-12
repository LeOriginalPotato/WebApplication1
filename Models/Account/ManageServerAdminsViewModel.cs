using System.Collections.Generic;

namespace TheSolution.PAPortal.Web.Models.Account;

public class ManageServerAdminsViewModel
{
    public List<ServerAdminUserEditViewModel> Users { get; set; } = new();
}
