import { BaseCommand } from '../lib'
import { IParam, Message } from '../types'

export default class extends BaseCommand {
    constructor() {
        super({
            name: 'eval',
            cooldown: 3,
            description: 'Evaluate JavaScript code.',
            usage: 'eval [code]'
        })
    }

    public override execute = async (
        M: Message,
        param: IParam
    ): Promise<void> => {
        let out: string
        try {
            const result = await eval(param.context)
            out = JSON.stringify(
                result === undefined ? 'Evaluated' : result,
                null,
                4
            )
        } catch (err: any) {
            out = err?.message || String(err)
        }
        await M.reply(out)
    }
}