import { BaseCommand } from '../lib'
import { Message } from '../types'

export default class DeleteCommand extends BaseCommand {
    constructor() {
        super({
            name: 'delete',
            description:
                "Deletes the quoted or replied message (only applicable to bot's messages).",
            cooldown: 10,
            usage: 'delete (by replying to a message sent by the bot)'
        })
    }

    public override execute = async (M: Message): Promise<void> => {
        // Ensure a quoted message exists and is from the bot itself
        if (!M.quoted || !M.quoted.key.fromMe) {
            await M.reply(
                `⚠️ *Invalid action!*\n\n` +
                `Reply to one of *my messages* (sent by the bot) that you want to delete.\n\n` +
                `Example:\n> Reply with *delete* to a message sent by the bot.`
            )
            return
        }

        try {
            await this.client.sock.sendMessage(M.from, {
                delete: M.quoted.key
            })
            await M.reply('✅ Message deleted successfully.')
        } catch (error) {
            console.error('❌ Error deleting message:', error)
            await M.reply('⚠️ Failed to delete the message. Try again later.')
        }
    }
}