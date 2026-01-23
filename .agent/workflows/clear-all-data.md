---
description: How to clear all database and sales data for fresh client deployment
---

# Clear All Data for Client Deployment

This workflow guides you through clearing all test data from the Chai Time POS system before handing it over to a client for testing.

## ⚠️ WARNING
This will **permanently delete** all:
- Bills/Sales data
- Shift records
- Raw materials data
- Activity logs
- Local storage data

**Make sure to backup any important data before proceeding!**

---

## Option 1: Clear Data via Firebase Console (Recommended)

### Step 1: Access Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **chaitime-fa063**
3. Navigate to **Realtime Database** in the left sidebar

### Step 2: Delete Data Collections
Delete the following nodes one by one:

| Node | Data Type |
|------|-----------|
| `/bills` | All sales/bill records |
| `/shifts` | All shift close records |
| `/rawMaterials` | All raw material purchases |
| `/logs` | All activity logs |

**To delete a node:**
1. Click on the node name (e.g., `bills`)
2. Click the **⋮** (three dots) menu
3. Select **Delete**
4. Confirm deletion

### Step 3: Clear Browser Local Storage
Run this in the browser console (F12 → Console) on the POS app:

```javascript
// Clear all Chai Time local data
localStorage.removeItem('bills');
localStorage.removeItem('lastBillNumber');
localStorage.removeItem('chaiTimeSettings');
localStorage.removeItem('activityLogs');
console.log('✅ Local storage cleared!');
```

### Step 4: Verify Data is Cleared
1. Refresh the Firebase Console - all nodes should be empty
2. Refresh the POS app
3. Check "My Bills" section - should show "No bills found"
4. Check Owner Dashboard - all values should be ₹0.00

---

## Option 2: Clear Data via Browser Console (Quick Method)

Open the POS app and run this in the browser console (F12 → Console):

```javascript
// ⚠️ WARNING: This will delete ALL data!
async function clearAllData() {
    if (!confirm('⚠️ This will DELETE ALL DATA. Are you sure?')) {
        console.log('❌ Cancelled');
        return;
    }
    
    try {
        // Clear Firebase data
        if (typeof db !== 'undefined') {
            console.log('🗑️ Deleting bills...');
            await db.ref('bills').remove();
            
            console.log('🗑️ Deleting shifts...');
            await db.ref('shifts').remove();
            
            console.log('🗑️ Deleting raw materials...');
            await db.ref('rawMaterials').remove();
            
            console.log('🗑️ Deleting logs...');
            await db.ref('logs').remove();
            
            console.log('✅ Firebase data cleared!');
        } else {
            console.warn('⚠️ Firebase not initialized');
        }
        
        // Clear localStorage
        localStorage.removeItem('bills');
        localStorage.removeItem('lastBillNumber');
        localStorage.removeItem('chaiTimeSettings');
        localStorage.removeItem('activityLogs');
        console.log('✅ Local storage cleared!');
        
        console.log('');
        console.log('🎉 ALL DATA CLEARED SUCCESSFULLY!');
        console.log('👉 Please refresh the page.');
        
    } catch (error) {
        console.error('❌ Error clearing data:', error);
    }
}

// Run it
clearAllData();
```

---

## Option 3: Reset Bill Number Counter

If you want to reset the bill number counter to start from 1:

```javascript
localStorage.setItem('lastBillNumber', '0');
console.log('✅ Bill number counter reset to 0');
```

---

## Post-Cleanup Checklist

After clearing data, verify:

- [ ] Firebase Console shows empty nodes
- [ ] Owner Dashboard shows ₹0.00 for all metrics
- [ ] "My Bills" section shows "No bills found"
- [ ] Reports section generates empty reports
- [ ] New bills start from #1 (if counter was reset)
- [ ] Raw Materials section is empty

---

## To Keep Settings (Optional)

If you want to keep shop settings (name, UPI QR, etc.) but clear sales data, skip this line:
```javascript
// Don't run this line:
// localStorage.removeItem('chaiTimeSettings');
```

---

## Client Handoff Notes

Before handing to client:
1. ✅ Clear all test data (this workflow)
2. ✅ Update owner login credentials if needed
3. ✅ Test a fresh bill to ensure system works
4. ✅ Verify Firebase connection is working
5. ✅ Check UPI QR code is configured correctly
