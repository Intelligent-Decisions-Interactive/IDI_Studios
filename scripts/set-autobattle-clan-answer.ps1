[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$secureAnswer = Read-Host "Enter the AutoBattle clan leader answer" -AsSecureString
$answerPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureAnswer)

try {
    $plainAnswer = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($answerPointer)
    $normalizedAnswer = [Text.RegularExpressions.Regex]::Replace(
        $plainAnswer.Normalize([Text.NormalizationForm]::FormKC).Trim().ToLowerInvariant(),
        "\s+",
        " "
    )

    if ([string]::IsNullOrWhiteSpace($normalizedAnswer)) {
        throw "The clan leader answer cannot be empty."
    }

    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes($normalizedAnswer))
        $hash = [BitConverter]::ToString($hashBytes).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
    }

    $projectRoot = Split-Path -Parent $PSScriptRoot
    $targetPath = Join-Path $projectRoot ".dev.vars"
    $setting = "AUTOBATTLE_CLAN_LEADER_SHA256=$hash"
    $content = if (Test-Path -LiteralPath $targetPath) {
        Get-Content -Raw -LiteralPath $targetPath
    }
    else {
        ""
    }

    if ($content -match "(?m)^AUTOBATTLE_CLAN_LEADER_SHA256=.*$") {
        $content = [Text.RegularExpressions.Regex]::Replace(
            $content,
            "(?m)^AUTOBATTLE_CLAN_LEADER_SHA256=.*$",
            $setting
        )
    }
    else {
        if ($content.Length -gt 0 -and -not $content.EndsWith("`n")) {
            $content += "`r`n"
        }
        $content += "$setting`r`n"
    }

    [IO.File]::WriteAllText(
        $targetPath,
        $content,
        [Text.UTF8Encoding]::new($false)
    )
    Write-Host "Clan answer hash saved to .dev.vars. Restart the development server to load it."
}
finally {
    if ($answerPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($answerPointer)
    }
    $plainAnswer = $null
    $normalizedAnswer = $null
}
