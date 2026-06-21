using System.ComponentModel;

namespace DID.Shared.Application.Enums;

/// <summary>
/// Represents an accreditation scope level, mapping between the on-chain byte value
/// and the human-readable string used in JWTs and the database.
/// New scopes can be added here without modifying the switch statements in service classes.
/// </summary>
public enum AccreditationScope : byte
{
    [Description("MemberState")] MemberState = 1,
    [Description("Ministry")]     Ministry    = 2,
    [Description("Institution")]  Institution = 3,
    [Description("Department")]   Department  = 4,
    [Description("BusinessRegistry")] BusinessRegistry = 5,
    [Description("Enterprise")]   Enterprise  = 6,
}
