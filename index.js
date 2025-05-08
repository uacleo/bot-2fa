const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection } = require('discord.js');
const { authenticator } = require('otplib');

// Crear cliente del bot
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel],
});

// Configuración
const secret = '2R4EOHYZGJU3U37XUP7CKCK7QBZRLZVZ'; // Tu secreto base32
const dailyLimit = 10; // Cada usuario puede generar 10 códigos
const usageMap = new Collection(); // Aquí se guarda cada usuario y sus usos

const USAGE_FILE = path.join(__dirname, 'usage_data.json');

// Cargar datos anteriores si existen
if (fs.existsSync(USAGE_FILE)) {
    const rawData = fs.readFileSync(USAGE_FILE);
    const data = JSON.parse(rawData);
    for (const [userId, value] of Object.entries(data)) {
        usageMap.set(userId, value);
    }
}

// Guardar datos en archivo
function saveUsageMap() {
    const dataToSave = Object.fromEntries(usageMap.entries());
    fs.writeFileSync(USAGE_FILE, JSON.stringify(dataToSave, null, 4));
}

// Bot listo
client.once('ready', () => {
    console.log('✅ Bot 2FA activo y con límite persistente.');
});

// Comando !2fa para mostrar botón
client.on('messageCreate', async message => {
    if (message.content === '!2fa') {
        const embed = new EmbedBuilder()
            .setTitle('Confirmación de seguridad')
            .setDescription(
                '**Si te encuentras en esta página, puedes continuar para ver tu código de autenticación.**\n' +
                '\n\n' +
                '**ATENCIÓN:** Solo puedes generar hasta **10 códigos por día.**'
            )
            .setColor(0xFEE75C);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('generate_2fa')
                .setLabel('🔐 Revelar código')
                .setStyle(ButtonStyle.Primary)
        );

        await message.channel.send({
            content: 'Requiere confirmación:',
            embeds: [embed],
            components: [row]
        });
    }
});

// Al presionar el botón
client.on('interactionCreate', async interaction => {
    try {
        if (!interaction.isButton()) return;

        const userId = interaction.user.id;
        const now = Date.now();
        const TWENTY_HOURS = 72 * 60 * 60 * 1000; // 20 horas en milisegundos

        if (!usageMap.has(userId)) {
            usageMap.set(userId, { lastReset: now, count: 0 });
        }

        const userData = usageMap.get(userId);

        if (now - userData.lastReset >= TWENTY_HOURS) {
            userData.lastReset = now;
            userData.count = 0;
        }

        if (interaction.customId === 'generate_2fa') {
            if (userData.count >= dailyLimit) {
                await interaction.reply({
                    content: 'Has alcanzado el límite de 10 códigos. Intenta nuevamente más tarde.',
                    ephemeral: true
                });
                return;
            }

            userData.count++;
            usageMap.set(userId, userData);
            saveUsageMap(); // Guardar en archivo

            const code = authenticator.generate(secret);
            const epoch = Math.floor(now / 1000);
            const remaining = 30 - (epoch % 30);
            const expiresAt = Math.floor((now + (remaining * 1000)) / 1000);

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setDescription(
                    '**✅ Código de autenticación generado**\n\n' +
                    '**🔐 Aviso de seguridad**\n' +
                    '`Este código es confidencial. No lo compartas con nadie.`\n\n' +
                    '**📌 2FA Autenticador Código**\n' +
                    `\`\`\`${code}\`\`\`\n` +
                    `**Expira:** <t:${expiresAt}:R>     **Usos restantes hoy:** ${dailyLimit - userData.count}`
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });

            setTimeout(() => {
                interaction.deleteReply().catch(() => {});
            }, remaining * 1000);
        }

    } catch (err) {
        console.error('❗ Error en la interacción:', err);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Ocurrió un error inesperado.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Ocurrió un error inesperado.', ephemeral: true });
        }
    }
});

// Login con tu token
client.login('MTM2OTc5NzgwOTgwMDM1MTc1NA.GZ9fSt.wpyE68EuuG6U3Mj79E_vPGEgZsSZ6j9UGggVHY');






