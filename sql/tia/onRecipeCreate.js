export async function RecipePage_2_OnonRecipeCreate(item, recipe) {
  HMIRuntime.Trace("onRecipeCreate fired: " + recipe);

  let conn = null;

  try {
    let connectionstring = "Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=concrete;Trusted_Connection=yes;";
    conn = await HMIRuntime.Database.CreateConnection(connectionstring);

    let { code, name, description, is_active, components } = JSON.parse(recipe);

    // Doubles any apostrophe so a name like O'Brien cannot break the statement,
    // and the N prefix keeps Arabic text from being stored as ??????.
    // Used for every text value below, so it cannot be commented out.
    let q = (v) => v ? `N'${String(v).replace(/'/g, "''")}'` : "NULL";

    // SET NOCOUNT ON: without it each INSERT returns an empty result of its
    // own and the SELECT ends up behind them. With it the SELECT is the only
    // result, so it is Results[0].
    let result = await conn.Execute(`
        SET NOCOUNT ON;
        BEGIN TRANSACTION;

        INSERT INTO recipe_header (code, name, description, is_active, created_at, updated_at)
        VALUES (${q(code)}, ${q(name)}, ${q(description)}, ${is_active ? 1 : 0}, SYSUTCDATETIME(), SYSUTCDATETIME());

        DECLARE @id int = SCOPE_IDENTITY();

        INSERT INTO recipe_components (recipe_id, material_id, target_qty)
        SELECT @id, m.id, v.qty
        FROM (VALUES ${components.filter(c => c.material_code).map(c => `(${q(c.material_code)}, ${Number(c.quantity)})`).join(", ")}) AS v(code, qty)
        JOIN recipe_material m ON m.code = v.code;

        COMMIT TRANSACTION;

        SELECT * FROM recipe_header;
    `);

    HMIRuntime.Trace("Success");

    Screen.Items("RecipePage_2").CreateCards(JSON.stringify(result.Results[0].Rows));
    Screen.Items("RecipePage_2").NewRecipeMessage(0, 3000);
  }
  catch (e) {
    Screen.Items("RecipePage_2").NewRecipeMessage(1, 3000);

    // A database failure carries Results, each statement with its own Errors.
    // A plain JavaScript fault - a misspelled variable, say - carries none, so
    // it is traced on its own instead of being lost to a loop over undefined.
    // That is what hid the two ReferenceErrors here: no output at all.
    if (e.Results) {
      for (let statement in e.Results) {
        let errors = e.Results[statement].Errors;
        for (let i in errors) {
          HMIRuntime.Trace("Errors state : " + errors[i].State);
          HMIRuntime.Trace("Errors Message : " + errors[i].Message);
        }
      }
    }
    else {
      HMIRuntime.Trace("Failed : " + (e.message || e));
    }
  }
  finally {
    // Runs on both paths, so the connection is released even when the insert
    // failed - it was unreachable on the error path before.
    if (conn) {
      conn.Close();
    }
  }
}
