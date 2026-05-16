# Import MySQL dump into docker compose db (Windows PowerShell).
# Usage: .\scripts\import-db.ps1 -DumpFile "C:\path\homeconnect_full.sql"
param(
    [Parameter(Mandatory = $true)]
    [string]$DumpFile
)

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Test-Path $DumpFile)) {
    Write-Error "File not found: $DumpFile"
    exit 1
}

if (-not (Test-Path ".env")) {
    Write-Error "Missing .env — copy from .env.example first."
    exit 1
}

Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        Set-Item -Path "env:$($matches[1].Trim())" -Value $matches[2].Trim()
    }
}

$dbName = if ($env:DB_NAME) { $env:DB_NAME } else { "homeconnect" }
Write-Host "Importing $DumpFile into database '$dbName' ..."

Get-Content $DumpFile -Raw | docker compose exec -T db mysql -u root -p"$env:MYSQL_ROOT_PASSWORD" $dbName

Write-Host "Done."
