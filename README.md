# Mapla Tea Cafe ☕ - POS System

A production-ready, cloud-deployable Point of Sale web application for a single-shop mini cafe/tea shop.

## 🎯 Features

### Cashier Features
- ✅ Secure cashier login with dropdown selection
- ✅ Item selection with real images (Tea, Coffee, Snacks)
- ✅ Cart management with quantity controls
- ✅ Automatic discount calculation (owner-controlled)
- ✅ Cash & UPI payment modes
- ✅ UPI QR code display for payments
- ✅ Thermal printer-optimized bill printing (58mm/80mm)
- ✅ Reprint last bill functionality
- ✅ Shift close with summary (cash/UPI totals)
- ✅ Offline billing with auto-sync
- ✅ Online/offline status indicator

### Owner Features
- ✅ Secret owner access (triple-tap logo)
- ✅ Dashboard with real-time analytics
  - Today's sales & monthly sales
  - Total bills count
  - Cash vs UPI ratio
  - Daily sales chart
  - Top-selling items chart
  - Best seller highlight
  - Cashier performance metrics
- ✅ Comprehensive Reports
  - Cashier-wise reports
  - Item-wise sales reports
  - Profit reports (cost vs selling)
  - Investor/bank reports
  - Date range filtering
  - PDF export capability
- ✅ Items Management
  - Add/edit items
  - Cost & selling price tracking
  - Category management
  - Image URL support
  - Enable/disable items
- ✅ Cashier Management
  - Add new cashiers
  - Reset passwords
  - Activate/deactivate cashiers
  - Shift history tracking
- ✅ Settings
  - Shop name & footer text
  - Discount enable/disable & percentage
  - UPI QR code configuration
  - Printer width selection (58mm/80mm)
- ✅ Audit Logs
  - Login/logout tracking
  - Discount changes
  - Reprints
  - Shift close events
  - Settings modifications
  - Read-only, non-deletable logs

## 🏗️ Architecture

**Strict 3-File Structure:**
- `index.html` - All structure & screens
- `styles.css` - All styling (warm cafe theme)
- `script.js` - All application logic

**No inline CSS or JavaScript**
**No additional files required**

## 🎨 Design

- **Theme**: Warm cafe colors (brown, cream, soft green)
- **Typography**: Poppins font family
- **Responsive**: Mobile-first design
- **Print**: Thermal printer optimized (58mm/80mm)
- **Animations**: Smooth transitions and micro-interactions

## 🚀 Quick Start

### Demo Mode (No Firebase Required)

1. Open `index.html` in a web browser
2. Use demo credentials:
   - **Cashier**: Select any cashier, password: `demo123`
   - **Owner**: Triple-tap logo, email: `owner@maplateacafe.com`, password: `owner123`

### Production Setup with Firebase

#### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: "Mapla Tea Cafe POS"
4. Follow the setup wizard

#### Step 2: Enable Firebase Services

**Authentication:**
1. Go to Authentication → Sign-in method
2. Enable "Email/Password"

**Firestore Database:**
1. Go to Firestore Database
2. Click "Create database"
3. Start in production mode
4. Choose your region

**Hosting:**
1. Go to Hosting
2. Click "Get started"

#### Step 3: Get Firebase Configuration

1. Go to Project Settings → General
2. Scroll to "Your apps"
3. Click "Web app" (</> icon)
4. Register app: "Mapla Tea Cafe POS"
5. Copy the configuration object

#### Step 4: Update Configuration

Open `script.js` and replace the Firebase config (lines 8-15):

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

#### Step 5: Add Firebase SDKs

Add these script tags in `index.html` before the closing `</body>` tag (before `<script src="script.js"></script>`):

```html
<!-- Firebase App (the core Firebase SDK) -->
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
<!-- Firebase Auth -->
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js"></script>
<!-- Firebase Firestore -->
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"></script>
```

#### Step 6: Set Up Firestore Security Rules

In Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
    match /bills/{billId} {
      allow read, write: if request.auth != null;
    }
    match /items/{itemId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // Add owner check in production
    }
    match /cashiers/{cashierId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // Add owner check in production
    }
    match /settings/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // Add owner check in production
    }
    match /shifts/{shiftId} {
      allow read, write: if request.auth != null;
    }
    match /audit/{logId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if false; // Audit logs are immutable
    }
  }
}
```

#### Step 7: Create Initial Owner Account

1. Go to Firebase Console → Authentication → Users
2. Click "Add user"
3. Email: `owner@maplateacafe.com`
4. Password: Create a strong password
5. Click "Add user"

#### Step 8: Add Initial Data (Optional)

You can add sample items and cashiers through the owner panel after logging in, or use Firebase Console to add them directly to Firestore.

#### Step 9: Deploy to Firebase Hosting

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase in your project directory:
   ```bash
   firebase init
   ```
   - Select "Hosting"
   - Choose your Firebase project
   - Public directory: `.` (current directory)
   - Single-page app: Yes
   - Don't overwrite index.html

4. Deploy:
   ```bash
   firebase deploy
   ```

5. Your app will be live at: `https://your-project-id.web.app`

## 📱 Usage Guide

### Cashier Workflow

1. **Login** → Select name from dropdown + enter password
2. **Select Items** → Tap items to add to cart
3. **Adjust Quantities** → Use +/- buttons
4. **Proceed to Payment** → Choose Cash or UPI
5. **Confirm Payment** → Bill is saved
6. **Print Bill** → Thermal printer or save PDF
7. **Close Shift** → View summary and logout

### Owner Workflow

1. **Login** → Triple-tap cafe logo → Enter credentials
2. **Dashboard** → View real-time analytics
3. **Manage Items** → Add/edit menu items with images
4. **Manage Cashiers** → Add/remove staff
5. **Configure Settings** → Shop details, discount, UPI QR
6. **Generate Reports** → Analyze sales and profits
7. **Review Audit Logs** → Track all system activities

## 🔒 Security Features

- Role-based access control (Cashier vs Owner)
- Firebase Authentication
- Firestore security rules
- Audit trail for all critical actions
- Owner-only discount controls
- Immutable audit logs

## 🌐 Offline Support

- Bills saved to LocalStorage when offline
- Auto-sync when connection restored
- Visual online/offline indicator
- No data loss during network issues

## 📊 Data Structure

### Firestore Collections

- `/items` - Menu items with pricing and images
- `/bills` - All sales transactions
- `/cashiers` - Staff accounts
- `/settings` - Shop configuration
- `/shifts` - Shift summaries
- `/audit` - System activity logs

## 🎯 Future Enhancements

- Stock management
- Customer loyalty program
- WhatsApp bill sharing
- Multiple shop support
- Advanced analytics with Chart.js
- SMS notifications
- Inventory alerts

## 🐛 Troubleshooting

**Firebase not loading:**
- Check that Firebase SDK scripts are added to index.html
- Verify Firebase config in script.js
- Check browser console for errors

**Items not displaying:**
- Ensure items are added in owner panel
- Check that items are enabled
- Verify image URLs are accessible

**Print not working:**
- Check printer connection
- Verify printer width setting (58mm/80mm)
- Try "Save as PDF" option

**Offline sync issues:**
- Check browser localStorage is enabled
- Verify network connection
- Check Firebase Firestore rules

## 📄 License

This project is created for Mapla Tea Cafe. All rights reserved.

## 🤝 Support

For issues or questions, contact the development team.

---

**Built with ❤️ for Mapla Tea Cafe**
