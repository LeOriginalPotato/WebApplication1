using System;
using Microsoft.EntityFrameworkCore;

namespace TheSolution.PAPortal.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();

    public DbSet<Category> Categories => Set<Category>();

    public DbSet<Fault> Faults => Set<Fault>();

    public DbSet<EscalationHistory> EscalationHistories => Set<EscalationHistory>();

    public DbSet<Notification> Notifications => Set<Notification>();

    public DbSet<Section78Dispute> Section78Disputes => Set<Section78Dispute>();

    public DbSet<SystemConfiguration> SystemConfigurations => Set<SystemConfiguration>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.UserID);
            entity.HasIndex(e => e.CellNumber).IsUnique();
            entity.HasIndex(e => e.Username).IsUnique();
            entity.HasIndex(e => e.EmailAddress).IsUnique();
            entity.Property(e => e.UserRole).HasDefaultValue("Resident");
            entity.Property(e => e.Username).IsRequired();
            entity.Property(e => e.FirstName).IsRequired();
            entity.Property(e => e.LastName).IsRequired();
            entity.Property(e => e.PhysicalAddress).IsRequired();
            entity.Property(e => e.CellNumber).IsRequired();
            entity.Property(e => e.EmailAddress).IsRequired();
            entity.Property(e => e.PasswordHash).IsRequired();
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.IsProfileComplete).HasDefaultValue(false);
            entity.HasData(
                new User
                {
                    UserID = 1,
                    Username = "jeanmari",
                    FirstName = "Jeanmari",
                    LastName = "Administrator",
                    PhysicalAddress = "PA Headquarters",
                    CellNumber = "0600000001",
                    EmailAddress = "jeanmari@thesolution.co.za",
                    PasswordHash = PasswordUtility.CreateHash("Foktogbokka", "jeanmari@thesolution.co.za"),
                    UserRole = "Server Admin",
                    CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                    IsProfileComplete = true
                },
                new User
                {
                    UserID = 2,
                    Username = "jean",
                    FirstName = "Jean",
                    LastName = "Administrator",
                    PhysicalAddress = "PA Headquarters",
                    CellNumber = "0600000002",
                    EmailAddress = "jean@thesolution.co.za",
                    PasswordHash = PasswordUtility.CreateHash("888@JP", "jean@thesolution.co.za"),
                    UserRole = "Server Admin",
                    CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                    IsProfileComplete = true
                },
                new User
                {
                    UserID = 3,
                    Username = "admin",
                    FirstName = "Admin",
                    LastName = "Example",
                    PhysicalAddress = "PA Headquarters",
                    CellNumber = "0600000003",
                    EmailAddress = "admin@pa.local",
                    PasswordHash = PasswordUtility.CreateHash("Password123!", "admin@pa.local"),
                    UserRole = "Admin",
                    CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                    IsProfileComplete = true
                },
                new User
                {
                    UserID = 4,
                    Username = "pamember",
                    FirstName = "PA",
                    LastName = "Member",
                    PhysicalAddress = "Ward Operations Desk",
                    CellNumber = "0600000004",
                    EmailAddress = "pamember@pa.local",
                    PasswordHash = PasswordUtility.CreateHash("Password123!", "pamember@pa.local"),
                    UserRole = "PA Member",
                    CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                    IsProfileComplete = true
                },
                new User
                {
                    UserID = 5,
                    Username = "resident",
                    FirstName = "Resident",
                    LastName = "Example",
                    PhysicalAddress = "Mohlakeng Extension 7",
                    CellNumber = "0600000005",
                    EmailAddress = "resident@pa.local",
                    PasswordHash = PasswordUtility.CreateHash("Password123!", "resident@pa.local"),
                    UserRole = "Resident",
                    CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                    IsProfileComplete = true
                }
            );        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasKey(e => e.CategoryID);
            entity.Property(e => e.CategoryName).IsRequired();
            entity.Property(e => e.Description).IsRequired();
            entity.HasData(
                new Category { CategoryID = 1, CategoryName = "Electrical & Grid", Description = "Issues related to electricity supply, outages, and grid infrastructure." },
                new Category { CategoryID = 2, CategoryName = "Roads & Transport", Description = "Issues related to roads, potholes, traffic signals, and public transport infrastructure." },
                new Category { CategoryID = 3, CategoryName = "Water & Sanitation", Description = "Issues related to water supply, leaks, sewer systems, and sanitation services." },
                new Category { CategoryID = 4, CategoryName = "Environmental & Landfill", Description = "Issues related to waste management, landfill sites, and environmental hazards." }
            );
        });

        modelBuilder.Entity<Fault>(entity =>
        {
            entity.HasKey(e => e.FaultID);
            entity.HasIndex(e => e.TicketReference).IsUnique();
            entity.Property(e => e.TicketReference).IsRequired();
            entity.Property(e => e.Description).IsRequired();
            entity.Property(e => e.PhysicalAddress).IsRequired();
            entity.Property(e => e.WardName).IsRequired();
            entity.Property(e => e.LiveLoggingOptIn).HasDefaultValue(false);
            entity.Property(e => e.Latitude).HasPrecision(9, 6);
            entity.Property(e => e.Longitude).HasPrecision(9, 6);
            entity.Property(e => e.Status).HasDefaultValue("Logged");
            entity.Property(e => e.DateLogged).IsRequired();
            entity.Property(e => e.LastUpdated).IsRequired();
            entity.Property(e => e.InspectionFindings).HasDefaultValue(string.Empty);

            entity.HasOne(e => e.User)
                .WithMany(u => u.Faults)
                .HasForeignKey(e => e.UserID)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Category)
                .WithMany(c => c.Faults)
                .HasForeignKey(e => e.CategoryID)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<EscalationHistory>(entity =>
        {
            entity.HasKey(e => e.EscalationID);
            entity.Property(e => e.Notes).IsRequired();
            entity.Property(e => e.DateActioned).IsRequired();

            entity.HasOne(e => e.Fault)
                .WithMany(f => f.EscalationHistory)
                .HasForeignKey(e => e.FaultID)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.ActionTakenByUser)
                .WithMany(u => u.EscalationActions)
                .HasForeignKey(e => e.ActionTakenBy)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasKey(e => e.NotificationID);
            entity.Property(e => e.TargetRole).IsRequired();
            entity.Property(e => e.Message).IsRequired();
            entity.Property(e => e.RelatedTicketReference).IsRequired();
            entity.Property(e => e.CreatedAt).IsRequired();

            entity.HasOne(e => e.User)
                .WithMany(u => u.Notifications)
                .HasForeignKey(e => e.UserID)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Section78Dispute>(entity =>
        {
            entity.HasKey(e => e.Section78DisputeID);
            entity.Property(e => e.PropertyAddress).IsRequired();
            entity.Property(e => e.MunicipalAccountNumber).IsRequired();
            entity.Property(e => e.ErfNumber).IsRequired();
            entity.Property(e => e.TitleDeedNumber).IsRequired();
            entity.Property(e => e.ActualDominantUse).IsRequired();
            entity.Property(e => e.PropertyCategoryDispute).IsRequired();
            entity.Property(e => e.OwnerStatement).IsRequired();
            entity.Property(e => e.SupportingDocumentPath).IsRequired();
            entity.Property(e => e.IdentityDocumentPath).IsRequired();
            entity.Property(e => e.MunicipalAccountProofPath).IsRequired();
            entity.Property(e => e.AdditionalNotes).HasDefaultValue(string.Empty);
            entity.Property(e => e.SubmittedAt).IsRequired();

            entity.HasOne(e => e.User)
                .WithMany(u => u.Section78Disputes)
                .HasForeignKey(e => e.UserID)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SystemConfiguration>(entity =>
        {
            entity.HasKey(e => e.SystemConfigurationID);
            entity.Property(e => e.WebsiteName).IsRequired();
            entity.Property(e => e.DomainName).IsRequired();
            entity.Property(e => e.StorageRootPath).IsRequired();
            entity.Property(e => e.LocalDirectoryStructure).IsRequired();
            entity.Property(e => e.DatabaseConnectionString).IsRequired();
            entity.Property(e => e.BackupDriveLocation).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();
            entity.HasData(
                new SystemConfiguration
                {
                    SystemConfigurationID = 1,
                    WebsiteName = "PA Infrastructure Portal",
                    DomainName = "pa-atwork.org",
                    StorageRootPath = "D:\\PAInfra\\Storage",
                    LocalDirectoryStructure = "tickets/{year}/{month}",
                    DatabaseConnectionString = "Server=(localdb)\\MSSQLLocalDB;Database=PAPortalDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True",
                    BackupDriveLocation = "E:\\PAInfraBackup",
                    WhatsAppChatLink = "https://wa.me/0000000000",
                    UpdatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                    UpdatedByUserID = 1
                }
            );

            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(e => e.UpdatedByUserID)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
