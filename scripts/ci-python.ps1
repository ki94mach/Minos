# Resolve and invoke Python on the Windows GitLab shell runner.
# Writes .ci-python-path in the project root so each CI script line can reuse it
# (PowerShell executor starts a new session per script line).
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$PathFile = Join-Path $Root '.ci-python-path'

function Resolve-PythonPath {
    if ($env:PYTHON_PATH -and (Test-Path -LiteralPath $env:PYTHON_PATH)) {
        return (Resolve-Path -LiteralPath $env:PYTHON_PATH).Path
    }

    foreach ($name in @('python.exe', 'python3.exe', 'python', 'python3')) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) {
            return $cmd.Source
        }
    }

    $py = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($py) {
        $exe = & $py.Source -3 -c "import sys; print(sys.executable)"
        if ($LASTEXITCODE -eq 0 -and $exe) {
            return $exe.Trim()
        }
    }

    $candidates = @(
        "$env:ProgramFiles\Python312\python.exe",
        "$env:ProgramFiles\Python311\python.exe",
        "$env:ProgramFiles\Python310\python.exe",
        "${env:ProgramFiles(x86)}\Python312\python.exe",
        "${env:ProgramFiles(x86)}\Python311\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
        'C:\Python312\python.exe',
        'C:\Python311\python.exe'
    )
    foreach ($path in $candidates) {
        if ($path -and (Test-Path -LiteralPath $path)) {
            return (Resolve-Path -LiteralPath $path).Path
        }
    }

    $searchRoots = @(
        $env:ProgramFiles,
        ${env:ProgramFiles(x86)},
        "$env:LOCALAPPDATA\Programs\Python"
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

    foreach ($root in $searchRoots) {
        $found = Get-ChildItem -LiteralPath $root -Filter python.exe -Recurse -Depth 4 -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch 'WindowsApps|Microsoft\\WindowsApps' } |
            Select-Object -First 1
        if ($found) {
            return $found.FullName
        }
    }

    return $null
}

if (-not (Test-Path -LiteralPath $PathFile)) {
    $python = Resolve-PythonPath
    if (-not $python) {
        Write-Error @"
Python 3 was not found on gitlab-runner-windows.

Install Python 3.12+ on OP-N2S-APP-SRV for all users, add it to the system PATH,
and restart the GitLab Runner service.

Or set a GitLab CI/CD variable PYTHON_PATH to the full path of python.exe
(for example C:\Program Files\Python312\python.exe).
"@
    }
    Set-Content -LiteralPath $PathFile -Value $python -NoNewline
    Write-Host "Using Python: $python"
    & $python --version
}

if ($Args.Count -eq 0) {
    exit 0
}

$python = (Get-Content -LiteralPath $PathFile -Raw).Trim()
& $python @Args
exit $LASTEXITCODE
