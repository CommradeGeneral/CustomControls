/*
 * Insert a recipe header and its component rows as one unit.
 *
 * Takes the payload the RecipePage control fires through onRecipeCreate,
 * exactly as it arrives - a JSON string - so TIA can pass the event argument
 * straight through without reshaping it.
 *
 * Why one procedure rather than an insert per table: the header's identity is
 * only known after it is inserted, and the components need it as their
 * recipe_id. Doing that from the container would mean a round trip in between,
 * during which a failure would leave a header with no components. Here the two
 * inserts share a transaction, so the recipe is created whole or not at all.
 *
 * The control sends material_code (MAT-1001); recipe_components stores
 * material_id, a foreign key into recipe_material. The lookup happens here,
 * and an unknown code fails the whole call rather than silently dropping a
 * component - a recipe missing an ingredient is worse than one not created.
 *
 * Usage from TIA, passing the onRecipeCreate argument unchanged:
 *   EXEC dbo.usp_CreateRecipe @payload = ?, @recipe_id = ? OUTPUT;
 */
CREATE OR ALTER PROCEDURE dbo.usp_CreateRecipe
    @payload   nvarchar(max),
    @recipe_id int = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    -- Any error aborts the batch and rolls the transaction back, so a failure
    -- part-way through cannot leave a header without its components.
    SET XACT_ABORT ON;

    IF ISJSON(@payload) <> 1
        THROW 50001, 'Payload is not valid JSON.', 1;

    ------------------------------------------------------------------
    -- Header
    ------------------------------------------------------------------
    DECLARE @code        nvarchar(20),
            @name        nvarchar(100),
            @description nvarchar(200),
            @is_active   bit,
            @plant_id    int,
            @created_s   bigint,
            @updated_s   bigint;

    SELECT
        @code        = NULLIF(LTRIM(RTRIM(JSON_VALUE(@payload, '$.code'))), ''),
        @name        = NULLIF(LTRIM(RTRIM(JSON_VALUE(@payload, '$.name'))), ''),
        @description = JSON_VALUE(@payload, '$.description'),
        -- The control sends a JSON boolean; SQL Server gives 'true'/'false'.
        @is_active   = CASE WHEN JSON_VALUE(@payload, '$.is_active') IN ('true', '1') THEN 1 ELSE 0 END,
        @plant_id    = TRY_CAST(JSON_VALUE(@payload, '$.plant_id') AS int),
        -- Timestamps arrive as [seconds, nanoseconds]; only the seconds are
        -- used, since the columns are datetime and cannot hold the rest.
        @created_s   = TRY_CAST(JSON_VALUE(@payload, '$.created_at[0]') AS bigint),
        @updated_s   = TRY_CAST(JSON_VALUE(@payload, '$.updated_at[0]') AS bigint);

    IF @code IS NULL OR @name IS NULL
        THROW 50002, 'Both code and name are required.', 1;

    IF EXISTS (SELECT 1 FROM dbo.recipe_header WHERE code = @code)
        THROW 50003, 'A recipe with that code already exists.', 1;

    ------------------------------------------------------------------
    -- Components: shredded first, so a bad material code is caught
    -- before anything is written.
    ------------------------------------------------------------------
    DECLARE @components TABLE (
        material_code nvarchar(40),
        material_id   int NULL,
        target_qty    decimal(10,3) NULL
    );

    INSERT INTO @components (material_code, material_id, target_qty)
    SELECT
        j.material_code,
        m.id,
        TRY_CAST(j.quantity AS decimal(10,3))
    FROM OPENJSON(@payload, '$.components')
         WITH (
             material_code nvarchar(40) '$.material_code',
             quantity      nvarchar(40) '$.quantity'
         ) AS j
    LEFT JOIN dbo.recipe_material m
           ON m.code = j.material_code
    WHERE NULLIF(LTRIM(RTRIM(j.material_code)), '') IS NOT NULL;

    -- Named in the error so the cause is obvious from the message alone.
    DECLARE @unknown nvarchar(4000) =
        (SELECT STRING_AGG(material_code, ', ')
         FROM @components WHERE material_id IS NULL);

    IF @unknown IS NOT NULL
    BEGIN
        DECLARE @msg nvarchar(4000) =
            CONCAT('Unknown material code(s): ', @unknown, '.');
        THROW 50004, @msg, 1;
    END

    ------------------------------------------------------------------
    -- Write both tables
    ------------------------------------------------------------------
    BEGIN TRANSACTION;

        INSERT INTO dbo.recipe_header
            (plant_id, code, name, description, is_active, created_at, updated_at)
        VALUES (
            @plant_id,
            @code,
            @name,
            @description,
            @is_active,
            -- Falls back to the server clock when the control sent nothing,
            -- which is the more trustworthy source anyway: the panel's clock
            -- can drift where the server's is what every other row is stamped
            -- against.
            COALESCE(DATEADD(SECOND, @created_s, CAST('1970-01-01' AS datetime2(3))), SYSUTCDATETIME()),
            COALESCE(DATEADD(SECOND, @updated_s, CAST('1970-01-01' AS datetime2(3))), SYSUTCDATETIME())
        );

        SET @recipe_id = SCOPE_IDENTITY();

        INSERT INTO dbo.recipe_components (recipe_id, material_id, target_qty)
        SELECT @recipe_id, material_id, target_qty
        FROM @components;

    COMMIT TRANSACTION;

    -- Returned as a row as well as an OUTPUT parameter, so a caller that
    -- cannot bind an output still learns the new id.
    SELECT @recipe_id AS recipe_id,
           (SELECT COUNT(*) FROM @components) AS components_inserted;
END
