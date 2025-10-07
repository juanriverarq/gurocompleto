# Environment Variables Setup

## Issue Fixed: `process is not defined` Error

The error was occurring because the code was trying to access `process.env` in a browser environment, which is not available. In Vite applications, environment variables must be accessed using `import.meta.env`.

## Changes Made

### 1. Updated `elevenLabsService.ts`

- Changed `process.env.ELEVENLABS_API_KEY` to `import.meta.env.VITE_ELEVENLABS_API_KEY`
- Updated `getAuthHeaders` function to use environment variable with fallback

### 2. Updated `systemIntegrationService.ts`

- Changed `process.env.REACT_APP_API_URL` to `import.meta.env.VITE_API_URL`

### 3. Created `.env` file

- Added `VITE_ELEVENLABS_API_KEY` with the configured API key
- Added `VITE_API_URL` for backend API configuration

## Environment Variables Required

Create a `.env` file in the frontend directory with:

```env
# ElevenLabs Configuration
VITE_ELEVENLABS_API_KEY=sk_06bf990afaf79a11677ac77a93d58d3abbdc6e254f776c7e

# API Configuration
VITE_API_URL=http://localhost:8081/api
```

## Important Notes

1. **Vite Environment Variables**: All environment variables in Vite must be prefixed with `VITE_` to be accessible in the browser.

2. **Security**: Environment variables prefixed with `VITE_` are exposed to the client-side code. Never put sensitive server-side secrets in `VITE_` variables.

3. **Access Pattern**: Use `import.meta.env.VITE_VARIABLE_NAME` instead of `process.env.VARIABLE_NAME`

4. **Fallback Strategy**: The service maintains a fallback to the hardcoded `DEFAULT_API_KEY` if the environment variable is not set.

## Testing

After making these changes:

1. The WebSocket connection should work properly
2. Real phone calls should be attempted via ElevenLabs
3. Fallback to simulation should work if the real call fails

## Troubleshooting

If you still see `process is not defined` errors:

1. Check that all `process.env` references are replaced with `import.meta.env`
2. Ensure environment variables are prefixed with `VITE_`
3. Restart the development server after changing `.env` file
4. Clear browser cache if needed

## Next Steps

1. Test the phone call functionality
2. Verify that real calls work with your Twilio configuration
3. Monitor the console for any remaining environment variable issues
