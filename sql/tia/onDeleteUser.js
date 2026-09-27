export async function UserManager_1_OnonDeleteUser(item, request) {
  var CONTROL = "UserManager_1";

  var ROLE_ADMIN = 65535;
  var MAX_DEPTH = 32;

  var connectionstring = "Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=concrete;Trusted_Connection=yes;";

  let report = function (code, ms) {
    try {
      Screen.Items(CONTROL).EditUserMessage(code, ms);
    } catch (e) {
      HMIRuntime.Trace("onDeleteUser: cannot reach " + CONTROL + " - " + (e.message || e));
    }
  };

  let conn = null;

  try {
    let payload = JSON.parse(request);
    let username = String(payload.username || "").trim();
    let owner = String(payload.owner || "").trim();
    let callerRole = Number(payload.callerRole) || 0;

    if (username.length === 0 || owner.length === 0) {
      report(4, 4000);
      return;
    }

    if (username === owner) {
      report(4, 4000);
      HMIRuntime.Trace("onDeleteUser: refused self-delete for " + owner);
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
          (SELECT owned_by FROM dbo.users WHERE username${cs} = ${q(username)}) AS target_owner,
          (SELECT COUNT(*) FROM dbo.users WHERE owned_by${cs} = ${q(username)}) AS owns_others,
          (SELECT COUNT(*) FROM dbo.users
             WHERE username${cs} = ${q(owner)} AND owned_by${cs} = ${q(username)}) AS owns_caller;
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
      HMIRuntime.Trace("onDeleteUser: " + owner + " does not own " + username);
      return;
    }

    if (owner !== "" && Number(info.owns_caller) > 0) {
      report(4, 4000);
      HMIRuntime.Trace("onDeleteUser: " + username + " owns the caller " + owner);
      return;
    }

    HMIRuntime.Trace("onDeleteUser: " + username + " owns " +
      Number(info.owns_others) + " direct account(s); deleting the whole tree");

    let removed = await conn.Execute(`
        SET NOCOUNT ON;
        SET XACT_ABORT ON;

        DECLARE @tree TABLE (username NVARCHAR(50) PRIMARY KEY, depth INT);

        WITH walk AS (
          SELECT username, 0 AS depth
          FROM dbo.users WHERE username${cs} = ${q(username)}
          UNION ALL
          SELECT u.username, w.depth + 1
          FROM dbo.users u
          JOIN walk w ON u.owned_by${cs} = w.username
        )
        INSERT INTO @tree (username, depth)
        SELECT username, depth FROM walk
        OPTION (MAXRECURSION ${MAX_DEPTH});

        BEGIN TRANSACTION;

        DELETE u
        FROM dbo.users u
        JOIN @tree t ON u.username = t.username;

        COMMIT TRANSACTION;

        SELECT username FROM @tree ORDER BY depth DESC, username;
      `);

    let deleted = [];
    for (let r in removed.Results) {
      let set = removed.Results[r].Rows;
      for (let k in set) {
        if (set[k].username !== undefined) deleted.push(set[k].username);
      }
    }

    report(0, 3000);
    HMIRuntime.Trace("onDeleteUser: deleted " + deleted.length + " account(s) by " + owner +
      " [" + deleted.join(", ") + "]");
  }
  catch (e) {
    let blocked = false;

    if (e.Results) {
      for (let statement in e.Results) {
        let errors = e.Results[statement].Errors;
        for (let i in errors) {
          let state = String(errors[i].State);
          let message = String(errors[i].Message);
          if (state === "547" || message.indexOf("REFERENCE constraint") >= 0
            || message.indexOf("FK_owned_by") >= 0) {
            blocked = true;
          }
          HMIRuntime.Trace("onDeleteUser DB error state : " + state);
          HMIRuntime.Trace("onDeleteUser DB error msg   : " + message);
        }
      }
    } else {
      HMIRuntime.Trace("onDeleteUser failed : " + (e.message || e));
    }

    report(blocked ? 5 : 3, 4000);
  }
  finally {
    if (conn) {
      conn.Close();
    }
  }
}
