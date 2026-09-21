/*
 * Login accounts for the LoginPage control.
 *
 * Follows the conventions of the recipe tables: INT IDENTITY surrogate key,
 * nvarchar text, bit flags.
 *
 * The table carries no created_at/updated_at columns by design. The only
 * datetimes here are operational rather than audit: locked_until, which the
 * lockout needs in order to expire, and last_login_at for support.
 *
 * ---------------------------------------------------------------------------
 * The password column
 * ---------------------------------------------------------------------------
 *
 * password_hash holds a complete bcrypt modular-crypt string, for example:
 *
 *   $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj.d7Ld/Nq9W
 *   |__||_||____________________||___________________________|
 *    ver cost  salt (22 chars)          hash (31 chars)
 *
 * There is deliberately no separate salt column. bcrypt generates a random
 * salt per password and stores it inside that string, so the hash is
 * self-contained: verification needs the stored string and the typed password
 * and nothing else. A salt column would be a second copy of data that already
 * lives in the hash, and the two could drift apart.
 *
 * The cost factor is embedded too, which is what makes the scheme upgradable.
 * When hardware gets faster you raise the cost for new passwords; old rows
 * keep verifying at their original cost and can be re-hashed on next login
 * (see the note at the bottom).
 *
 * CHAR(60), not NVARCHAR: a bcrypt string is exactly 60 ASCII characters, so a
 * fixed-width non-Unicode column is the exact fit and stores in 60 bytes
 * rather than 120. The CHECK constraint below is what stops a plaintext
 * password ever being written here by mistake - a wrong INSERT fails loudly
 * instead of silently storing a readable password.
 *
 * NULL is allowed so an account can exist without a usable password: a new
 * account awaiting its first password, or one whose password was
 * administratively cleared. A NULL must be treated as "cannot log in" - never
 * as "any password matches".
 */

USE concrete;
GO

IF OBJECT_ID('dbo.app_user', 'U') IS NOT NULL
BEGIN
    RAISERROR('dbo.app_user already exists - drop it first if you mean to recreate it.', 16, 1);
    RETURN;
END
GO

/*
 * Named app_user rather than "user": USER is a reserved word in T-SQL, so the
 * table would need bracket-quoting everywhere it is referenced.
 */
CREATE TABLE dbo.app_user
(
    id              INT IDENTITY(1,1) NOT NULL,

    /*
     * The login name the operator types. NVARCHAR because a plant may want
     * non-ASCII names, and the control is bilingual.
     *
     * Uniqueness is enforced by the index below rather than by UNIQUE here,
     * so the constraint has a name the error handler can recognise.
     */
    username        NVARCHAR(50)  NOT NULL,

    /*
     * Shown in the UI instead of the login name. Optional: an account with no
     * display name falls back to its username.
     */
    display_name    NVARCHAR(100) NULL,

    -- See the header. A complete bcrypt string, or NULL for "cannot log in".
    password_hash   CHAR(60)      NULL,

    /*
     * Whether the account may log in at all, separate from whether it has a
     * password. Disabling is reversible and keeps the row intact, which
     * deleting would not - and recipe rows may reference the user later.
     */
    is_active       BIT           NOT NULL CONSTRAINT DF_app_user_is_active DEFAULT (1),

    /*
     * What the account is allowed to do, as a plain integer the application
     * interprets. Deliberately unconstrained: the database stores the number,
     * and TIA decides what each one means, so adding a role later needs no
     * schema change.
     *
     * Defaults to 0, which should therefore be your *least* privileged role.
     * A row inserted without an explicit role must not land on an
     * administrator by accident.
     */
    role            INT           NOT NULL CONSTRAINT DF_app_user_role DEFAULT (0),

    /*
     * Failed attempts since the last success, and the lockout expiry.
     *
     * bcrypt makes offline cracking expensive; these make *online* guessing
     * expensive, which is a different attack. Without them an attacker can
     * simply keep calling onSignIn.
     *
     * Kept as data rather than logic: the login procedure decides the policy,
     * so thresholds can change without a schema change.
     */
    failed_attempts INT           NOT NULL CONSTRAINT DF_app_user_failed DEFAULT (0),
    locked_until    DATETIME      NULL,

    -- Diagnostics: "when did this account last work?" is the first question
    -- asked when someone reports they cannot log in.
    last_login_at   DATETIME      NULL,

    CONSTRAINT PK_app_user PRIMARY KEY CLUSTERED (id),

    /*
     * Structural check that the column holds a bcrypt string and not a
     * plaintext password: $2a/$2b/$2y, a two-digit cost, $, then 53 characters
     * of bcrypt's base64 alphabet. A typed password cannot satisfy this.
     *
     * Not a security control - it cannot tell a real hash from a well-formed
     * fake - but it catches the one mistake that would be catastrophic and
     * silent.
     */
    CONSTRAINT CK_app_user_bcrypt CHECK (
        password_hash IS NULL
        OR (
            LEN(password_hash) = 60
            AND password_hash LIKE '$2[aby]$[0-9][0-9]$%'
            AND password_hash NOT LIKE '%[^$./A-Za-z0-9]%'
        )
    ),

    -- A lockout with no failures behind it means the two were written
    -- inconsistently; the login procedure always sets them together.
    CONSTRAINT CK_app_user_lockout CHECK (
        locked_until IS NULL OR failed_attempts > 0
    )
);
GO

/*
 * Case-insensitive uniqueness.
 *
 * The database's default collation is already case-insensitive, so "Ahmed" and
 * "ahmed" collide here - which is what you want for a login name, since an
 * operator typing either should reach one account rather than creating two
 * that look identical in the UI.
 *
 * Stated explicitly rather than relying on the server default, so the rule
 * survives a restore onto a differently collated instance.
 */
CREATE UNIQUE NONCLUSTERED INDEX UX_app_user_username
    ON dbo.app_user (username)
    WITH (IGNORE_DUP_KEY = OFF);
GO

/*
 * ---------------------------------------------------------------------------
 * How this table is meant to be used
 * ---------------------------------------------------------------------------
 *
 * VERIFYING A LOGIN
 *   Never compare passwords in SQL. bcrypt hashes are salted, so the same
 *   password hashes differently every time and
 *
 *       WHERE password_hash = @something
 *
 *   can never match. Verification is always: read the row, hand the stored
 *   string and the typed password to bcrypt's verify function, and let it
 *   answer. Which component does that is the open question - see below.
 *
 * TELLING THE OPERATOR WHY IT FAILED
 *   Do not. "No such user" and "wrong password" must look identical from the
 *   outside, or the login screen becomes a tool for discovering valid
 *   usernames. LoginMessage code 1 already says "either username or password
 *   is invalid", which is the right wording.
 *
 *   Take the same care with timing: if a missing user returns instantly while
 *   a wrong password takes 200ms of bcrypt, the difference is measurable and
 *   says the same thing. The usual fix is to verify against a dummy hash when
 *   the user does not exist, so both paths cost the same.
 *
 * COST FACTOR
 *   12 is a reasonable default today (~200-400ms on typical hardware). Tune it
 *   on the machine that will run it: pick the highest cost that keeps a login
 *   comfortably under ~500ms.
 *
 * UPGRADING LATER
 *   On a successful login, if the stored cost is below current policy, re-hash
 *   the typed password at the new cost and update the row. That is the only
 *   moment the plaintext is available, and it upgrades accounts gradually
 *   without forcing a password reset.
 */
