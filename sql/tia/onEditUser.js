export async function UserManager_1_OnonEditUser(item, request) {
  var CONTROL = "UserManager_1";

  var ROLE_ADMIN = 65535;
  var ALLOWED_ROLES = [1, 3, 65535];

  var connectionstring = "Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=concrete;Trusted_Connection=yes;";

  let report = function (code, ms) {
    try {
      Screen.Items(CONTROL).EditUserMessage(code, ms);
    } catch (e) {
      HMIRuntime.Trace("onEditUser: cannot reach " + CONTROL + " - " + (e.message || e));
    }
  };

  let conn = null;

  try {
    let payload = JSON.parse(request);
    let username = String(payload.username || "").trim();
    let displayName = String(payload.displayName || "").trim();
    let role = Number(payload.role);
    let isActive = payload.isActive ? 1 : 0;
    let owner = String(payload.owner || "").trim();
    let callerRole = Number(payload.callerRole) || 0;

    if (username.length === 0 || owner.length === 0) {
      report(4, 4000);
      return;
    }

    if (ALLOWED_ROLES.indexOf(role) < 0) {
      report(4, 4000);
      HMIRuntime.Trace("onEditUser: refused role " + payload.role);
      return;
    }

    conn = await HMIRuntime.Database.CreateConnection(connectionstring);

    let q = (v) => `N'${String(v).replace(/'/g, "''")}'`;

    let CASE_SENSITIVE = "COLLATE Latin1_General_CS_AS";
    let cs = CASE_SENSITIVE ? " " + CASE_SENSITIVE : "";

    let lookup = await conn.Execute(`
        SET NOCOUNT ON;
        SELECT
          (SELECT COUNT(*) FROM dbo.users WHERE username${cs} = ${q(username)}) AS target_exists,
          (SELECT owned_by FROM dbo.users WHERE username${cs} = ${q(username)}) AS target_owner;
      `);

    let rows = lookup.Results[0].Rows;
    let info = null;
    for (let k in rows) { info = rows[k]; break; }

    if (!info || Number(info.target_exists) === 0) {
      report(1, 4000);
      return;
    }

    let targetOwner = info.target_owner ? String(info.target_owner) : "";
    if (callerRole !== ROLE_ADMIN && targetOwner !== owner) {
      report(4, 4000);
      HMIRuntime.Trace("onEditUser: " + owner + " does not own " + username);
      return;
    }

    if (callerRole !== ROLE_ADMIN && role === ROLE_ADMIN) {
      report(4, 4000);
      HMIRuntime.Trace("onEditUser: " + owner + " may not grant administrator");
      return;
    }

    let displayValue = displayName.length > 0 ? q(displayName) : "NULL";

    await conn.Execute(`
        SET NOCOUNT ON;
        UPDATE dbo.users
           SET display_name = ${displayValue},
               role = ${role},
               is_active = ${isActive}
         WHERE username${cs} = ${q(username)};
      `);

    report(0, 3000);
    HMIRuntime.Trace("onEditUser: saved " + username + " (role " + role + ", active " + isActive + ")");
  }
  catch (e) {
    report(3, 4000);

    if (e.Results) {
      for (let statement in e.Results) {
        let errors = e.Results[statement].Errors;
        for (let i in errors) {
          HMIRuntime.Trace("onEditUser DB error state : " + errors[i].State);
          HMIRuntime.Trace("onEditUser DB error msg   : " + errors[i].Message);
        }
      }
    } else {
      HMIRuntime.Trace("onEditUser failed : " + (e.message || e));
    }
  }
  finally {
    if (conn) {
      conn.Close();
    }
  }
}
