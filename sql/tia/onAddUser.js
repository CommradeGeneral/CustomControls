export async function UserManager_1_OnonAddUser(item, request) {
  let Bcrypt = Bt.Bcrypt;
  var CONTROL = "UserManager_1";

  var COST = 10;
  var MIN_LENGTH = 8;
  var ALLOWED_ROLES = [1, 3, 65535];

  var connectionstring = "Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=concrete;Trusted_Connection=yes;";

  let conn = null;

  try {
    let payload = JSON.parse(request);
    let username = String(payload.username || "").trim();
    let displayName = String(payload.displayName || "").trim();
    let password = String(payload.password || "");
    let role = Number(payload.role);
    let owner = String(payload.owner || "").trim();

    if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) {
      Screen.Items(CONTROL).AddUserMessage(1, 4000);
      return;
    }

    if (password.length < MIN_LENGTH) {
      Screen.Items(CONTROL).AddUserMessage(2, 4000);
      return;
    }

    if (ALLOWED_ROLES.indexOf(role) < 0) {
      Screen.Items(CONTROL).AddUserMessage(4, 4000);
      HMIRuntime.Trace("onAddUser: refused role " + payload.role);
      return;
    }

    conn = await HMIRuntime.Database.CreateConnection(connectionstring);

    let q = (v) => `N'${String(v).replace(/'/g, "''")}'`;

    let CASE_SENSITIVE = "COLLATE Latin1_General_CS_AS";
    let cs = CASE_SENSITIVE ? " " + CASE_SENSITIVE : "";

    let taken = await conn.Execute(`
        SET NOCOUNT ON;
        SELECT COUNT(*) AS n FROM dbo.users
        WHERE username${cs} = ${q(username)};
      `);

    let takenRows = taken.Results[0].Rows;
    let takenCount = 0;
    for (let k in takenRows) { takenCount = Number(takenRows[k].n); break; }

    if (takenCount > 0) {
      Screen.Items(CONTROL).AddUserMessage(1, 4000);
      HMIRuntime.Trace("onAddUser: username taken " + username);
      return;
    }

    let hash = Bcrypt.hash(password, COST);

    let displayValue = displayName.length > 0 ? q(displayName) : "NULL";
    let ownerValue = owner.length > 0 ? q(owner) : "NULL";

    await conn.Execute(`
        SET NOCOUNT ON;
        INSERT INTO dbo.users (username, display_name, password_hash, is_active, role, owned_by)
        VALUES (${q(username)}, ${displayValue}, '${hash}', 1, ${role}, ${ownerValue});
      `);

    Screen.Items(CONTROL).AddUserMessage(0, 3000);
    HMIRuntime.Trace("onAddUser: created " + username + " (role " + role + ")");
  }
  catch (e) {
    let duplicate = false;

    if (e.Results) {
      for (let statement in e.Results) {
        let errors = e.Results[statement].Errors;
        for (let i in errors) {
          let state = String(errors[i].State);
          let message = String(errors[i].Message);
          if (state === "2627" || state === "2601"
            || message.indexOf("PK_app_user") >= 0
            || message.indexOf("duplicate key") >= 0) {
            duplicate = true;
          }
          HMIRuntime.Trace("onAddUser DB error state : " + state);
          HMIRuntime.Trace("onAddUser DB error msg   : " + message);
        }
      }
    } else {
      HMIRuntime.Trace("onAddUser failed : " + (e.message || e));
    }

    Screen.Items(CONTROL).AddUserMessage(duplicate ? 1 : 3, 4000);
  }
  finally {
    if (conn) {
      conn.Close();
    }
  }
}
