# Print runner environment details to help configure shell-win CI jobs.
# Always exits 0 so the diagnostics job does not block the pipeline.
param(
    [switch]$Quick
)

$ErrorActionPreference = 'Continue'
. "$PSScriptRoot/ci-python-common.ps1"
$Root = Split-Path -Parent $PSScriptRoot
$LogPath = Join-Path $Root 'runner-diagnostics.txt'
$lines = New-Object System.Collections.Generic.List[string]

function Write-Diag {
    param([string]$Message)
    Write-Host $Message
    $lines.Add($Message)
}

function Test-CommandName {
    param([string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) {
        return "FOUND -> $($cmd.Source)"
    }
    return 'not on PATH'
}

function Test-WhereExe {
    param([string]$Name)
    $output = & where.exe $Name 2>$null
    if ($LASTEXITCODE -eq 0 -and $output) {
        return ($output -join ' | ')
    }
    return 'where.exe: not found'
}

function Test-PathLine {
    param([string]$Path)
    if (-not $Path) {
        return 'skipped (empty)'
    }
    if (Test-Path -LiteralPath $Path) {
        return "EXISTS -> $Path"
    }
    return "missing -> $Path"
}

Write-Diag '=== Minos GitLab Runner Diagnostics ==='
Write-Diag "Timestamp: $(Get-Date -Format o)"
Write-Diag "Hostname: $env:COMPUTERNAME"
Write-Diag "User: $env:USERDOMAIN\$env:USERNAME"
Write-Diag "Project dir: $Root"
Write-Diag "Shell: $($PSVersionTable.PSEdition) $($PSVersionTable.PSVersion)"
Write-Diag ''

Write-Diag '--- GitLab CI variables ---'
foreach ($name in @(
        'CI_RUNNER_DESCRIPTION',
        'CI_RUNNER_TAGS',
        'CI_PROJECT_DIR',
        'CI_COMMIT_REF_NAME',
        'PYTHON_PATH',
        'PIP_INDEX_URL',
        'NPM_CONFIG_REGISTRY'
    )) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ($value) {
        Write-Diag "$name=$value"
    }
    else {
        Write-Diag "$name=(not set)"
    }
}
Write-Diag ''

Write-Diag '--- PATH entries ---'
if ($env:PATH) {
    $index = 0
    foreach ($entry in ($env:PATH -split ';')) {
        if ($entry) {
            Write-Diag ("[{0:D2}] {1}" -f $index, $entry)
            $index++
        }
    }
}
else {
    Write-Diag 'PATH is empty'
}
Write-Diag ''

Write-Diag '--- Command lookup (Get-Command) ---'
foreach ($name in @('python', 'python3', 'python.exe', 'python3.exe', 'py', 'py.exe', 'pip', 'pip3', 'node', 'npm')) {
    Write-Diag ("{0,-12} {1}" -f $name, (Test-CommandName $name))
}
Write-Diag ''

Write-Diag '--- where.exe lookup ---'
foreach ($name in @('python', 'python3', 'py', 'node', 'npm')) {
    Write-Diag ("{0,-8} {1}" -f $name, (Test-WhereExe $name))
}
Write-Diag ''

Write-Diag '--- Common Python install paths ---'
$candidates = @(
    "$env:ProgramFiles\Python312\python.exe",
    "$env:ProgramFiles\Python311\python.exe",
    "$env:ProgramFiles\Python310\python.exe",
    "${env:ProgramFiles(x86)}\Python312\python.exe",
    "${env:ProgramFiles(x86)}\Python311\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python310\python.exe",
    'C:\Python312\python.exe',
    'C:\Python311\python.exe',
    'C:\Python310\python.exe'
)
foreach ($path in $candidates) {
    Write-Diag (Test-PathLine $path)
}
Write-Diag ''

if (-not $Quick) {
    Write-Diag '--- Python installs under Program Files / AppData / Chocolatey (depth 5) ---'
    $found = Get-CiPythonCandidatePaths
    if ($found.Count -eq 0) {
        Write-Diag 'No python.exe found in standard install trees'
    }
    else {
        foreach ($path in ($found | Sort-Object -Unique)) {
            if (Test-IsSuitableCiPythonPath $path) {
                Write-Diag "SUITABLE -> $path"
            }
            else {
                Write-Diag "UNSUITABLE (bundled app Python) -> $path"
            }
        }
    }
    Write-Diag ''
}

Write-Diag '--- Launcher / version probes ---'
foreach ($probe in @(
        @{ Label = 'python --version'; Command = 'python'; Args = @('--version') },
        @{ Label = 'python3 --version'; Command = 'python3'; Args = @('--version') },
        @{ Label = 'py -3 --version'; Command = 'py'; Args = @('-3', '--version') },
        @{ Label = 'py -3 executable'; Command = 'py'; Args = @('-3', '-c', 'import sys; print(sys.executable)') }
    )) {
    $cmd = Get-Command $probe.Command -ErrorAction SilentlyContinue
    if (-not $cmd) {
        Write-Diag ("{0}: command not on PATH" -f $probe.Label)
        continue
    }
    try {
        $output = & $cmd.Source @($probe.Args) 2>&1 | Out-String
        $output = $output.Trim()
        if ($output) {
            Write-Diag ("{0}: {1}" -f $probe.Label, $output)
        }
        else {
            Write-Diag ("{0}: (no output, exit $LASTEXITCODE)" -f $probe.Label)
        }
    }
    catch {
        Write-Diag ("{0}: ERROR -> $($_.Exception.Message)" -f $probe.Label)
    }
}
Write-Diag ''

Write-Diag '--- Node / npm ---'
foreach ($probe in @(
        @{ Label = 'node --version'; Command = 'node'; Args = @('--version') },
        @{ Label = 'npm --version'; Command = 'npm'; Args = @('--version') }
    )) {
    $cmd = Get-Command $probe.Command -ErrorAction SilentlyContinue
    if (-not $cmd) {
        Write-Diag ("{0}: command not on PATH" -f $probe.Label)
        continue
    }
    $output = & $cmd.Source @($probe.Args) 2>&1 | Out-String
    Write-Diag ("{0}: {1}" -f $probe.Label, $output.Trim())
}
Write-Diag ''

Write-Diag '--- ci-python.ps1 resolver ---'
$resolved = Resolve-CiPythonPath
$bootstrapped = Get-CiBootstrappedPythonExe
if ($resolved) {
    Write-Diag "Resolver would use: $resolved"
    Write-CiPythonVersion -PythonPath $resolved
}
elseif ($bootstrapped -and (Test-Path -LiteralPath $bootstrapped)) {
    Write-Diag "Bootstrapped Python cached at: $bootstrapped"
    Write-CiPythonVersion -PythonPath $bootstrapped
}
else {
    Write-Diag 'No Python available yet; backend-tests will bootstrap .ci/python automatically'
}
Write-Diag ''

Write-Diag '=== Recommendation ==='
if ($resolved -or ($bootstrapped -and (Test-Path -LiteralPath $bootstrapped))) {
    $path = if ($resolved) { $resolved } else { $bootstrapped }
    Write-Diag "Python for CI: $path"
}
else {
    Write-Diag 'No suitable system Python for CI on this runner.'
    Write-Diag ''
    Write-Diag 'CI will bootstrap a project-local Python under .ci/python on first backend job.'
    Write-Diag 'That copy is cached between pipelines; no runner admin or Nexus changes are required.'
    Write-Diag ''
    Write-Diag 'If bootstrap fails (download blocked), set GitLab CI/CD variables you can edit:'
    Write-Diag '  PYTHON_EMBED_URL, GET_PIP_URL, or PYTHON_PATH'
    Write-Diag ''
    Write-Diag 'Optional admin fix: choco install python312 -y && Restart-Service gitlab-runner'
    Write-Diag 'frontend-tests can run now (Node v20.11.1 is available).'
}
Write-Diag '=== End diagnostics ==='

Set-Content -LiteralPath $LogPath -Value ($lines -join [Environment]::NewLine) -Encoding UTF8
Write-Host ""
Write-Host "Wrote $LogPath"
exit 0
