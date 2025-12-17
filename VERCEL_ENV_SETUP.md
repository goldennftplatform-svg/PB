# Vercel Environment Variables Setup

## Helius API Key

**API Key**: `431ca765-2f35-4b23-8abd-db03796bd85f`

## Steps to Add to Vercel

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your project: `pb-n7kx` (or your project name)

2. **Navigate to Settings**
   - Click on your project
   - Go to "Settings" tab
   - Click "Environment Variables" in the sidebar

3. **Add Environment Variable**
   - Click "Add New"
   - **Name**: `HELIUS_API_KEY`
   - **Value**: `431ca765-2f35-4b23-8abd-db03796bd85f`
   - **Environment**: Select all (Production, Preview, Development)
   - Click "Save"

4. **Redeploy** (if needed)
   - Go to "Deployments" tab
   - Click "..." on latest deployment
   - Click "Redeploy"

## Verification

After adding the environment variable:

1. Check that deployments show the new env var
2. Visit the live site: https://pb-n7kx.vercel.app/
3. Open browser console (F12)
4. Check for price service initialization
5. Verify Helius API is being used (check network requests)

## Alternative: Use Vercel CLI

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Login to Vercel
vercel login

# Add environment variable
vercel env add HELIUS_API_KEY

# Enter the value when prompted: 431ca765-2f35-4b23-8abd-db03796bd85f
# Select environments: Production, Preview, Development

# Redeploy
vercel --prod
```

## Current Status

✅ **API Key**: Configured in code (fallback)
⏭️ **Vercel**: Needs to be added to environment variables
✅ **Code**: Ready for deployment

## Notes

- The price service will use the API key from environment variables first
- Falls back to the hardcoded key if env var not set
- Helius API provides faster RPC and better data retrieval
- No additional configuration needed once env var is set
















