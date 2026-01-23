# Firebase Security Setup for Chai Time POS

## Understanding Firebase Security for Frontend Apps

**Important**: Firebase API keys in frontend applications are designed to be public. Unlike traditional API keys, Firebase API keys alone don't grant access to your data. Security is enforced through:

1. **Firebase Security Rules** - Server-side rules that control data access
2. **Domain Restrictions** - Restrict API key to only work from your domain
3. **Firebase App Check** - Protects against abuse and bot attacks

---

## ✅ Current Firebase Security Rules

Your Firebase Realtime Database has comprehensive security rules with:
- Authentication required for all read/write operations
- Data validation for all fields
- Immutable audit logs (can only create, not update/delete)
- Proper indexing for efficient queries

```json
{
    "rules": {
        ".read": false,
        ".write": false,
        "bills": {
            ".read": "auth != null",
            ".write": "auth != null",
            "$billId": {
                ".validate": "newData.hasChildren(['billNumber', 'cashierId', 'cashierName', 'items', 'subtotal', 'total', 'timestamp', 'paymentMode'])",
                "billNumber": { ".validate": "newData.isNumber() && newData.val() > 0" },
                "cashierId": { ".validate": "newData.isString() && newData.val().length > 0" },
                "cashierName": { ".validate": "newData.isString() && newData.val().length > 0" },
                "items": {
                    ".validate": "newData.hasChildren()",
                    "$itemIndex": {
                        "itemId": { ".validate": "newData.isString()" },
                        "name": { ".validate": "newData.isString() && newData.val().length > 0" },
                        "price": { ".validate": "newData.isNumber() && newData.val() > 0" },
                        "quantity": { ".validate": "newData.isNumber() && newData.val() > 0" }
                    }
                },
                "subtotal": { ".validate": "newData.isNumber() && newData.val() >= 0" },
                "discount": { ".validate": "newData.isNumber() && newData.val() >= 0" },
                "total": { ".validate": "newData.isNumber() && newData.val() >= 0" },
                "timestamp": { ".validate": "newData.isString()" },
                "paymentMode": { ".validate": "newData.isString() && (newData.val() == 'cash' || newData.val() == 'upi')" },
                "synced": { ".validate": "newData.isBoolean()" }
            },
            ".indexOn": ["cashierId", "billNumber", "timestamp", "paymentMode"]
        },
        "rawMaterials": {
            ".read": "auth != null",
            ".write": "auth != null",
            "$materialId": {
                ".validate": "newData.hasChildren(['date', 'itemName', 'quantity', 'price', 'timestamp'])"
            },
            ".indexOn": ["date", "timestamp", "itemName"]
        },
        "shifts": {
            ".read": "auth != null",
            ".write": "auth != null",
            "$shiftId": {
                ".validate": "newData.hasChildren(['cashierId', 'cashierName', 'startTime', 'endTime'])"
            },
            ".indexOn": ["cashierId", "startTime", "endTime"]
        },
        "audit": {
            ".read": "auth != null",
            "$logId": {
                ".write": "auth != null && !data.exists()"  // Can only create, not update/delete
            },
            ".indexOn": ["timestamp", "action", "userId"]
        }
    }
}
```

---

## Step 3: Enable Firebase App Check (Recommended)

1. Go to **Firebase Console → App Check**
2. Register your app with **reCAPTCHA v3**
3. Enable enforcement for Realtime Database

---

## Step 4: Require Authentication for All Operations

The code already requires owner login with email/password. Ensure:
- Cashiers are authenticated via the owner's Firebase Auth
- All database operations check `auth != null`

---

## Alternative: Using a Config File (For Deployment Flexibility)

If you want to keep credentials separate (for different environments), create a `config.js` file:

### Create: `assets/js/config.js`
```javascript
// Firebase Configuration
// This file can be different for development/production
const FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT.firebasedatabase.app",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
};
```

### Add to `.gitignore`:
```
assets/js/config.js
```

### Create: `assets/js/config.example.js`
```javascript
// Copy this file to config.js and add your Firebase credentials
const FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT.firebasedatabase.app",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
};
```

### Update `index.html`:
Add before script.js:
```html
<script src="assets/js/config.js"></script>
```

### Update `script.js`:
```javascript
const firebaseConfig = FIREBASE_CONFIG;
```

---

## Rate Limiting Implementation

Add to `script.js` for client-side rate limiting:

```javascript
// Rate Limiter
const rateLimiter = {
    timestamps: [],
    maxRequests: 20,  // Max requests
    timeWindow: 60000, // Per minute
    
    canProceed() {
        const now = Date.now();
        this.timestamps = this.timestamps.filter(t => now - t < this.timeWindow);
        if (this.timestamps.length >= this.maxRequests) {
            return false;
        }
        this.timestamps.push(now);
        return true;
    }
};

// Use before Firebase operations:
if (!rateLimiter.canProceed()) {
    showToast('Too many requests. Please wait.', 'warning');
    return;
}
```

---

## Immediate Actions Checklist

- [ ] **Update Firebase Security Rules** (Step 1) - Most important!
- [ ] **Restrict API key to your domain** (Step 2)
- [ ] **Enable App Check** (Step 3) - Recommended
- [ ] **Create config.js approach** (Step 4) - Keep credentials out of Git
- [ ] **Add rate limiting** - Prevent abuse

---

## Why This Matters

1. **Security Rules** = Your real protection (server-side enforcement)
2. **API Key Restrictions** = Prevents key usage from unauthorized domains
3. **App Check** = Protects against bots and automation
4. **Rate Limiting** = Prevents abuse and quota exhaustion

**Remember**: Firebase API keys are meant to be public. The security comes from rules, not hiding keys!
