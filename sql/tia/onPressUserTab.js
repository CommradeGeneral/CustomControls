export async function UserManager_1_OnonPressUserTab(item, request) {
  var CONTROL = "UserManager_1";

  var ROLE_MANAGE_USERS = 1;
  var ROLE_ADMIN = 65535;
  var MAX_ROWS = 500;

  var connectionstring = "Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=concrete;Trusted_Connection=yes;";

  let conn = null;

  try {
    let payload = JSON.parse(request);
    let owner = String(payload.owner || "").trim();

    if (owner.length === 0) {
      Screen.Items(CONTROL).LoadUsers(2, 0, "");
      HMIRuntime.Trace("onPressUserTab: no signed-in user");
      return;
    }

    conn = await HMIRuntime.Database.CreateConnection(connectionstring);

    let q = (v) => `N'${String(v).replace(/'/g, "''")}'`;

    let CASE_SENSITIVE = "COLLATE Latin1_General_CS_AS";
    let cs = CASE_SENSITIVE ? " " + CASE_SENSITIVE : "";

    let me = await conn.Execute(`
        SET NOCOUNT ON;
        SELECT role, is_active FROM dbo.users
        WHERE username${cs} = ${q(owner)};
      `);

    let meRows = me.Results[0].Rows;
    let account = null;
    for (let k in meRows) { account = meRows[k]; break; }

    if (!account || !account.is_active) {
      Screen.Items(CONTROL).LoadUsers(2, 0, "");
      HMIRuntime.Trace("onPressUserTab: refused " + owner);
      return;
    }

    let callerRole = Number(account.role) || 0;

    if ((callerRole & ROLE_MANAGE_USERS) === 0) {
      Screen.Items(CONTROL).LoadUsers(2, 0, "");
      HMIRuntime.Trace("onPressUserTab: role " + callerRole + " may not list users");
      return;
    }

    let scope = (callerRole === ROLE_ADMIN)
      ? ""
      : `WHERE owned_by${cs} = ${q(owner)}`;

    let list = await conn.Execute(`
        SET NOCOUNT ON;
        SELECT TOP ${MAX_ROWS}
               username, display_name, role, is_active,
               CONVERT(varchar(19), last_login_at, 126) + 'Z' AS last_login_at,
               owned_by
        FROM dbo.users
        ${scope}
        ORDER BY username;
      `);

    let rows = [];
    let listRows = list.Results[0].Rows;
    for (let k in listRows) {
      let r = listRows[k];
      rows.push({
        username: r.username,
        display_name: r.display_name,
        role: Number(r.role) || 0,
        is_active: r.is_active ? 1 : 0,
        last_login_at: r.last_login_at || null
      });
    }

    Screen.Items(CONTROL).LoadUsers(0, 0, JSON.stringify(rows));
    HMIRuntime.Trace("onPressUserTab: sent " + rows.length + " row(s) to " + owner);
  }
  catch (e) {
    Screen.Items(CONTROL).LoadUsers(1, 0, "");

    if (e.Results) {
      for (let statement in e.Results) {
        let errors = e.Results[statement].Errors;
        for (let i in errors) {
          HMIRuntime.Trace("onPressUserTab DB error state : " + errors[i].State);
          HMIRuntime.Trace("onPressUserTab DB error msg   : " + errors[i].Message);
        }
      }
    } else {
      HMIRuntime.Trace("onPressUserTab failed : " + (e.message || e));
    }
  }
  finally {
    if (conn) {
      conn.Close();
    }
  }
}
