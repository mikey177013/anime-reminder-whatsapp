import { BaseCommand } from '../lib'
import { AnimeLoader } from '../loaders'
import { IParam, Message } from '../types'

export default class extends BaseCommand {
    constructor() {
        super({
            name: 'unregister',
            cooldown: 20,
            description:
                'Removes anime from the registered anime list of a user/group.',
            usage: 'unregister --id=<mal_id> || unregister --id=<mal_id> --group=true'
        })
    }

    public override execute = async (
        M: Message,
        { flags }: IParam
    ): Promise<void> => {
        if (!flags.id)
            return void (await M.reply(
                `Provide the MAL id of an ongoing anime. Example - *${this.client.config.prefix}unregister --id=51180*`
            ))

        const group =
            flags.group && flags.group === 'true' && M.isGroup ? true : false
        const id = group ? M.from : M.sender.id
        const anime = await this.client.db.getAnime(flags.id)

        if (!anime || !anime.registered.includes(id))
            return void (await M.reply(
                `🟨 Skipped as ${group ? 'this group is' : "you're"} not registered for this anime id.`
            ))

        await this.client.db.pullRegistered(flags.id, id)

        await M.reply(
            `🟩 Successfully removed *${anime.titles.title_eng || anime.titles.title_rom}* from the registered list.`
        )

        const mapData = this.client.store.get('today')
        if (
            !mapData ||
            !mapData.length ||
            !this.client.scheduled.includes(anime.titles.title_rom)
        )
            return void null

        const index = mapData.findIndex(
            (x) => x.title === anime.titles.title_rom
        )
        if (index < 0) return void null

        const regIndex = mapData[index].registered.indexOf(id)
        if (regIndex > -1) mapData[index].registered.splice(regIndex, 1)

        if (!mapData[index].registered.length) {
            mapData.splice(index, 1)
            this.client.scheduled.splice(
                this.client.scheduled.indexOf(anime.titles.title_rom),
                1
            )
            const timeoutId = this.client.timer.get(anime.titles.title_rom)
            if (timeoutId) {
                clearTimeout(timeoutId)
                this.client.timer.delete(anime.titles.title_rom)
            }
        }

        this.client.store.set('today', mapData)
        await new AnimeLoader(this.client).load()
        await this.client.init()
    }
}