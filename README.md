# D&D Discord Bot

A Discord bot that acts as a Dungeon Master for D&D 5e sessions, powered by OpenAI with voice chat integration.

## Features

- **Dungeon Master Mode**: AI-powered DM that manages story progression, encounters, and character interactions
- **Voice Chat Integration**: Bot joins voice channels and speaks using OpenAI text-to-speech
- **Auto-Start Sessions**: Game automatically starts when all players join the party
- **Session Management**: Start, manage, and end D&D sessions with voice channel requirement
- **Character Creation**: Players can create characters through Discord modals
- **Character Stats**: Private character sheets with detailed stats for each player
- **Story Continuity**: Maintains session history and character states
- **Encounter Generation**: Generate combat, social, exploration, and puzzle encounters
- **Action Processing**: Players describe their actions and the DM responds with story progression

## Commands

### `/dm start`
Start a new D&D session (must be in a voice channel).

**Options:**
- `level` (1-20): Party level
- `size` (1-8): Number of players
- `theme` (optional): Campaign theme (default: fantasy adventure)

**Requirements:**
- User must be in a voice channel
- Bot will join the voice channel and speak using text-to-speech

### `/dm action`
Describe your character's action in the story.

**Options:**
- `action`: What your character does
- `dice` (optional): Dice roll results

### `/dm encounter`
Generate an encounter for the party.

**Options:**
- `type`: Combat, Social, Exploration, or Puzzle
- `difficulty` (optional): Easy, Medium, Hard, or Deadly

### `/dm status`
Check current session status, including party members and recent events.

### `/dm end`
End the current session.

## Setup

1. **Install Dependencies**
   ```bash
   bun install
   ```

2. **Environment Variables**
   Create a `.env` file with:
   ```
   DISCORD_TOKEN=your_discord_bot_token
   DISCORD_CLIENT_ID=your_discord_client_id
   DISCORD_GUILD_ID=your_guild_id_optional
   OPENAI_API_KEY=your_openai_api_key
   ```

3. **Deploy Commands**
   ```bash
   bun run deploy
   ```

4. **Start the Bot**
   ```bash
   bun run start
   ```

## Usage

1. **Join Voice Channel**: Users must be in a voice channel to start a session
2. **Start Session**: Use `/dm start` to begin a new D&D session
3. **Bot Joins Voice**: Bot automatically joins the voice channel
4. **Join Session**: Players click the "Join Session" button to create characters
5. **Create Character**: Fill out the modal with character details
6. **Auto-Start Game**: When all players join, the adventure begins automatically
7. **Voice Narration**: Bot speaks the story in voice chat and posts text in chat
8. **Character Stats**: Use the "Show Character Stats" button to view your character sheet
9. **Take Actions**: Use `/dm action` to describe what your character does
10. **Generate Encounters**: Use `/dm encounter` to create challenges
11. **Check Status**: Use `/dm status` to see session information
12. **End Session**: Use `/dm end` when the adventure concludes

## Voice Features

- **Text-to-Speech**: Bot converts story text to speech using OpenAI TTS
- **Voice Channel Requirement**: Sessions can only be started from voice channels
- **Automatic Join**: Bot joins the voice channel of the session starter
- **Story Narration**: Bot speaks the story progression in voice chat
- **Dual Output**: Story is posted in text chat and spoken in voice chat

## Character System

- **Modal Creation**: Players create characters through Discord modals
- **Auto-Generated Stats**: Character stats are automatically generated
- **Private Character Sheets**: Each player can view their character stats privately
- **Validation**: Input validation for classes, races, and backgrounds
- **Complete Stats**: Includes ability scores, HP, AC, alignment, and description

## Architecture

- **Commands**: Slash command handlers for DM functionality
- **Events**: Button and modal interaction handlers
- **Services**: OpenAI integration for AI-powered DM responses and TTS
- **Voice**: Voice chat integration with text-to-speech
- **Utils**: Logging and utility functions
- **Config**: Environment configuration management

## Requirements

- Node.js 18+ or Bun
- Discord Bot Token
- OpenAI API Key
- Discord Server with bot permissions
- Voice channel access

## Permissions

The bot requires the following Discord permissions:
- Send Messages
- Use Slash Commands
- Read Message History
- Add Reactions
- Embed Links
- Connect to Voice Channels
- Speak in Voice Channels
- Use Voice Activity
