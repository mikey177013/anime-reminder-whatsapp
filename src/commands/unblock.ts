import { BaseCommand } from '../lib'
import { Message, IParam } from '../types'

export default class extends BaseCommand {
    constructor() {
        super({
            name: 'unblock',
            usage: 'unblock (--id=91xxxxx,62xxxx/mentioning users/replying to a user)',
            cooldown: 10,
            description: "Unblock users from the bot's id."
        })
    }

    public override execute = async (
        M: Message,
        { flags }: IParam
    ): Promise<void> => {
        let users: string[] = []
        let isSkipped = false

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
        users = users.filter(
            (user) =>
                user !== this.client.cleanId(this.client.sock.user?.id || '')
        )

        if (!users.length) {
            return void (await M.reply(
                "Provide users to unblock by mentioning, replying, or using --id=91xxxx (91 is the country code & xxxx is the user's WhatsApp id).\n\n*[You can't unblock the bot itself]*"
            ))
        }

        let text = '🟩 *Unblocked:*'
        for (const id of users) {
            if (!blocklist.includes(id)) {
                isSkipped = true
                continue
            }
            try {
                await this.client.sock.updateBlockStatus(id, 'unblock')
                text += `\n*@${id.split('@')[0]}*`
            } catch {
                isSkipped = true
            }
        }

        await M.reply(
            text.concat(
                isSkipped
                    ? '\n\n🟨 *Note:* Some users were skipped (either not blocked or failed to unblock).'
                    : ''
            ),
            'text',
            users
        )
    }
}