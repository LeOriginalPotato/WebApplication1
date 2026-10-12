using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace TheSolution.PAPortal.Data;

public class Category
{
    [Key]
    public int CategoryID { get; set; }

    public string CategoryName { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public virtual ICollection<Fault> Faults { get; set; } = new HashSet<Fault>();
}
