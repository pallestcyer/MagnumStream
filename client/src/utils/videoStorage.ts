// IndexedDB utility for storing large video files
const DB_NAME = 'MagnumStreamVideos';
const DB_VERSION = 2; // Incremented to add sessionId index
const STORE_NAME = 'recordings';

interface VideoRecord {
  id: string;
  sessionId: string; // Customer names combined as session identifier
  sceneType: 'cruising' | 'chase' | 'arrival';
  cameraAngle: 1 | 2;
  blob: Blob;
  duration: number;
  createdAt: Date;
}

class VideoStorage {
  private db: IDBDatabase | null = null;


  // Set current session (called when customer info is submitted or resuming project)
  setCurrentSession(customerNames: string, isNewProject: boolean = true): void {
    // Create session ID from customer names (sanitized)
    const sessionId = customerNames.toLowerCase().replace(/[^a-z0-9\s&]/g, '').replace(/\s+/g, '_');
    const previousSessionId = localStorage.getItem('currentSessionId');
    
    if (previousSessionId && previousSessionId !== sessionId) {
      console.log('🔄 Switching from session', previousSessionId, 'to', sessionId);
      // Clear previous session's scene completion status
      this.clearSceneCompletionStatus(previousSessionId);
    }
    
    if (isNewProject) {
      // Clear completion status for new projects to start fresh
      this.clearSceneCompletionStatus(sessionId);
      console.log('🧹 Cleared completion status for new project:', sessionId);

      // CRITICAL: Always clear recording ID for new projects, even if session ID is the same
      // This prevents updating a previous completed recording when starting a new one for the same pilot
      localStorage.removeItem('currentRecordingId');
      console.log('🧹 Cleared recording ID for fresh start');
    } else {
      console.log('🔄 Resuming existing project session:', sessionId);
    }
    
    localStorage.setItem('currentSessionId', sessionId);
    console.log('📋 Set current session to:', sessionId);
  }

  // Clear scene completion status for a session
  private clearSceneCompletionStatus(sessionId: string): void {
    const sceneTypes = ['cruising', 'chase', 'arrival'];
    sceneTypes.forEach(sceneType => {
      const completionKey = `scene_completed_${sessionId}_${sceneType}`;
      localStorage.removeItem(completionKey);
    });
    console.log(`🗑️ Cleared scene completion status for session: ${sessionId}`);
  }

  // Clear current session (useful for starting completely fresh)
  clearCurrentSession(): void {
    const currentSessionId = localStorage.getItem('currentSessionId');
    if (currentSessionId) {
      this.clearSceneCompletionStatus(currentSessionId);
    }
    localStorage.removeItem('currentSessionId');
    console.log('🗑️ Cleared current session');
  }

  // Update project status in database via API
  async updateProjectStatus(status: 'recorded' | 'in_progress' | 'exported'): Promise<void> {
    const sessionId = this.getCurrentSessionId();
    const customerName = sessionId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    try {
      // Map our status to export_status field
      const exportStatus = status === 'exported' ? 'completed' : status === 'recorded' ? 'recorded' : 'in_progress';

      // Get pilot info from context
      const pilotEmail = localStorage.getItem('pilotEmail') || '';
      const staffMember = localStorage.getItem('staffMember') || '';
      const currentDate = new Date().toISOString().split('T')[0];
      const currentTime = new Date().toTimeString().split(' ')[0];

      // Check if we already have a recording ID for this session
      const existingRecordingId = localStorage.getItem('currentRecordingId');

      let response;
      if (existingRecordingId) {
        // UPDATE existing recording
        console.log(`📊 Updating existing recording: ${existingRecordingId} with status: ${status}`);
        response = await fetch(`/api/recordings/${existingRecordingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exportStatus: exportStatus,
          })
        });
      } else {
        // CREATE new recording
        console.log(`📊 Creating new recording for session: ${sessionId} with status: ${status}`);
        response = await fetch('/api/recordings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectName: `${customerName} Flight`,
            pilotName: customerName,
            pilotEmail: pilotEmail,
            staffMember: staffMember,
            flightDate: currentDate,
            flightTime: currentTime,
            exportStatus: exportStatus,
            sessionId: sessionId
          })
        });
      }

      if (response.ok) {
        const recording = await response.json();
        console.log(`📊 Updated project ${sessionId} status to: ${status}`, recording);

        // Store the recording ID if we don't have one yet
        if (!existingRecordingId) {
          console.log(`📊 Setting initial recording ID: ${recording.id}`);
          localStorage.setItem('currentRecordingId', recording.id);
        }
      } else {
        console.error('❌ Failed to update project status:', response.statusText);
      }
    } catch (error) {
      console.error('❌ Failed to update project status:', error);
    }
  }

  // Get current session ID (make it public for external access)
  getCurrentSessionId(): string {
    const sessionId = localStorage.getItem('currentSessionId');
    if (sessionId) {
      return sessionId;
    }
    
    const fallbackId = `session_${Date.now()}`;
    localStorage.setItem('currentSessionId', fallbackId);
    return fallbackId;
  }

  // Set project status (for backward compatibility)
  setProjectStatus(_sessionId: string, status: 'recorded' | 'in_progress' | 'exported'): void {
    this.updateProjectStatus(status);
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = (event.target as IDBOpenDBRequest).transaction!;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          store.createIndex('sceneType', 'sceneType', { unique: false });
          store.createIndex('cameraAngle', 'cameraAngle', { unique: false });
          console.log('📦 Created IndexedDB store for video recordings');
        } else {
          // Store exists, check if we need to add sessionId index
          const store = transaction.objectStore(STORE_NAME);
          if (!store.indexNames.contains('sessionId')) {
            store.createIndex('sessionId', 'sessionId', { unique: false });
            console.log('📦 Added sessionId index to existing store');
          }
        }
      };
    });
  }

  async storeVideo(
    sceneType: 'cruising' | 'chase' | 'arrival',
    cameraAngle: 1 | 2,
    blob: Blob,
    duration: number
  ): Promise<string> {
    if (!this.db) {
      await this.init();
    }

    const sessionId = this.getCurrentSessionId();
    const id = `${sessionId}_${sceneType}_camera${cameraAngle}_${Date.now()}`;
    const record: VideoRecord = {
      id,
      sessionId,
      sceneType,
      cameraAngle,
      blob,
      duration,
      createdAt: new Date()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);

      request.onsuccess = () => {
        console.log(`💾 Stored ${sceneType} camera ${cameraAngle} video (${blob.size} bytes) for session ${sessionId}`);
        console.log(`🔍 Stored record details:`, { id, sessionId, sceneType, cameraAngle, duration, blobSize: blob.size });
        resolve(id);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getVideo(sceneType: 'cruising' | 'chase' | 'arrival', cameraAngle: 1 | 2): Promise<Blob | null> {
    if (!this.db) {
      await this.init();
    }

    const currentSessionId = this.getCurrentSessionId();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      // First try current session, then fall back to any session with this scene type
      if (store.indexNames.contains('sessionId')) {
        const index = store.index('sessionId');
        const request = index.getAll(currentSessionId);

        request.onsuccess = () => {
          const records: VideoRecord[] = request.result;
          console.log(`🔍 Found ${records.length} records for session ${currentSessionId}:`, records.map(r => ({ id: r.id, sceneType: r.sceneType, cameraAngle: r.cameraAngle, sessionId: r.sessionId || 'undefined' })));
          
          // Debug: Show breakdown by scene type
          const sceneBreakdown = records.reduce((acc, r) => {
            acc[r.sceneType] = (acc[r.sceneType] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          console.log(`🔍 Scene type breakdown for session ${currentSessionId}:`, sceneBreakdown);
          
          const match = records
            .filter(r => r.sceneType === sceneType && r.cameraAngle === cameraAngle)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]; // Get latest

          if (match) {
            console.log(`📹 Retrieved ${sceneType} camera ${cameraAngle} video for session ${currentSessionId}:`, {
              size: match.blob.size,
              type: match.blob.type,
              createdAt: match.createdAt,
              duration: match.duration
            });
            resolve(match.blob);
          } else {
            console.log(`📹 No video found for ${sceneType} camera ${cameraAngle} in current session ${currentSessionId}`);
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      } else {
        // No sessionId index available, assume no videos for current session
        console.log(`📹 No sessionId index available, returning null for ${sceneType} camera ${cameraAngle}`);
        resolve(null);
      }
    });
  }


  async getVideoDuration(sceneType: 'cruising' | 'chase' | 'arrival'): Promise<number | null> {
    if (!this.db) {
      await this.init();
    }

    const currentSessionId = this.getCurrentSessionId();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      // Only use sessionId index, don't fall back to old records
      if (store.indexNames.contains('sessionId')) {
        const index = store.index('sessionId');
        const request = index.getAll(currentSessionId);

        request.onsuccess = () => {
          const records: VideoRecord[] = request.result;
          const sceneRecords = records.filter(r => r.sceneType === sceneType);
          console.log(`⏱️ Found ${sceneRecords.length} duration records for ${sceneType} in session ${currentSessionId}`);
          console.log(`⏱️ DEBUG: Scene records for ${sceneType}:`, sceneRecords.map(r => ({
            id: r.id,
            sessionId: r.sessionId,
            sceneType: r.sceneType,
            cameraAngle: r.cameraAngle,
            duration: r.duration,
            createdAt: r.createdAt
          })));
          
          if (sceneRecords.length > 0) {
            const latest = sceneRecords.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
            console.log(`⏱️ Returning duration ${latest.duration} for ${sceneType} (from record ${latest.id})`);
            resolve(latest.duration);
          } else {
            console.log(`⏱️ No duration found for ${sceneType} in current session`);
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      } else {
        // No sessionId index available, assume no videos for current session
        console.log(`⏱️ No sessionId index available, returning null duration for ${sceneType}`);
        resolve(null);
      }
    });
  }

  async clearScene(sceneType: 'cruising' | 'chase' | 'arrival'): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    const currentSessionId = this.getCurrentSessionId();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('sessionId');
      const request = index.getAll(currentSessionId);

      request.onsuccess = () => {
        const records: VideoRecord[] = request.result;
        const sceneRecords = records.filter(r => r.sceneType === sceneType);
        const deletePromises = sceneRecords.map(record => {
          return new Promise<void>((deleteResolve, deleteReject) => {
            const deleteRequest = store.delete(record.id);
            deleteRequest.onsuccess = () => deleteResolve();
            deleteRequest.onerror = () => deleteReject(deleteRequest.error);
          });
        });

        Promise.all(deletePromises)
          .then(() => {
            console.log(`🗑️ Cleared ${sceneRecords.length} videos for ${sceneType} scene in session ${currentSessionId}`);
            resolve();
          })
          .catch(reject);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllStorageInfo(): Promise<{ scene: string; cameras: number; totalSize: number }[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records: VideoRecord[] = request.result;
        const sceneStats = ['cruising', 'chase', 'arrival'].map(scene => {
          const sceneRecords = records.filter(r => r.sceneType === scene);
          const cameras = new Set(sceneRecords.map(r => r.cameraAngle)).size;
          const totalSize = sceneRecords.reduce((sum, r) => sum + r.blob.size, 0);
          return { scene, cameras, totalSize };
        });
        resolve(sceneStats);
      };
      request.onerror = () => reject(request.error);
    });
  }


  // Debug function to show all records in IndexedDB
  async debugAllRecords(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records: VideoRecord[] = request.result;
        console.log(`🔍 DEBUG: All ${records.length} records in IndexedDB:`, records.map(r => ({
          id: r.id,
          sessionId: r.sessionId,
          sceneType: r.sceneType,
          cameraAngle: r.cameraAngle,
          blobSize: r.blob.size,
          duration: r.duration,
          createdAt: r.createdAt
        })));
        
        const sessionBreakdown = records.reduce((acc, r) => {
          acc[r.sessionId] = (acc[r.sessionId] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log(`🔍 DEBUG: Session breakdown:`, sessionBreakdown);
        
        const sceneBreakdown = records.reduce((acc, r) => {
          acc[r.sceneType] = (acc[r.sceneType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log(`🔍 DEBUG: Scene type breakdown:`, sceneBreakdown);
        
        resolve();
      };
      request.onerror = () => resolve();
    });
  }

  // Get the local device URL for direct video uploads
  private async getLocalDeviceUrl(): Promise<string> {
    try {
      // Try to get local device URL from health endpoint
      const healthResponse = await fetch('/api/health');
      console.log('📡 Health endpoint response status:', healthResponse.status);
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        console.log('📡 Health endpoint data:', healthData);
        
        if (healthData.services?.localDevice) {
          console.log('📡 Found local device URL:', healthData.services.localDevice);
          return healthData.services.localDevice;
        } else {
          console.warn('📡 No localDevice URL in health response');
        }
      }
    } catch (error) {
      console.warn('Could not get local device URL from health endpoint:', error);
    }
    
    // Fallback to localhost in development (Mac service runs on port 3001)
    const fallbackUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '';
    console.log('📡 Using fallback URL:', fallbackUrl);
    return fallbackUrl;
  }

  // Upload all videos for current session to the server for FFmpeg processing
  async uploadSessionVideosToServer(recordingId: string): Promise<boolean> {
    if (!this.db) {
      await this.init();
    }

    const currentSessionId = this.getCurrentSessionId();
    console.log(`📤 Uploading videos for session ${currentSessionId} to server...`);
    
    const localDeviceUrl = await this.getLocalDeviceUrl();
    if (!localDeviceUrl) {
      throw new Error('Local device URL not available for video uploads');
    }
    console.log(`📤 Using local device URL: ${localDeviceUrl}`);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      if (store.indexNames.contains('sessionId')) {
        const index = store.index('sessionId');
        const request = index.getAll(currentSessionId);

        request.onsuccess = async () => {
          const records: VideoRecord[] = request.result;
          console.log(`📤 Found ${records.length} videos to upload for session ${currentSessionId}`);
          
          try {
            // Upload each video to the server
            const uploadPromises = records.map(async (record) => {
              const formData = new FormData();
              formData.append('video', record.blob, `${record.sceneType}_camera${record.cameraAngle}.mp4`);
              formData.append('sceneType', record.sceneType);
              formData.append('cameraAngle', record.cameraAngle.toString());
              formData.append('duration', record.duration.toString());
              formData.append('sessionId', currentSessionId);

              // Upload directly to local device
              const response = await fetch(`${localDeviceUrl}/api/recordings/${recordingId}/upload-scene-video`, {
                method: 'POST',
                body: formData
              });

              if (!response.ok) {
                throw new Error(`Failed to upload ${record.sceneType} camera ${record.cameraAngle}: ${response.statusText}`);
              }

              const result = await response.json();
              console.log(`✅ Uploaded ${record.sceneType} camera ${record.cameraAngle}:`, result);
              return result;
            });

            await Promise.all(uploadPromises);
            console.log(`🎉 Successfully uploaded all ${records.length} videos for session ${currentSessionId}`);
            resolve(true);
            
          } catch (error) {
            console.error('❌ Failed to upload videos:', error);
            reject(error);
          }
        };

        request.onerror = () => reject(request.error);
      } else {
        console.warn('📤 No sessionId index available, cannot upload videos');
        resolve(false);
      }
    });
  }
}

// Export singleton instance
export const videoStorage = new VideoStorage();