using System.Collections.Generic;

namespace TheSolution.PAPortal.Web.Models.Account;

public class ManageStaffViewModel
{
    public List<StaffUserEditViewModel> Users { get; set; } = new();
}
