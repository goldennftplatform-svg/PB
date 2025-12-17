# Windows Crash Report
**Generated:** 2025-11-11 14:05:34

## Critical Findings

### Crash Frequency
- **Total crashes in last 7 days:** 20
- **Today (11/11/2025):** 9 crashes
- **Crash intervals today:** 1-24 minutes apart

### Crash Pattern Analysis
The system is experiencing **frequent unexpected shutdowns** with the following characteristics:

1. **Event ID 41 (Critical):** "The system has rebooted without cleanly shutting down first"
2. **Event ID 6008 (Error):** "The previous system shutdown was unexpected"
3. **BugCheckCode: 0** - This indicates NO actual BSOD/blue screen occurred, suggesting:
   - Sudden power loss
   - Hardware failure (CPU, RAM, motherboard)
   - Power supply unit (PSU) issues
   - Overheating causing instant shutdown
   - Loose power connections

### Recent Crash Timeline (Today)
```
11/11/2025 2:02:03 PM  - Crash
11/11/2025 1:51:02 PM  - Crash (11 min interval)
11/11/2025 1:49:43 PM  - Crash (1.3 min interval)
11/11/2025 1:36:35 PM  - Crash (13 min interval)
11/11/2025 1:34:55 PM  - Crash (1.7 min interval)
11/11/2025 1:24:43 PM  - Crash (10 min interval)
11/11/2025 1:00:35 PM  - Crash (24 min interval)
11/11/2025 12:49:25 PM - Crash (11 min interval)
11/11/2025 11:46:02 AM - Crash (63 min interval)
11/11/2025 10:18:19 AM - Crash (87 min interval)
```

### Additional Issues Found

1. **Secure Boot Errors (Event ID 1801):**
   - Secure Boot CA/keys need to be updated
   - Device: Gigabyte Z390 AORUS PRO (Firmware F14b)
   - This is a separate issue but should be addressed

2. **Application Crashes:**
   - Multiple Node.js crashes (acpllibmanager.node)
   - Photoshop memory leaks
   - Cursor.exe memory issues
   - inno_updater.exe crashes

## Likely Root Causes

### Primary Suspects (in order of probability):

1. **Power Supply Unit (PSU) Failure**
   - Most likely cause given BugCheckCode 0
   - PSU may be failing under load
   - Check PSU wattage vs system requirements

2. **Hardware Overheating**
   - CPU or GPU overheating causing thermal shutdown
   - Check CPU/GPU temperatures
   - Clean dust from fans/heatsinks
   - Verify thermal paste application

3. **RAM Issues**
   - Faulty RAM modules
   - Run Windows Memory Diagnostic: `mdsched.exe`

4. **Motherboard Issues**
   - Gigabyte Z390 AORUS PRO may have hardware problems
   - Check for bulging capacitors
   - Verify all connections are secure

5. **Loose Power Connections**
   - Check 24-pin ATX connector
   - Check CPU power connector (4/8-pin)
   - Check GPU power connectors

## Recommended Actions

### Immediate Steps:

1. **Check System Temperatures:**
   ```powershell
   # Install and run HWiNFO64 or Core Temp
   # Monitor CPU/GPU temps during normal use
   ```

2. **Run Memory Diagnostic:**
   ```powershell
   mdsched.exe
   # Restart and let it complete
   ```

3. **Check Power Supply:**
   - Verify PSU wattage is adequate for your system
   - Check if PSU fan is spinning
   - Listen for unusual noises from PSU
   - Consider testing with a different PSU if available

4. **Check Event Viewer for Hardware Errors:**
   ```powershell
   Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-WHEA-Logger'}
   ```

5. **Update BIOS/UEFI:**
   - Current firmware: F14b
   - Check Gigabyte website for updates
   - Secure Boot errors suggest firmware update needed

6. **Check Physical Connections:**
   - Reseat RAM modules
   - Reseat all power connectors
   - Check for loose cables

### Diagnostic Commands:

```powershell
# Check for hardware errors
Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-WHEA-Logger'}

# View all critical events
Get-WinEvent -FilterHashtable @{LogName='System'; Level=1} -MaxEvents 50

# Check system reliability
perfmon /rel

# Run system file checker
sfc /scannow

# Check disk health
wmic diskdrive get status
```

## System Information

- **Motherboard:** Gigabyte Z390 AORUS PRO
- **Firmware:** F14b (American Megatrends)
- **OS:** Windows 10 (Build 19045)
- **Architecture:** x64

## Next Steps

1. **Immediate:** Check temperatures and PSU
2. **Short-term:** Run memory diagnostic and check hardware connections
3. **If issues persist:** Consider professional hardware diagnostics or component replacement

---

**Note:** The frequency of crashes (every 1-24 minutes) suggests a critical hardware issue that needs immediate attention. The system may become completely unusable if not addressed.

