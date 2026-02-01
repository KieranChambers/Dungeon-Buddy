# Dungeon Buddy

Dungeon buddy is a Discord bot built with [DiscordJS](https://discord.js.org/) exclusively for the
[No Pressure](https://discord.gg/nopressureeu) discord server.

It allows for an interactive group building experience, where members can create groups, join groups, and leave groups.
The bot also provide information on the group, such as the dungeon, keystone level and the roles required. All
information is updated in real-time so there shouldn't be any confusion on who is in the group.

When a member joins the group, they receive a randomly generated passphrase (unique to the group) which they can attach
as a 'note' in-game. This confirms they are from the NoP Discord and is used to prevent any bad actors from sneaking
into NoP groups and trolling.

## Commands

`/lfg` - create a group for the dungeon. Choose desired dungeon > dungeon difficulty > timed/completed > your role >
required roles from a drop-down style menu.

`/lfgquick` - create a group using a '_quick string_' rather than a drop-down style menu.

Example quick string: `fall 10t d hdd`

    <dungeonShorthand> <keyLevel><timed/completed> <yourRole><requiredRoles>

`/lfghistory` - check up-to 10 of your latest groups. Previous teammates & passphrases can be found here.

`/lfgstats` - check total groups created, groups created in the last 24h, 7d, 30d & also the most popular dungeons for
each key range.

---

## Deployment Guide

This bot is containerized with Docker and can be deployed locally for development or to Railway for production.

### Table of Contents

- [Local Development Setup](#local-development-setup)
- [Railway Production Deployment](#railway-production-deployment)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Troubleshooting](#troubleshooting)

---

## Local Development Setup

### Prerequisites

- Docker and Docker Compose installed
- A Discord bot application for testing (separate from production)

### Steps

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Dungeon-Buddy
   ```

2. **Copy the environment file**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` with your test bot credentials**
   ```env
   NODE_ENV=development
   
   TEST_BOT_TOKEN=your_test_bot_token
   TEST_CLIENT_ID=your_test_client_id
   TEST_GUILD_ID=your_test_guild_id
   TEST_DB_STORAGE=./data/database.sqlite
   ```

4. **Build and start the bot**
   ```bash
   docker compose up --build
   ```

5. **Stop the bot**
   ```bash
   # Press Ctrl+C, or run:
   docker compose down
   ```

### What Happens

- Docker builds the image with all dependencies
- Bot automatically deploys slash commands to your Discord server
- Bot connects and starts running
- Database is stored in `./data/database.sqlite` (persists between restarts)
- A clean starter database is included in the repository

### Rebuilding After Code Changes

```bash
docker compose up --build
```

### Running in Background

```bash
# Start detached
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

---

## Railway Production Deployment

### Prerequisites

- GitHub account
- Railway account (free tier available at [railway.app](https://railway.app))
- Discord bot for production

### Steps

#### 1. Push Code to GitHub

Ensure your code is in a GitHub repository.

#### 2. Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your Dungeon-Buddy repository
5. Railway will automatically detect the `Dockerfile` and build

#### 3. Add Volume for Database Persistence

**Important:** Without a volume, database data will be lost on redeploy.

1. Click on your service in Railway
2. Go to "Settings" tab
3. Scroll to "Volumes" section
4. Click "Add Volume"
5. Set mount path: `/app/data`
6. Click "Add"

#### 4. Configure Environment Variables

Click on the "Variables" tab and add:

```env
NODE_ENV=production
PROD_BOT_TOKEN=<your_production_bot_token>
PROD_CLIENT_ID=<your_production_client_id>
PROD_GUILD_ID=<your_production_guild_id>
PROD_DB_STORAGE=/app/data/database.sqlite
```

#### Getting Discord Credentials

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application (or create a new one)
3. **Client ID**: Found on "General Information" page
4. **Bot Token**: Found on "Bot" page (click "Reset Token" if needed)
5. **Guild ID**: 
   - Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
   - Right-click your server > "Copy Server ID"

#### 5. Deploy

Railway will automatically build and deploy. Watch the logs:

1. Click "Deployments"
2. Select the latest deployment
3. You should see:
   ```
   [DEPLOY] Started refreshing X application (/) commands.
   [DEPLOY] Successfully reloaded X application (/) commands.
   Ready! Logged in as YourBot#1234
   ```

#### 6. Verify

- Check your Discord server
- Bot should appear online
- Slash commands should be available (type `/` to see them)

### Updating the Bot

Just push to GitHub - Railway automatically redeploys:

```bash
git add .
git commit -m "Update bot"
git push origin main
```

---

## Environment Variables

### Required for Production (Railway)

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PROD_BOT_TOKEN` | Discord bot token | `MTIzNDU2...` |
| `PROD_CLIENT_ID` | Discord application client ID | `1234567890123456789` |
| `PROD_GUILD_ID` | Discord server ID | `9876543210987654321` |
| `PROD_DB_STORAGE` | Database file path | `/app/data/database.sqlite` |

### Required for Development (Local)

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `TEST_BOT_TOKEN` | Discord bot token | `MTIzNDU2...` |
| `TEST_CLIENT_ID` | Discord application client ID | `1234567890123456789` |
| `TEST_GUILD_ID` | Discord server ID | `9876543210987654321` |
| `TEST_DB_STORAGE` | Database file path | `./data/database.sqlite` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_LOGGING` | Enable database query logging | `false` |

---

## Database

The bot uses SQLite for data persistence.

### Local Development

- Database file: `./data/database.sqlite`
- A clean starter database is included in the repository
- Stored on your computer, survives container restarts
- Accumulates data as you test locally

### Railway Production

- Database file: `/app/data/database.sqlite`
- Starts with the clean database from the repository
- Stored in Railway volume (persistent storage)
- Survives deployments and restarts
- **Important**: Ensure volume is mounted at `/app/data`

### Database Structure

The bot creates three tables:

1. **dungeoninstances** - Completed dungeon group information
2. **errors** - Error logging
3. **interaction_status** - Discord interaction states

---

## Troubleshooting

### Bot won't start locally

Check Docker logs:
```bash
docker compose logs
```

Common issues:
- Missing environment variables in `.env`
- Invalid Discord token
- Docker not running

### Commands not appearing in Discord

The bot automatically deploys commands on startup. If they don't appear:

1. Wait a few minutes (Discord can cache)
2. Restart Discord app
3. Check bot has proper permissions in your server
4. Check logs for `[DEPLOY] Successfully reloaded X application (/) commands`

### Database not persisting (Railway)

Ensure:
1. Volume is mounted at `/app/data` in Railway dashboard (Settings > Volumes)
2. `PROD_DB_STORAGE=/app/data/database.sqlite` is set in environment variables

### Database not persisting (Local)

The `data/` directory is included in the repository with a starter database. If issues occur:
- Ensure `TEST_DB_STORAGE=./data/database.sqlite` in your `.env`
- Check that the `data/` directory exists

### Bot crashes on startup

Check logs for error messages:

**Railway**: Dashboard > Deployments > Select deployment > View logs

**Local**: `docker compose logs`

Common issues:
- Missing environment variables
- Invalid Discord credentials
- Database file path misconfigured

### Need to rebuild after code changes

```bash
docker compose down
docker compose up --build
```

The `--build` flag forces Docker to rebuild with your updated code.

---

## Cost

**Railway Free Tier:**
- 500 hours of execution time per month
- Sufficient for a Discord bot

---

## Architecture

The bot uses a multi-stage Docker build:
1. **Builder stage**: Compiles native `sqlite3` dependency
2. **Runtime stage**: Clean, minimal image with compiled dependencies
3. **Automatic command deployment**: Commands sync on startup
4. **Environment-based configuration**: Uses `TEST_*` vars for development, `PROD_*` for production

---

## License

This project is licensed under the [CC BY-NC 4.0 License](https://creativecommons.org/licenses/by-nc/4.0/).

### Conditions

-   You **must credit** the original author in any fork, modification, or usage of this project by adding the following
    to your Discord bot description:
    > Original code by Baddadan/Kashual for NoP EU. GitHub: https://bit.ly/3ZrVj7C
-   This code **cannot** be used in any product that is sold for money or restricted by a paywall. This includes Discord
    member sections

If you have questions about the licensing terms, please contact me at the [No Pressure](https://discord.gg/nopressureeu)
discord server.

