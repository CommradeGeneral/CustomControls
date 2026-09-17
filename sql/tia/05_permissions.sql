/*
 * Database access for the WinCC runtime — Windows authentication.
 *
 * No password anywhere: the connection string uses Integrated Security, so the
 * runtime connects as whatever Windows account its process runs under.
 *
 * On this machine that is one of two, which is why both are granted below:
 *
 *   DESKTOP-KC44QI2\HP     SIMATICRuntimeManager.exe runs as this. It is
 *                          already a sysadmin, so it needs nothing - included
 *                          here only as a note, not as a grant.
 *
 *   NT AUTHORITY\SYSTEM    The WinCC services (TraceLogger, TraceProfiler) and
 *                          server_runtime.exe run as LocalSystem, which reaches
 *                          SQL Server as this. It has a login but no access to
 *                          the concrete database, which is the gap this fixes.
 *
 * Granting both means the screen scripts work regardless of which process ends
 * up executing them, and nothing has to be reconfigured if Siemens changes it.
 *
 * The grants are narrow on purpose: EXECUTE on the one procedure, SELECT on the
 * three tables the screen reads. No direct INSERT, UPDATE or DELETE, so the
 * only write path is usp_CreateRecipe and its validation. A mistake in a screen
 * script cannot corrupt the tables.
 */

USE concrete;
GO

------------------------------------------------------------------
-- NT AUTHORITY\SYSTEM  (LocalSystem services)
------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'NT AUTHORITY\SYSTEM')
BEGIN
    CREATE USER [NT AUTHORITY\SYSTEM] FOR LOGIN [NT AUTHORITY\SYSTEM];
END
GO

GRANT EXECUTE ON dbo.usp_CreateRecipe TO [NT AUTHORITY\SYSTEM];
GRANT SELECT  ON dbo.recipe_header     TO [NT AUTHORITY\SYSTEM];
GRANT SELECT  ON dbo.recipe_material   TO [NT AUTHORITY\SYSTEM];
GRANT SELECT  ON dbo.recipe_components TO [NT AUTHORITY\SYSTEM];
GO

------------------------------------------------------------------
-- What each account ended up with
------------------------------------------------------------------
SELECT
    pr.name AS principal_name,
    dp.permission_name,
    dp.state_desc,
    OBJECT_NAME(dp.major_id) AS object_name
FROM sys.database_permissions dp
JOIN sys.database_principals pr ON pr.principal_id = dp.grantee_principal_id
WHERE pr.name = 'NT AUTHORITY\SYSTEM'
  AND dp.major_id <> 0
ORDER BY object_name, permission_name;
GO
