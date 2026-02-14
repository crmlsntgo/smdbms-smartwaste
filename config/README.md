# Firebase Service Account Setup

## How to get your serviceAccountKey.json:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** (gear icon) → **Service Accounts**
4. Click **Generate New Private Key**
5. Save the downloaded JSON file as `serviceAccountKey.json` in this directory

## File structure:
```
config/
  └── serviceAccountKey.json  ← Place your key here
```

⚠️ **IMPORTANT**: Never commit `serviceAccountKey.json` to git!
