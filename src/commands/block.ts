import { BaseCommand } from '../lib'
import { Message, IParam } from '../types'

export default class BlockCommand extends BaseCommand {
    constructor() {
        super({
            name: 'block',
            usage: 'block (--id=91xxxxx,62xxxx / mention / reply)',
            cooldown: 10,
            description:
                "Block users from the bot's WhatsApp ID to make the bot ignore those users."
        })
    }

    public override execute = async (M: Message, { flags }: IParam): Promise<void> => {
        const users: string[] = []
        const failed: string[] = []
        let skipped = false

        // Collect target users
        if (M.mentioned.length) users.push(...M.mentioned)
        if (M.quoted && !M.quoted.key.fromMe) users.push(M.quoted.sender.id)
        if (flags.id) {
            users.push(
                ...flags.id
                    .split(',')
                    .map((x) => x.split('@')[0].concat('@s.whatsapp.net'))
            )
        }

        const blocklist = await this.client.sock.fetchBlocklist()

        // Filter out invalid or restricted users
        const filteredUsers = users.filter((user) => {
            const botId = this.client.cleanId(this.client.sock.user?.id || '')
            const isOwner = this.client.config.owners.includes(user)
            return user !== botId && user !== M.sender.id && !isOwner
        })

        if (!filteredUsers.length) {
            await M.reply(
                `⚠️ *No valid users found to block.*\n\n` +
                `You can block users by:\n` +
                `• Mentioning them\n` +
                `• Replying to one of their messages\n` +
                `• Using: --id=91xxxxxxxx (country code + number)\n\n` +
                `*Note:* You can’t block yourself, an owner, or the bot itself.`
            )
            return
        }

        // Text containers
        let skippedText = '🟨 *Skipped:*'
        let failedText = '🟥 *Failed:*'
        let blockedText = '🟩 *Blocked:*'

        for (const id of filteredUsers) {
            if (blocklist.includes(id)) {
                skippedText += `\n*@${id.split('@')[0]}*`
                skipped = true
                continue
            }

            try {
                await this.client.sock.updateBlockStatus(id, 'block')
                blockedText += `\n*@${id.split('@')[0]}*`
            } catch (err) {
                failed.push(id)
                failedText += `\n*@${id.split('@')[0]}*`
            }
        }

        // Compose final output message
        let resultText = blockedText
        if (skipped)
            resultText += `\n\n${skippedText}\n*[Already blocked users were skipped]*`
        if (failed.length)
            resultText += `\n\n${failedText}\n*[Check IDs — these failed to block]*`

        await M.reply(resultText, 'text', filteredUsers.filter((u) => !failed.includes(u)))
    }
}