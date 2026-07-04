# Resolve and invoke Python on the Windows GitLab shell runner.
# Writes .ci-python-path in the project root so each CI script line can reuse it
# (PowerShell executor starts a new session per script line).
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/ci-python-common.ps1"

$Root = Split-Path -Parent $PSScriptRoot
$PathFile = Join-Path $Root '.ci-python-path'

if (-not (Test-Path -LiteralPath $PathFile)) {
    $python = Resolve-CiPythonPath
    if (-not $python) {
        Write-Host 'No system Python found; bootstrapping project-local Python under .ci/python ...'
        & "$PSScriptRoot/ci-bootstrap-python.ps1"
        $python = Resolve-CiPythonPath
    }
    if (-not $python) {
        Write-CiPythonMissingError
    }
    Set-Content -LiteralPath $PathFile -Value $python -NoNewline -Encoding ASCII
    Write-Host "Using Python: $python"
    Write-CiPythonVersion -PythonPath $python
}

if ($Args.Count -eq 0) {
    exit 0
}

$python = (Get-Content -LiteralPath $PathFile -Raw).Trim()
& $python @Args
exit $LASTEXITCODE
