import { AnyMessageContent, MessageType, proto } from '@whiskeysockets/baileys'
import chalk from 'chalk'
import { Client } from '../lib'
import { IParam } from '../types'

export class MessageInteraction {
    constructor(private readonly client: Client) {}

    public handle = async (m: proto.IWebMessageInfo): Promise<void> => {
        if (m.key.fromMe) return

        const M = this.simplify(m)
        if (['senderKeyDistributionMessage', 'protocolMessage'].includes(M.type)) return

        if (!M.isCommand) {
            console.log(
                `${chalk.magentaBright('[MESSAGE]')} - Message from ${chalk.cyan(
                    M.sender.username || M.sender.id.split('@')[0]
                )} in ${chalk.blue(M.isGroup ? M.from : 'DM')}`
            )
            return
        }

        if (!M.text) return
        const blocklist = await this.client.sock.fetchBlocklist()
        if (blocklist.includes(M.sender.id)) return

        const msg = M.text.slice(1).trim()
        const cmd = msg.split(' ')[0].toLowerCase()

        console.log(
            `${chalk.yellowBright('[COMMAND]')} - Command ${chalk.cyan(
                `${this.client.config.prefix}${cmd}`
            )} from ${chalk.cyan(M.sender.username || M.sender.id.split('@')[0])} in ${chalk.blue(M.isGroup ? M.from : 'DM')}`
        )

        const command = this.client.commands.get(cmd)
        if (
            !command ||
            (['eval', 'block', 'unblock', 'delete'].includes(command.config.name) &&
                !this.client.config.owners.includes(M.sender.id))
        ) {
            return void (await M.reply("Can't find any command."))
        }

        const cdKey = `${M.sender.id}:${command.config.name}`
        const cd = this.client.cooldown.get(cdKey)
        if (cd) {
            const remainingS = Math.floor((cd - Date.now()) / 1000)
            return void (await M.reply(
                `You are on cooldown. You can use this command again after ${remainingS} second${remainingS > 1 ? 's' : ''}.`
            ))
        } else {
            const cooldownMs = (command.config.cooldown || 3) * 1000
            this.client.cooldown.set(cdKey, Date.now() + cooldownMs)
            setTimeout(() => this.client.cooldown.delete(cdKey), cooldownMs)
        }

        const param = this.getCommandParams(msg.split(' '))
        try {
            await command.execute(M, param)
        } catch (err: any) {
            console.error(err.message)
        }
    }

    private getCommandParams = (args: string[]): IParam => {
        args.splice(0, 1)
        let context = args.join(' ').trim()
        const flags: { [key: string]: string } = {}
        const data: string[] = []

        args.forEach((arg, i) => {
            const split = arg.split('=')
            if (arg.startsWith('--') && arg.includes('=') && split[1]) {
                flags[split[0].replace('--', '').toLowerCase()] = split[1].toLowerCase()
                data.push(args[i])
            }
        })

        data.forEach((arg) => args.splice(args.indexOf(arg), 1))
        Object.keys(flags).forEach((key) => {
            context = context.replace(`--${key}=${flags[key]}`, '')
        })

        return { args, context: context.trim(), flags }
    }

    private simplify = (m: proto.IWebMessageInfo) => {
        const { key } = m
        const isGroup = key.remoteJid?.endsWith('@g.us') || false
        const messageType =
            m.message?.conversation ||
            m.message?.extendedTextMessage?.text ||
            m.message?.editedMessage?.message
                ? 'text'
                : m.message?.imageMessage
                ? 'image'
                : m.message?.audioMessage
                ? 'audio'
                : m.message?.videoMessage
                ? 'video'
                : 'unknown'

        const text =
            messageType === 'text'
                ? m.message?.conversation || m.message?.extendedTextMessage?.text
                : messageType === 'image' || messageType === 'video'
                ? m.message?.[messageType === 'image' ? 'imageMessage' : 'videoMessage']?.caption
                : undefined

        const type = (Object.keys(m.message || {})[0] as MessageType) || 'conversation'
        const context = m.message?.[type as 'extendedTextMessage']?.contextInfo

        const senderId = isGroup
            ? this.client.cleanId(key.participant || '')
            : this.client.cleanId(key.remoteJid || '')

        const sender = {
            id: senderId,
            username: m.pushName || '',
            isOwner: this.client.config.owners.includes(senderId)
        }

        const rawMentioned = context?.mentionedJid || []
        const mentioned = rawMentioned.filter((x) => x != null)

        const from = key.remoteJid || ''
        let quoted:
            | {
                  sender: { id: string; isOwner: boolean }
                  text?: string
                  message: proto.IMessage
                  key: typeof key
              }
            | undefined = undefined

        if (context?.quotedMessage && context.participant && context.stanzaId) {
            const quotedType = (Object.keys(context.quotedMessage)[0] as MessageType) || 'conversation'
            const quotedText =
                ['imageMessage', 'videoMessage'].includes(quotedType)
                    ? context.quotedMessage?.[quotedType as 'imageMessage']?.caption
                    : quotedType === 'extendedTextMessage'
                    ? context.quotedMessage.extendedTextMessage?.text
                    : quotedType === 'conversation'
                    ? context.quotedMessage.conversation
                    : undefined
            quoted = {
                text: quotedText,
                message: context.quotedMessage,
                key: {
                    remoteJid: from,
                    fromMe: this.client.cleanId(context.participant) === this.client.cleanId(this.client.sock.user?.id || ''),
                    id: context.stanzaId,
                    participant: this.client.cleanId(context.participant)
                },
                sender: {
                    id: this.client.cleanId(context.participant),
                    isOwner: this.client.config.owners.includes(context.participant)
                }
            }
        }

        const reply = async (
            content: string | Buffer,
            type: 'text' | 'image' | 'video' = 'text',
            mentions?: string[],
            caption?: string
        ) => {
            if (type === 'text' && Buffer.isBuffer(content)) throw new Error("Can't send buffer as text.")
            return await this.client.sock.sendMessage(
                from,
                {
                    [type]: content,
                    caption,
                    jpegThumbnail: type === 'image' && process.platform === 'win32' ? (content as Buffer).toString('base64') : undefined,
                    mentions
                } as AnyMessageContent,
                { quoted: m }
            )
        }

        return {
            from,
            sender,
            quoted,
            message: m,
            reply,
            key,
            text,
            type,
            isGroup,
            isCommand: text?.startsWith(this.client.config.prefix) || false,
            mentioned
        }
    }
}