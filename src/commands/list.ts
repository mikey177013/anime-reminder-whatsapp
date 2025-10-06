import { Anime } from '@shineiichijo/marika'
import { BaseCommand, MAL_LOGO_URL } from '../lib'
import { Message, IParam } from '../types'

export default class extends BaseCommand {
    constructor() {
        super({
            name: 'list',
            description: "Displays the user's list of registered anime.",
            cooldown: 10,
            usage: 'list (--page=2) | list --for=group'
        })
    }

    public override execute = async (
        M: Message,
        { flags }: IParam
    ): Promise<void> => {
        let page = 1
        if (flags.page && !isNaN(Number(flags.page))) {
            page = Math.max(1, parseInt(flags.page))
        }

        const isGroup = flags.for === 'group' && M.isGroup
        const id = isGroup ? M.from : M.sender.id
        const animeData = await this.client.db.getAnimeList(id)

        if (!animeData?.length) {
            return void (await M.reply(
                `${isGroup ? 'This group has not been' : "You're not"} registered for any anime.`
            ))
        }

        const { pagination, data } = this.client.utils.paginateArray(animeData, 10, page)
        let text = `${isGroup ? 'Group' : M.sender.username}'s registered anime list (${animeData.length} total)\n`

        if (pagination.total_pages > 1) {
            text += `\n📗 *Current Page:* ${page}\n📘 *Total Pages:* ${pagination.total_pages}\n`
        }

        for (const anime of data) {
            const index = animeData.findIndex((a) => a.mal_id === anime.mal_id)
            text += `\n*#${index + 1}*\n${anime.titles.title_eng || anime.titles.title_rom}\n*[Use ${this.client.config.prefix}unregister --id=${anime.mal_id}${isGroup ? ' --group=true' : ''} to remove this anime from ${isGroup ? "the group's" : 'your'} list]*\n`
        }

        const firstAnime = await new Anime().getAnimeById(data[0].mal_id).catch(() => undefined)
        if (!firstAnime) return void (await M.reply('Failed to fetch anime details from MAL.'))

        const { jpg } = firstAnime.images
        const image = await this.client.utils.getBuffer(
            jpg.large_image_url || jpg.image_url || jpg.small_image_url || MAL_LOGO_URL
        )

        await this.client.sock.sendMessage(
            id,
            {
                image,
                caption: text.trim(),
                jpegThumbnail: process.platform === 'win32' ? image.toString('base64') : undefined,
                contextInfo: {
                    externalAdReply: {
                        sourceUrl: firstAnime.url,
                        thumbnail: await this.client.utils.getBuffer(MAL_LOGO_URL),
                        title: 'MyAnimeList',
                        body: firstAnime.title_english || firstAnime.title
                    }
                }
            },
            { quoted: M.message }
        )
    }
}