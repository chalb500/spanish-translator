param(
    [string]$Model = "gpt-4o-mini"
)

$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) {
    throw "npm.cmd was not found. Install Node.js, reopen PowerShell, and try again."
}

$originalApiKey = [Environment]::GetEnvironmentVariable("OPENAI_API_KEY", "Process")
$originalModel = [Environment]::GetEnvironmentVariable("OPENAI_MODEL", "Process")
$secureKey = Read-Host "OpenAI API key (input is hidden)" -AsSecureString
$keyPointer = [IntPtr]::Zero
$exitCode = 1

try {
    $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    if ([string]::IsNullOrWhiteSpace($apiKey)) {
        throw "An API key is required to run the real-provider evaluation."
    }

    $env:OPENAI_API_KEY = $apiKey
    $env:OPENAI_MODEL = $Model
    Push-Location $PSScriptRoot
    try {
        & $npmCommand.Source run evaluate
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
} finally {
    if ($keyPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
    }
    if ($null -eq $originalApiKey) {
        Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
    } else {
        $env:OPENAI_API_KEY = $originalApiKey
    }
    if ($null -eq $originalModel) {
        Remove-Item Env:OPENAI_MODEL -ErrorAction SilentlyContinue
    } else {
        $env:OPENAI_MODEL = $originalModel
    }
    Remove-Variable apiKey, secureKey, keyPointer -ErrorAction SilentlyContinue
}

exit $exitCode
