
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
   match /dashboard/{document=**} {
      allow read: if true;
      allow write: if true;
    }

    function isSignedIn() {
      return request.auth != null;
    }
    
    function getRole() {
      return isSignedIn() ? get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role : null;
    }
    
    function isAdmin() {
      return getRole() == 'admin';
    }
    
    function isUtility() {
      return getRole() in ['utility staff', 'utility_staff', 'utility', 'utility-staff'];
    }

    // Users collection
    match /users/{userId} {
      allow read: if isSignedIn() && (request.auth.uid == userId || isAdmin());
      allow create: if isSignedIn() && request.auth.uid == userId;
      allow update: if isSignedIn() && (request.auth.uid == userId || isAdmin());
      allow delete: if isSignedIn() && (isAdmin() || request.auth.uid == userId);
    }

    // Usernames (identifier -> uid mapping)
    match /usernames/{identifier} {
      allow read: if true;
      allow create: if isSignedIn() && request.resource.data.uid == request.auth.uid && request.resource.data.email == request.auth.token.email;
      allow update: if isSignedIn() && resource.data.uid == request.auth.uid;
      allow delete: if isSignedIn() && (isAdmin() || resource.data.uid == request.auth.uid);
      allow delete: if isAdmin() || (isSignedIn() && resource.data.uid == request.auth.uid);
    }

    // Serials
    match /serials/{serialId} {
      allow read: if isSignedIn();
      allow create, update: if isSignedIn() && (isUtility() || isAdmin());
      allow delete: if isSignedIn() && isAdmin();
    }

    // Settings (for global counters like settings/serials)
    match /settings/{docId} {
        allow read: if isSignedIn();
        allow write: if isSignedIn() && (isAdmin() || isUtility());
    }

    // Bins collection
    match /bins/{binId} {
      // Read: admins and utility staff can read bins
      allow read: if isSignedIn() && (isAdmin() || isUtility());

      // Create: utility staff and admins can create bins
      allow create: if isSignedIn() && (isUtility() || isAdmin());

      // Update: both admins and utility staff can update any bin
      allow update: if isSignedIn() && (isAdmin() || isUtility());

      // Delete: both admins and utility staff can delete bins (needed for moving to archive)
      allow delete: if isSignedIn() && (isAdmin() || isUtility());
    }

    // Archive collection (NEW)
    match /archive/{binId} {
      // Read: admins and utility staff can read archived bins
      allow read: if isSignedIn() && (isAdmin() || isUtility());

      // Create: utility staff and admins can create archive entries (when removing bins)
      allow create: if isSignedIn() && (isUtility() || isAdmin());

      // Update: admins and utility staff can update archived bins (for restore operations)
      allow update: if isSignedIn() && (isAdmin() || isUtility());

      // Delete: admins can delete anything, utility staff can delete only 'Restored' (auto-cleanup)
      allow delete: if isSignedIn() && (isAdmin() || (isUtility() && resource.data.status == 'Restored'));
    }

    // Deleted collection (for permanent deletion tracking)
    match /deleted/{binId} {
      // Read: only admins can read deleted bins
      allow read: if isSignedIn() && isAdmin();

      // Create: only admins can move bins to deleted
      allow create: if isSignedIn() && isAdmin();

      // Update: only admins can update deleted bins
      allow update: if isSignedIn() && isAdmin();

      // Delete: only admins can permanently delete (auto-cleanup)
      allow delete: if isSignedIn() && isAdmin();
    }

    // Hazardous Detections (MISSING PREVIOUSLY)
    match /hazardous_detections/{detectionId} {
      allow read: if isSignedIn() && (isAdmin() || isUtility());
      // Server writes to this, so client write permissions are not strictly needed unless testing
      allow create: if false; 
      allow update: if false;
    }

    // Account Archive (for users archiving their own accounts)
    match /account_archive/{userId} {
      // Allow users to create/write their own archive record
      allow create, update: if isSignedIn() && request.auth.uid == userId;
      allow read, delete: if isSignedIn() && isAdmin();
    }

    // Notifications collection (for fill-level alerts and system notifications)
    match /notifications/{notificationId} {
      // Read: admins and utility staff can read notifications
      allow read: if isSignedIn() && (isAdmin() || isUtility());
      
      // Create: admins and utility staff can create notifications
      allow create: if isSignedIn() && (isAdmin() || isUtility());
      
      // Update: admins and utility staff can update notifications (e.g., to dismiss them)
      allow update: if isSignedIn() && (isAdmin() || isUtility());
      
      // Delete: only admins can delete notifications
      allow delete: if isSignedIn() && isAdmin();
    }
  }
}
```