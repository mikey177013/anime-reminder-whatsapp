import { BaseCommand } from '../lib'
import { Message } from '../types'

export default class extends BaseCommand {
    constructor() {
        super({
            name: 'help',
            description: "Displays the bot's available commands",
            cooldown: 10,
            usage: 'help'
        })
    }

    public override execute = async (M: Message): Promise<void> => {
        let text = `Hello ${M.sender.username || ''}! 👋\nBelow are the available commands of the bot:\n`
        for (const cmd of this.client.commands.values()) {
            const { name, cooldown, description, usage } = cmd.config
            const restricted = ['eval', 'block', 'unblock', 'delete']
            const isOwnerOnly = restricted.includes(name)
            if (isOwnerOnly && !this.client.config.owners.includes(M.sender.id)) continue
            text += `\n\n🔵 *Command:* ${this.client.utils.capitalise(name)}\n⚪ *Description:* ${description}\n⚫ *Usage:* ${usage
                .split('||')
                .map((x) => `${this.client.config.prefix}${x.trim()}`)
                .join(' | ')}\n⏰ *Cooldown:* ${cooldown || 3}s`
        }
        await M.reply(text.trim())
    }
}