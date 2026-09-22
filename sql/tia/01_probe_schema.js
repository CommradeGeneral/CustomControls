/*
 * Report the shape of the user table, so the login handler can be written
 * against the columns that actually exist.
 *
 * The table was renamed to dbo.[user], and the columns may have changed with
 * it. Rather than guess - a wrong column name fails at runtime, in front of an
 * operator, on the one screen that must work - this asks the database and
 * traces the answer.
 *
 * Wire it to a button, run it once, and send the trace output.
 *
 * Nothing here writes to the database or changes any state: it reads
 * INFORMATION_SCHEMA and one row of the table itself.
 *
 * ---------------------------------------------------------------------------
 * A note on the name
 * ---------------------------------------------------------------------------
 *
 * USER is a reserved word in T-SQL - it is a niladic function returning the
 * current user name. A table called "user" is therefore legal but must be
 * bracket-quoted as [user] everywhere it appears, in this script and in every
 * statement that follows. Unquoted, `FROM dbo.user` is a syntax error rather
 * than a missing-table error, which is why it is worth stating outright.
 */
export async function ProbeUserSchema() {
  var say = function (m) { HMIRuntime.Trace("[schema] " + m); };

  // Match whatever the login handler uses.
  var connectionstring = "Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=concrete;Trusted_Connection=yes;";

  // The table to describe. Schema and name are kept apart so the query can
  // ask INFORMATION_SCHEMA about them as plain strings, where no quoting
  // applies - the brackets are only needed when the name is used as an
  // identifier, which happens further down.
  var SCHEMA = "dbo";
  var TABLE = "user";

  var conn = null;

  try {
    conn = await HMIRuntime.Database.CreateConnection(connectionstring);
    say("connected; describing " + SCHEMA + ".[" + TABLE + "]");

    /*
     * Does it exist at all, and is it a table or a view? Asked first, so a
     * missing table reports itself plainly instead of coming back as an empty
     * column list that reads like a permissions problem.
     */
    var existence = await conn.Execute(`
      SET NOCOUNT ON;
      SELECT TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = N'${SCHEMA}' AND TABLE_NAME = N'${TABLE}';
    `);

    var existsRows = existence.Results[0].Rows;
    var existsKeys = [];
    for (var ek in existsRows) existsKeys.push(ek);
    if (existsKeys.length === 0) {
      say("NOT FOUND: no table or view named " + SCHEMA + ".[" + TABLE + "]");
      say("check the name, and that this connection's database is right");
      return;
    }
    say("found, type = " + existsRows[existsKeys[0]].TABLE_TYPE);

    /*
     * The columns, in their declared order. ORDINAL_POSITION matters: it is
     * the order a human reads the table in, and it makes the trace comparable
     * with the CREATE TABLE in sql/01_users.sql.
     */
    var columns = await conn.Execute(`
      SET NOCOUNT ON;
      SELECT ORDINAL_POSITION, COLUMN_NAME, DATA_TYPE,
             CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = N'${SCHEMA}' AND TABLE_NAME = N'${TABLE}'
      ORDER BY ORDINAL_POSITION;
    `);

    var rows = columns.Results[0].Rows;
    say("---- columns ----");
    var count = 0;
    for (var k in rows) {
      var c = rows[k];
      // The length only means something for the character types, and prints
      // as -1 for MAX, which would read as nonsense on an INT.
      var size = "";
      if (c.CHARACTER_MAXIMUM_LENGTH !== null &&
          typeof c.CHARACTER_MAXIMUM_LENGTH !== "undefined") {
        size = (String(c.CHARACTER_MAXIMUM_LENGTH) === "-1")
          ? "(max)"
          : "(" + c.CHARACTER_MAXIMUM_LENGTH + ")";
      }
      var nullable = (String(c.IS_NULLABLE).toUpperCase() === "YES") ? "NULL" : "NOT NULL";
      var dflt = (c.COLUMN_DEFAULT === null || typeof c.COLUMN_DEFAULT === "undefined")
        ? ""
        : "  DEFAULT " + c.COLUMN_DEFAULT;
      say("  " + c.ORDINAL_POSITION + ". " + c.COLUMN_NAME +
          "  " + c.DATA_TYPE + size + "  " + nullable + dflt);
      count++;
    }
    say("---- " + count + " column(s) ----");

    /*
     * What the login handler needs, checked by name.
     *
     * Reported as a list rather than assumed, because this is the whole point
     * of the probe: the handler reads exactly these, and any one of them
     * missing means a rewrite rather than a rename.
     */
    var needed = ["id", "username", "display_name", "password_hash",
                  "is_active", "role", "failed_attempts", "locked_until",
                  "last_login_at"];
    var present = {};
    for (var k2 in rows) present[String(rows[k2].COLUMN_NAME).toLowerCase()] = true;

    say("---- what the login handler expects ----");
    var missing = [];
    for (var i = 0; i < needed.length; i++) {
      var ok = present[needed[i]] === true;
      say("  " + (ok ? "OK      " : "MISSING ") + needed[i]);
      if (!ok) missing.push(needed[i]);
    }
    if (missing.length === 0) {
      say("all expected columns present - only the table name changed");
    } else {
      say("MISSING " + missing.length + ": " + missing.join(", "));
      say("send this trace and the handler will be written against the real names");
    }

    /*
     * Row count and one sample row's keys.
     *
     * The keys are what the JS side actually sees, which is not always what
     * INFORMATION_SCHEMA reports - a driver can case-fold or alias them, and
     * the handler reads them as properties, so this is the spelling that
     * matters in the code.
     */
    var sample = await conn.Execute(`
      SET NOCOUNT ON;
      SELECT COUNT(*) AS n FROM ${SCHEMA}.[${TABLE}];
    `);
    var sRows = sample.Results[0].Rows;
    for (var sk in sRows) { say("row count: " + sRows[sk].n); break; }

    var one = await conn.Execute(`
      SET NOCOUNT ON;
      SELECT TOP 1 * FROM ${SCHEMA}.[${TABLE}];
    `);
    var oneRows = one.Results[0].Rows;
    var oneKeys = [];
    for (var ok2 in oneRows) oneKeys.push(ok2);
    if (oneKeys.length === 0) {
      say("table is empty - no sample row to inspect");
    } else {
      var row = oneRows[oneKeys[0]];
      var props = [];
      for (var p in row) props.push(p);
      say("properties as JS sees them: " + props.join(", "));
      /*
       * Deliberately does NOT trace the values. One of these columns is a
       * password hash, and a trace file is not the place for it - the names
       * are the whole of what this probe needs.
       */
    }
  }
  catch (e) {
    if (e.Results) {
      for (var statement in e.Results) {
        var errors = e.Results[statement].Errors;
        for (var j in errors) {
          say("DB error state : " + errors[j].State);
          say("DB error msg   : " + errors[j].Message);
        }
      }
    } else {
      say("failed : " + (e.message || e));
    }
  }
  finally {
    if (conn) {
      conn.Close();
    }
  }
}
