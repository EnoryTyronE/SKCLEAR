import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, limit, Timestamp } from 'firebase/firestore';

export interface Activity {
  id?: string;
  type: 'budget' | 'abyip' | 'cbydp' | 'setup' | 'transparency' | 'user_management';
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

// Format time ago
export const formatTimeAgo = (date: Date): string => {
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
