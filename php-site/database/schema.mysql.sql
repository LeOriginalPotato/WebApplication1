CREATE DATABASE IF NOT EXISTS pa_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pa_portal;

CREATE TABLE IF NOT EXISTS Categories (
	CategoryID INT AUTO_INCREMENT PRIMARY KEY,
	CategoryName VARCHAR(120) NOT NULL,
	Description VARCHAR(500) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Users (
	UserID INT AUTO_INCREMENT PRIMARY KEY,
	Username VARCHAR(50) NOT NULL,
	FirstName VARCHAR(120) NOT NULL,
	LastName VARCHAR(120) NOT NULL,
	PhysicalAddress VARCHAR(255) NOT NULL,
	CellNumber VARCHAR(30) NOT NULL,
	EmailAddress VARCHAR(255) NOT NULL,
	PasswordHash VARCHAR(500) NOT NULL,
	UserRole VARCHAR(50) NOT NULL DEFAULT 'Resident',
	CreatedAt DATETIME NOT NULL,
	IsProfileComplete TINYINT(1) NOT NULL DEFAULT 0,
	UNIQUE KEY UX_Users_Username (Username),
	UNIQUE KEY UX_Users_CellNumber (CellNumber),
	UNIQUE KEY UX_Users_EmailAddress (EmailAddress)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Faults (
	FaultID INT AUTO_INCREMENT PRIMARY KEY,
	TicketReference VARCHAR(80) NOT NULL,
	UserID INT NOT NULL,
	CategoryID INT NOT NULL,
	Description VARCHAR(1500) NOT NULL,
	PhysicalAddress VARCHAR(255) NOT NULL,
	Latitude DECIMAL(9,6) NOT NULL,
	Longitude DECIMAL(9,6) NOT NULL,
	Status VARCHAR(120) NOT NULL DEFAULT 'Logged',
	MunicipalityRefCode VARCHAR(100) NULL,
	DateLogged DATETIME NOT NULL,
	LastUpdated DATETIME NOT NULL,
	TeamDispatched TINYINT(1) NOT NULL DEFAULT 0,
	InspectionFindings VARCHAR(2000) NOT NULL DEFAULT '',
	IsResolved TINYINT(1) NOT NULL DEFAULT 0,
	ResolvedAt DATETIME NULL,
	ProofImagePath VARCHAR(500) NULL,
	UNIQUE KEY UX_Faults_TicketReference (TicketReference),
	KEY IX_Faults_UserID (UserID),
	KEY IX_Faults_CategoryID (CategoryID),
	CONSTRAINT FK_Faults_Users_UserID FOREIGN KEY (UserID) REFERENCES Users(UserID),
	CONSTRAINT FK_Faults_Categories_CategoryID FOREIGN KEY (CategoryID) REFERENCES Categories(CategoryID)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS EscalationHistories (
	EscalationID INT AUTO_INCREMENT PRIMARY KEY,
	FaultID INT NOT NULL,
	ActionTakenBy INT NOT NULL,
	Notes VARCHAR(2000) NOT NULL,
	DateActioned DATETIME NOT NULL,
	KEY IX_EscalationHistories_FaultID (FaultID),
	KEY IX_EscalationHistories_ActionTakenBy (ActionTakenBy),
	CONSTRAINT FK_EscalationHistories_Faults_FaultID FOREIGN KEY (FaultID) REFERENCES Faults(FaultID) ON DELETE CASCADE,
	CONSTRAINT FK_EscalationHistories_Users_ActionTakenBy FOREIGN KEY (ActionTakenBy) REFERENCES Users(UserID)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Notifications (
	NotificationID INT AUTO_INCREMENT PRIMARY KEY,
	UserID INT NULL,
	TargetRole VARCHAR(50) NOT NULL,
	Message VARCHAR(1000) NOT NULL,
	RelatedTicketReference VARCHAR(80) NOT NULL,
	IsRead TINYINT(1) NOT NULL DEFAULT 0,
	CreatedAt DATETIME NOT NULL,
	KEY IX_Notifications_UserID (UserID),
	KEY IX_Notifications_TargetRole (TargetRole),
	CONSTRAINT FK_Notifications_Users_UserID FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS SystemConfigurations (
	SystemConfigurationID INT AUTO_INCREMENT PRIMARY KEY,
	WebsiteName VARCHAR(200) NOT NULL,
	DomainName VARCHAR(300) NOT NULL,
	StorageRootPath VARCHAR(500) NOT NULL,
	LocalDirectoryStructure VARCHAR(500) NOT NULL,
	DatabaseConnectionString VARCHAR(2000) NOT NULL,
	BackupDriveLocation VARCHAR(500) NOT NULL,
	WhatsAppChatLink VARCHAR(1000) NOT NULL,
	UpdatedAt DATETIME NOT NULL,
	UpdatedByUserID INT NOT NULL,
	KEY IX_SystemConfigurations_UpdatedByUserID (UpdatedByUserID),
	CONSTRAINT FK_SystemConfigurations_Users_UpdatedByUserID FOREIGN KEY (UpdatedByUserID) REFERENCES Users(UserID)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Section78Disputes (
	Section78DisputeID INT AUTO_INCREMENT PRIMARY KEY,
	UserID INT NOT NULL,
	PropertyAddress VARCHAR(500) NOT NULL,
	MunicipalAccountNumber VARCHAR(255) NOT NULL,
	ErfNumber VARCHAR(255) NOT NULL,
	PropertyCategoryDispute VARCHAR(255) NOT NULL,
	OwnerStatement TEXT NOT NULL,
	NoFormalNoticeReceived TINYINT(1) NOT NULL DEFAULT 0,
	NoSection78DocumentsReceived TINYINT(1) NOT NULL DEFAULT 0,
	SupportingDocumentPath VARCHAR(1000) NOT NULL,
	IdentityDocumentPath VARCHAR(1000) NOT NULL,
	MunicipalAccountProofPath VARCHAR(1000) NOT NULL,
	AdditionalNotes TEXT NOT NULL,
	SubmittedAt DATETIME NOT NULL,
	KEY IX_Section78Disputes_UserID (UserID),
	CONSTRAINT FK_Section78Disputes_Users_UserID FOREIGN KEY (UserID) REFERENCES Users(UserID)
) ENGINE=InnoDB;

INSERT INTO Categories (CategoryID, CategoryName, Description) VALUES
(1, 'Electrical & Grid', 'Issues related to electricity supply, outages, and grid infrastructure.'),
(2, 'Roads & Transport', 'Issues related to roads, potholes, traffic signals, and transport infrastructure.'),
(3, 'Water & Sanitation', 'Issues related to water supply, leaks, sewer systems, and sanitation services.'),
(4, 'Environmental & Landfill', 'Issues related to waste management, landfill sites, and environmental hazards.')
ON DUPLICATE KEY UPDATE Description = VALUES(Description);

INSERT INTO Users (UserID, Username, FirstName, LastName, PhysicalAddress, CellNumber, EmailAddress, PasswordHash, UserRole, CreatedAt, IsProfileComplete) VALUES
(1, 'jeanmari', 'Jeanmari', 'Administrator', 'PA Headquarters', '0600000001', 'jeanmari@thesolution.co.za', 'Foktogbokka', 'Server Admin', UTC_TIMESTAMP(), 1),
(2, 'jean', 'Jean', 'Administrator', 'PA Headquarters', '0600000002', 'jean@thesolution.co.za', '888@JP', 'Server Admin', UTC_TIMESTAMP(), 1),
(3, 'admin', 'Admin', 'Example', 'PA Headquarters', '0600000003', 'admin@pa.local', 'Password123!', 'Admin', UTC_TIMESTAMP(), 1),
(4, 'pamember', 'PA', 'Member', 'Ward Operations Desk', '0600000004', 'pamember@pa.local', 'Password123!', 'PA Member', UTC_TIMESTAMP(), 1),
(5, 'resident', 'Resident', 'Example', 'Mohlakeng Extension 7', '0600000005', 'resident@pa.local', 'Password123!', 'Resident', UTC_TIMESTAMP(), 1)
ON DUPLICATE KEY UPDATE FirstName = VALUES(FirstName), LastName = VALUES(LastName), PhysicalAddress = VALUES(PhysicalAddress), PasswordHash = VALUES(PasswordHash), UserRole = VALUES(UserRole), IsProfileComplete = VALUES(IsProfileComplete);

INSERT INTO SystemConfigurations (SystemConfigurationID, WebsiteName, DomainName, StorageRootPath, LocalDirectoryStructure, DatabaseConnectionString, BackupDriveLocation, WhatsAppChatLink, UpdatedAt, UpdatedByUserID) VALUES
(1, 'PA Infrastructure Portal', 'pa-atwork.org', 'D:/PAInfra/Storage', 'tickets/{year}/{month}', 'mysql:host=127.0.0.1;dbname=pa_portal;charset=utf8mb4', 'E:/PAInfraBackup', 'https://wa.me/0000000000', UTC_TIMESTAMP(), 1)
ON DUPLICATE KEY UPDATE WebsiteName = VALUES(WebsiteName), DomainName = VALUES(DomainName), WhatsAppChatLink = VALUES(WhatsAppChatLink), UpdatedAt = VALUES(UpdatedAt), UpdatedByUserID = VALUES(UpdatedByUserID);
