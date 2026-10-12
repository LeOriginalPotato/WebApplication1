using System;
using System.ComponentModel.DataAnnotations;

namespace TheSolution.PAPortal.Data;

public class SystemConfiguration
{
    [Key]
    public int SystemConfigurationID { get; set; }

    public string WebsiteName { get; set; } = string.Empty;

    public string DomainName { get; set; } = string.Empty;

    public string StorageRootPath { get; set; } = string.Empty;

    public string LocalDirectoryStructure { get; set; } = string.Empty;

    public string DatabaseConnectionString { get; set; } = string.Empty;

    public string BackupDriveLocation { get; set; } = string.Empty;

    public string WhatsAppChatLink { get; set; } = string.Empty;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public int UpdatedByUserID { get; set; }
}
