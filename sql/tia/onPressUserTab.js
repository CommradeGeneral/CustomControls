export async function UserManager_1_OnonPressUserTab(item, request) {
  var ROLE_ADMIN = 65535;
  var MAX_ROWS = 500;

  var connectionstring = "Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=concrete;Trusted_Connection=yes;";

  let conn = null;

  try {
    let payload = JSON.parse(request);
    let owner = String(payload.owner || "").trim();
    let callerRole = Number(payload.role) || 0;

    if (owner.length === 0) {
      item.LoadUsers(2, 0, "");
      HMIRuntime.Trace("onPressUserTab: no signed-in user");
      return;
    }

    conn = await HMIRuntime.Database.CreateConnection(connectionstring);

    let q = (v) => `N'${String(v).replace(/'/g, "''")}'`;

    let CASE_SENSITIVE = "COLLATE Latin1_General_CS_AS";
    let cs = CASE_SENSITIVE ? " " + CASE_SENSITIVE : "";

    let conditions = [`username${cs} <> ${q(owner)}`];
    if (callerRole !== ROLE_ADMIN) {
      conditions.push(`owned_by${cs} = ${q(owner)}`);
    }
    let scope = "WHERE " + conditions.join(" AND ");

    let list = await conn.Execute(`
        SET NOCOUNT ON;
        SELECT TOP ${MAX_ROWS}
               username, display_name, role, is_active,
               CONVERT(varchar(19), last_login_at, 126) + 'Z' AS last_login_at,
               owned_by
        FROM dbo.users
        ${scope}
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

    item.LoadUsers(0, 0, JSON.stringify(rows));
    HMIRuntime.Trace("onPressUserTab: sent " + rows.length + " row(s) to " + owner);
  }
  catch (e) {
    item.LoadUsers(1, 0, "");

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
