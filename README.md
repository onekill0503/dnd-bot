# D&D Discord Bot

A comprehensive Discord bot for Dungeons & Dragons 5e gameplay with AI-powered storytelling, voice narration, and automated dice rolling.

## Features

### Core Gameplay
- **AI-Powered Storytelling**: Dynamic narrative generation using OpenAI GPT
- **Voice Narration**: Text-to-speech for immersive storytelling
- **Session Management**: Redis-based persistent game sessions
- **Multi-language Support**: English, Indonesian, and other languages
- **Player Death Handling**: Automatic session termination when all players die

### Character System
- **Comprehensive Character Creation**: Full D&D 5e character sheets
- **Skill System**: All 18 skills with proficiency tracking
- **Currency Management**: Copper, Silver, Electrum, Gold, Platinum
- **Inventory System**: Equipment, weapons, armor, magic items with properties
- **Spellcasting**: Spell slots, cantrips, and prepared spells
- **Class Features**: Automatic class-specific abilities and proficiencies
- **Background Integration**: Background-specific skills and equipment

### Enhanced Story Continuity
- **Story Context Tracking**: Maintains narrative coherence across sessions
- **Important Events**: Remembers key story moments
- **NPC Interactions**: Tracks relationships with non-player characters
- **Quest Progress**: Manages active and completed quests
- **Environmental State**: Tracks changes to locations and surroundings

### Automatic Dice Rolling
- **Smart Action Analysis**: Automatically determines when dice rolls are needed
- **Skill Checks**: Automatic skill check generation based on character stats
- **Attack Rolls**: Handles combat actions with appropriate modifiers
- **Saving Throws**: Automatic saving throw generation
- **Damage Rolls**: Calculates damage based on weapons and abilities
- **Critical Success/Failure**: Tracks natural 20s and 1s

### Voice Features
- **Text-to-Speech**: Converts story text to voice narration
- **Multi-language Voice**: Supports different languages for narration
- **Voice Channel Integration**: Automatic voice channel detection
- **ElevenLabs Integration**: High-quality voice synthesis with expression support
- **Expression Parsing**: Supports voice expressions like [sarcastically], [whispers], [giggles]

## Installation

### Option 1: Docker (Recommended)

1. Clone the repository
2. Copy the environment example file:
   ```bash
   cp env.example .env
   ```
3. Edit `.env` file with your configuration
4. Run with Docker Compose:
   ```bash
   docker-compose up -d
   ```

### Option 2: Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Set up environment variables:
   ```env
   DISCORD_TOKEN=your_discord_token
   OPENAI_API_KEY=your_openai_api_key
   REDIS_PASSWORD=your_redis_password
   
   # Optional: ElevenLabs TTS Integration
   ELEVEN_LABS_KEY=your_elevenlabs_api_key
   USE_ELEVEN=true
   ELEVEN_LABS_DEFAULT_VOICE_ID=pNInz6obpgDQGcFmaJgB
   ELEVEN_LABS_MODEL_ID=eleven_v3
   ```
4. Run the bot:
   ```bash
   bun run index.ts
   ```

### Docker Commands

```bash
# Start the services
docker-compose up -d

# View logs
docker-compose logs -f dnd-bot

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# View running containers
docker-compose ps
```

## Usage

### Starting a Session
```
/dm start [party_level] [party_size] [campaign_theme] [language]
```

### Session Management
```
/dm end
```
**DM only** - Ends the session and disconnects all participants from the voice channel.

```
/dm disconnect
```
Disconnect from voice channel and end your individual session.

```
/dm status
```
Check session status and player information.

```
/dm continue
```
Manually continue the story when all players have acted.

### Creating Characters
Characters are automatically created with:
- **Ability Scores**: Generated using 4d6 drop lowest
- **Class Features**: Automatic class-specific abilities
- **Starting Equipment**: D&D 5e accurate equipment with properties and descriptions
- **Skill Proficiencies**: Class and background skills with proper proficiency bonuses
- **Spellcasting**: Accurate cantrips and spell slots based on class type (full/half/pact casters)
- **Currency**: D&D 5e starting gold with background bonuses and proper currency distribution

### Viewing Character Information
Use the unified view command to check your character:
```
/dm view [type]
```
Available view types:
- **sheet**: Character stats, ability scores, HP, AC
- **inventory**: Equipment, weapons, armor, items
- **spells**: Spell slots, cantrips, prepared spells
- **currency**: Copper, silver, electrum, gold, platinum
- **skills**: All 18 skills with proficiency status
- **all**: Complete character overview

### Gameplay
- **Actions**: Players describe their actions in natural language
- **Automatic Rolls**: Bot determines and rolls appropriate dice
- **Story Continuity**: AI maintains narrative coherence
- **Death Handling**: Automatic session management for player death
- **Character Viewing**: Unified command to view character stats, inventory, spells, currency, and skills

### ElevenLabs Voice Integration
The bot supports ElevenLabs for high-quality voice synthesis with expression support and language-specific voice selection:

#### Language Support
The bot automatically selects appropriate voices based on the session language:
- **English (en)**: Multiple voice options including Adam, Rachel, Domi, Bella
- **Indonesian (id)**: Voice selection optimized for Indonesian content
- **French (fr)**: French-optimized voice selection
- **Spanish (es)**: Spanish-optimized voice selection
- **German (de)**: German-optimized voice selection
- **Italian (it)**: Italian-optimized voice selection
- **Portuguese (pt)**: Portuguese-optimized voice selection
- **Russian (ru)**: Russian-optimized voice selection

#### Expression Support
The bot can parse and apply voice expressions in story text:
- `[sarcastically]` - Sarcastic tone with reduced stability
- `[whispers]` - Whispered speech with lower volume
- `[giggles]` - Laughing tone with increased style
- `[angrily]` - Angry tone with high style and low stability
- `[sadly]` - Sad tone with moderate style
- `[excitedly]` - Excited tone with high style and speed
- `[fearfully]` - Fearful tone with moderate style
- `[mysteriously]` - Mysterious tone with moderate style

#### Example Usage
```
In the ancient land of Eldoria, where skies shimmered and forests whispered secrets to the wind, lived a dragon named Zephyros. [sarcastically] Not the "burn it all down" kind... [giggles] but he was gentle, wise, with eyes like old stars. [whispers] Even the birds fell silent when he passed.
```

#### Language-Specific Voice Selection
The bot automatically:
1. Detects the session language (en, id, fr, etc.)
2. Converts to ISO 639-1 format for ElevenLabs API
3. Selects appropriate voice IDs for the language
4. Applies expressions while maintaining language context

#### Configuration
- Set `USE_ELEVEN=true` to enable ElevenLabs
- Set `ELEVEN_LABS_KEY` with your API key
- Optionally customize `ELEVEN_LABS_DEFAULT_VOICE_ID` and `ELEVEN_LABS_MODEL_ID`

### Improved Systems
- **Currency**: D&D 5e starting gold with background bonuses and realistic currency distribution
- **Inventory**: Accurate starting equipment with weapon properties, armor AC, and item descriptions
- **Skills**: Proper proficiency bonuses (+2 at level 1) and class-appropriate skill selections
- **Spellcasting**: Accurate cantrips and spell slots based on class type (full/half/pact casters)

## Character Systems

### Skills
All 18 D&D skills are tracked with:
- Proficiency status
- Ability modifiers
- Class and background bonuses

### Currency
Five-tier currency system:
- **Copper (cp)**: 1/100 gold
- **Silver (sp)**: 1/10 gold  
- **Electrum (ep)**: 1/2 gold
- **Gold (gp)**: Standard currency
- **Platinum (pp)**: 10 gold

### Inventory
Comprehensive item tracking:
- **Equipment Types**: Weapons, armor, tools, consumables, treasure, gear, magic items
- **Properties**: Special item abilities
- **Attunement**: Magic item attunement tracking
- **Weight & Value**: Encumbrance and treasure management

### Spellcasting
Full spellcasting system:
- **Spell Slots**: Level-based slot tracking
- **Cantrips**: Unlimited use spells
- **Prepared Spells**: Spell preparation tracking
- **Ritual Casting**: Ritual spell support

## Technical Architecture

### Services
- **OpenAI Service**: AI storytelling and character generation
- **Redis Service**: Session persistence and data management
- **Voice Service**: Text-to-speech functionality
- **Session Manager**: Game session coordination

### Data Persistence
- **Redis**: Session data, character sheets, story context
- **Maps**: In-memory session tracking
- **JSON Serialization**: Complex data structure handling

### Error Handling
- **Graceful Degradation**: Continues operation on service failures
- **Logging**: Comprehensive error tracking
- **Recovery**: Automatic session restoration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
