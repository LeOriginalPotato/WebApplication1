CREATE TABLE Categories (
	CategoryID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
	CategoryName NVARCHAR(120) NOT NULL,
	Description NVARCHAR(500) NOT NULL
);

CREATE TABLE Users (
	UserID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
	Username NVARCHAR(50) NOT NULL,
	FirstName NVARCHAR(120) NOT NULL,
	LastName NVARCHAR(120) NOT NULL,
	PhysicalAddress NVARCHAR(255) NOT NULL,
	CellNumber NVARCHAR(30) NOT NULL,
	EmailAddress NVARCHAR(255) NOT NULL,
	PasswordHash NVARCHAR(500) NOT NULL,
	UserRole NVARCHAR(50) NOT NULL CONSTRAINT DF_Users_UserRole DEFAULT('Resident'),
	CreatedAt DATETIME2 NOT NULL,
	IsProfileComplete BIT NOT NULL CONSTRAINT DF_Users_IsProfileComplete DEFAULT(0)
);

CREATE UNIQUE INDEX UX_Users_Username ON Users (Username);
CREATE UNIQUE INDEX UX_Users_CellNumber ON Users (CellNumber);
CREATE UNIQUE INDEX UX_Users_EmailAddress ON Users (EmailAddress);

CREATE TABLE Faults (
	FaultID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
	TicketReference NVARCHAR(80) NOT NULL,
	UserID INT NOT NULL,
	CategoryID INT NOT NULL,
	Description NVARCHAR(1500) NOT NULL,
	PhysicalAddress NVARCHAR(255) NOT NULL,
	Latitude DECIMAL(9,6) NOT NULL,
	Longitude DECIMAL(9,6) NOT NULL,
	Status NVARCHAR(120) NOT NULL CONSTRAINT DF_Faults_Status DEFAULT('Logged'),
	MunicipalityRefCode NVARCHAR(100) NULL,
	DateLogged DATETIME2 NOT NULL,
	LastUpdated DATETIME2 NOT NULL,
	TeamDispatched BIT NOT NULL CONSTRAINT DF_Faults_TeamDispatched DEFAULT(0),
	InspectionFindings NVARCHAR(2000) NOT NULL CONSTRAINT DF_Faults_InspectionFindings DEFAULT(''),
	IsResolved BIT NOT NULL CONSTRAINT DF_Faults_IsResolved DEFAULT(0),
	ResolvedAt DATETIME2 NULL,
	ProofImagePath NVARCHAR(500) NULL,
	CONSTRAINT FK_Faults_Users_UserID FOREIGN KEY (UserID) REFERENCES Users(UserID),
	CONSTRAINT FK_Faults_Categories_CategoryID FOREIGN KEY (CategoryID) REFERENCES Categories(CategoryID)
);

CREATE UNIQUE INDEX UX_Faults_TicketReference ON Faults (TicketReference);
CREATE INDEX IX_Faults_UserID ON Faults (UserID);
CREATE INDEX IX_Faults_CategoryID ON Faults (CategoryID);

CREATE TABLE EscalationHistories (
	EscalationID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
	FaultID INT NOT NULL,
	ActionTakenBy INT NOT NULL,
	Notes NVARCHAR(2000) NOT NULL,
	DateActioned DATETIME2 NOT NULL,
	CONSTRAINT FK_EscalationHistories_Faults_FaultID FOREIGN KEY (FaultID) REFERENCES Faults(FaultID) ON DELETE CASCADE,
	CONSTRAINT FK_EscalationHistories_Users_ActionTakenBy FOREIGN KEY (ActionTakenBy) REFERENCES Users(UserID)
);

CREATE INDEX IX_EscalationHistories_FaultID ON EscalationHistories (FaultID);
CREATE INDEX IX_EscalationHistories_ActionTakenBy ON EscalationHistories (ActionTakenBy);

CREATE TABLE Notifications (
	NotificationID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
	UserID INT NULL,
	TargetRole NVARCHAR(50) NOT NULL,
	Message NVARCHAR(1000) NOT NULL,
	RelatedTicketReference NVARCHAR(80) NOT NULL,
	IsRead BIT NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT(0),
	CreatedAt DATETIME2 NOT NULL,
	CONSTRAINT FK_Notifications_Users_UserID FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE SET NULL
);

CREATE INDEX IX_Notifications_UserID ON Notifications (UserID);
CREATE INDEX IX_Notifications_TargetRole ON Notifications (TargetRole);

CREATE TABLE SystemConfigurations (
	SystemConfigurationID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
	WebsiteName NVARCHAR(200) NOT NULL,
	DomainName NVARCHAR(300) NOT NULL,
	StorageRootPath NVARCHAR(500) NOT NULL,
	LocalDirectoryStructure NVARCHAR(500) NOT NULL,
	DatabaseConnectionString NVARCHAR(2000) NOT NULL,
	BackupDriveLocation NVARCHAR(500) NOT NULL,
	UpdatedAt DATETIME2 NOT NULL,
	UpdatedByUserID INT NOT NULL,
	CONSTRAINT FK_SystemConfigurations_Users_UpdatedByUserID FOREIGN KEY (UpdatedByUserID) REFERENCES Users(UserID)
);

CREATE INDEX IX_SystemConfigurations_UpdatedByUserID ON SystemConfigurations (UpdatedByUserID);
