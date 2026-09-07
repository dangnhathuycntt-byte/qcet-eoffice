<#
.SYNOPSIS
    Kịch bản tự động đăng ký Windows Task Scheduler cho hệ thống QCET E-Office.
.DESCRIPTION
    Đăng ký 2 tác vụ hệ thống:
    1. QCET_EOffice_AutoBoot: Tự động khởi động hệ sinh thái Docker Compose khi Windows Server bật nguồn (AtStartup, delay 1 phút).
    2. QCET_EOffice_DailyBackup: Tự động sao lưu định kỳ vào 01:00 AM mỗi ngày gọi backup-daily.ps1.
#>

param(
    [string]$AppDir = "C:\QCET\QCET Work",
    [string]$BackupScriptPath = ""
)

$ErrorActionPreference = "Stop"

# Kiểm tra quyền Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Script yêu cầu quyền Administrator để đăng ký Task Scheduler. Vui lòng chạy lại PowerShell với quyền 'Run as Administrator'."
    exit 1
}

Write-Host "================ ĐĂNG KÝ WINDOWS TASK SCHEDULER: QCET E-OFFICE ================" -ForegroundColor Cyan
Write-Host "Thư mục ứng dụng (AppDir): $AppDir" -ForegroundColor Gray

if ([string]::IsNullOrWhiteSpace($BackupScriptPath)) {
    $BackupScriptPath = Join-Path $AppDir "scripts\backup-daily.ps1"
}
Write-Host "Đường dẫn backup script: $BackupScriptPath" -ForegroundColor Gray

try {
    # 1. Đăng ký tác vụ Tự khởi động (AutoBoot on Startup)
    Write-Host "`n1. Đang cấu hình tác vụ tự khởi động hệ thống (QCET_EOffice_AutoBoot)..." -ForegroundColor Yellow
    $bootAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"cd '$AppDir'; docker compose up -d`""
    $bootTrigger = New-ScheduledTaskTrigger -AtStartup
    $bootTrigger.Delay = 'PT1M' # Chờ 1 phút để dịch vụ Docker Engine/WSL2 khởi động hoàn tất
    $bootPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $bootSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 2)

    Register-ScheduledTask -TaskName "QCET_EOffice_AutoBoot" `
        -Action $bootAction `
        -Trigger $bootTrigger `
        -Principal $bootPrincipal `
        -Settings $bootSettings `
        -Description "Tự động khởi động hệ thống QCET E-Office khi máy chủ bật nguồn" `
        -Force | Out-Null

    Write-Host "✓ Tác vụ 'QCET_EOffice_AutoBoot' đã được đăng ký thành công!" -ForegroundColor Green

    # 2. Đăng ký tác vụ Sao lưu Hàng ngày (Daily Backup 01:00 AM)
    Write-Host "`n2. Đang cấu hình tác vụ sao lưu hàng ngày (QCET_EOffice_DailyBackup)..." -ForegroundColor Yellow
    $backupAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$BackupScriptPath`""
    $backupTrigger = New-ScheduledTaskTrigger -Daily -At "01:00"
    $backupPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $backupSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable

    Register-ScheduledTask -TaskName "QCET_EOffice_DailyBackup" `
        -Action $backupAction `
        -Trigger $backupTrigger `
        -Principal $backupPrincipal `
        -Settings $backupSettings `
        -Description "Tự động sao lưu dữ liệu CSDL và tệp đính kèm QCET E-Office lúc 01:00 AM" `
        -Force | Out-Null

    Write-Host "✓ Tác vụ 'QCET_EOffice_DailyBackup' đã được đăng ký thành công!" -ForegroundColor Green

    Write-Host "`n================ HOÀN TẤT ĐĂNG KÝ TASK SCHEDULER ================" -ForegroundColor Cyan
    Write-Host "Cả 2 tác vụ đã sẵn sàng và kích hoạt trên Windows Server." -ForegroundColor Green
}
catch {
    Write-Error "[LỖI NGHIÊM TRỌNG] Không thể đăng ký tác vụ Task Scheduler: $($_.Exception.Message)"
    exit 1
}
