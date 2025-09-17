# Migration Guide: MongoDB to Supabase

## Prerequisites

1. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Start Local Supabase:**
   ```bash
   supabase start
   ```

3. **Get Local Supabase Credentials:**
   ```bash
   supabase status
   ```

## Database Schema Migration

### 1. Users Table
```sql
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  department TEXT,
  employee_id TEXT,
  phone TEXT,
  designation TEXT,
  is_active BOOLEAN DEFAULT true,
  is_approved BOOLEAN DEFAULT false,
  assigned_devices UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 2. Devices Table
```sql
CREATE TABLE devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  mac_address TEXT UNIQUE NOT NULL,
  ip_address TEXT UNIQUE NOT NULL,
  location TEXT NOT NULL,
  classroom TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error')),
  device_secret TEXT,
  pir_enabled BOOLEAN DEFAULT false,
  pir_gpio INTEGER,
  pir_auto_off_delay INTEGER DEFAULT 30,
  switches JSONB DEFAULT '[]',
  assigned_users UUID[] DEFAULT '{}',
  queued_intents JSONB DEFAULT '[]',
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_devices_mac_address ON devices(mac_address);
CREATE INDEX idx_devices_ip_address ON devices(ip_address);
CREATE INDEX idx_devices_status ON devices(status);
```

### 3. Activity Logs Table
```sql
CREATE TABLE activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID REFERENCES devices(id),
  device_name TEXT,
  switch_id TEXT,
  switch_name TEXT,
  action TEXT NOT NULL,
  triggered_by TEXT DEFAULT 'user',
  user_id UUID REFERENCES users(id),
  user_name TEXT,
  classroom TEXT,
  location TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_activity_logs_device_id ON activity_logs(device_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
```

## Environment Variables

Update your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Remove MongoDB config
# MONGODB_URI=mongodb://localhost:27017/iot-automation
```

## Code Changes Required

### 1. Update Database Connection
Replace MongoDB connection with Supabase in `server.js`:

```javascript
// Remove mongoose connection
// const mongoose = require('mongoose');

// Add Supabase connection
const supabase = require('./config/supabase');
```

### 2. Update Models
Convert Mongoose models to Supabase queries. Example for User model:

```javascript
// Instead of Mongoose User model
const User = {
  async findOne(query) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .match(query)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async create(userData) {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
```

### 3. Update Authentication
Modify JWT token generation to work with Supabase UUIDs:

```javascript
// Generate token with Supabase UUID
const token = jwt.sign(
  { userId: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);
```

## Migration Steps

1. **Backup MongoDB Data:**
   ```bash
   mongodump --db iot-automation --out backup
   ```

2. **Start Supabase:**
   ```bash
   supabase start
   ```

3. **Run Schema Migration:**
   ```bash
   psql "postgresql://postgres:postgres@localhost:54322/postgres" -f schema.sql
   ```

4. **Update Application Code:**
   - Replace Mongoose models with Supabase queries
   - Update authentication logic
   - Modify database connection

5. **Test Migration:**
   ```bash
   npm test
   ```

6. **Data Migration (Optional):**
   Write scripts to migrate existing MongoDB data to Supabase

## Firebase Cloud Integration

### Frontend Changes

1. **Install Firebase:**
   ```bash
   npm install firebase
   ```

2. **Firebase Configuration:**
   ```typescript
   // src/config/firebase.ts
   import { initializeApp } from 'firebase/app';
   import { getAuth } from 'firebase/auth';
   import { getFirestore } from 'firebase/firestore';

   const firebaseConfig = {
     apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
     authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
     projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
     storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
     messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
     appId: import.meta.env.VITE_FIREBASE_APP_ID
   };

   export const app = initializeApp(firebaseConfig);
   export const auth = getAuth(app);
   export const db = getFirestore(app);
   ```

3. **Update API Calls:**
   Modify `src/services/api.ts` to use Firebase Auth and Supabase for data:

   ```typescript
   // Use Firebase Auth for authentication
   import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
   import { auth } from '../config/firebase';

   // Use Supabase for API calls
   const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
   const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
   ```

## Testing the Hybrid Setup

1. **Start Local Supabase:**
   ```bash
   supabase start
   ```

2. **Start Backend:**
   ```bash
   npm run dev
   ```

3. **Start Frontend:**
   ```bash
   npm run dev
   ```

4. **Test Authentication Flow:**
   - Firebase handles user authentication
   - Supabase stores user data and application state
   - Real-time features work through Supabase subscriptions

## Benefits of This Setup

✅ **Local Development:** Supabase local provides full PostgreSQL database
✅ **Cloud Ready:** Easy migration to Supabase Cloud
✅ **Firebase Integration:** Leverage Firebase Auth, Hosting, and other services
✅ **Real-time:** Supabase real-time subscriptions for live updates
✅ **Security:** Row Level Security (RLS) built into Supabase

## Challenges to Consider

⚠️ **Learning Curve:** Converting from MongoDB/Mongoose to PostgreSQL/Supabase
⚠️ **Schema Design:** PostgreSQL requires more upfront schema planning
⚠️ **Real-time Complexity:** Socket.io vs Supabase real-time subscriptions
⚠️ **Migration Effort:** Significant code changes required

Would you like me to help you implement any specific part of this migration?