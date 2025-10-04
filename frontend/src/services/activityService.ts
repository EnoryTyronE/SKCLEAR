import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, limit, where, Timestamp, startAfter, DocumentSnapshot } from 'firebase/firestore';

export interface Activity {
  id?: string;
  type: 'budget' | 'abyip' | 'cbydp' | 'setup' | 'transparency' | 'user_management' | 'projects';
  title: string;
  description: string;
  member: {
    name: string;
    role: string;
    id: string;
  };
  timestamp: Date;
  status: 'completed' | 'ongoing' | 'pending';
  module: string;
  details?: any; // Additional context data
}

// Log a new activity
export const logActivity = async (activity: Omit<Activity, 'id' | 'timestamp'>) => {
  try {
    const activityData = {
      ...activity,
      timestamp: Timestamp.fromDate(new Date()),
      createdAt: new Date()
    };
    
    console.log('Logging activity to Firebase:', activityData);
    const docRef = await addDoc(collection(db, 'activities'), activityData);
    console.log('Activity logged successfully with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error logging activity:', error);
    console.error('Activity data that failed:', activity);
    throw error;
  }
};

// Get recent activities
export const getRecentActivities = async (limitCount: number = 10): Promise<Activity[]> => {
  try {
    console.log('Fetching recent activities from Firebase...');
    const q = query(
      collection(db, 'activities'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const activities: Activity[] = [];
    
    console.log('Found', querySnapshot.size, 'activities in Firebase');
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('Processing activity:', doc.id, data);
      activities.push({
        id: doc.id,
        type: data.type,
        title: data.title,
        description: data.description,
        member: data.member,
        timestamp: data.timestamp?.toDate() || new Date(),
        status: data.status,
        module: data.module,
        details: data.details
      });
    });
    
    console.log('Returning activities:', activities);
    return activities;
  } catch (error) {
    console.error('Error fetching activities:', error);
    return [];
  }
};

// Get all activities with filtering and pagination
export const getAllActivities = async (
  filters?: {
    module?: string;
    memberId?: string;
    status?: string; // kept for future use
    dateFrom?: Date;
    dateTo?: Date;
  },
  pageSize: number = 50,
  lastDoc?: DocumentSnapshot
): Promise<{ activities: Activity[]; lastDoc?: DocumentSnapshot; hasMore: boolean }> => {
  try {
    console.log('Fetching all activities with filters:', filters);

    const hasAnyFilter = Boolean(
      (filters && (
        (filters.module && filters.module !== '') ||
        (filters.memberId && filters.memberId !== '') ||
        filters.status || filters.dateFrom || filters.dateTo
      ))
    );

    // Strategy:
    // - If no filters: use paginated server query (orderBy timestamp desc)
    // - If any filters: fetch a larger window and filter client-side to avoid composite indexes
    const effectivePageSize = hasAnyFilter ? Math.max(pageSize, 200) : pageSize; // larger window when filtering

    let q = query(
      collection(db, 'activities'),
      orderBy('timestamp', 'desc'),
      limit(effectivePageSize + 1)
    );

    // Only use cursor pagination when NOT filtering
    if (!hasAnyFilter && lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const querySnapshot = await getDocs(q);
    const fetched: Activity[] = [];

    let hasMore = false;
    let newLastDoc: DocumentSnapshot | undefined;

    let index = 0;
    querySnapshot.forEach((doc) => {
      if (index < effectivePageSize) {
        const data = doc.data();
        fetched.push({
          id: doc.id,
          type: data.type,
          title: data.title,
          description: data.description,
          member: data.member || { name: 'Unknown', role: 'Unknown', id: '' },
          timestamp: data.timestamp?.toDate() || new Date(),
          status: data.status,
          module: data.module,
          details: data.details
        });
        newLastDoc = doc;
      } else {
        hasMore = true;
      }
      index++;
    });

    // Apply client-side filtering when any filter is set
    let filteredActivities = fetched;

    if (hasAnyFilter) {
      if (filters?.module) {
        filteredActivities = filteredActivities.filter(activity => activity.module === filters.module);
      }
      if (filters?.status) {
        filteredActivities = filteredActivities.filter(activity => activity.status === filters.status);
      }
      if (filters?.memberId) {
        filteredActivities = filteredActivities.filter(activity => activity.member.id === filters.memberId);
      }
      if (filters?.dateFrom) {
        const dateFromStart = new Date(filters.dateFrom);
        dateFromStart.setHours(0, 0, 0, 0); // Start of day
        filteredActivities = filteredActivities.filter(activity => activity.timestamp >= dateFromStart);
      }
      if (filters?.dateTo) {
        const dateToEnd = new Date(filters.dateTo);
        dateToEnd.setHours(23, 59, 59, 999); // End of day
        filteredActivities = filteredActivities.filter(activity => activity.timestamp <= dateToEnd);
      }

      // When filtering, pagination via lastDoc isn't reliable; return hasMore=false
      hasMore = false;
      newLastDoc = undefined;
    }

    return { activities: filteredActivities, lastDoc: newLastDoc, hasMore };
  } catch (error) {
    console.error('Error fetching all activities:', error);
    console.error('Error details:', {
      filters,
      pageSize,
      lastDoc: lastDoc?.id,
      error: error instanceof Error ? error.message : String(error)
    });
    return { activities: [], hasMore: false };
  }
};

// Helper functions for common activities
export const logBudgetActivity = async (
  action: string,
  details: string,
  member: { name: string; role: string; id: string },
  status: 'completed' | 'ongoing' | 'pending' = 'completed'
) => {
  return logActivity({
    type: 'budget',
    title: `Budget ${action}`,
    description: details,
    member,
    status,
    module: 'Budget'
  });
};

export const logABYIPActivity = async (
  action: string,
  details: string,
  member: { name: string; role: string; id: string },
  status: 'completed' | 'ongoing' | 'pending' = 'completed'
) => {
  return logActivity({
    type: 'abyip',
    title: `ABYIP ${action}`,
    description: details,
    member,
    status,
    module: 'ABYIP'
  });
};

export const logCBYDPActivity = async (
  action: string,
  details: string,
  member: { name: string; role: string; id: string },
  status: 'completed' | 'ongoing' | 'pending' = 'completed'
) => {
  return logActivity({
    type: 'cbydp',
    title: `CBYDP ${action}`,
    description: details,
    member,
    status,
    module: 'CBYDP'
  });
};

export const logSetupActivity = async (
  action: string,
  details: string,
  member: { name: string; role: string; id: string },
  status: 'completed' | 'ongoing' | 'pending' = 'completed'
) => {
  return logActivity({
    type: 'setup',
    title: `SK Setup ${action}`,
    description: details,
    member,
    status,
    module: 'SK Setup'
  });
};

export const logTransparencyActivity = async (
  action: string,
  details: string,
  member: { name: string; role: string; id: string },
  status: 'completed' | 'ongoing' | 'pending' = 'completed'
) => {
  return logActivity({
    type: 'transparency',
    title: `Transparency ${action}`,
    description: details,
    member,
    status,
    module: 'Transparency'
  });
};

export const logProjectActivity = async (
  action: string,
  details: string,
  member: { name: string; role: string; id: string },
  status: 'completed' | 'ongoing' | 'pending' = 'completed'
) => {
  return logActivity({
    type: 'projects',
    title: `Project ${action}`,
    description: details,
    member,
    status,
    module: 'Projects'
  });
};

// Convert Firestore timestamp to Date
export const convertToDate = (firebaseTimestamp: any): Date | null => {
  if (!firebaseTimestamp) return null;
  if (firebaseTimestamp instanceof Date) return firebaseTimestamp;
  if (typeof firebaseTimestamp.toDate === 'function') return firebaseTimestamp.toDate();
  if (typeof firebaseTimestamp === 'string' || typeof firebaseTimestamp === 'number') {
    const date = new Date(firebaseTimestamp);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
};

// Format time ago
export const formatTimeAgo = (date: Date | null | undefined): string => {
  if (!date) return 'N/A';
  if (!(date instanceof Date) || isNaN(date.getTime())) return 'Invalid Date';
  
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else {
    const weeks = Math.floor(diffInSeconds / 604800);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
};
