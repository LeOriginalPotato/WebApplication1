using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using TheSolution.PAPortal.Data;
using TheSolution.PAPortal.Web.Hubs;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"))
           .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning)));
builder.Services.AddSignalR();

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Account/Login";
        options.AccessDeniedPath = "/Account/AccessDenied";
        options.Cookie.Name = "PAInfra.Auth";
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
    });

builder.Services.AddAuthorization();

var app = builder.Build();

using (IServiceScope scope = app.Services.CreateScope())
{
    ApplicationDbContext dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    dbContext.Database.Migrate();

    dbContext.Database.ExecuteSqlRaw("""
        IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL
        BEGIN
            IF COL_LENGTH(N'dbo.Users', N'IsProfileComplete') IS NULL
                ALTER TABLE dbo.Users ADD IsProfileComplete bit NOT NULL DEFAULT (0);

            IF COL_LENGTH(N'dbo.Users', N'PhysicalAddress') IS NULL
                ALTER TABLE dbo.Users ADD PhysicalAddress nvarchar(max) NOT NULL DEFAULT (N'');

            IF COL_LENGTH(N'dbo.Users', N'Username') IS NULL
                ALTER TABLE dbo.Users ADD Username nvarchar(450) NULL;

            IF COL_LENGTH(N'dbo.Users', N'Username') IS NOT NULL
            BEGIN
                EXEC(N'UPDATE dbo.Users
                      SET Username = CONCAT(N''legacy_'', UserID)
                      WHERE Username IS NULL OR LTRIM(RTRIM(Username)) = N'''';');

                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'Username' AND is_nullable = 1)
                    EXEC(N'ALTER TABLE dbo.Users ALTER COLUMN Username nvarchar(450) NOT NULL;');

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_Username' AND object_id = OBJECT_ID(N'dbo.Users'))
                    EXEC(N'CREATE UNIQUE INDEX IX_Users_Username ON dbo.Users (Username);');
            END
        END

        IF OBJECT_ID(N'dbo.Faults', N'U') IS NOT NULL
        BEGIN
            IF COL_LENGTH(N'dbo.Faults', N'TeamDispatched') IS NULL
                ALTER TABLE dbo.Faults ADD TeamDispatched bit NOT NULL CONSTRAINT DF_Faults_TeamDispatched_Compat DEFAULT (0);

            IF COL_LENGTH(N'dbo.Faults', N'InspectionFindings') IS NULL
                ALTER TABLE dbo.Faults ADD InspectionFindings nvarchar(max) NOT NULL CONSTRAINT DF_Faults_InspectionFindings_Compat DEFAULT (N'');

            IF COL_LENGTH(N'dbo.Faults', N'WardName') IS NULL
                ALTER TABLE dbo.Faults ADD WardName nvarchar(max) NOT NULL CONSTRAINT DF_Faults_WardName_Compat DEFAULT (N'');

            IF COL_LENGTH(N'dbo.Faults', N'LiveLoggingOptIn') IS NULL
                ALTER TABLE dbo.Faults ADD LiveLoggingOptIn bit NOT NULL CONSTRAINT DF_Faults_LiveLoggingOptIn_Compat DEFAULT (0);

            IF COL_LENGTH(N'dbo.Faults', N'IsResolved') IS NULL
                ALTER TABLE dbo.Faults ADD IsResolved bit NOT NULL CONSTRAINT DF_Faults_IsResolved_Compat DEFAULT (0);

            IF COL_LENGTH(N'dbo.Faults', N'ResolvedAt') IS NULL
                ALTER TABLE dbo.Faults ADD ResolvedAt datetime2 NULL;

            IF COL_LENGTH(N'dbo.Faults', N'ProofImagePath') IS NULL
                ALTER TABLE dbo.Faults ADD ProofImagePath nvarchar(max) NULL;
        END

        IF OBJECT_ID(N'dbo.Notifications', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.Notifications
            (
                NotificationID int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                UserID int NULL,
                TargetRole nvarchar(max) NOT NULL,
                Message nvarchar(max) NOT NULL,
                RelatedTicketReference nvarchar(max) NOT NULL,
                IsRead bit NOT NULL CONSTRAINT DF_Notifications_IsRead_Compat DEFAULT(0),
                CreatedAt datetime2 NOT NULL,
                CONSTRAINT FK_Notifications_Users_UserID_Compat FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID) ON DELETE SET NULL
            );
            CREATE INDEX IX_Notifications_UserID ON dbo.Notifications(UserID);
        END

        IF OBJECT_ID(N'dbo.SystemConfigurations', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.SystemConfigurations
            (
                SystemConfigurationID int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                WebsiteName nvarchar(max) NOT NULL CONSTRAINT DF_SystemConfigurations_WebsiteName_Compat DEFAULT(N''),
                DomainName nvarchar(max) NOT NULL CONSTRAINT DF_SystemConfigurations_DomainName_Compat DEFAULT(N''),
                StorageRootPath nvarchar(max) NOT NULL,
                LocalDirectoryStructure nvarchar(max) NOT NULL,
                DatabaseConnectionString nvarchar(max) NOT NULL,
                BackupDriveLocation nvarchar(max) NOT NULL,
                WhatsAppChatLink nvarchar(max) NOT NULL CONSTRAINT DF_SystemConfigurations_WhatsAppChatLink_Compat DEFAULT(N''),
                UpdatedAt datetime2 NOT NULL,
                UpdatedByUserID int NOT NULL,
                CONSTRAINT FK_SystemConfigurations_Users_UpdatedByUserID_Compat FOREIGN KEY (UpdatedByUserID) REFERENCES dbo.Users(UserID)
            );
            CREATE INDEX IX_SystemConfigurations_UpdatedByUserID ON dbo.SystemConfigurations(UpdatedByUserID);
        END

        IF OBJECT_ID(N'dbo.SystemConfigurations', N'U') IS NOT NULL
        BEGIN
            IF COL_LENGTH(N'dbo.SystemConfigurations', N'WebsiteName') IS NULL
                ALTER TABLE dbo.SystemConfigurations ADD WebsiteName nvarchar(max) NOT NULL CONSTRAINT DF_SystemConfigurations_WebsiteName_Compat2 DEFAULT(N'');

            IF COL_LENGTH(N'dbo.SystemConfigurations', N'DomainName') IS NULL
                ALTER TABLE dbo.SystemConfigurations ADD DomainName nvarchar(max) NOT NULL CONSTRAINT DF_SystemConfigurations_DomainName_Compat2 DEFAULT(N'');

            IF COL_LENGTH(N'dbo.SystemConfigurations', N'WhatsAppChatLink') IS NULL
                ALTER TABLE dbo.SystemConfigurations ADD WhatsAppChatLink nvarchar(max) NOT NULL CONSTRAINT DF_SystemConfigurations_WhatsAppChatLink_Compat2 DEFAULT(N'');
        END

        IF OBJECT_ID(N'dbo.Section78Disputes', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.Section78Disputes
            (
                Section78DisputeID int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                UserID int NOT NULL,
                PropertyAddress nvarchar(max) NOT NULL,
                MunicipalAccountNumber nvarchar(max) NOT NULL,
                ErfNumber nvarchar(max) NOT NULL,
                TitleDeedNumber nvarchar(max) NOT NULL CONSTRAINT DF_Section78Disputes_TitleDeedNumber_Compat DEFAULT(N''),
                ActualDominantUse nvarchar(max) NOT NULL CONSTRAINT DF_Section78Disputes_ActualDominantUse_Compat DEFAULT(N''),
                PropertyCategoryDispute nvarchar(max) NOT NULL,
                OwnerStatement nvarchar(max) NOT NULL,
                NoFormalNoticeReceived bit NOT NULL CONSTRAINT DF_Section78Disputes_NoFormalNoticeReceived_Compat DEFAULT(0),
                NoSection78DocumentsReceived bit NOT NULL CONSTRAINT DF_Section78Disputes_NoSection78DocumentsReceived_Compat DEFAULT(0),
                SupportingDocumentPath nvarchar(max) NOT NULL,
                IdentityDocumentPath nvarchar(max) NOT NULL,
                MunicipalAccountProofPath nvarchar(max) NOT NULL,
                AdditionalNotes nvarchar(max) NOT NULL CONSTRAINT DF_Section78Disputes_AdditionalNotes_Compat DEFAULT(N''),
                SubmittedAt datetime2 NOT NULL,
                CONSTRAINT FK_Section78Disputes_Users_UserID_Compat FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID) ON DELETE NO ACTION
            );
            CREATE INDEX IX_Section78Disputes_UserID ON dbo.Section78Disputes(UserID);
        END
        """);

    bool hasJeanmariAdmin = dbContext.Users.Any(u => u.EmailAddress == "jeanmari@thesolution.co.za" && u.UserRole == "Server Admin");
    bool hasJeanAdmin = dbContext.Users.Any(u => u.EmailAddress == "jean@thesolution.co.za" && u.UserRole == "Server Admin");
    bool hasExampleAdmin = dbContext.Users.Any(u => u.EmailAddress == "admin@pa.local" && u.UserRole == "Admin");
    bool hasExamplePaMember = dbContext.Users.Any(u => u.EmailAddress == "pamember@pa.local" && u.UserRole == "PA Member");
    bool hasExampleResident = dbContext.Users.Any(u => u.EmailAddress == "resident@pa.local" && u.UserRole == "Resident");

    if (!hasJeanmariAdmin || !hasJeanAdmin || !hasExampleAdmin || !hasExamplePaMember || !hasExampleResident)
    {
        dbContext.EscalationHistories.ExecuteDelete();
        dbContext.Notifications.ExecuteDelete();
        dbContext.Faults.ExecuteDelete();
        dbContext.SystemConfigurations.ExecuteDelete();
        dbContext.Users.ExecuteDelete();

        User jeanmariUser = new()
        {
            Username = "jeanmari",
            FirstName = "Jeanmari",
            LastName = "Administrator",
            PhysicalAddress = "PA Headquarters",
            CellNumber = "0600000001",
            EmailAddress = "jeanmari@thesolution.co.za",
            PasswordHash = PasswordUtility.CreateHash("Foktogbokka", "jeanmari@thesolution.co.za"),
            UserRole = "Server Admin",
            CreatedAt = DateTime.UtcNow,
            IsProfileComplete = true
        };

        User jeanUser = new()
        {
            Username = "jean",
            FirstName = "Jean",
            LastName = "Administrator",
            PhysicalAddress = "PA Headquarters",
            CellNumber = "0600000002",
            EmailAddress = "jean@thesolution.co.za",
            PasswordHash = PasswordUtility.CreateHash("888@JP", "jean@thesolution.co.za"),
            UserRole = "Server Admin",
            CreatedAt = DateTime.UtcNow,
            IsProfileComplete = true
        };

        User exampleAdminUser = new()
        {
            Username = "admin",
            FirstName = "Admin",
            LastName = "Example",
            PhysicalAddress = "PA Headquarters",
            CellNumber = "0600000003",
            EmailAddress = "admin@pa.local",
            PasswordHash = PasswordUtility.CreateHash("Password123!", "admin@pa.local"),
            UserRole = "Admin",
            CreatedAt = DateTime.UtcNow,
            IsProfileComplete = true
        };

        User examplePaMemberUser = new()
        {
            Username = "pamember",
            FirstName = "PA",
            LastName = "Member",
            PhysicalAddress = "Ward Operations Desk",
            CellNumber = "0600000004",
            EmailAddress = "pamember@pa.local",
            PasswordHash = PasswordUtility.CreateHash("Password123!", "pamember@pa.local"),
            UserRole = "PA Member",
            CreatedAt = DateTime.UtcNow,
            IsProfileComplete = true
        };

        User exampleResidentUser = new()
        {
            Username = "resident",
            FirstName = "Resident",
            LastName = "Example",
            PhysicalAddress = "Mohlakeng Extension 7",
            CellNumber = "0600000005",
            EmailAddress = "resident@pa.local",
            PasswordHash = PasswordUtility.CreateHash("Password123!", "resident@pa.local"),
            UserRole = "Resident",
            CreatedAt = DateTime.UtcNow,
            IsProfileComplete = true
        };

        dbContext.Users.AddRange(jeanmariUser, jeanUser, exampleAdminUser, examplePaMemberUser, exampleResidentUser);
        dbContext.SaveChanges();

        dbContext.SystemConfigurations.Add(new SystemConfiguration
        {
            WebsiteName = "PA Infrastructure Portal",
            DomainName = "pa-atwork.org",
            StorageRootPath = "D:\\PAInfra\\Storage",
            LocalDirectoryStructure = "tickets/{year}/{month}",
            DatabaseConnectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? string.Empty,
            BackupDriveLocation = "E:\\PAInfraBackup",
            WhatsAppChatLink = "https://wa.me/0000000000",
            UpdatedAt = DateTime.UtcNow,
            UpdatedByUserID = jeanmariUser.UserID
        });
        dbContext.SaveChanges();
    }
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapStaticAssets();
app.MapControllers();
app.MapHub<NotificationHub>("/hubs/notifications");
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();
