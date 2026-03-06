# 🐧 Building in WSL - Quick Guide

## ✅ You're in WSL - Perfect!

WSL (Windows Subsystem for Linux) will fix the Rust build issues. Here's how to build:

## 🚀 Quick Steps

### 1. Navigate to Project
```bash
cd /mnt/c/Users/PreSafu/Desktop/POWERsol
```

### 2. Install Dependencies (if needed)
```bash
# Check if Anchor is installed
anchor --version

# If not, install:
npm install -g @coral-xyz/anchor-cli

# Check Rust
rustc --version
cargo --version
```

### 3. Build
```bash
# Clean first
anchor clean

# Build
anchor build
```

### 4. Check IDL
```bash
# Verify IDL was generated
ls -la target/idl/lottery.json

# Check for new fields
grep -i "rollover_count" target/idl/lottery.json
grep -i "pepe_ball_count" target/idl/lottery.json
```

## 🎯 What to Expect

After successful build:
- ✅ `target/idl/lottery.json` will have the new fields
- ✅ JavaScript clients can now use the 50/50 rollover
- ✅ Test scripts will work

## 🧪 After Build

Once IDL is generated, test the 50/50 rollover:

```bash
# From WSL or Windows PowerShell
node scripts/test-50-50-rollover.js
```

Or use the existing snapshot script:
```bash
node scripts/trigger-snapshot.js
```

## 💡 Pro Tips

- **WSL File Access**: Your Windows files are at `/mnt/c/Users/...`
- **Cross-Platform**: You can build in WSL, then run Node scripts from Windows
- **IDL Location**: The IDL file will be accessible from both WSL and Windows

---

**Ready?** Run `anchor build` in WSL! 🚀

