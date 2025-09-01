interface DriveFile {
  fileId: string;
  webViewLink: string;
  webContentLink: string;
  name: string;
  size: number;
  mimeType: string;
}

// Extend Window interface to include Google Identity Services
declare global {
  interface Window {
    google: any;
  }
}

class GoogleDriveService {
  private clientId: string;
  private apiKey: string;
  private isInitialized: boolean = false;
  private accessToken: string | null = null;
  private tokenClient: any = null;
  private initializationPromise: Promise<boolean> | null = null;
  private autoConnectPromise: Promise<boolean> | null = null;
  private readonly TOKEN_STORAGE_KEY = 'google_drive_access_token';
  private readonly TOKEN_EXPIRY_KEY = 'google_drive_token_expiry';

  constructor() {
    // TODO: Use environment variables in production
    // this.clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
    // this.apiKey = process.env.REACT_APP_GOOGLE_CLIENT_SECRET || '';
    
    // Temporary hardcoded values for testing
    this.clientId = '417174186413-9tic39kfp63368octrt6gr15srlcjbpn.apps.googleusercontent.com';
    this.apiKey = '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';
    
    console.log('GoogleDriveService constructor - Client ID:', this.clientId ? 'Set' : 'Not set');
    
    // Load existing token from storage
    this.loadStoredToken();
    
    // Auto-connect when service is created
    this.autoConnect();
  }

  // Load stored access token from localStorage
  private loadStoredToken(): void {
    try {
      const storedToken = localStorage.getItem(this.TOKEN_STORAGE_KEY);
      const tokenExpiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
      
      if (storedToken && tokenExpiry) {
        const expiryTime = parseInt(tokenExpiry);
        const currentTime = Date.now();
        
        // Check if token is still valid (with 5 minute buffer)
        if (currentTime < expiryTime - (5 * 60 * 1000)) {
          this.accessToken = storedToken;
          console.log('Loaded stored access token (valid until:', new Date(expiryTime), ')');
        } else {
          console.log('Stored token expired, will need to refresh');
          this.clearStoredToken();
        }
      }
    } catch (error) {
      console.error('Error loading stored token:', error);
      this.clearStoredToken();
    }
  }

  // Save access token to localStorage
  private saveStoredToken(token: string, expiresIn: number): void {
    try {
      const expiryTime = Date.now() + (expiresIn * 1000);
      localStorage.setItem(this.TOKEN_STORAGE_KEY, token);
      localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime.toString());
      console.log('Saved access token (expires:', new Date(expiryTime), ')');
    } catch (error) {
      console.error('Error saving token:', error);
    }
  }

  // Clear stored token
  private clearStoredToken(): void {
    try {
      localStorage.removeItem(this.TOKEN_STORAGE_KEY);
      localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
      console.log('Cleared stored token');
    } catch (error) {
      console.error('Error clearing token:', error);
    }
  }

  // Auto-connect to Google Drive
  private async autoConnect(): Promise<void> {
    try {
      console.log('Auto-connecting to Google Drive...');
      
      // If we already have a valid token, skip sign-in
      if (this.accessToken) {
        console.log('Already have valid access token, skipping sign-in');
        return;
      }
      
      await this.initialize();
      await this.signIn();
      console.log('Google Drive auto-connected successfully');
    } catch (error) {
      console.error('Auto-connect failed:', error);
    }
  }

  // Initialize Google Drive API (with singleton pattern)
  async initialize(): Promise<boolean> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<boolean> {
    try {
      console.log('Starting Google Drive initialization...');
      console.log('Client ID:', this.clientId);
      
      if (!this.clientId) {
        throw new Error('Google Client ID is not configured');
      }

      // Load Google Identity Services
      await this.loadGoogleIdentityServices();
      
      // Initialize token client
      await this.initializeTokenClient();
      
      this.isInitialized = true;
      console.log('Google Drive initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Drive:', error);
      this.initializationPromise = null;
      return false;
    }
  }

  // Load Google Identity Services
  private loadGoogleIdentityServices(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if Google Identity Services is already loaded
      if (window.google && window.google.accounts) {
        console.log('Google Identity Services already loaded');
        resolve();
        return;
      }

      console.log('Loading Google Identity Services...');
      
      // Load Google Identity Services script
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        console.log('Google Identity Services script loaded');
        resolve();
      };
      
      script.onerror = (error) => {
        console.error('Failed to load Google Identity Services script:', error);
        reject(new Error('Failed to load Google Identity Services script'));
      };
      
      document.head.appendChild(script);
    });
  }

  // Initialize token client
  private async initializeTokenClient(): Promise<void> {
    try {
      console.log('Initializing token client with client ID:', this.clientId);
      
      // Wait for Google Identity Services to be fully ready
      if (!window.google || !window.google.accounts) {
        throw new Error('Google Identity Services not ready');
      }

      // Initialize the token client with popup configuration
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        prompt: 'consent',
        ux_mode: 'popup',
        callback: (response: any) => {
          if (response.error) {
            console.error('Token client error:', response.error);
            return;
          }
          this.accessToken = response.access_token;
          console.log('Access token obtained via token client');
          
          // Save the token to localStorage for persistence
          if (response.access_token && response.expires_in) {
            this.saveStoredToken(response.access_token, response.expires_in);
          }
        }
      });

      console.log('Token client initialized successfully');
    } catch (error) {
      console.error('Error initializing token client:', error);
      throw error;
    }
  }

  // Sign in user (now called automatically)
  async signIn(): Promise<boolean> {
    if (this.autoConnectPromise) {
      return this.autoConnectPromise;
    }

    this.autoConnectPromise = this._signIn();
    return this.autoConnectPromise;
  }

  private async _signIn(): Promise<boolean> {
    try {
      console.log('Starting automatic sign-in process...');
      
      // Ensure initialization
      const initialized = await this.initialize();
      if (!initialized) {
        console.error('Failed to initialize Google Drive');
        return false;
      }

      if (!this.tokenClient) {
        console.error('Token client not available after initialization');
        return false;
      }

      console.log('Token client available, requesting access token...');
      
      // Request access token with timeout
      return new Promise((resolve) => {
        let timeoutId: NodeJS.Timeout;
        
        const checkToken = () => {
          if (this.accessToken) {
            console.log('Access token obtained successfully');
            clearTimeout(timeoutId);
            resolve(true);
          } else {
            setTimeout(checkToken, 100);
          }
        };
        
        // Set timeout for popup blocking
        timeoutId = setTimeout(() => {
          console.error('Google Drive sign-in timeout - popup may be blocked');
          resolve(false);
        }, 10000); // 10 second timeout
        
        this.tokenClient.requestAccessToken();
        checkToken();
      });
    } catch (error) {
      console.error('Error signing in:', error);
      return false;
    }
  }

  // Manual sign in (for explicit user action)
  async manualSignIn(): Promise<boolean> {
    console.log('Manual sign-in requested by user');
    return this.signIn();
  }

  // Sign out user
  async signOut(): Promise<void> {
    try {
      if (this.accessToken && window.google && window.google.accounts) {
        window.google.accounts.oauth2.revoke(this.accessToken, () => {
          console.log('Access token revoked successfully');
        });
        this.accessToken = null;
        this.autoConnectPromise = null;
        this.clearStoredToken();
        console.log('User signed out successfully');
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  // Check if user is signed in
  isSignedIn(): boolean {
    try {
      // Check if we have a token and it's not expired
      if (!this.accessToken) {
        return false;
      }
      
      // Check if token is expired by looking at stored expiry
      const tokenExpiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
      if (tokenExpiry) {
        const expiryTime = parseInt(tokenExpiry);
        const currentTime = Date.now();
        
        // If token is expired or will expire in next 5 minutes, consider it invalid
        if (currentTime >= expiryTime - (5 * 60 * 1000)) {
          console.log('Token expired or expiring soon, clearing');
          this.accessToken = null;
          this.clearStoredToken();
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking sign-in status:', error);
      return false;
    }
  }

  // Wait for connection to be ready
  async waitForConnection(): Promise<boolean> {
    if (this.isSignedIn()) {
      return true;
    }

    // Wait for auto-connect to complete
    if (this.autoConnectPromise) {
      return this.autoConnectPromise;
    }

    // If no auto-connect in progress, start one
    return this.signIn();
  }

  // Upload file to Google Drive
  async uploadFile(file: File, folderName: string = 'SK Management System'): Promise<DriveFile> {
    try {
      console.log('Starting file upload to Google Drive:', file.name);
      console.log('File size:', file.size, 'bytes');
      
      // Ensure we're connected
      console.log('Checking connection...');
      const connected = await this.waitForConnection();
      if (!connected) {
        throw new Error('Failed to connect to Google Drive');
      }
      console.log('Connection confirmed');

      if (!this.accessToken) {
        throw new Error('No access token available');
      }
      console.log('Access token available');

      // Get or create folder
      console.log('Getting or creating folder:', folderName);
      const folderId = await this.getOrCreateFolder(folderName);
      console.log('Folder ID:', folderId);
      
      // Create file metadata
      const metadata = {
        name: file.name,
        parents: [folderId]
      };
      console.log('File metadata:', metadata);

      // Create FormData for upload
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', file);
      console.log('FormData created, starting upload...');

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Upload timeout - aborting request');
        controller.abort();
      }, 30000); // 30 second timeout

      try {
        // Upload file using fetch with timeout
        const response = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,mimeType,webViewLink,webContentLink`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.accessToken}`
            },
            body: formData,
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);
        console.log('Upload response received:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Upload failed with status:', response.status);
          console.error('Error response:', errorText);
          throw new Error(`Upload failed: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        console.log('Upload result:', result);
        
        // Convert webViewLink to direct download URL for images
        let imageUrl = result.webViewLink;
        if (result.mimeType && result.mimeType.startsWith('image/')) {
          // Convert from view URL to direct download URL
          imageUrl = `https://drive.google.com/uc?export=view&id=${result.id}`;
        }
        
        const driveFile: DriveFile = {
          fileId: result.id,
          webViewLink: result.webViewLink,
          webContentLink: result.webContentLink,
          name: result.name,
          size: result.size,
          mimeType: result.mimeType
        };

        console.log('File uploaded successfully:', driveFile);
        console.log('Image URL for display:', imageUrl);
        return driveFile;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Upload timed out after 30 seconds');
        }
        throw fetchError;
      }
    } catch (error) {
      console.error('Error uploading file to Google Drive:', error);
      throw error;
    }
  }

  // Get or create folder
  async getOrCreateFolder(folderName: string): Promise<string> {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available');
      }

      // Search for existing folder
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(folderName)}' and mimeType='application/vnd.google-apps.folder'&fields=files(id,name)`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      const searchResult = await searchResponse.json();
      
      if (searchResult.files && searchResult.files.length > 0) {
        return searchResult.files[0].id;
      }

      // Create new folder
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      };

      const folderResponse = await fetch(
        'https://www.googleapis.com/drive/v3/files?fields=id',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(folderMetadata)
        }
      );

      const folderResult = await folderResponse.json();
      return folderResult.id;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  // List files in folder
  async listFiles(folderName: string): Promise<DriveFile[]> {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available');
      }

      const folderId = await this.getOrCreateFolder(folderName);
      
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents&fields=files(id,name,mimeType,size,createdTime,webViewLink,webContentLink)`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      const result = await response.json();

      return result.files.map((file: any) => ({
        fileId: file.id,
        webViewLink: file.webViewLink,
        webContentLink: file.webContentLink,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType
      }));
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  // Delete file
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available');
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  // Get file by ID
  async getFile(fileId: string): Promise<DriveFile | null> {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available');
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,webViewLink,webContentLink`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      if (!response.ok) {
        return null;
      }

      const result = await response.json();

      return {
        fileId: result.id,
        webViewLink: result.webViewLink,
        webContentLink: result.webContentLink,
        name: result.name,
        size: result.size,
        mimeType: result.mimeType
      };
    } catch (error) {
      console.error('Error getting file:', error);
      return null;
    }
  }

  // Get connection status for UI
  getConnectionStatus(): { isConnected: boolean; expiresAt?: Date } {
    try {
      const isConnected = this.isSignedIn();
      const tokenExpiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
      const expiresAt = tokenExpiry ? new Date(parseInt(tokenExpiry)) : undefined;
      
      return { isConnected, expiresAt };
    } catch (error) {
      console.error('Error getting connection status:', error);
      return { isConnected: false };
    }
  }
}

// Create singleton instance
const googleDriveService = new GoogleDriveService();
export default googleDriveService;
