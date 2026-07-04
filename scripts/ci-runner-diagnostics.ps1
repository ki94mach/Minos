# Print runner environment details to help configure shell-win CI jobs.
# Always exits 0 so the diagnostics job does not block the pipeline.
param(
    [switch]$Quick
)

$ErrorActionPreference = 'Continue'
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
    Write-Diag '--- Python installs under Program Files / AppData (depth 5) ---'
    $searchRoots = @(
        $env:ProgramFiles,
        ${env:ProgramFiles(x86)},
        "$env:LOCALAPPDATA\Programs\Python"
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

    $found = @()
    foreach ($root in $searchRoots) {
        $found += Get-ChildItem -LiteralPath $root -Filter python.exe -Recurse -Depth 5 -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch 'WindowsApps|Microsoft\\WindowsApps' }
    }
    if ($found.Count -eq 0) {
        Write-Diag 'No python.exe found in standard install trees'
    }
    else {
        foreach ($item in ($found | Sort-Object FullName -Unique)) {
            Write-Diag "FOUND -> $($item.FullName)"
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
$resolved = $null
try {
    Remove-Item -LiteralPath (Join-Path $Root '.ci-python-path') -ErrorAction SilentlyContinue
    & (Join-Path $PSScriptRoot 'ci-python.ps1') 2>&1 | ForEach-Object { Write-Diag $_ }
    $pathFile = Join-Path $Root '.ci-python-path'
    if (Test-Path -LiteralPath $pathFile) {
        $resolved = (Get-Content -LiteralPath $pathFile -Raw).Trim()
        Write-Diag "Resolver selected: $resolved"
    }
    else {
        Write-Diag 'Resolver did not create .ci-python-path'
    }
}
catch {
    Write-Diag "Resolver error: $($_.Exception.Message)"
}
Write-Diag ''

Write-Diag '=== Recommendation ==='
if ($resolved) {
    Write-Diag "Use scripts/ci-python.ps1 (already resolves to: $resolved)"
    if (-not $env:PYTHON_PATH) {
        Write-Diag "Optional: set CI/CD variable PYTHON_PATH=$resolved for faster, explicit resolution"
    }
}
else {
    Write-Diag 'Python was not found. Choose one fix:'
    Write-Diag '1. Install Python 3.12+ for all users on OP-N2S-APP-SRV, add to system PATH, restart gitlab-runner service'
    Write-Diag '2. Set GitLab CI/CD variable PYTHON_PATH to the full path of python.exe from the search results above'
    Write-Diag '3. Until Python exists, backend-tests and spa-build cannot run on shell-win'
}
Write-Diag 'Node/npm appear usable if node --version succeeded above (required for frontend-tests).'
Write-Diag '=== End diagnostics ==='

Set-Content -LiteralPath $LogPath -Value ($lines -join [Environment]::NewLine) -Encoding UTF8
Write-Host ""
Write-Host "Wrote $LogPath"
exit 0
