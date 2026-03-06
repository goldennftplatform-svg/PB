# PC Crash Log Summary - January 15, 2026

## Recent Crashes (Today)

### Critical System Crashes (Event ID 41)
- **5:05:57 PM** - System rebooted without clean shutdown
- **4:25:33 PM** - System rebooted without clean shutdown  
- **3:53:32 PM** - System rebooted without clean shutdown

### Unexpected Shutdowns (Event ID 6008)
- **5:06:02 PM** - Previous shutdown at 4:25:38 PM was unexpected
- **4:25:38 PM** - Previous shutdown at 3:53:37 PM was unexpected

## Crash Pattern Analysis

**Frequency:** Crashes happening every 30-40 minutes
**Pattern:** Sudden power loss / unexpected shutdowns
**No BSOD:** BugCheckCode 0 indicates no blue screen - suggests hardware failure

## Likely Causes (from WINDOWS_CRASH_REPORT.md)

1. **Power Supply Unit (PSU) Failure** - Most likely
   - PSU may be failing under load
   - Check PSU wattage vs system requirements
   - Listen for unusual noises from PSU

2. **Hardware Overheating**
   - CPU or GPU overheating causing thermal shutdown
   - Check CPU/GPU temperatures
   - Clean dust from fans/heatsinks

3. **RAM Issues**
   - Faulty RAM modules
   - Run: `mdsched.exe` (Windows Memory Diagnostic)

4. **Motherboard Issues**
   - Gigabyte Z390 AORUS PRO may have hardware problems
   - Check for bulging capacitors
   - Verify all connections are secure

5. **Loose Power Connections**
   - Check 24-pin ATX connector
   - Check CPU power connector (4/8-pin)
   - Check GPU power connectors

## System Information

- **Motherboard:** Gigabyte Z390 AORUS PRO
- **Firmware:** F14b (American Megatrends)
- **OS:** Windows 10 (Build 19045)
- **Architecture:** x64

## Immediate Actions Needed

1. **Check System Temperatures:**
   - Install HWiNFO64 or Core Temp
   - Monitor CPU/GPU temps during normal use
   - If temps > 80°C under load, overheating is likely

2. **Run Memory Diagnostic:**
   ```powershell
   mdsched.exe
   # Restart and let it complete
   ```

3. **Check Power Supply:**
   - Verify PSU fan is spinning
   - Check PSU wattage is adequate
   - Test with different PSU if available

4. **Check Physical Connections:**
   - Reseat RAM modules
   - Reseat all power connectors
   - Check for loose cables

5. **Update BIOS/UEFI:**
   - Current firmware: F14b
   - Check Gigabyte website for updates
   - Secure Boot errors (Event ID 1801) suggest firmware update needed

## Application Crashes Found

- Multiple Node.js crashes (acpllibmanager.node)
- Photoshop memory leaks
- Cursor.exe memory issues
- inno_updater.exe crashes

## Warning

The frequency of crashes (every 30-40 minutes) suggests a **critical hardware issue** that needs immediate attention. The system may become completely unusable if not addressed.

---

**Generated:** January 15, 2026 5:15 PM
**Based on:** Windows Event Viewer logs and WINDOWS_CRASH_REPORT.md
