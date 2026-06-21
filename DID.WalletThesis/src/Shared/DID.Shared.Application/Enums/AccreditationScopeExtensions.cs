using System.ComponentModel;
using System.Reflection;

namespace DID.Shared.Application.Enums;

/// <summary>
/// Extension helpers for <see cref="AccreditationScope"/> that replace hard-coded switch statements.
/// </summary>
public static class AccreditationScopeExtensions
{
    /// <summary>Returns the [Description] attribute value, falling back to the enum name.</summary>
    public static string ToScopeString(this AccreditationScope scope)
    {
        var member = typeof(AccreditationScope).GetMember(scope.ToString()).FirstOrDefault();
        var attr = member?.GetCustomAttribute<DescriptionAttribute>();
        return attr?.Description ?? scope.ToString();
    }

    /// <summary>
    /// Parses a scope string (case-insensitive) to the enum value.
    /// Throws <see cref="ArgumentOutOfRangeException"/> for unknown values.
    /// </summary>
    public static AccreditationScope ParseScope(string scope)
    {
        var normalised = scope.Trim();
        foreach (AccreditationScope value in Enum.GetValues<AccreditationScope>())
        {
            var member = typeof(AccreditationScope).GetMember(value.ToString()).FirstOrDefault();
            var attr = member?.GetCustomAttribute<DescriptionAttribute>();
            var label = attr?.Description ?? value.ToString();
            if (string.Equals(label, normalised, StringComparison.OrdinalIgnoreCase))
                return value;
        }
        var valid = string.Join(", ", Enum.GetValues<AccreditationScope>()
            .Select(v =>
            {
                var m = typeof(AccreditationScope).GetMember(v.ToString()).FirstOrDefault();
                return m?.GetCustomAttribute<DescriptionAttribute>()?.Description ?? v.ToString();
            }));
        throw new ArgumentOutOfRangeException(nameof(scope), scope,
            $"Unsupported accreditation scope. Valid values are: {valid}");
    }

    /// <summary>Returns null for byte values not represented in the enum.</summary>
    public static string? ToScopeStringOrNull(byte value)
    {
        if (Enum.IsDefined(typeof(AccreditationScope), value))
            return ((AccreditationScope)value).ToScopeString();
        return null;
    }
}
