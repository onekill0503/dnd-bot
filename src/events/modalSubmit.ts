import {
  ModalSubmitInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
} from 'discord.js';
import { OpenAIService } from '../services/openai';
import { SessionManager } from '../services/sessionManager';
import { VoiceService } from '../services/voice';
import { logger } from '../utils/logger';

export const name = 'modalSubmit';
export const once = false;
export const execute = async (interaction: any) => {
  try {
    if (interaction.customId === 'character_creation_modal') {
      await handleCharacterCreation(interaction);
    } else if (interaction.customId === 'player_action_modal') {
      await handlePlayerAction(interaction);
    } else if (interaction.customId === 'cast_spell_modal') {
      await handleCastSpell(interaction);
    } else if (interaction.customId === 'generate_encounter_modal') {
      await handleGenerateEncounter(interaction);
    }
  } catch (error) {
    logger.error('Error handling modal submit:', error);
    await interaction.reply({
      content: 'There was an error processing your action.',
      flags: 64, // Ephemeral flag
    });
  }
};

export async function handleCharacterCreation(
  interaction: ModalSubmitInteraction
) {
  try {
    // Defer the reply immediately to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    const sessionId = interaction.channelId!;
    const openaiService = new OpenAIService();
    const sessionManager = (interaction.client as any)
      .sessionManager as SessionManager;
    const username = interaction.user.username || 'Unknown User';
    const userId = interaction.user.id;

    logger.info(
      `Character creation modal submitted in channel ${sessionId} by user ${userId}`
    );

    if (!userId) {
      await interaction.editReply({
        content: '❌ Unable to identify user. Please try again.',
      });
      return;
    }

    // Check Redis session first - search for sessions by voice channel ID
    const allSessions = await sessionManager.getAllSessions();
    const redisSession = allSessions.find(
      session =>
        session.participants.includes(userId) ||
        session.guildId === interaction.guildId
    );

    if (!redisSession) {
      logger.warn(
        `No Redis session found for user ${userId} in guild ${interaction.guildId}`
      );
      await interaction.editReply({
        content: '❌ No active session found. Please start a session first.',
      });
      return;
    }

    // Get session status from OpenAI service using the voice channel ID
    const voiceChannelId = redisSession.channelId;
    logger.info(
      `Looking for OpenAI session with voice channel ID: ${voiceChannelId}`
    );

    const session = await openaiService.getSessionStatus(voiceChannelId);

    if (!session) {
      logger.warn(
        `No OpenAI session found for voice channel ${voiceChannelId}`
      );
      logger.debug(
        `Available OpenAI sessions: ${openaiService.getAllSessionIds()}`
      );
      const sessionDetails = openaiService.getAllSessionDetails();
      logger.debug(`Session details:`, sessionDetails);
      await interaction.editReply({
        content:
          '❌ Session found in Redis but not in OpenAI service. Please restart the session.',
      });
      return;
    }

    if (session.players.has(userId)) {
      await interaction.editReply({
        content: '❌ You have already created a character for this session.',
      });
      return;
    }

    // Add user to Redis session participants using voice channel ID
    await sessionManager.addParticipant(voiceChannelId, userId);

    // Get form data
    const name = interaction.fields.getTextInputValue('character_name');
    const characterClass =
      interaction.fields.getTextInputValue('character_class');
    const race = interaction.fields.getTextInputValue('character_race');
    const background = interaction.fields.getTextInputValue(
      'character_background'
    );
    const description = interaction.fields.getTextInputValue(
      'character_description'
    );

    logger.info(
      `Creating character ${name} (${race} ${characterClass}) for user ${userId} in session ${sessionId}`
    );

    // Validate inputs
    const validClasses = [
      'Barbarian',
      'Bard',
      'Cleric',
      'Druid',
      'Fighter',
      'Monk',
      'Paladin',
      'Ranger',
      'Rogue',
      'Sorcerer',
      'Warlock',
      'Wizard',
    ];

    const validRaces = [
      'Dragonborn',
      'Dwarf',
      'Elf',
      'Gnome',
      'Half-Elf',
      'Half-Orc',
      'Halfling',
      'Human',
      'Tiefling',
    ];

    const validBackgrounds = [
      'Acolyte',
      'Criminal',
      'Folk Hero',
      'Noble',
      'Sage',
      'Soldier',
    ];

    if (!validClasses.includes(characterClass)) {
      await interaction.editReply({
        content: `❌ Invalid class. Please choose from: ${validClasses.join(', ')}`,
      });
      return;
    }

    if (!validRaces.includes(race)) {
      await interaction.editReply({
        content: `❌ Invalid race. Please choose from: ${validRaces.join(', ')}`,
      });
      return;
    }

    if (!validBackgrounds.includes(background)) {
      await interaction.editReply({
        content: `❌ Invalid background. Please choose from: ${validBackgrounds.join(', ')}`,
      });
      return;
    }

    // Add character using the correct method signature
    const result = await openaiService.addCharacter(
      voiceChannelId,
      userId,
      username,
      name,
      characterClass,
      race,
      background,
      description
    );

    if (!result.success) {
      logger.error(`Failed to add character: ${result.message}`);
      await interaction.editReply({
        content: `❌ ${result.message}`,
      });
      return;
    }

    logger.info(
      `Character ${name} created successfully in session ${sessionId}`
    );

    // Create character embed with stats
    const character = result.character!;
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(`🎭 ${name} has joined the adventure!`)
      .addFields(
        { name: 'Class', value: characterClass, inline: true },
        { name: 'Race', value: race, inline: true },
        { name: 'Background', value: background, inline: true },
        { name: 'Level', value: character.level.toString(), inline: true },
        {
          name: 'Hit Points',
          value: character.hitPoints.toString(),
          inline: true,
        },
        {
          name: 'Armor Class',
          value: character.armorClass.toString(),
          inline: true,
        },
        {
          name: 'Strength',
          value: `${character.stats.strength} (${character.stats.strength >= 10 ? '+' : ''}${Math.floor((character.stats.strength - 10) / 2)})`,
          inline: true,
        },
        {
          name: 'Dexterity',
          value: `${character.stats.dexterity} (${character.stats.dexterity >= 10 ? '+' : ''}${Math.floor((character.stats.dexterity - 10) / 2)})`,
          inline: true,
        },
        {
          name: 'Constitution',
          value: `${character.stats.constitution} (${character.stats.constitution >= 10 ? '+' : ''}${Math.floor((character.stats.constitution - 10) / 2)})`,
          inline: true,
        },
        {
          name: 'Intelligence',
          value: `${character.stats.intelligence} (${character.stats.intelligence >= 10 ? '+' : ''}${Math.floor((character.stats.intelligence - 10) / 2)})`,
          inline: true,
        },
        {
          name: 'Wisdom',
          value: `${character.stats.wisdom} (${character.stats.wisdom >= 10 ? '+' : ''}${Math.floor((character.stats.wisdom - 10) / 2)})`,
          inline: true,
        },
        {
          name: 'Charisma',
          value: `${character.stats.charisma} (${character.stats.charisma >= 10 ? '+' : ''}${Math.floor((character.stats.charisma - 10) / 2)})`,
          inline: true,
        },
        { name: 'Alignment', value: character.alignment, inline: true },
        { name: 'Description', value: description, inline: false }
      )
      .setFooter({ text: `Player: ${username}` });

    // Create character stats button
    const statsButton = new ButtonBuilder()
      .setCustomId(`show_stats_${userId}`)
      .setLabel('Show Character Stats')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📊');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      statsButton
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    // Notify the channel about the new character
    const channelEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🎭 New Character Joined!')
      .setDescription(
        `${name} (${race} ${characterClass}) has joined the party!`
      )
      .addFields(
        { name: 'Player', value: username, inline: true },
        { name: 'Background', value: background, inline: true }
      );

    if (interaction.channel && 'send' in interaction.channel) {
      await (interaction.channel as any).send({ embeds: [channelEmbed] });
    }

    // If the game is starting, send a public message
    logger.debug(
      `Session status: ${session.status}, players: ${session.players.size}/${session.maxPlayers}`
    );
    if (
      session.status === 'active' &&
      session.players.size === session.maxPlayers
    ) {
      logger.info(
        `Game starting in session ${sessionId} - all players have joined`
      );

      // Create action button for players
      const actionButton = new ButtonBuilder()
        .setCustomId('player_action')
        .setLabel('Perform Action')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚔️');

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        actionButton
      );

      const gameStartEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎭 Adventure Begins!')
        .setDescription(result.message)
        .addFields(
          {
            name: 'Party Members',
            value: (await openaiService.getSessionCharacters(voiceChannelId))
              .map(c => `- ${c.name} (${c.race} ${c.class})`)
              .join('\n'),
            inline: false,
          },
          {
            name: 'How to Play',
            value:
              'Click the "Perform Action" button below to describe what your character does!',
            inline: false,
          }
        )
        .setFooter({ text: 'Your adventure awaits!' });

      if (interaction.channel && 'send' in interaction.channel) {
        await (interaction.channel as any).send({
          embeds: [gameStartEmbed],
          components: [actionRow],
        });
      }

      // Start voice narration after text has been sent
      if (session.voiceChannelId) {
        try {
          const voiceService = new VoiceService();
          await voiceService.narrateStoryEvent(
            session.voiceChannelId,
            session.guildId || '',
            result.message,
            undefined, // client parameter
            session.language, // language parameter
            sessionId // session ID parameter
          );
        } catch (voiceError) {
          logger.error(
            'Error narrating game start in voice channel:',
            voiceError
          );
        }
      }
    }
  } catch (error) {
    logger.error('Error in character creation modal:', error);

    // Handle interaction timeout errors
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 10062
    ) {
      logger.warn('Interaction timed out - user will need to try again');
      return;
    }

    try {
      await interaction.editReply({
        content:
          'There was an error creating your character. Please try again.',
      });
    } catch (replyError) {
      logger.error('Error sending error reply:', replyError);
    }
  }
}

export async function handlePlayerAction(interaction: ModalSubmitInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const sessionId = interaction.channelId!;
    const openaiService = new OpenAIService();
    const sessionManager = (interaction.client as any)
      .sessionManager as SessionManager;
    const userId = interaction.user.id;

    logger.info(
      `Player action modal submitted in channel ${sessionId} by user ${userId}`
    );

    // Check Redis session first - search for sessions by voice channel ID
    const allSessions = await sessionManager.getAllSessions();
    const redisSession = allSessions.find(
      session =>
        session.participants.includes(userId) ||
        session.guildId === interaction.guildId
    );

    if (!redisSession) {
      logger.warn(
        `No Redis session found for user ${userId} in guild ${interaction.guildId}`
      );
      await interaction.editReply({
        content: '❌ No active session found. Please start a session first.',
      });
      return;
    }

    // Get session status from OpenAI service using the voice channel ID
    const voiceChannelId = redisSession.channelId;
    const session = await openaiService.getSessionStatus(voiceChannelId);

    if (!session) {
      logger.warn(
        `No OpenAI session found for voice channel ${voiceChannelId}`
      );
      await interaction.editReply({
        content:
          '❌ Session found in Redis but not in OpenAI service. Please restart the session.',
      });
      return;
    }

    if (session.status !== 'active') {
      await interaction.editReply({
        content:
          '❌ The game has not started yet. Please wait for all players to join.',
      });
      return;
    }

    // Get the player's action
    const action = interaction.fields.getTextInputValue('player_action');

    logger.info(
      `Processing action: "${action}" for user ${userId} in session ${voiceChannelId}`
    );

    // Track the player action
    const trackResult = await openaiService.trackPlayerAction(
      voiceChannelId,
      userId,
      action
    );

    if (!trackResult.success) {
      await interaction.editReply({
        content: `❌ ${trackResult.message}`,
      });
      return;
    }

    // If all players have acted, continue the story
    if (trackResult.allPlayersActed) {
      logger.info(
        `All players have acted. Continuing story in session ${voiceChannelId}`
      );

      const response =
        await openaiService.continueStoryWithAllActions(voiceChannelId);

      const responseEmbed = new EmbedBuilder()
        .setColor(0x4b0082)
        .setTitle('🎭 Dungeon Master Response')
        .setDescription(response)
        .addFields({
          name: 'Round Complete',
          value: 'All players have acted and the story continues!',
          inline: false,
        });

      await interaction.editReply({
        embeds: [responseEmbed],
      });

      // Send the response to the channel (only once, not duplicated)
      const channelEmbed = new EmbedBuilder()
        .setColor(0x4b0082)
        .setTitle('🎭 Dungeon Master Response')
        .setDescription(response)
        .addFields({
          name: 'Round Complete',
          value: 'All players have acted and the story continues!',
          inline: false,
        });

      if (interaction.channel && 'send' in interaction.channel) {
        await (interaction.channel as any).send({ embeds: [channelEmbed] });
      }

      // Start voice narration after text has been sent
      if (session.voiceChannelId) {
        try {
          await openaiService.narrateStoryResponse(voiceChannelId, response);
        } catch (voiceError) {
          logger.error(
            'Error narrating player action response in voice channel:',
            voiceError
          );
        }
      }

      // Show "Perform Action" button after story event
      const actionButton = new ButtonBuilder()
        .setCustomId('player_action')
        .setLabel('Perform Action')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚔️');

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        actionButton
      );

      const nextActionEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎭 Next Round')
        .setDescription('The story continues! What would you like to do next?')
        .setFooter({
          text: 'Click "Perform Action" to describe what your character does',
        });

      if (interaction.channel && 'send' in interaction.channel) {
        await (interaction.channel as any).send({
          embeds: [nextActionEmbed],
          components: [actionRow],
        });
      }
    } else {
      // Show pending actions status
      const pendingActions =
        await openaiService.getPendingActions(voiceChannelId);
      const pendingList = pendingActions
        .map(pa => `- ${pa.characterName}: ${pa.action}`)
        .join('\n');

      const responseEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Action Recorded')
        .setDescription(trackResult.message)
        .addFields({
          name: 'Pending Actions',
          value: pendingList || 'None',
          inline: false,
        });

      await interaction.editReply({
        embeds: [responseEmbed],
      });

      // Only send to channel if this is the last player (all players have acted)
      // This prevents duplicate messages for each player action
    }
  } catch (error) {
    logger.error('Error in player action modal:', error);

    // Handle interaction timeout errors
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 10062
    ) {
      logger.warn('Interaction timed out - user will need to try again');
      return;
    }

    try {
      await interaction.editReply({
        content: 'There was an error processing your action. Please try again.',
      });
    } catch (replyError) {
      logger.error('Error sending error reply:', replyError);
    }
  }
}

export async function handleCastSpell(interaction: ModalSubmitInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const openaiService = new OpenAIService();
    const sessionManager = (interaction.client as any)
      .sessionManager as SessionManager;
    const userId = interaction.user.id;

    // Find the session
    const allSessions = await sessionManager.getAllSessions();
    const redisSession = allSessions.find(
      session =>
        session.participants.includes(userId) ||
        session.guildId === interaction.guildId
    );
    if (!redisSession) {
      await interaction.editReply({
        content: '❌ No active session found. Please start a session first.',
      });
      return;
    }
    const character = await openaiService.getCharacter(
      redisSession.channelId,
      userId
    );
    if (!character) {
      await interaction.editReply({
        content: '❌ No character found. Create a character first.',
      });
      return;
    }
    if (!character.spellSlots || character.spellSlots.length === 0) {
      await interaction.editReply({
        content: '❌ Your character cannot cast spells.',
      });
      return;
    }
    // Get form data
    const spellName = interaction.fields.getTextInputValue('spell_name');
    const spellLevelStr = interaction.fields.getTextInputValue('spell_level');
    const spellLevel = parseInt(spellLevelStr) || 0;
    // For cantrips (level 0), no spell slot is used
    if (spellLevel === 0) {
      const cantrip = character.cantrips?.find(
        c => c.name.toLowerCase() === spellName.toLowerCase()
      );
      if (!cantrip) {
        await interaction.editReply({
          content: `❌ You don't know the cantrip "${spellName}".`,
        });
        return;
      }
      const embed = new EmbedBuilder()
        .setColor(0x9370db)
        .setTitle(`🔮 Casting Cantrip: ${cantrip.name}`)
        .setDescription(
          `You cast ${cantrip.name}!\n\n**Description:** ${cantrip.description}`
        )
        .addFields(
          { name: 'Casting Time', value: cantrip.castingTime, inline: true },
          { name: 'Range', value: cantrip.range, inline: true },
          { name: 'Duration', value: cantrip.duration, inline: true }
        );
      await interaction.editReply({ embeds: [embed] });
    } else {
      // Check if character has available spell slots
      const spellSlot = character.spellSlots.find(
        slot => slot.level === spellLevel
      );
      if (!spellSlot || spellSlot.available <= 0) {
        await interaction.editReply({
          content: `❌ You don't have any available level ${spellLevel} spell slots.`,
        });
        return;
      }
      // Use a spell slot
      await sessionManager.updateSpellSlots(
        redisSession.channelId,
        userId,
        spellLevel,
        spellSlot.used + 1
      );
      const embed = new EmbedBuilder()
        .setColor(0x9370db)
        .setTitle(`🔮 Casting Spell: ${spellName}`)
        .setDescription(
          `You cast ${spellName} using a level ${spellLevel} spell slot!`
        )
        .addFields(
          { name: 'Spell Level', value: spellLevel.toString(), inline: true },
          {
            name: 'Remaining Slots',
            value: `${spellSlot.available - 1}/${spellSlot.total}`,
            inline: true,
          }
        );
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    logger.error('Error in cast spell modal:', error);
    try {
      await interaction.editReply({
        content: 'There was an error casting your spell. Please try again.',
      });
    } catch (replyError) {
      logger.error('Error sending error reply:', replyError);
    }
  }
}

export async function handleGenerateEncounter(
  interaction: ModalSubmitInteraction
) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const openaiService = new OpenAIService();
    const sessionManager = (interaction.client as any)
      .sessionManager as SessionManager;
    const userId = interaction.user.id;
    // Find the session
    const allSessions = await sessionManager.getAllSessions();
    const redisSession = allSessions.find(
      session =>
        session.participants.includes(userId) ||
        session.guildId === interaction.guildId
    );
    if (!redisSession) {
      await interaction.editReply({
        content: '❌ No active session found. Please start a session first.',
      });
      return;
    }
    // Get form data
    const encounterType = interaction.fields.getTextInputValue(
      'encounter_type'
    ) as 'combat' | 'social' | 'exploration' | 'puzzle';
    const difficulty = (interaction.fields.getTextInputValue('difficulty') ||
      'medium') as 'easy' | 'medium' | 'hard' | 'deadly';
    // Generate the encounter
    const encounter = await openaiService.generateEncounter(
      redisSession.channelId,
      encounterType,
      difficulty
    );
    const embed = new EmbedBuilder()
      .setColor(0xff4500)
      .setTitle(
        `⚔️ ${encounterType.charAt(0).toUpperCase() + encounterType.slice(1)} Encounter`
      )
      .setDescription(encounter)
      .addFields(
        { name: 'Type', value: encounterType, inline: true },
        { name: 'Difficulty', value: difficulty, inline: true }
      );
    await interaction.editReply({ embeds: [embed] });
    // Start voice narration after text has been sent
    try {
      await openaiService.narrateEncounter(redisSession.channelId, encounter);
    } catch (voiceError) {
      logger.error('Error narrating encounter in voice channel:', voiceError);
    }
    // Show "Perform Action" button after encounter
    const actionButton = new ButtonBuilder()
      .setCustomId('player_action')
      .setLabel('Perform Action')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('⚔️');
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      actionButton
    );
    const nextActionEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🎭 Encounter Response')
      .setDescription('How do you respond to this encounter?')
      .setFooter({
        text: 'Click "Perform Action" to describe what your character does',
      });
    if (interaction.channel && 'send' in interaction.channel) {
      await (interaction.channel as any).send({
        embeds: [nextActionEmbed],
        components: [actionRow],
      });
    }
  } catch (error) {
    logger.error('Error in generate encounter modal:', error);
    try {
      await interaction.editReply({
        content:
          'There was an error generating the encounter. Please try again.',
      });
    } catch (replyError) {
      logger.error('Error sending error reply:', replyError);
    }
  }
}
