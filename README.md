# Barnett Event Planning Services - Seating Chart Planner

A React-based event seating planner with drag-and-drop guest assignment, multiple table shapes, dark mode, and more.

## Features

- **Guest Management**: Paste guest lists, search/filter, add guests on the fly
- **Flexible Tables**: Rectangle and circle shapes, 2-30 seats, configurable ends
- **Table Tags**: Color-code tables (Head Table, Family, Friends, Work, Kids, VIP)
- **Drag & Drop**: Intuitive guest placement with visual feedback
- **Undo/Redo**: Full history with Ctrl+Z / Ctrl+Y support
- **Save Versions**: Multiple saved versions per event with duplicate option
- **Export**: Download seating data as JSON
- **Print Views**: Combined, visual-only, or list-only print layouts
- **Dark Mode**: Full dark theme support
- **Zoom Controls**: Scale the canvas from 40% to 200%

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file and add your Supabase credentials
cp .env.example .env

# Run development server
npm run dev

# Build for production
npm run build
```

## Supabase Setup

This app uses the shared **barnett-office** Supabase project (one $10/mo project for all Barnett apps).

### First time setup (one-time):

1. Create a project called "barnett-office" at [supabase.com](https://supabase.com)
2. Save your credentials somewhere safe (Settings → API)

### Adding this app's tables:

1. Go to SQL Editor in your barnett-office project
2. Run the schema in `supabase-schema.sql`

### Configure the app:

Copy `.env.example` to `.env` and add your credentials:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

### Multi-app strategy:

All Barnett apps share one Supabase project with separate tables:
```
barnett-office (one project = $10/mo)
├── seating_events      ← this app
├── property_units      ← property manager
├── investment_deals    ← deal tracker
└── family_tasks        ← family hub
```

Same credentials work across all apps. Just run each app's schema SQL to add its tables.

**Note**: Without Supabase credentials, the app falls back to localStorage (good for local dev).

## Deployment

### Vercel
```bash
npm run build
# Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to environment variables
# Deploy the `dist` folder
```

### Netlify
```bash
npm run build
# Add environment variables in site settings
# Set publish directory to `dist`
```

## Tech Stack

- React 18
- Vite
- Supabase (PostgreSQL)
- Lucide React (icons)

---

*Vibe Coded by WesB at a fancy gala*
