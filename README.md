# School Management System

A complete school management application with cloud sync.

## 🚀 Quick Deploy

### Deploy to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   npm run build
   vercel --prod
   ```

4. **Add Environment Variables** in Vercel Dashboard:
   - `VITE_SUPABASE_URL` = Your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase Anon Key

5. **Done!** Your app is online.

---

## 📁 Files You Need:

### On Your Computer (Local):
- `.env.local` - Your Supabase credentials (NOT in Git)
- `*.sql` files - Database schema (run in Supabase)

### In GitHub (Safe):
- All source code ✅
- Configuration files ✅
- No credentials ✅

---

## ☁️ Setup Cloud Sync

1. **Run SQL in Supabase:**
   - Open: https://app.supabase.com/project/YOUR_PROJECT_ID/sql/new
   - Run: `CREATE-CLOUD-SYNC-SCHEMA.sql` (from your computer)

2. **Enable Realtime:**
   - Go to: Database → Replication
   - Enable for all tables

3. **Login to your app:**
   - Data will auto-sync to cloud

---

## 🔒 Security

- ✅ No credentials in GitHub
- ✅ `.env.local` excluded from Git
- ✅ `.qwen/` folder excluded
- ✅ All `*.sql` files excluded

**IMPORTANT:** Never commit `.env.local` or `*.sql` files!

---

## 📞 Support

Email: nahlaoui17@gmail.com
