# Environment Variables Setup

## Google Drive Integration

To properly configure Google Drive integration, create a `.env` file in the `frontend` directory with the following variables:

```env
# Google OAuth Configuration
REACT_APP_GOOGLE_CLIENT_ID=417174186413-9tic39kfp63368octrt6gr15srlcjbpn.apps.googleusercontent.com
REACT_APP_GOOGLE_CLIENT_SECRET=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

# Backend API URL
REACT_APP_API_URL=http://localhost:5000
```

## Steps to Create .env File

1. Navigate to the `frontend` directory
2. Create a new file named `.env` (no file extension)
3. Add the above content to the file
4. Save the file
5. Restart the development server: `npm start`

## Important Notes

- The `.env` file should be in the `frontend` directory, not the root directory
- Environment variables must start with `REACT_APP_` to be accessible in React
- After creating or modifying the `.env` file, restart the development server
- The `.env` file should be added to `.gitignore` to keep credentials secure

## Google Identity Services (GIS)

This application now uses the newer **Google Identity Services (GIS)** API instead of the deprecated Google Sign-In API. This resolves the `idpiframe_initialization_failed` error that occurs with newer OAuth clients.

### Key Changes:
- ✅ Uses `https://accounts.google.com/gsi/client` script
- ✅ Implements `google.accounts.oauth2.initTokenClient()`
- ✅ Modern token-based authentication
- ✅ Better security and performance

## Automatic Connection

**NEW FEATURE**: Google Drive now connects automatically when the app loads!

### How it works:
- ✅ **Auto-connect**: Google Drive connects automatically when the service is created
- ✅ **No manual button**: Users don't need to click "Connect Drive"
- ✅ **Seamless experience**: File uploads work immediately
- ✅ **Fallback option**: Manual retry button available if needed

### User Experience:
1. **App loads** → Google Drive starts connecting automatically
2. **User uploads file** → Connection is ready, upload proceeds
3. **No interruptions** → Smooth, seamless file management

## Current Status

For testing purposes, the Google credentials are currently hardcoded in `src/services/googleDriveService.ts`. Once the `.env` file is created, you can uncomment the environment variable lines and remove the hardcoded values.

## Testing the Integration

### Test Route Available:
Visit `/file-upload-test` to test the automatic Google Drive integration:

1. **Navigate to**: `http://localhost:3000/file-upload-test`
2. **Upload a file**: Click the upload area and select any file
3. **Watch the magic**: File automatically uploads to Google Drive
4. **Verify**: Check your Google Drive for the "SK Management System" folder

### Expected Behavior:
- ✅ Google Drive connects automatically
- ✅ File uploads work without manual connection
- ✅ Files appear in Google Drive immediately
- ✅ Direct link to view files in Google Drive

## Troubleshooting

If you encounter the `idpiframe_initialization_failed` error:
1. ✅ **Solution**: The service has been updated to use Google Identity Services
2. ✅ **No action needed**: The fix is already implemented
3. ✅ **Test**: Try uploading a file - it should work automatically

The new implementation should work seamlessly with your existing Google OAuth client.
