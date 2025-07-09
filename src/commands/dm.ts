import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { OpenAIService } from '../services/openai';
import { SessionManager } from '../services/sessionManager';
import { VoiceService } from '../services/voice';
import { logger } from '../utils/logger';
import type { Command } from '../types';

function getLanguageDisplayName(language: string): string {
  switch (language) {
    case 'fr': return 'Français';
    case 'es': return 'Español';
    case 'de': return 'Deutsch';
    case 'it': return 'Italiano';
    case 'pt': return 'Português';
    case 'ru': return 'Русский';
    case 'id': return 'Bahasa Indonesia';
    default: return 'English';
  }
}

export const data = new SlashCommandBuilder()
  .setName('dm')
  .setDescription('D&D Dungeon Master commands')
  .addSubcommand(subcommand =>
    subcommand
      .setName('start')
      .setDescription('Start a new D&D session')
      .addIntegerOption(option =>
        option.setName('party_level')
          .setDescription('Party level (1-20)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(20))
      .addIntegerOption(option =>
        option.setName('party_size')
          .setDescription('Number of players (1-6)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(6))
      .addStringOption(option =>
        option.setName('campaign_theme')
          .setDescription('Campaign theme (e.g., fantasy, horror, sci-fi)')
          .setRequired(false))
      .addStringOption(option =>
        option.setName('language')
          .setDescription('Session language (en, id)')
          .setRequired(false)
          .addChoices(
            { name: 'English', value: 'en' },
            { name: 'Indonesian', value: 'id' }
          )))
  .addSubcommand(subcommand =>
    subcommand
      .setName('character')
      .setDescription('Create a character')
      .addStringOption(option =>
        option.setName('name')
          .setDescription('Character name')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('class')
          .setDescription('Character class')
          .setRequired(true)
          .addChoices(
            { name: 'Fighter', value: 'fighter' },
            { name: 'Wizard', value: 'wizard' },
            { name: 'Cleric', value: 'cleric' },
            { name: 'Rogue', value: 'rogue' },
            { name: 'Ranger', value: 'ranger' },
            { name: 'Paladin', value: 'paladin' },
            { name: 'Barbarian', value: 'barbarian' },
            { name: 'Bard', value: 'bard' },
            { name: 'Druid', value: 'druid' },
            { name: 'Monk', value: 'monk' },
            { name: 'Sorcerer', value: 'sorcerer' },
            { name: 'Warlock', value: 'warlock' },
            { name: 'Artificer', value: 'artificer' }
          ))
      .addStringOption(option =>
        option.setName('race')
          .setDescription('Character race')
          .setRequired(true)
          .addChoices(
            { name: 'Human', value: 'human' },
            { name: 'Elf', value: 'elf' },
            { name: 'Dwarf', value: 'dwarf' },
            { name: 'Halfling', value: 'halfling' },
            { name: 'Gnome', value: 'gnome' },
            { name: 'Half-Orc', value: 'half-orc' },
            { name: 'Tiefling', value: 'tiefling' },
            { name: 'Dragonborn', value: 'dragonborn' }
          ))
      .addStringOption(option =>
        option.setName('background')
          .setDescription('Character background')
          .setRequired(true)
          .addChoices(
            { name: 'Acolyte', value: 'acolyte' },
            { name: 'Criminal', value: 'criminal' },
            { name: 'Folk Hero', value: 'folk hero' },
            { name: 'Noble', value: 'noble' },
            { name: 'Sage', value: 'sage' },
            { name: 'Soldier', value: 'soldier' },
            { name: 'Urchin', value: 'urchin' },
            { name: 'Entertainer', value: 'entertainer' },
            { name: 'Guild Artisan', value: 'guild artisan' },
            { name: 'Hermit', value: 'hermit' },
            { name: 'Outlander', value: 'outlander' },
            { name: 'Charlatan', value: 'charlatan' }
          ))
      .addStringOption(option =>
        option.setName('description')
          .setDescription('Character description')
          .setRequired(false)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('View your character information')
      .addStringOption(option =>
        option.setName('type')
          .setDescription('What to view')
          .setRequired(true)
          .addChoices(
            { name: 'Character Sheet', value: 'sheet' },
            { name: 'Inventory', value: 'inventory' },
            { name: 'Spells', value: 'spells' },
            { name: 'Currency', value: 'currency' },
            { name: 'Skills', value: 'skills' },
            { name: 'All', value: 'all' }
          )))

  .addSubcommand(subcommand =>
    subcommand
      .setName('add_item')
      .setDescription('Add item to inventory (DM only)')
      .addStringOption(option =>
        option.setName('item_name')
          .setDescription('Item name')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('description')
          .setDescription('Item description')
          .setRequired(true))
      .addIntegerOption(option =>
        option.setName('quantity')
          .setDescription('Quantity')
          .setRequired(false))
      .addIntegerOption(option =>
        option.setName('value')
          .setDescription('Value in gold pieces')
          .setRequired(false))
      .addStringOption(option =>
        option.setName('type')
          .setDescription('Item type')
          .setRequired(false)
          .addChoices(
            { name: 'Weapon', value: 'weapon' },
            { name: 'Armor', value: 'armor' },
            { name: 'Tool', value: 'tool' },
            { name: 'Consumable', value: 'consumable' },
            { name: 'Treasure', value: 'treasure' },
            { name: 'Gear', value: 'gear' },
            { name: 'Magic Item', value: 'magic item' }
          )))
  .addSubcommand(subcommand =>
    subcommand
      .setName('add_currency')
      .setDescription('Add currency (DM only)')
      .addStringOption(option =>
        option.setName('currency_type')
          .setDescription('Currency type')
          .setRequired(true)
          .addChoices(
            { name: 'Copper', value: 'copper' },
            { name: 'Silver', value: 'silver' },
            { name: 'Electrum', value: 'electrum' },
            { name: 'Gold', value: 'gold' },
            { name: 'Platinum', value: 'platinum' }
          ))
                .addIntegerOption(option =>
        option.setName('amount')
          .setDescription('Amount to add')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('end')
      .setDescription('End the current D&D session (DM only)'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('disconnect')
      .setDescription('Disconnect from voice channel and end your session'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('Check session status and player information'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('continue')
      .setDescription('Continue the story manually'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('debug')
      .setDescription('Debug session information (DM only)'))


export const execute: Command['execute'] = async (interaction: ChatInputCommandInteraction) => {
  try {
    const subcommand = interaction.options.getSubcommand();
    const openaiService = new OpenAIService();
    const sessionManager = (interaction.client as any).sessionManager as SessionManager;
    const sessionId = interaction.channelId; // Use channel ID as session ID
    
    logger.info(`DM command executed: ${subcommand} in channel ${sessionId}`);

    switch (subcommand) {
      case 'start': {
        // Check if user is in a voice channel
        const member = interaction.member;
        if (!member || !('voice' in member) || !member.voice.channel) {
          await interaction.reply({
            content: '❌ You must be in a voice channel to start a D&D session!',
            flags: 64 // Ephemeral flag
          });
          return;
        }

        const level = interaction.options.getInteger('party_level', true);
        const size = interaction.options.getInteger('party_size', true);
        const theme = interaction.options.getString('campaign_theme') || 'fantasy adventure';
        const language = interaction.options.getString('language') || 'en'; // Default to English
        const voiceChannel = member.voice.channel;
        const guildId = interaction.guildId!;
        const userId = interaction.user.id;
        
        await interaction.deferReply();

        logger.info(`Starting session in channel ${sessionId} with level ${level}, size ${size}, theme ${theme}`);

        // Create session in Redis
        const session = await sessionManager.startSession(voiceChannel.id, guildId, userId);
        
        // Join voice channel
        await sessionManager.speakInChannel(voiceChannel.id, guildId, "Welcome to the D&D session! I'm your Dungeon Master.", interaction.client);

        const openingScene = await openaiService.startSession(voiceChannel.id, level, size, theme, voiceChannel.id, guildId, language);

        const embed = new EmbedBuilder()
          .setColor(0x8B4513)
          .setTitle('🎭 Dungeon Master Session Started')
          .setDescription(openingScene)
          .addFields(
            { name: 'Party Level', value: level.toString(), inline: true },
            { name: 'Party Size', value: size.toString(), inline: true },
            { name: 'Theme', value: theme, inline: true },
            { name: 'Voice Channel', value: voiceChannel.name, inline: true },
            { name: 'Language', value: getLanguageDisplayName(language), inline: true }
          )
          .setFooter({ text: 'Click "Join Session" to create your character' });

        const joinButton = new ButtonBuilder()
          .setCustomId('join_session')
          .setLabel('Join Session')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎭');

        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(joinButton);

        await interaction.editReply({ embeds: [embed], components: [row] });
        break;
      }





      case 'status': {
        logger.info(`Checking status for session ${sessionId}`);
        
        // Check Redis session first - search for sessions by user or guild
        const allSessions = await sessionManager.getAllSessions();
        const redisSession = allSessions.find(session => 
          session.participants.includes(interaction.user.id) || 
          session.guildId === interaction.guildId
        );
        
        if (!redisSession) {
          await interaction.reply({
            content: '❌ No active session found. Use `/dm start` to begin a new session.',
            flags: 64 // Ephemeral flag
          });
          return;
        }

        const session = await openaiService.getSessionStatus(redisSession.channelId);

        if (!session) {
          await interaction.reply({
            content: '❌ Session found in Redis but not in OpenAI service. Please restart the session.',
            flags: 64 // Ephemeral flag
          });
          return;
        }

        const characters = await openaiService.getSessionCharacters(redisSession.channelId);
        const characterList = characters.length > 0 
          ? characters.map((c: any) => `- ${c.name} (${c.race} ${c.class})`).join('\n')
          : 'No characters created yet';

        const pendingActions = await openaiService.getPendingActions(redisSession.channelId);
        const pendingList = pendingActions.length > 0 
          ? pendingActions.map(pa => `- ${pa.characterName}: ${pa.action}`).join('\n')
          : 'None';

        const embed = new EmbedBuilder()
          .setColor(0x32CD32)
          .setTitle('📊 Session Status')
          .addFields(
            { name: 'Status', value: session.status, inline: true },
            { name: 'Party Level', value: session.partyLevel.toString(), inline: true },
            { name: 'Players', value: `${session.players.size}/${session.maxPlayers}`, inline: true },
            { name: 'Current Location', value: session.currentLocation, inline: true },
            { name: 'Redis Participants', value: redisSession.participants.length.toString(), inline: true },
            { name: 'Characters', value: characterList, inline: false },
            { name: 'Pending Actions', value: pendingList, inline: false }
          );

        if (session.status === 'active') {
          embed.addFields(
            { name: 'Active Quests', value: session.activeQuests.length > 0 ? session.activeQuests.join(', ') : 'None', inline: false },
            { name: 'Recent Events', value: session.recentEvents.slice(-3).join('\n') || 'None', inline: false }
          );
        }

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'end': {
        logger.info(`Ending session ${sessionId}`);
        
        // Get Redis session to find voice channel ID
        const allSessions = await sessionManager.getAllSessions();
        const redisSession = allSessions.find(session => 
          session.participants.includes(interaction.user.id) || 
          session.guildId === interaction.guildId
        );
        
        if (!redisSession) {
          await interaction.reply({
            content: '❌ No active session found to end.',
            flags: 64 // Ephemeral flag
          });
          return;
        }

        // Check if user is the session creator (DM) or has permission to end session
        if (redisSession.creatorId !== interaction.user.id) {
          await interaction.reply({
            content: '❌ Only the Dungeon Master can end the session.',
            flags: 64 // Ephemeral flag
          });
          return;
        }

        try {
          // End the OpenAI session
          const ended = openaiService.endSession(redisSession.channelId);
          
          // End the session in SessionManager (this will clean up Redis data)
          await sessionManager.endSession(redisSession.channelId);
          
          // Disconnect all participants from voice channel
          for (const participantId of redisSession.participants) {
            try {
              await sessionManager.leaveVoiceChannel(redisSession.guildId, redisSession.channelId, participantId);
            } catch (voiceError) {
              logger.warn(`Failed to disconnect participant ${participantId} from voice channel:`, voiceError);
            }
          }
          
          if (ended) {
            await interaction.reply({
              content: '✅ Session ended successfully. All participants have been disconnected from the voice channel.',
              flags: 64 // Ephemeral flag
            });
          } else {
            await interaction.reply({
              content: '✅ Session ended successfully. All participants have been disconnected from the voice channel.',
              flags: 64 // Ephemeral flag
            });
          }
        } catch (error) {
          logger.error('Error ending session:', error);
          await interaction.reply({
            content: '❌ Failed to end session. Please try again.',
            flags: 64 // Ephemeral flag
          });
        }
        break;
      }

      case 'disconnect': {
        logger.info(`Disconnecting from voice channel for session ${sessionId}`);
        
        // Get Redis session to find voice channel ID
        const allSessions = await sessionManager.getAllSessions();
        const redisSession = allSessions.find(session => 
          session.participants.includes(interaction.user.id) || 
          session.guildId === interaction.guildId
        );
        
        if (!redisSession) {
          await interaction.reply({
            content: '❌ No active session found to disconnect from.',
            flags: 64 // Ephemeral flag
          });
          return;
        }

        // Disconnect from voice channel
        await sessionManager.disconnectFromVoiceChannel(redisSession.channelId, interaction.user.id);
        await interaction.reply({
          content: '👋 You have been disconnected from the voice channel and your session has ended.',
          flags: 64 // Ephemeral flag
        });
        break;
      }

      case 'continue': {
        await interaction.deferReply();

        // Get Redis session to find voice channel ID
        const allSessions = await sessionManager.getAllSessions();
        const redisSession = allSessions.find(session => 
          session.participants.includes(interaction.user.id) || 
          session.guildId === interaction.guildId
        );
        
        if (!redisSession) {
          await interaction.editReply({
            content: '❌ No active session found. Use `/dm start` to begin a new session.',
          });
          return;
        }

        logger.info(`Continuing story in session ${redisSession.channelId}`);

        const response = await openaiService.continueStoryWithAllActions(redisSession.channelId);

        const embed = new EmbedBuilder()
          .setColor(0x4B0082)
          .setTitle('🎭 Dungeon Master Response')
          .setDescription(response)
          .addFields(
            { name: 'Round Complete', value: 'All players have acted and the story continues!', inline: false }
          );

        await interaction.editReply({ embeds: [embed] });

        // Start voice narration after text has been sent
        try {
          await openaiService.narrateStoryResponse(redisSession.channelId, response);
        } catch (voiceError) {
          logger.error('Error narrating action response in voice channel:', voiceError);
        }

        // Show "Perform Action" button after story event
        const actionButton = new ButtonBuilder()
          .setCustomId('player_action')
          .setLabel('Perform Action')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚔️');

        const actionRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(actionButton);

        const nextActionEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('🎭 Next Round')
          .setDescription('The story continues! What would you like to do next?')
          .setFooter({ text: 'Click "Perform Action" to describe what your character does' });

        if (interaction.channel && 'send' in interaction.channel) {
          await (interaction.channel as any).send({ 
            embeds: [nextActionEmbed],
            components: [actionRow]
          });
        }
        break;
      }

      case 'debug': {
        logger.info(`Debug command executed by ${interaction.user.id}`);
        
        await interaction.deferReply({ ephemeral: true });
        
        // Get Redis sessions
        const allSessions = await sessionManager.getAllSessions();
        
        // Get OpenAI sessions
        const openaiSessionIds = openaiService.getAllSessionIds();
        const openaiSessionDetails = openaiService.getAllSessionDetails();
        
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('🔍 Session Debug Information')
          .addFields(
            { name: 'Redis Sessions', value: allSessions.length.toString(), inline: true },
            { name: 'OpenAI Sessions', value: openaiSessionIds.length.toString(), inline: true },
            { name: 'Redis Session IDs', value: allSessions.map(s => s.channelId).join(', ') || 'None', inline: false },
            { name: 'OpenAI Session IDs', value: openaiSessionIds.join(', ') || 'None', inline: false }
          );
        
        if (openaiSessionDetails.length > 0) {
          const sessionInfo = openaiSessionDetails.map(({ key, session }) => 
            `**${key}**: ${session.players.size}/${session.maxPlayers} players, status: ${session.status}`
          ).join('\n');
          embed.addFields({ name: 'OpenAI Session Details', value: sessionInfo, inline: false });
        }
        
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'context': {
        await interaction.deferReply();

        // Get Redis session to find voice channel ID
        const allSessions = await sessionManager.getAllSessions();
        const redisSession = allSessions.find(session => 
          session.participants.includes(interaction.user.id) || 
          session.guildId === interaction.guildId
        );
        
        if (!redisSession) {
          await interaction.editReply({
            content: '❌ No active session found. Use `/dm start` to begin a new session.',
          });
          return;
        }

        const context = await openaiService.getStoryContext(redisSession.channelId);

        const embed = new EmbedBuilder()
          .setColor(0x4B0082)
          .setTitle('📖 Story Context')
          .setDescription(context.summary)
          .addFields(
            { name: 'Current Scene', value: context.currentScene, inline: false },
            { name: 'Recent Events', value: context.recentEvents.slice(-3).join('\n') || 'None', inline: false },
            { name: 'Important Events', value: context.importantEvents.slice(-3).join('\n') || 'None', inline: false },
            { name: 'Session Round', value: context.sessionRound.toString(), inline: true }
          );

        await interaction.editReply({ embeds: [embed] });
        break;
      }











      case 'view': {
        const viewType = interaction.options.getString('type', true);
        
        await interaction.deferReply({ ephemeral: true });

        // Get Redis session to find voice channel ID
        const allSessions = await sessionManager.getAllSessions();
        const redisSession = allSessions.find(session => 
          session.participants.includes(interaction.user.id) || 
          session.guildId === interaction.guildId
        );
        
        if (!redisSession) {
          await interaction.editReply({
            content: '❌ No active session found. Use `/dm start` to begin a new session.',
          });
          return;
        }

        const character = await openaiService.getCharacter(redisSession.channelId, interaction.user.id);

        if (!character) {
          await interaction.editReply({
            content: '❌ No character found. Create a character first.',
          });
          return;
        }

        let embed: EmbedBuilder;

        switch (viewType) {
          case 'sheet': {
            embed = new EmbedBuilder()
              .setColor(0x8B4513)
              .setTitle(`📜 ${character.name} - Character Sheet`)
              .addFields(
                { name: 'Class & Race', value: `${character.race} ${character.class}`, inline: true },
                { name: 'Level', value: character.level.toString(), inline: true },
                { name: 'Background', value: character.background, inline: true },
                { name: 'HP', value: `${character.hitPoints}/${character.maxHitPoints}`, inline: true },
                { name: 'AC', value: character.armorClass.toString(), inline: true },
                { name: 'Status', value: character.status, inline: true },
                { name: 'Strength', value: `${character.stats.strength} (${character.stats.strength >= 10 ? '+' : ''}${Math.floor((character.stats.strength - 10) / 2)})`, inline: true },
                { name: 'Dexterity', value: `${character.stats.dexterity} (${character.stats.dexterity >= 10 ? '+' : ''}${Math.floor((character.stats.dexterity - 10) / 2)})`, inline: true },
                { name: 'Constitution', value: `${character.stats.constitution} (${character.stats.constitution >= 10 ? '+' : ''}${Math.floor((character.stats.constitution - 10) / 2)})`, inline: true },
                { name: 'Intelligence', value: `${character.stats.intelligence} (${character.stats.intelligence >= 10 ? '+' : ''}${Math.floor((character.stats.intelligence - 10) / 2)})`, inline: true },
                { name: 'Wisdom', value: `${character.stats.wisdom} (${character.stats.wisdom >= 10 ? '+' : ''}${Math.floor((character.stats.wisdom - 10) / 2)})`, inline: true },
                { name: 'Charisma', value: `${character.stats.charisma} (${character.stats.charisma >= 10 ? '+' : ''}${Math.floor((character.stats.charisma - 10) / 2)})`, inline: true }
              );
            break;
          }

          case 'inventory': {
            const inventoryList = character.inventory && character.inventory.length > 0
              ? character.inventory.map(item => 
                  `**${item.name}** (${item.quantity}x) - ${item.description}\n` +
                  `Value: ${item.value}gp, Weight: ${item.weight}lb, Type: ${item.type}`
                ).join('\n\n')
              : 'No items in inventory';

            embed = new EmbedBuilder()
              .setColor(0xFFD700)
              .setTitle(`🎒 ${character.name} - Inventory`)
              .setDescription(inventoryList);
            break;
          }

          case 'spells': {
            const spellSlotsList = character.spellSlots && character.spellSlots.length > 0
              ? character.spellSlots.map(slot => 
                  `Level ${slot.level}: ${slot.available}/${slot.total}`
                ).join('\n')
              : 'No spell slots';

            const cantripsList = character.cantrips && character.cantrips.length > 0
              ? character.cantrips.map(cantrip => 
                  `**${cantrip.name}** - ${cantrip.description}`
                ).join('\n\n')
              : 'No cantrips known';

            embed = new EmbedBuilder()
              .setColor(0x9370DB)
              .setTitle(`🔮 ${character.name} - Spells`)
              .addFields(
                { name: 'Spell Slots', value: spellSlotsList, inline: false },
                { name: 'Cantrips', value: cantripsList, inline: false }
              );
            break;
          }

          case 'currency': {
            const currencyList = `**Copper:** ${character.currency.copper} cp\n` +
              `**Silver:** ${character.currency.silver} sp\n` +
              `**Electrum:** ${character.currency.electrum} ep\n` +
              `**Gold:** ${character.currency.gold} gp\n` +
              `**Platinum:** ${character.currency.platinum} pp`;

            embed = new EmbedBuilder()
              .setColor(0xFFD700)
              .setTitle(`💰 ${character.name} - Currency`)
              .setDescription(currencyList);
            break;
          }

          case 'skills': {
            const skillsList = Object.entries(character.skills)
              .map(([skillName, skill]) => {
                const proficient = skill.proficient ? '✓' : '✗';
                const modifier = skill.modifier >= 0 ? `+${skill.modifier}` : `${skill.modifier}`;
                return `**${skillName}:** ${modifier} ${proficient}`;
              })
              .join('\n');

            embed = new EmbedBuilder()
              .setColor(0x32CD32)
              .setTitle(`🎯 ${character.name} - Skills`)
              .setDescription(skillsList)
              .setFooter({ text: '✓ = Proficient, ✗ = Not Proficient' });
            break;
          }

          case 'all': {
            // Create a comprehensive view with all character information
            const statsList = `**Strength:** ${character.stats.strength} (${character.stats.strength >= 10 ? '+' : ''}${Math.floor((character.stats.strength - 10) / 2)})\n` +
              `**Dexterity:** ${character.stats.dexterity} (${character.stats.dexterity >= 10 ? '+' : ''}${Math.floor((character.stats.dexterity - 10) / 2)})\n` +
              `**Constitution:** ${character.stats.constitution} (${character.stats.constitution >= 10 ? '+' : ''}${Math.floor((character.stats.constitution - 10) / 2)})\n` +
              `**Intelligence:** ${character.stats.intelligence} (${character.stats.intelligence >= 10 ? '+' : ''}${Math.floor((character.stats.intelligence - 10) / 2)})\n` +
              `**Wisdom:** ${character.stats.wisdom} (${character.stats.wisdom >= 10 ? '+' : ''}${Math.floor((character.stats.wisdom - 10) / 2)})\n` +
              `**Charisma:** ${character.stats.charisma} (${character.stats.charisma >= 10 ? '+' : ''}${Math.floor((character.stats.charisma - 10) / 2)})`;

            const currencyList = `**Copper:** ${character.currency.copper} cp\n` +
              `**Silver:** ${character.currency.silver} sp\n` +
              `**Electrum:** ${character.currency.electrum} ep\n` +
              `**Gold:** ${character.currency.gold} gp\n` +
              `**Platinum:** ${character.currency.platinum} pp`;

            const inventoryList = character.inventory && character.inventory.length > 0
              ? character.inventory.map(item => 
                  `**${item.name}** (${item.quantity}x) - ${item.description}`
                ).join('\n')
              : 'No items in inventory';

            const skillsList = Object.entries(character.skills)
              .map(([skillName, skill]) => {
                const proficient = skill.proficient ? '✓' : '✗';
                const modifier = skill.modifier >= 0 ? `+${skill.modifier}` : `${skill.modifier}`;
                return `**${skillName}:** ${modifier} ${proficient}`;
              })
              .join('\n');

            embed = new EmbedBuilder()
              .setColor(0x4B0082)
              .setTitle(`📊 ${character.name} - Complete Character Sheet`)
              .addFields(
                { name: 'Basic Info', value: `${character.race} ${character.class} (Level ${character.level})\nBackground: ${character.background}\nHP: ${character.hitPoints}/${character.maxHitPoints} | AC: ${character.armorClass}`, inline: false },
                { name: 'Ability Scores', value: statsList, inline: false },
                { name: 'Currency', value: currencyList, inline: false },
                { name: 'Inventory', value: inventoryList, inline: false },
                { name: 'Skills', value: skillsList, inline: false }
              )
              .setFooter({ text: '✓ = Proficient, ✗ = Not Proficient' });
            break;
          }

          default:
            await interaction.editReply({
              content: '❌ Invalid view type. Please choose from: sheet, inventory, spells, currency, skills, or all.',
            });
            return;
        }

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'character': {
        const name = interaction.options.getString('name', true);
        const characterClass = interaction.options.getString('class', true);
        const race = interaction.options.getString('race', true);
        const background = interaction.options.getString('background', true);
        const description = interaction.options.getString('description') || 'A brave adventurer';

        await interaction.deferReply();

        // Get Redis session to find voice channel ID
        const allSessions = await sessionManager.getAllSessions();
        const redisSession = allSessions.find(session => 
          session.participants.includes(interaction.user.id) || 
          session.guildId === interaction.guildId
        );
        
        if (!redisSession) {
          await interaction.editReply({
            content: '❌ No active session found. Use `/dm start` to begin a new session.',
          });
          return;
        }

        logger.info(`Creating character ${name} in session ${redisSession.channelId}`);

        const result = await openaiService.addCharacter(
          redisSession.channelId,
          interaction.user.id,
          interaction.user.username,
          name,
          characterClass,
          race,
          background,
          description
        );

        if (result.success) {
          const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Character Created')
            .setDescription(result.message)
            .addFields(
              { name: 'Name', value: name, inline: true },
              { name: 'Class', value: characterClass, inline: true },
              { name: 'Race', value: race, inline: true },
              { name: 'Background', value: background, inline: true }
            );

          await interaction.editReply({ embeds: [embed] });
        } else {
          await interaction.editReply({
            content: `❌ ${result.message}`,
          });
        }
        break;
      }

      case 'add_item': {
        const itemName = interaction.options.getString('item_name', true);
        const description = interaction.options.getString('description', true);
        const quantity = interaction.options.getInteger('quantity') || 1;
        const value = interaction.options.getInteger('value') || 0;
        const type = interaction.options.getString('type') || 'gear';

        await interaction.deferReply();

        // Get Redis session to find voice channel ID
        const allSessions = await sessionManager.getAllSessions();
        const redisSession = allSessions.find(session => 
          session.participants.includes(interaction.user.id) || 
          session.guildId === interaction.guildId
        );
        
        if (!redisSession) {
          await interaction.editReply({
            content: '❌ No active session found. Use `/dm start` to begin a new session.',
          });
          return;
        }

        // Check if user is the session creator (DM)
        if (redisSession.creatorId !== interaction.user.id) {
          await interaction.editReply({
            content: '❌ Only the Dungeon Master can add items.',
          });
          return;
        }

        const item = {
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: itemName,
          description: description,
          quantity: quantity,
          weight: 0,
          value: value,
          rarity: 'common',
          type: type,
          properties: [],
          attunement: false,
          equipped: false,
        };

        // Add item to all players in the session
        for (const participantId of redisSession.participants) {
          await sessionManager.addInventoryItem(redisSession.channelId, participantId, item);
        }

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ Item Added')
          .setDescription(`Added ${itemName} to all players' inventories`)
          .addFields(
            { name: 'Item', value: itemName, inline: true },
            { name: 'Quantity', value: quantity.toString(), inline: true },
            { name: 'Value', value: `${value}gp`, inline: true },
            { name: 'Type', value: type, inline: true }
          );

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'add_currency': {
        const currencyType = interaction.options.getString('currency_type', true);
        const amount = interaction.options.getInteger('amount', true);

        await interaction.deferReply();

        // Get Redis session to find voice channel ID
        const allSessions = await sessionManager.getAllSessions();
        const redisSession = allSessions.find(session => 
          session.participants.includes(interaction.user.id) || 
          session.guildId === interaction.guildId
        );
        
        if (!redisSession) {
          await interaction.editReply({
            content: '❌ No active session found. Use `/dm start` to begin a new session.',
          });
          return;
        }

        // Check if user is the session creator (DM)
        if (redisSession.creatorId !== interaction.user.id) {
          await interaction.editReply({
            content: '❌ Only the Dungeon Master can add currency.',
          });
          return;
        }

        // Add currency to all players in the session
        for (const participantId of redisSession.participants) {
          await sessionManager.updateCharacterCurrency(redisSession.channelId, participantId, currencyType, amount);
        }

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ Currency Added')
          .setDescription(`Added ${amount} ${currencyType} to all players`)
          .addFields(
            { name: 'Currency', value: currencyType, inline: true },
            { name: 'Amount', value: amount.toString(), inline: true }
          );

        await interaction.editReply({ embeds: [embed] });
        break;
      }


    }
  } catch (error) {
    logger.error('Error in DM command:', error);
    
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({
        content: 'There was an error processing your command. Please try again.',
      });
    } else {
      await interaction.reply({
        content: 'There was an error processing your command. Please try again.',
        flags: 64 // Ephemeral flag
      });
    }
  }
}; 