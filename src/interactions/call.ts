import { WACallEvent } from '@whiskeysockets/baileys'
import chalk from 'chalk'
import { Client } from '../lib'

export class CallInteraction {
    constructor(private readonly client: Client) {}

    public handle = async (call: WACallEvent): Promise<void> => {
        const caller = call.from.split('@')[0]
        console.log(`${chalk.redBright('[CALL]')} - Incoming call from ${caller}`)

        try {
            await this.client.sock.rejectCall(call.id, call.from)
            console.log(`${chalk.redBright('[CALL]')} - Call rejected!`)

            if (!this.client.config.owners.includes(call.from)) {
                await this.client.sock.updateBlockStatus(call.from, 'block')
                console.log(`${chalk.redBright('[CALL]')} - User blocked!`)
            }
        } catch (err) {
            console.error(`${chalk.redBright('[CALL]')} - Error handling call from ${caller}:`, err)
        }
    }
}